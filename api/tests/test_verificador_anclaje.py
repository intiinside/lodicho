"""`verificar_anclaje` es una segunda llamada barata a Flash -- se testea
igual que `intencion.clasificar_intencion`, monkeypatcheando
`generar_structured` en el punto donde se usa."""
from __future__ import annotations

import pytest

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
    ResultadoAnclaje,
)
from app.services import verificador_anclaje
from app.services.generacion import GeminiGenerationError


def _informe() -> InformeContrastacion:
    return InformeContrastacion(
        veredicto=Veredicto.viable_y_en_plan,
        justificacion="justificacion de prueba",
        factores_factibilidad=FactoresFactibilidad(
            competencia_legal=CompetenciaLegal.exclusiva,
            consta_en_plan=ConstaEnPlan.explicito,
            financiamiento_identificado=FinanciamientoIdentificado.con_monto,
            plazo_vs_periodo=PlazoVsPeriodo.holgado,
            precedente_presupuestario=PrecedentePresupuestario.existe,
        ),
        requiere_indicador=False,
        articulos_citados=[],
        es_gestion_no_ejecucion=False,
        confianza="alta",
    )


def _evidencias() -> list[EvidenciaItem]:
    return [EvidenciaItem(paso=PasoEvidencia.marco_legal, texto="art 55", score=0.9, doc_id="cootad", git_sha="abc", point_id="p1")]


def test_verificar_anclaje_devuelve_el_resultado_del_modelo(monkeypatch):
    monkeypatch.setattr(
        verificador_anclaje, "generar_structured", lambda *a, **k: ResultadoAnclaje(anclado=True)
    )

    resultado = verificador_anclaje.verificar_anclaje(_informe(), _evidencias())

    assert resultado.anclado is True


def test_verificar_anclaje_reporta_afirmaciones_sin_sustento(monkeypatch):
    monkeypatch.setattr(
        verificador_anclaje,
        "generar_structured",
        lambda *a, **k: ResultadoAnclaje(anclado=False, afirmaciones_sin_sustento=["algo no anclado"]),
    )

    resultado = verificador_anclaje.verificar_anclaje(_informe(), _evidencias())

    assert resultado.anclado is False
    assert resultado.afirmaciones_sin_sustento == ["algo no anclado"]


def test_verificar_anclaje_propaga_fallo_de_gemini(monkeypatch):
    def _falla(*a, **k):
        raise GeminiGenerationError("timeout")

    monkeypatch.setattr(verificador_anclaje, "generar_structured", _falla)

    with pytest.raises(GeminiGenerationError):
        verificador_anclaje.verificar_anclaje(_informe(), _evidencias())
