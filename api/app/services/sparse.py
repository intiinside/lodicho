"""Embeddings dispersos BM25 (FastEmbed `Qdrant/bm25`, local, sin costo de API).

Al igual que los embeddings densos tienen un `task_type` asimetrico entre
indexar y consultar, BM25 pondera distinto: el termino de IDF solo tiene
sentido del lado de la consulta. FastEmbed lo modela con dos metodos
separados (`embed` / `query_embed`); replicamos esa misma asimetria aqui
con `embed_documents` / `embed_query` para que el resto de la app nunca
tenga que decidir cual usar.
"""
from __future__ import annotations

from fastembed import SparseEmbedding, SparseTextEmbedding
from qdrant_client import models

SPARSE_MODEL = "Qdrant/bm25"

_model: SparseTextEmbedding | None = None


def _get_model() -> SparseTextEmbedding:
    global _model
    if _model is None:
        _model = SparseTextEmbedding(model_name=SPARSE_MODEL)
    return _model


def _to_sparse_vector(embedding: SparseEmbedding) -> models.SparseVector:
    return models.SparseVector(
        indices=embedding.indices.tolist(),
        values=embedding.values.tolist(),
    )


def embed_documents(texts: list[str]) -> list[models.SparseVector]:
    """Vectores dispersos para indexar (upsert)."""
    if not texts:
        return []
    return [_to_sparse_vector(e) for e in _get_model().embed(texts)]


def embed_query(text: str) -> models.SparseVector:
    """Vector disperso de una consulta."""
    embeddings = list(_get_model().query_embed([text]))
    return _to_sparse_vector(embeddings[0])
