"""Generacion de veredicto con las tres salvaguardas de CLAUDE.md:
auto-consistencia (3 corridas a temperatura 0.3), verificador de anclaje, y
los dos validadores semanticos de `validadores_informe.py` (el tercero,
sobre indicadores, se resuelve como correccion determinista).

Solo llama a `generacion.generar_structured` -- cero DB, cero Qdrant
directo, 100% testeable con monkeypatch de una secuencia de retornos
controlada.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from app.db.models import Candidatura
from app.db.models.enums import EstadoAnalisis
from app.prompts.generacion_veredicto import (
    PROMPT_GENERACION_VEREDICTO,
    PROMPT_REINTENTO_SUFIJO,
    SYSTEM_INSTRUCTION_VEREDICTO,
    formatear_evidencias_para_prompt,
)
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import InformeContrastacion
from app.services.generacion import GENERATION_MODEL_PRO, generar_structured
from app.services.validadores_informe import (
    aplicar_correccion_requiere_indicador,
    validar_informe,
)
from app.services.verificador_anclaje import verificar_anclaje

N_CORRIDAS_AUTO_CONSISTENCIA = 3
TEMPERATURA_AUTO_CONSISTENCIA = 0.3


@dataclass
class ResultadoVeredicto:
    informe: InformeContrastacion
    estado: EstadoAnalisis
    modelo_usado: str
    payload_extra: dict = field(default_factory=dict)


def _generar_informe(prompt: str) -> InformeContrastacion:
    resultado = generar_structured(
        prompt,
        InformeContrastacion,
        system_instruction=SYSTEM_INSTRUCTION_VEREDICTO,
        model=GENERATION_MODEL_PRO,
        temperature=TEMPERATURA_AUTO_CONSISTENCIA,
    )
    assert isinstance(resultado, InformeContrastacion)
    return resultado


def _elegir_por_mayoria(corridas: list[InformeContrastacion]) -> InformeContrastacion:
    conteo = Counter(c.veredicto for c in corridas)
    veredicto_mayoritario, votos = conteo.most_common(1)[0]
    if votos < 2:
        return corridas[0]
    return next(c for c in corridas if c.veredicto == veredicto_mayoritario)


def generar_veredicto_con_salvaguardas(
    *,
    afirmacion: str,
    evidencias: list[EvidenciaItem],
    candidatura: Candidatura,
    nivel_gobierno: str | None,
) -> ResultadoVeredicto:
    payload_extra: dict = {}

    prompt_base = PROMPT_GENERACION_VEREDICTO.format(
        afirmacion=afirmacion,
        dignidad=candidatura.dignidad,
        nivel_gobierno=nivel_gobierno or "desconocido",
        periodo=candidatura.periodo,
        estado_plan=candidatura.estado_plan.value,
        evidencia_formateada=formatear_evidencias_para_prompt(evidencias),
    )

    corridas = [_generar_informe(prompt_base) for _ in range(N_CORRIDAS_AUTO_CONSISTENCIA)]
    veredictos = [c.veredicto for c in corridas]
    auto_consistencia_ok = len(set(veredictos)) == 1

    if auto_consistencia_ok:
        informe = corridas[0]
    else:
        informe = _elegir_por_mayoria(corridas)
        payload_extra["auto_consistencia"] = {
            "ok": False,
            "veredictos": [v.value for v in veredictos],
        }

    informe, indicador_forzado = aplicar_correccion_requiere_indicador(informe)
    if indicador_forzado:
        payload_extra["indicador_forzado"] = True

    violaciones = validar_informe(informe, evidencias)
    validador_fallido = False

    if violaciones:
        prompt_reintento = prompt_base + PROMPT_REINTENTO_SUFIJO.format(
            violaciones="; ".join(violaciones)
        )
        informe = _generar_informe(prompt_reintento)
        informe, indicador_forzado_reintento = aplicar_correccion_requiere_indicador(informe)
        if indicador_forzado_reintento:
            payload_extra["indicador_forzado"] = True

        violaciones_reintento = validar_informe(informe, evidencias)
        if violaciones_reintento:
            validador_fallido = True
            payload_extra["validador_fallido"] = {
                "violaciones": violaciones_reintento,
                "reintento": True,
            }

    resultado_anclaje = verificar_anclaje(informe, evidencias)
    if not resultado_anclaje.anclado:
        payload_extra["anclaje"] = {
            "ok": False,
            "afirmaciones_sin_sustento": resultado_anclaje.afirmaciones_sin_sustento,
        }

    requiere_revision = not auto_consistencia_ok or validador_fallido or not resultado_anclaje.anclado
    estado = EstadoAnalisis.en_revision if requiere_revision else EstadoAnalisis.borrador

    return ResultadoVeredicto(
        informe=informe,
        estado=estado,
        modelo_usado=GENERATION_MODEL_PRO,
        payload_extra=payload_extra,
    )
