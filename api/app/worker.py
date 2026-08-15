import asyncio

from arq.connections import RedisSettings

from app.config.settings import settings
from app.services.veredicto_job import ejecutar_generacion_veredicto


async def ping(ctx: dict) -> str:
    """Placeholder: ARQ exige al menos una funcion registrada para poder
    arrancar."""
    return "pong"


async def generar_veredicto(ctx: dict, declaracion_id: int, candidatura_id: int) -> dict:
    """Job real (CLAUDE.md, paso 7). El trabajo -- Gemini, Qdrant,
    SQLAlchemy -- es todo bloqueante; `asyncio.to_thread` evita frenar el
    loop del proceso worker (mismo principio que Docling en `admin.py`)."""
    return await asyncio.to_thread(ejecutar_generacion_veredicto, declaracion_id, candidatura_id)


class WorkerSettings:
    functions = [ping, generar_veredicto]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
