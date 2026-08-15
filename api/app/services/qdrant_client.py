"""Cliente Qdrant.

Cuatro colecciones, siempre accedidas por alias (la dimension del vector
denso es inmutable; el alias permite reindexar a `_v2` y conmutar sin
downtime — ver scripts/init_qdrant.py). Ningun modulo de la app debe pasar
un nombre de coleccion fisico a `collection_name`, solo estas constantes.

Cada punto lleva dos vectores nombrados: `dense` (Gemini, 768, normalizado
L2 — ver services/embeddings.py) y `sparse` (BM25 local — ver
services/sparse.py). La busqueda hibrida fusiona ambos por RRF.
"""
from __future__ import annotations

from qdrant_client import QdrantClient, models

from app.config.settings import settings

ALIAS_MARCO_LEGAL = "marco_legal"
ALIAS_PLANES_TRABAJO = "planes_trabajo"
ALIAS_CONTEXTO = "contexto"
ALIAS_ANALISIS_PUBLICADOS = "analisis_publicados"

VECTOR_DENSE = "dense"
VECTOR_SPARSE = "sparse"

# Cuantos candidatos trae cada rama (dense/sparse) antes de fusionar por
# RRF. Sobre-muestrear es necesario: RRF necesita suficientes candidatos
# por rama para que el ranking fusionado sea significativo.
_PREFETCH_MULTIPLIER = 4

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    return _client


def upsert_point(
    alias: str,
    point_id: str,
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    payload: dict,
) -> None:
    get_client().upsert(
        collection_name=alias,
        points=[
            models.PointStruct(
                id=point_id,
                vector={VECTOR_DENSE: dense_vector, VECTOR_SPARSE: sparse_vector},
                payload=payload,
            )
        ],
    )


def delete_by_doc_id(alias: str, doc_id: str) -> None:
    """Nunca solo upsert: si un documento pasa de 12 a 9 chunks, hay que
    borrar todos los puntos previos de ese doc_id antes de re-indexar, o
    los huerfanos siguen apareciendo en busquedas con contenido viejo."""
    get_client().delete(
        collection_name=alias,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="doc_id", match=models.MatchValue(value=doc_id)
                    )
                ]
            )
        ),
    )


def hybrid_search(
    alias: str,
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    query_filter: models.Filter | None = None,
    limit: int = 10,
) -> list[models.ScoredPoint]:
    """Primitiva generica de busqueda hibrida dense+sparse, fusionada por
    RRF. El filtro se aplica dentro de cada rama del prefetch (asi lo
    exige la Query API de Qdrant cuando se fusiona), nunca despues.

    Para `planes_trabajo`, usar `search_planes_trabajo` en vez de esta
    funcion directamente: ese wrapper hace obligatorio el filtro por
    `candidatura_id` (Regla critica 1 de CLAUDE.md).
    """
    prefetch_limit = limit * _PREFETCH_MULTIPLIER

    result = get_client().query_points(
        collection_name=alias,
        prefetch=[
            models.Prefetch(
                query=dense_vector,
                using=VECTOR_DENSE,
                filter=query_filter,
                limit=prefetch_limit,
            ),
            models.Prefetch(
                query=sparse_vector,
                using=VECTOR_SPARSE,
                filter=query_filter,
                limit=prefetch_limit,
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        limit=limit,
    )
    return result.points


def search_planes_trabajo(
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    candidatura_id: int,
    limit: int = 10,
) -> list[models.ScoredPoint]:
    """Regla critica 1: toda recuperacion sobre planes_trabajo filtra por
    candidatura_id en el cliente Qdrant, nunca delegado al prompt.
    `candidatura_id` no es opcional: recuperar el plan de otra candidatura
    produce un veredicto difamatorio.
    """
    query_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="candidatura_id", match=models.MatchValue(value=candidatura_id)
            )
        ]
    )
    return hybrid_search(
        ALIAS_PLANES_TRABAJO, dense_vector, sparse_vector, query_filter, limit
    )


def search_marco_legal(
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    nivel_gobierno: str,
    vigente: bool = True,
    limit: int = 10,
) -> list[models.ScoredPoint]:
    query_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="nivel_gobierno", match=models.MatchValue(value=nivel_gobierno)
            ),
            models.FieldCondition(key="vigente", match=models.MatchValue(value=vigente)),
        ]
    )
    return hybrid_search(ALIAS_MARCO_LEGAL, dense_vector, sparse_vector, query_filter, limit)


def listar_plan_trabajo(candidatura_id: int, limit: int = 200) -> list[models.Record]:
    """Trae todos los chunks del plan de trabajo de una candidatura via
    `scroll` (sin embedding de consulta): para mostrar el plan completo en
    el perfil publico, no para busqueda semantica. Mismo filtro obligatorio
    por `candidatura_id` que `search_planes_trabajo` (Regla critica 1)."""
    puntos, _ = get_client().scroll(
        collection_name=ALIAS_PLANES_TRABAJO,
        scroll_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="candidatura_id", match=models.MatchValue(value=candidatura_id)
                )
            ]
        ),
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    return puntos


def search_contexto(
    dense_vector: list[float],
    sparse_vector: models.SparseVector,
    jurisdiccion_dpa: str,
    limit: int = 10,
) -> list[models.ScoredPoint]:
    query_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="jurisdiccion_dpa", match=models.MatchValue(value=jurisdiccion_dpa)
            )
        ]
    )
    return hybrid_search(ALIAS_CONTEXTO, dense_vector, sparse_vector, query_filter, limit)
