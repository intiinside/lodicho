from arq.connections import RedisSettings

from app.config.settings import settings


class WorkerSettings:
    functions: list = []
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
