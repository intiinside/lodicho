from arq.connections import RedisSettings

from app.config.settings import settings


async def ping(ctx: dict) -> str:
    """Placeholder: ARQ exige al menos una funcion registrada para poder
    arrancar. Reemplazar/ampliar cuando exista el primer job real (ej.
    generacion de veredicto en background, CLAUDE.md paso 7)."""
    return "pong"


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
