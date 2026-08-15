"""Formateo de eventos Server-Sent Events.

Unico punto del codebase que concatena `"event: "` / `"data: "` a mano —
todo lo demas que emite un evento SSE pasa por aca, para que el framing
(y la serializacion de enums a su `.value` via Pydantic) sea siempre igual.
"""
from __future__ import annotations

from pydantic import BaseModel


def sse_event(evento: str, data: BaseModel) -> str:
    return f"event: {evento}\ndata: {data.model_dump_json()}\n\n"
