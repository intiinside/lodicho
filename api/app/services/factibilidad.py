"""Calculo del score de factibilidad.

CLAUDE.md: "El score nunca lo genera el LLM. El modelo llena factores
discretos; Python calcula el numero con pesos fijos. Reproducible,
auditable, explicable." Funcion pura, sin ningun mock necesario para
testear.
"""
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

# Cada factor tiene tres niveles: mejor=100, intermedio=50, peor=0.
VALOR_FACTOR: dict[object, int] = {
    CompetenciaLegal.exclusiva: 100,
    CompetenciaLegal.concurrente: 50,
    CompetenciaLegal.sin_competencia: 0,
    ConstaEnPlan.explicito: 100,
    ConstaEnPlan.implicito: 50,
    ConstaEnPlan.no_consta: 0,
    FinanciamientoIdentificado.con_monto: 100,
    FinanciamientoIdentificado.mencionado: 50,
    FinanciamientoIdentificado.ausente: 0,
    PlazoVsPeriodo.holgado: 100,
    PlazoVsPeriodo.ajustado: 50,
    PlazoVsPeriodo.imposible: 0,
    PrecedentePresupuestario.existe: 100,
    PrecedentePresupuestario.parcial: 50,
    PrecedentePresupuestario.ninguno: 0,
}

# Pesos exactos de la rubrica de CLAUDE.md. Suman 1.00.
PESOS_FACTIBILIDAD: dict[str, Decimal] = {
    "competencia_legal": Decimal("0.35"),
    "consta_en_plan": Decimal("0.20"),
    "financiamiento_identificado": Decimal("0.20"),
    "plazo_vs_periodo": Decimal("0.15"),
    "precedente_presupuestario": Decimal("0.10"),
}


def calcular_factibilidad(factores: FactoresFactibilidad) -> Decimal:
    total = Decimal("0")
    for campo, peso in PESOS_FACTIBILIDAD.items():
        valor = VALOR_FACTOR[getattr(factores, campo)]
        total += Decimal(valor) * peso
    return total.quantize(Decimal("0.01"))
