"""Verificador de anclaje (CLAUDE.md, "Salvaguardas del veredicto"):
segunda llamada barata a Flash que chequea si cada afirmacion del informe
esta sustentada en un chunk de evidencia citado.
"""
from __future__ import annotations

from app.prompts.generacion_veredicto import formatear_evidencias_para_prompt
from app.prompts.verificador_anclaje import PROMPT_VERIFICADOR_ANCLAJE
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import InformeContrastacion, ResultadoAnclaje
from app.services.generacion import GENERATION_MODEL_FLASH, generar_structured


def verificar_anclaje(
    informe: InformeContrastacion, evidencias: list[EvidenciaItem]
) -> ResultadoAnclaje:
    prompt = PROMPT_VERIFICADOR_ANCLAJE.format(
        justificacion=informe.justificacion,
        evidencia_formateada=formatear_evidencias_para_prompt(evidencias),
    )
    resultado = generar_structured(prompt, ResultadoAnclaje, model=GENERATION_MODEL_FLASH)
    assert isinstance(resultado, ResultadoAnclaje)
    return resultado
