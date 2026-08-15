"""Los dos validadores semanticos que corren post-hoc sobre el informe
generado, y la correccion deterministica de `requiere_indicador` -- CLAUDE.md:
"son la salvaguarda principal" (no expresables en JSON Schema)."""
from __future__ import annotations

from app.db.models.enums import PasoEvidencia, Veredicto
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import (
    CompetenciaLegal,
    ConstaEnPlan,
    FactoresFactibilidad,
    FinanciamientoIdentificado,
    InformeContrastacion,
    PlazoVsPeriodo,
    PrecedentePresupuestario,
)
from app.services.validadores_informe import (
    aplicar_correccion_requiere_indicador,
    validar_competencia_exige_articulos,
    validar_informe,
    validar_sin_plan_no_es_ausencia,
)


def _factores(**overrides) -> FactoresFactibilidad:
    base = dict(
        competencia_legal=CompetenciaLegal.exclusiva,
        consta_en_plan=ConstaEnPlan.explicito,
        financiamiento_identificado=FinanciamientoIdentificado.con_monto,
        plazo_vs_periodo=PlazoVsPeriodo.holgado,
        precedente_presupuestario=PrecedentePresupuestario.existe,
    )
    base.update(overrides)
    return FactoresFactibilidad(**base)


def _informe(**overrides) -> InformeContrastacion:
    base = dict(
        veredicto=Veredicto.viable_y_en_plan,
        justificacion="justificacion de prueba",
        factores_factibilidad=_factores(),
        requiere_indicador=False,
        articulos_citados=[],
        es_gestion_no_ejecucion=False,
        confianza="alta",
    )
    base.update(overrides)
    return InformeContrastacion(**base)


def _evidencia(paso: PasoEvidencia) -> EvidenciaItem:
    return EvidenciaItem(paso=paso, texto="texto", score=0.9, doc_id="doc-1", git_sha="abc", point_id="p1")


def test_no_consta_en_plan_sin_evidencia_planes_trabajo_falla():
    informe = _informe(veredicto=Veredicto.no_consta_en_plan)
    resultado = validar_sin_plan_no_es_ausencia(informe, [])
    assert resultado is not None


def test_no_consta_en_plan_con_evidencia_planes_trabajo_pasa():
    informe = _informe(veredicto=Veredicto.no_consta_en_plan)
    resultado = validar_sin_plan_no_es_ausencia(informe, [_evidencia(PasoEvidencia.planes_trabajo)])
    assert resultado is None


def test_otros_veredictos_no_disparan_este_validador():
    informe = _informe(veredicto=Veredicto.viable_y_en_plan)
    assert validar_sin_plan_no_es_ausencia(informe, []) is None


def test_competencia_sin_articulos_ni_marco_legal_falla():
    informe = _informe(
        veredicto=Veredicto.fuera_de_competencia,
        factores_factibilidad=_factores(competencia_legal=CompetenciaLegal.sin_competencia),
        articulos_citados=[],
    )
    resultado = validar_competencia_exige_articulos(informe, [])
    assert resultado is not None


def test_competencia_con_marco_legal_pasa():
    informe = _informe(veredicto=Veredicto.fuera_de_competencia)
    resultado = validar_competencia_exige_articulos(informe, [_evidencia(PasoEvidencia.marco_legal)])
    assert resultado is None


def test_competencia_con_articulos_citados_pasa_sin_evidencia_marco_legal():
    informe = _informe(veredicto=Veredicto.fuera_de_competencia, articulos_citados=["Art. 55"])
    assert validar_competencia_exige_articulos(informe, []) is None


def test_competencia_legal_no_sin_competencia_tambien_dispara_el_validador():
    informe = _informe(
        veredicto=Veredicto.viable_y_en_plan,
        factores_factibilidad=_factores(competencia_legal=CompetenciaLegal.concurrente),
        articulos_citados=[],
    )
    assert validar_competencia_exige_articulos(informe, []) is not None


def test_aplicar_correccion_requiere_indicador_fuerza_incomprobable():
    informe = _informe(veredicto=Veredicto.viable_y_en_plan, requiere_indicador=True)
    corregido, forzado = aplicar_correccion_requiere_indicador(informe)
    assert forzado is True
    assert corregido.veredicto == Veredicto.incomprobable


def test_aplicar_correccion_no_toca_informe_ya_incomprobable():
    informe = _informe(veredicto=Veredicto.incomprobable, requiere_indicador=True)
    corregido, forzado = aplicar_correccion_requiere_indicador(informe)
    assert forzado is False
    assert corregido is informe


def test_aplicar_correccion_no_toca_informe_sin_requiere_indicador():
    informe = _informe(veredicto=Veredicto.viable_y_en_plan, requiere_indicador=False)
    corregido, forzado = aplicar_correccion_requiere_indicador(informe)
    assert forzado is False
    assert corregido is informe


def test_validar_informe_junta_las_violaciones_de_ambos_validadores():
    informe = _informe(
        veredicto=Veredicto.no_consta_en_plan,
        factores_factibilidad=_factores(competencia_legal=CompetenciaLegal.sin_competencia),
    )
    # no_consta_en_plan sin evidencia de planes_trabajo, y competencia_legal
    # es "sin_competencia" asi que ese segundo validador no aplica.
    assert len(validar_informe(informe, [])) == 1


def test_validar_informe_sin_violaciones_retorna_lista_vacia():
    informe = _informe(
        veredicto=Veredicto.viable_y_en_plan,
        factores_factibilidad=_factores(competencia_legal=CompetenciaLegal.sin_competencia),
    )
    assert validar_informe(informe, []) == []
