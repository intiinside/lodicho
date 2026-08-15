"""Recuperacion dirigida de evidencia (RAG) para el camino de evidencia de
`/api/v1/consulta`: `planes_trabajo` (si hay candidatura con plan
registrado) + `marco_legal` (si se conoce el nivel de gobierno).

CLAUDE.md, regla critica 1: `search_planes_trabajo` nunca se llama sin un
`candidatura_id` real. Aca eso se traduce a: solo se llama si `candidatura`
no es None Y su `estado_plan` es `registrado` — si la candidatura no
registro plan, no tiene sentido buscar lo que no existe (evita gastar una
llamada a Qdrant para nada, y evita que alguien confunda ese caso con
`sin_plan_recuperado`, que es un fallo tecnico distinto).

El embedding denso y disperso del texto de la consulta se calculan una sola
vez y se reusan en ambas busquedas.
"""
from __future__ import annotations

from qdrant_client import models as qdrant_models

from app.db.models import Candidatura
from app.db.models.enums import EstadoPlanCandidatura, PasoEvidencia
from app.schemas.consulta import EvidenciaItem
from app.services import embeddings, qdrant_client, sparse

LIMIT_POR_PASO_DEFAULT = 6


def _a_evidencia_item(punto: qdrant_models.ScoredPoint, paso: PasoEvidencia) -> EvidenciaItem:
    payload = punto.payload or {}
    return EvidenciaItem(
        paso=paso,
        texto=payload["texto"],
        score=punto.score,
        doc_id=payload["doc_id"],
        git_sha=payload["git_sha"],
        point_id=str(punto.id),
        fuente_url=payload.get("fuente_url"),
    )


def recuperar_evidencia(
    texto: str,
    *,
    candidatura: Candidatura | None,
    nivel_gobierno: str | None,
    limit_por_paso: int = LIMIT_POR_PASO_DEFAULT,
) -> list[EvidenciaItem]:
    dense_vector = embeddings.embed_query(texto)
    sparse_vector = sparse.embed_query(texto)

    items: list[EvidenciaItem] = []

    if candidatura is not None and candidatura.estado_plan == EstadoPlanCandidatura.registrado:
        puntos = qdrant_client.search_planes_trabajo(
            dense_vector, sparse_vector, candidatura.id, limit=limit_por_paso
        )
        items.extend(_a_evidencia_item(p, PasoEvidencia.planes_trabajo) for p in puntos)

    if nivel_gobierno is not None:
        puntos = qdrant_client.search_marco_legal(
            dense_vector, sparse_vector, nivel_gobierno, limit=limit_por_paso
        )
        items.extend(_a_evidencia_item(p, PasoEvidencia.marco_legal) for p in puntos)

    return items
