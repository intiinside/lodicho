"""Validadores semanticos de `InformeContrastacion` que no son expresables
en JSON Schema (CLAUDE.md: "son la salvaguarda principal").

Tres validadores en CLAUDE.md:

1. `sin_plan_no_es_ausencia` -- `no_consta_en_plan` solo es valido si hubo
   retrieval exitoso sobre `planes_trabajo`.
2. `veredicto_factico_exige_indicadores` -- una cifra sin indicador que la
   respalde no puede sostener el veredicto. Como el tool call de
   indicadores no existe todavia (Entrega 3), esto se resuelve como
   correccion deterministica en Python (`aplicar_correccion_requiere_indicador`),
   no como un validador que dispara reintento: si el modelo se
   autorreporta `requiere_indicador=True`, se fuerza `incomprobable` sin
   pedirle que regenere nada.
3. `competencia_exige_articulos` -- una evaluacion de competencia legal
   necesita evidencia de `marco_legal` o articulos citados.

Si un validador de la lista `validar_informe` falla, el caller
(`generacion_veredicto.py`) hace un reintento; si vuelve a fallar, persiste
con `estado=en_revision` -- nunca descarta ni bloquea la respuesta.
"""
from __future__ import annotations

from app.db.models.enums import PasoEvidencia, Veredicto
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import CompetenciaLegal, InformeContrastacion


def validar_sin_plan_no_es_ausencia(
    informe: InformeContrastacion, evidencias: list[EvidenciaItem]
) -> str | None:
    if informe.veredicto != Veredicto.no_consta_en_plan:
        return None
    if any(e.paso == PasoEvidencia.planes_trabajo for e in evidencias):
        return None
    return (
        "veredicto=no_consta_en_plan requiere evidencia de planes_trabajo; "
        "no se recupero ninguna."
    )


def validar_competencia_exige_articulos(
    informe: InformeContrastacion, evidencias: list[EvidenciaItem]
) -> str | None:
    evalua_competencia = (
        informe.veredicto == Veredicto.fuera_de_competencia
        or informe.factores_factibilidad.competencia_legal != CompetenciaLegal.sin_competencia
    )
    if not evalua_competencia:
        return None
    tiene_marco_legal = any(e.paso == PasoEvidencia.marco_legal for e in evidencias)
    if tiene_marco_legal or informe.articulos_citados:
        return None
    return (
        "la evaluacion de competencia legal requiere evidencia de marco_legal "
        "o articulos_citados; no hay ninguno de los dos."
    )


def aplicar_correccion_requiere_indicador(
    informe: InformeContrastacion,
) -> tuple[InformeContrastacion, bool]:
    if not informe.requiere_indicador or informe.veredicto == Veredicto.incomprobable:
        return informe, False
    return informe.model_copy(update={"veredicto": Veredicto.incomprobable}), True


def validar_informe(
    informe: InformeContrastacion, evidencias: list[EvidenciaItem]
) -> list[str]:
    violaciones = [
        validar_sin_plan_no_es_ausencia(informe, evidencias),
        validar_competencia_exige_articulos(informe, evidencias),
    ]
    return [v for v in violaciones if v is not None]
