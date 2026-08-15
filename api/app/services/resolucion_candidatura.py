"""Resolucion de candidatura a partir del texto de una consulta.

Dos pasos: (1) extraer el nombre del candidato mencionado (Gemini), (2)
buscarlo entre `Candidato.nombre` en Postgres. El matching se hace en
Python (normalizando tildes/mayusculas), no con `unaccent` de Postgres:
al volumen de un piloto (candidaturas de una provincia, no un padron
nacional) traer `Candidato JOIN Candidatura` completo y comparar en Python
es simple y no depende de que esa extension este habilitada en el VPS.
Si el censo crece, el punto de escalado natural es indexar
`lower(unaccent(nombre))` en Postgres y mover el filtro a SQL.

Tambien vive aca el mapeo dignidad -> nivel_gobierno: `marco_legal` se
filtra por `nivel_gobierno` (ver `qdrant_client.search_marco_legal`), pero
`Candidatura.dignidad` es texto libre (no hay enum en el modelo, `admin.py`
no lo restringe). El mapeo nunca adivina: una dignidad no reconocida lanza
`NivelGobiernoDesconocidoError` en vez de aproximar un nivel de gobierno.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Candidato, Candidatura
from app.prompts.extraccion_candidato import PROMPT_EXTRACCION_CANDIDATO
from app.schemas.consulta import NombreExtraido
from app.services.generacion import generar_structured

DIGNIDAD_A_NIVEL_GOBIERNO: dict[str, str] = {
    "prefecto": "provincial",
    "viceprefecto": "provincial",
    "alcalde": "cantonal",
    "concejal": "cantonal",
    "concejal_urbano": "cantonal",
    "concejal_rural": "cantonal",
    "vocal_junta_parroquial": "parroquial_rural",
    "presidente_junta_parroquial": "parroquial_rural",
}

FALLBACK_PREFIX = "fallback_"


class NivelGobiernoDesconocidoError(Exception):
    """La dignidad no esta en `DIGNIDAD_A_NIVEL_GOBIERNO`. Nunca se adivina
    un nivel de gobierno: mejor fallar limpio que filtrar marco_legal con
    un valor incorrecto (CLAUDE.md, "regla critica 1" aplica el mismo
    principio de nunca dejar la seguridad del filtro al azar)."""


def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return " ".join(sin_tildes.lower().split())


def extraer_nombre_candidato(texto: str) -> str | None:
    resultado = generar_structured(
        PROMPT_EXTRACCION_CANDIDATO.format(texto=texto),
        NombreExtraido,
    )
    assert isinstance(resultado, NombreExtraido)
    return resultado.nombre_candidato


@dataclass
class CandidaturaCandidata:
    id: int
    nombre: str
    dignidad: str
    organizacion: str


def _emparejar(
    nombre_normalizado: str, filas: list[tuple[Candidato, Candidatura]]
) -> list[CandidaturaCandidata]:
    """Funcion pura (sin DB): dado el nombre ya normalizado y las filas ya
    traidas, decide el matching. Separada de `buscar_candidaturas_por_nombre`
    para poder testearla con listas armadas a mano, sin sesion de DB."""
    vistos: dict[int, CandidaturaCandidata] = {}
    for candidato, candidatura in filas:
        if nombre_normalizado in _normalizar(candidato.nombre):
            vistos.setdefault(
                candidatura.id,
                CandidaturaCandidata(
                    id=candidatura.id,
                    nombre=candidato.nombre,
                    dignidad=candidatura.dignidad,
                    organizacion=candidatura.organizacion_politica,
                ),
            )
    return list(vistos.values())


def buscar_candidaturas_por_nombre(session: Session, nombre: str) -> list[CandidaturaCandidata]:
    filas = session.execute(
        select(Candidato, Candidatura).join(Candidatura, Candidato.candidatura_id == Candidatura.id)
    ).all()
    return _emparejar(_normalizar(nombre), [(c, k) for c, k in filas])


def nivel_gobierno_para_dignidad(dignidad: str) -> str:
    clave = _normalizar(dignidad).replace(" ", "_")
    nivel = DIGNIDAD_A_NIVEL_GOBIERNO.get(clave)
    if nivel is None:
        raise NivelGobiernoDesconocidoError(dignidad)
    return nivel


def es_fallback(candidatura_id_raw: str) -> bool:
    return candidatura_id_raw.startswith(FALLBACK_PREFIX)


def dignidad_desde_fallback(candidatura_id_raw: str) -> str:
    return candidatura_id_raw[len(FALLBACK_PREFIX) :]
