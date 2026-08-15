"""`sse_event` es el unico punto del codebase que arma el framing SSE a
mano — verificar que produce exactamente `event: ...\\ndata: ...\\n\\n` y
que los enums se serializan a su `.value` (no al nombre Python)."""
from __future__ import annotations

from pydantic import BaseModel

from app.db.models.enums import PasoEvidencia
from app.services.sse import sse_event


class _Dummy(BaseModel):
    paso: PasoEvidencia
    texto: str


def test_sse_event_produce_el_framing_exacto():
    bloque = sse_event("evidencia", _Dummy(paso=PasoEvidencia.marco_legal, texto="hola"))

    assert bloque.startswith("event: evidencia\ndata: ")
    assert bloque.endswith("\n\n")


def test_sse_event_serializa_enum_a_su_value_no_al_nombre():
    bloque = sse_event("evidencia", _Dummy(paso=PasoEvidencia.marco_legal, texto="hola"))

    assert '"paso":"marco_legal"' in bloque
    assert "PasoEvidencia" not in bloque
