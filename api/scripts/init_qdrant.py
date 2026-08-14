"""Crea las cuatro colecciones de Qdrant y sus alias.

Uso: python scripts/init_qdrant.py  (desde api/, con QDRANT_URL en el entorno)

Cada alias apunta a una coleccion fisica versionada (`<alias>_v1`). Para
reindexar sin downtime en el futuro: crear `<alias>_v2`, indexar todo el
contenido ahi, y mover el alias con `update_collection_aliases` — nunca
apuntar la app directamente a un nombre de coleccion versionado.

Idempotente: correrlo de nuevo sobre un Qdrant ya inicializado no falla ni
duplica nada.
"""
from __future__ import annotations

from qdrant_client import QdrantClient, models

from app.config.settings import settings
from app.services.embeddings import EMBEDDING_DIM
from app.services.qdrant_client import (
    ALIAS_ANALISIS_PUBLICADOS,
    ALIAS_CONTEXTO,
    ALIAS_MARCO_LEGAL,
    ALIAS_PLANES_TRABAJO,
    VECTOR_DENSE,
    VECTOR_SPARSE,
)

COLLECTION_VERSION_SUFFIX = "_v1"

ALIASES = [
    ALIAS_MARCO_LEGAL,
    ALIAS_PLANES_TRABAJO,
    ALIAS_CONTEXTO,
    ALIAS_ANALISIS_PUBLICADOS,
]


def _vectors_config() -> dict[str, models.VectorParams]:
    return {
        VECTOR_DENSE: models.VectorParams(
            size=EMBEDDING_DIM,
            distance=models.Distance.COSINE,
        ),
    }


def _sparse_vectors_config() -> dict[str, models.SparseVectorParams]:
    # modifier=IDF: Qdrant aplica el termino de IDF en tiempo de consulta.
    # FastEmbed (services/sparse.py) solo produce term frequency crudo.
    return {
        VECTOR_SPARSE: models.SparseVectorParams(modifier=models.Modifier.IDF),
    }


def _alias_target(client: QdrantClient, alias: str) -> str | None:
    for a in client.get_aliases().aliases:
        if a.alias_name == alias:
            return a.collection_name
    return None


def init_alias(client: QdrantClient, alias: str) -> None:
    collection_name = f"{alias}{COLLECTION_VERSION_SUFFIX}"

    if client.collection_exists(collection_name):
        print(f"  coleccion ya existe: {collection_name}")
    else:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=_vectors_config(),
            sparse_vectors_config=_sparse_vectors_config(),
        )
        print(f"  coleccion creada: {collection_name}")

    if _alias_target(client, alias) == collection_name:
        print(f"  alias ya apunta correctamente: {alias} -> {collection_name}")
        return

    client.update_collection_aliases(
        change_aliases_operations=[
            models.CreateAliasOperation(
                create_alias=models.CreateAlias(
                    collection_name=collection_name, alias_name=alias
                )
            )
        ]
    )
    print(f"  alias apuntado: {alias} -> {collection_name}")


def main() -> None:
    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    for alias in ALIASES:
        print(f"[{alias}]")
        init_alias(client, alias)


if __name__ == "__main__":
    main()
