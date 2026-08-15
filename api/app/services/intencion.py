"""Clasificacion de intencion de una consulta ciudadana.

CLAUDE.md, regla critica 5: el clasificador rechaza con mensaje fijo (no
generado por el modelo) recomendacion de voto, comparacion de calidad entre
candidatos, y opinion sobre la persona. El modelo Gemini solo puede
devolver una categoria del enum `CategoriaIntencion` (via `response_schema`
en `generacion.generar_structured`); el texto que ve el usuario cuando se
rechaza sale siempre de `MENSAJES_RECHAZO`, nunca de la respuesta del
modelo.
"""
from __future__ import annotations

from app.prompts.clasificacion_intencion import PROMPT_CLASIFICACION_INTENCION
from app.schemas.consulta import CategoriaIntencion, IntencionClasificada
from app.services.generacion import generar_structured

MENSAJES_RECHAZO: dict[CategoriaIntencion, str] = {
    CategoriaIntencion.recomendacion_voto: (
        "Este sistema no hace recomendaciones de voto ni sugiere por quien "
        "votar. Puedes preguntar si una propuesta especifica es viable o "
        "esta en el plan de trabajo registrado."
    ),
    CategoriaIntencion.comparacion_calidad: (
        "Este sistema no emite juicios sobre que candidato es mejor. Puedes "
        "pedir un contraste factual entre propuestas, sin valoracion de "
        "calidad."
    ),
    CategoriaIntencion.opinion_persona: (
        "Este sistema no opina sobre el caracter ni la reputacion de las "
        "personas candidatas. Puedes preguntar sobre una propuesta o "
        "declaracion concreta."
    ),
}


def clasificar_intencion(texto: str) -> CategoriaIntencion:
    resultado = generar_structured(
        PROMPT_CLASIFICACION_INTENCION.format(texto=texto),
        IntencionClasificada,
    )
    assert isinstance(resultado, IntencionClasificada)
    return resultado.categoria
