from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Postgres ---
    database_url: str = ""

    # --- Redis ---
    redis_url: str = ""

    # --- Qdrant ---
    qdrant_url: str = ""
    qdrant_api_key: str = ""

    # --- Gemini ---
    gemini_api_key: str = ""

    # --- Ingesta (n8n / GitHub webhook) ---
    github_webhook_secret: str = ""
    ingest_api_token: str = ""

    # --- CORS ---
    allowed_origins: str = ""

    # --- Salvaguarda legal ---
    modo_silencio_electoral: bool = False


settings = Settings()
