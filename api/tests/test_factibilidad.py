"""CLAUDE.md: "El score nunca lo genera el LLM... pesos fijos, reproducible,
auditable." `calcular_factibilidad` es Python puro -- sin ningun mock."""
from __future__ import annotations

from decimal import Decimal

from app.schemas.veredicto import (
    CompetenciaLegal,
    ConstaEnPlan,
    FactoresFactibilidad,
    FinanciamientoIdentificado,
    PlazoVsPeriodo,
    PrecedentePresupuestario,
)
from app.services.factibilidad import calcular_factibilidad


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


def test_todos_los_factores_en_el_mejor_valor_da_100():
    assert calcular_factibilidad(_factores()) == Decimal("100.00")


def test_todos_los_factores_en_el_peor_valor_da_0():
    factores = _factores(
        competencia_legal=CompetenciaLegal.sin_competencia,
        consta_en_plan=ConstaEnPlan.no_consta,
        financiamiento_identificado=FinanciamientoIdentificado.ausente,
        plazo_vs_periodo=PlazoVsPeriodo.imposible,
        precedente_presupuestario=PrecedentePresupuestario.ninguno,
    )
    assert calcular_factibilidad(factores) == Decimal("0.00")


def test_pesos_exactos_de_la_rubrica():
    # Solo competencia_legal en el peor valor (peso 35%): 65 puntos de 100.
    factores = _factores(competencia_legal=CompetenciaLegal.sin_competencia)
    assert calcular_factibilidad(factores) == Decimal("65.00")


def test_todos_los_factores_en_el_valor_intermedio_da_50():
    factores = _factores(
        competencia_legal=CompetenciaLegal.concurrente,
        consta_en_plan=ConstaEnPlan.implicito,
        financiamiento_identificado=FinanciamientoIdentificado.mencionado,
        plazo_vs_periodo=PlazoVsPeriodo.ajustado,
        precedente_presupuestario=PrecedentePresupuestario.parcial,
    )
    assert calcular_factibilidad(factores) == Decimal("50.00")
