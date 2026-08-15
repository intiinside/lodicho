"""`generar_veredicto_con_salvaguardas` es el corazon de las tres
salvaguardas de CLAUDE.md (auto-consistencia, validadores+reintento,
verificador de anclaje). Solo llama a `generar_structured` y
`verificar_anclaje`, ambos parcheados aca -- cero DB, cero Qdrant, cero red."""
from __future__ import annotations

import pytest

from app.db.models import Candidatura
from app.db.models.enums import EstadoAnalisis, EstadoPlanCandidatura, PasoEvidencia, Veredicto
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
from app.services import generacion_veredicto as gv
from app.services.generacion import GeminiGenerationError


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


def _candidatura() -> Candidatura:
    return Candidatura(
        id=1,
        organizacion_politica="Partido X",
        lista_numero="1",
        dignidad="alcalde",
        jurisdiccion_dpa="0201",
        periodo="2027-2031",
        estado_plan=EstadoPlanCandidatura.registrado,
    )


def _evidencias() -> list[EvidenciaItem]:
    return [
        EvidenciaItem(paso=PasoEvidencia.planes_trabajo, texto="eje vial", score=0.9, doc_id="plan-1", git_sha="abc", point_id="p1"),
        EvidenciaItem(paso=PasoEvidencia.marco_legal, texto="art 55", score=0.8, doc_id="cootad", git_sha="def", point_id="p2"),
    ]


def _secuencia(*informes: InformeContrastacion):
    cola = list(informes)

    def _fake(*a, **k):
        if not cola:
            raise AssertionError("se llamo a generar_structured mas veces de las esperadas")
        return cola.pop(0)

    return _fake


def _mockear_anclaje(monkeypatch, anclado=True, afirmaciones_sin_sustento=None):
    monkeypatch.setattr(
        gv,
        "verificar_anclaje",
        lambda *a, **k: ResultadoAnclaje(
            anclado=anclado, afirmaciones_sin_sustento=afirmaciones_sin_sustento or []
        ),
    )


def _generar(monkeypatch, **kwargs):
    return gv.generar_veredicto_con_salvaguardas(
        afirmacion="una propuesta",
        evidencias=_evidencias(),
        candidatura=_candidatura(),
        nivel_gobierno="cantonal",
        **kwargs,
    )


def test_tres_corridas_consistentes_da_borrador_sin_nota_de_auto_consistencia(monkeypatch):
    informe = _informe()
    monkeypatch.setattr(gv, "generar_structured", _secuencia(informe, informe, informe))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = _generar(monkeypatch)

    assert resultado.estado == EstadoAnalisis.borrador
    assert "auto_consistencia" not in resultado.payload_extra


def test_tres_corridas_divergentes_da_en_revision_con_nota(monkeypatch):
    a = _informe(veredicto=Veredicto.viable_y_en_plan)
    b = _informe(veredicto=Veredicto.fuera_de_competencia, articulos_citados=["Art. 55"])
    c = _informe(veredicto=Veredicto.incomprobable)
    monkeypatch.setattr(gv, "generar_structured", _secuencia(a, b, c))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = _generar(monkeypatch)

    assert resultado.estado == EstadoAnalisis.en_revision
    assert resultado.payload_extra["auto_consistencia"]["ok"] is False
    assert len(resultado.payload_extra["auto_consistencia"]["veredictos"]) == 3


def test_dos_de_tres_coinciden_elige_la_mayoria(monkeypatch):
    mayoria = _informe(veredicto=Veredicto.viable_y_en_plan)
    minoria = _informe(veredicto=Veredicto.incomprobable)
    monkeypatch.setattr(gv, "generar_structured", _secuencia(minoria, mayoria, mayoria))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = _generar(monkeypatch)

    assert resultado.informe.veredicto == Veredicto.viable_y_en_plan
    assert resultado.estado == EstadoAnalisis.en_revision  # sigue sin ser consistente


def test_requiere_indicador_fuerza_incomprobable_en_las_tres_corridas(monkeypatch):
    informe = _informe(requiere_indicador=True)
    monkeypatch.setattr(gv, "generar_structured", _secuencia(informe, informe, informe))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = _generar(monkeypatch)

    assert resultado.informe.veredicto == Veredicto.incomprobable
    assert resultado.payload_extra["indicador_forzado"] is True
    assert resultado.estado == EstadoAnalisis.borrador


def test_validador_falla_y_el_reintento_corrige(monkeypatch):
    # competencia_legal=sin_competencia en ambos para no disparar tambien
    # el validador de competencia (aislar el escenario al validador de
    # "no_consta_en_plan sin evidencia de planes_trabajo").
    factores_sin_competencia = _factores(competencia_legal=CompetenciaLegal.sin_competencia)
    invalido = _informe(veredicto=Veredicto.no_consta_en_plan, factores_factibilidad=factores_sin_competencia)
    valido = _informe(veredicto=Veredicto.viable_y_en_plan, factores_factibilidad=factores_sin_competencia)
    monkeypatch.setattr(gv, "generar_structured", _secuencia(invalido, invalido, invalido, valido))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = gv.generar_veredicto_con_salvaguardas(
        afirmacion="una propuesta",
        evidencias=[],  # sin planes_trabajo -> no_consta_en_plan es invalido
        candidatura=_candidatura(),
        nivel_gobierno="cantonal",
    )

    assert resultado.informe.veredicto == Veredicto.viable_y_en_plan
    assert "validador_fallido" not in resultado.payload_extra
    # Las 3 corridas iniciales son identicas (mismo objeto invalido
    # repetido) -> auto_consistencia_ok=True; el reintento corrige el
    # validador sin afectar esa bandera -> estado final borrador.
    assert resultado.estado == EstadoAnalisis.borrador


def test_validador_falla_y_persiste_tras_reintento(monkeypatch):
    factores_sin_competencia = _factores(competencia_legal=CompetenciaLegal.sin_competencia)
    invalido = _informe(veredicto=Veredicto.no_consta_en_plan, factores_factibilidad=factores_sin_competencia)
    monkeypatch.setattr(gv, "generar_structured", _secuencia(invalido, invalido, invalido, invalido))
    _mockear_anclaje(monkeypatch, anclado=True)

    resultado = gv.generar_veredicto_con_salvaguardas(
        afirmacion="una propuesta",
        evidencias=[],
        candidatura=_candidatura(),
        nivel_gobierno="cantonal",
    )

    assert resultado.estado == EstadoAnalisis.en_revision
    assert resultado.payload_extra["validador_fallido"]["reintento"] is True


def test_anclaje_falla_fuerza_en_revision(monkeypatch):
    informe = _informe()
    monkeypatch.setattr(gv, "generar_structured", _secuencia(informe, informe, informe))
    _mockear_anclaje(monkeypatch, anclado=False, afirmaciones_sin_sustento=["algo suelto"])

    resultado = _generar(monkeypatch)

    assert resultado.estado == EstadoAnalisis.en_revision
    assert resultado.payload_extra["anclaje"]["ok"] is False


def test_fallo_tecnico_de_gemini_se_propaga(monkeypatch):
    def _falla(*a, **k):
        raise GeminiGenerationError("timeout")

    monkeypatch.setattr(gv, "generar_structured", _falla)

    with pytest.raises(GeminiGenerationError):
        _generar(monkeypatch)
