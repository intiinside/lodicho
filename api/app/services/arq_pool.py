"""Pool de conexion ARQ compartido por el proceso API (no el worker).

Singleton lazy async con doble-check bajo un lock -- mismo espiritu que
`qdrant_client.get_client()` / `embeddings._get_client()`, adaptado a async
porque `create_pool` de arq es una corutina.
"""
from __future__ import annotations

import asyncio

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config.settings import settings

_pool: ArqRedis | None = None
_lock = asyncio.Lock()


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        async with _lock:
            if _pool is None:
                _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool
