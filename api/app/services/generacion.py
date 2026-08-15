"""Cliente Gemini compartido para salida estructurada (`generate_content`).

Mismo patron de singleton que `embeddings.py`, pero para generacion de texto
con `response_schema` en vez de embeddings. Se centraliza aca porque
`intencion.py` y `resolucion_candidatura.py` necesitan exactamente lo mismo
(prompt + `response_schema` + manejo de errores) y no tiene sentido
triplicar el try/except de fallos de Gemini — cualquier fallo (timeout,
error de API, JSON invalido) se normaliza a `GeminiGenerationError`, el
unico tipo de excepcion que el router necesita atrapar para esta capa.

CLAUDE.md: "Usar response_schema de Gemini + revalidacion Pydantic."
"""
from __future__ import annotations

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config.settings import settings

GENERATION_MODEL_FLASH = "gemini-2.5-flash"

_client: genai.Client | None = None


class GeminiGenerationError(Exception):
    """Cualquier fallo de una llamada a Gemini para salida estructurada."""


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def generar_structured(
    prompt: str,
    response_schema: type[BaseModel],
    *,
    system_instruction: str | None = None,
    model: str = GENERATION_MODEL_FLASH,
) -> BaseModel:
    try:
        response = _get_client().models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                system_instruction=system_instruction,
            ),
        )
        parsed = response.parsed
        if parsed is None:
            raise GeminiGenerationError("Gemini no devolvio una salida estructurada valida.")
        return parsed
    except GeminiGenerationError:
        raise
    except Exception as exc:
        raise GeminiGenerationError(str(exc)) from exc
