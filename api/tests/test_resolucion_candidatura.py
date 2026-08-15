"""`_emparejar` y `nivel_gobierno_para_dignidad` son funciones puras a
proposito (sin DB) para poder testearlas con objetos armados a mano. El
caso mas importante aca es que `nivel_gobierno_para_dignidad` nunca
adivina: una dignidad no mapeada debe fallar, no aproximar un nivel de
gobierno al azar (eso filtrarira marco_legal con el articulado
incorrecto)."""
from __future__ import annotations

import pytest

from app.db.models import Candidato, Candidatura
from app.schemas.consulta import NombreExtraido
from app.services import resolucion_candidatura as rc
from app.services.generacion import GeminiGenerationError


def _candidatura(id: int, dignidad: str = "alcalde", organizacion: str = "Partido X") -> Candidatura:
    return Candidatura(
        id=id,
        organizacion_politica=organizacion,
        lista_numero="1",
        dignidad=dignidad,
        jurisdiccion_dpa="0201",
        periodo="2027-2031",
    )


def _candidato(nombre: str, candidatura_id: int) -> Candidato:
    return Candidato(nombre=nombre, candidatura_id=candidatura_id, posicion_lista=1)


def test_normalizar_quita_tildes_mayusculas_y_espacios_dobles():
    assert rc._normalizar("  José    María Ñáñez ") == "jose maria nanez"


def test_emparejar_cero_matches():
    filas = [(_candidato("Ana Torres", 1), _candidatura(1))]

    assert rc._emparejar(rc._normalizar("pedro perez"), filas) == []


def test_emparejar_un_match():
    filas = [(_candidato("José Pérez", 1), _candidatura(1, dignidad="alcalde"))]

    resultado = rc._emparejar(rc._normalizar("perez"), filas)

    assert len(resultado) == 1
    assert resultado[0].id == 1
    assert resultado[0].nombre == "José Pérez"


def test_emparejar_multiples_matches_distintas_candidaturas():
    filas = [
        (_candidato("Juan Perez", 1), _candidatura(1)),
        (_candidato("Ana Perez", 2), _candidatura(2)),
    ]

    resultado = rc._emparejar(rc._normalizar("perez"), filas)

    assert {c.id for c in resultado} == {1, 2}


def test_emparejar_dedupe_por_candidatura_si_dos_candidatos_matchean_la_misma_lista():
    filas = [
        (_candidato("Juan Perez", 1), _candidatura(1)),
        (_candidato("Juana Perez", 1), _candidatura(1)),
    ]

    resultado = rc._emparejar(rc._normalizar("perez"), filas)

    assert len(resultado) == 1


@pytest.mark.parametrize(
    "dignidad,nivel_esperado",
    [
        ("prefecto", "provincial"),
        ("alcalde", "cantonal"),
        ("vocal_junta_parroquial", "parroquial_rural"),
        ("Alcalde", "cantonal"),  # insensible a mayusculas
    ],
)
def test_nivel_gobierno_para_dignidad_valida(dignidad, nivel_esperado):
    assert rc.nivel_gobierno_para_dignidad(dignidad) == nivel_esperado


def test_nivel_gobierno_para_dignidad_desconocida_no_adivina():
    with pytest.raises(rc.NivelGobiernoDesconocidoError):
        rc.nivel_gobierno_para_dignidad("gobernador")


def test_es_fallback():
    assert rc.es_fallback("fallback_alcalde") is True
    assert rc.es_fallback("42") is False


def test_dignidad_desde_fallback():
    assert rc.dignidad_desde_fallback("fallback_vocal_junta_parroquial") == "vocal_junta_parroquial"


def test_extraer_nombre_candidato_devuelve_none_si_gemini_no_encuentra_nombre(monkeypatch):
    monkeypatch.setattr(
        rc, "generar_structured", lambda *a, **k: NombreExtraido(nombre_candidato=None)
    )

    assert rc.extraer_nombre_candidato("una propuesta sin nombre") is None


def test_extraer_nombre_candidato_propaga_fallo_de_gemini(monkeypatch):
    def _falla(*a, **k):
        raise GeminiGenerationError("timeout")

    monkeypatch.setattr(rc, "generar_structured", _falla)

    with pytest.raises(GeminiGenerationError):
        rc.extraer_nombre_candidato("cualquier texto")
