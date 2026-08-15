"""`POST /api/v1/veredicto` (SSE) -- Entrega 2: generacion de veredicto.

A diferencia de `consulta.py` (generador SINCRONO, porque todo el trabajo
-- Gemini, Qdrant, SQLAlchemy -- es bloqueante y corre en el proceso API,
envuelto en threadpool por Starlette), aca el trabajo pesado (llamadas a
Gemini Pro con auto-consistencia + verificador de anclaje) corre en el
proceso WORKER via ARQ. Lo unico que hace este generador es `await` sobre
I/O de Redis (encolar el job y esperar su resultado) -- I/O async real, asi
que puede ser `async def` genuino, sin threadpool.

Los dos `session.get()` iniciales son lookups por PK (milisegundos) y
corren directo sobre el loop sin threadpool -- si algun dia se vuelven mas
costosos, envolver en `asyncio.to_thread`.
"""
from __future__ import annotations

import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.db.models import Candidatura, Declaracion
from app.db.session import get_session
from app.schemas.consulta import ErrorEventData, RechazoEventData
from app.schemas.veredicto import VeredictoEventData, VeredictoRequest
from app.services.arq_pool import get_arq_pool
from app.services.sse import sse_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["veredicto"])

VEREDICTO_RESULT_TIMEOUT_SEGUNDOS = 150

MENSAJE_SILENCIO_ELECTORAL = (
    "Silencio electoral activo: solo se permite consultar informes ya publicados."
)
MENSAJE_DECLARACION_NO_ENCONTRADA = "No se encontro la declaracion indicada."
MENSAJE_CANDIDATURA_NO_ENCONTRADA = "No se encontro la candidatura indicada."
MENSAJE_FALLO_VEREDICTO = "No se pudo generar el veredicto. Intenta de nuevo."
MENSAJE_ERROR_INESPERADO = "Ocurrio un error inesperado. Intenta de nuevo."


@router.post("/veredicto")
async def veredicto(
    body: VeredictoRequest,
    session: Session = Depends(get_session),
) -> StreamingResponse:
    return StreamingResponse(
        _generar_stream_veredicto(body.declaracion_id, body.candidatura_id, session),
        media_type="text/event-stream",
    )


async def _generar_stream_veredicto(
    declaracion_id: int,
    candidatura_id: int,
    session: Session,
) -> AsyncGenerator[str, None]:
    try:
        if settings.modo_silencio_electoral:
            yield sse_event("rechazo", RechazoEventData(motivo=MENSAJE_SILENCIO_ELECTORAL))
            return

        declaracion = session.get(Declaracion, declaracion_id)
        if declaracion is None:
            yield sse_event("error", ErrorEventData(detalle=MENSAJE_DECLARACION_NO_ENCONTRADA))
            return

        candidatura = session.get(Candidatura, candidatura_id)
        if candidatura is None:
            yield sse_event("error", ErrorEventData(detalle=MENSAJE_CANDIDATURA_NO_ENCONTRADA))
            return

        try:
            pool = await get_arq_pool()
            job = await pool.enqueue_job("generar_veredicto", declaracion.id, candidatura.id)
            resultado = await job.result(timeout=VEREDICTO_RESULT_TIMEOUT_SEGUNDOS)
        except Exception:
            logger.exception("fallo al generar veredicto (job ARQ)")
            yield sse_event("error", ErrorEventData(detalle=MENSAJE_FALLO_VEREDICTO))
            return

        yield sse_event("veredicto", VeredictoEventData(**resultado))

    except Exception:
        logger.exception("fallo no manejado en /veredicto")
        yield sse_event("error", ErrorEventData(detalle=MENSAJE_ERROR_INESPERADO))
