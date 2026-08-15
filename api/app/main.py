from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.routers import admin, consulta

app = FastAPI(title="Lo Dicho API")

if settings.allowed_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )

app.include_router(admin.router)
app.include_router(consulta.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
