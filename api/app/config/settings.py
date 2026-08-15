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
    allowed_origins: str = ""  # separados por coma, ej: "https://lodicho.intiinside.com,http://localhost:8000"

    # --- Salvaguarda legal ---
    modo_silencio_electoral: bool = False

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.allowed_origins.split(",") if origen.strip()]


settings = Settings()
