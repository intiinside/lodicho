"""Contratos Pydantic de `/api/v1/veredicto`.

`InformeContrastacion` es el `response_schema` que Gemini Pro debe llenar
(CLAUDE.md: "JSON, nunca Markdown... response_schema de Gemini +
revalidacion Pydantic"). Reusa `Veredicto` de `db/models/enums.py` -- nunca
un enum paralelo.

`VeredictoEventData` es el evento SSE terminal: su forma debe calzar exacto
con lo que `web/js/views/home-view.js` ya sabe leer (`data.veredicto`,
`data.estado`, `data.factibilidad_score`, `data.factibilidad_factores`,
`data.respuesta_candidato`, `data.evidencias`).
"""
from __future__ import annotations

import enum
from typing import Literal

from pydantic import BaseModel

from app.db.models.enums import EstadoAnalisis, Veredicto
from app.schemas.consulta import EvidenciaItem


class CompetenciaLegal(str, enum.Enum):
    exclusiva = "exclusiva"
    concurrente = "concurrente"
    sin_competencia = "sin_competencia"


class ConstaEnPlan(str, enum.Enum):
    explicito = "explicito"
    implicito = "implicito"
    no_consta = "no_consta"


class FinanciamientoIdentificado(str, enum.Enum):
    con_monto = "con_monto"
    mencionado = "mencionado"
    ausente = "ausente"


class PlazoVsPeriodo(str, enum.Enum):
    holgado = "holgado"
    ajustado = "ajustado"
    imposible = "imposible"


class PrecedentePresupuestario(str, enum.Enum):
    existe = "existe"
    parcial = "parcial"
    ninguno = "ninguno"


class FactoresFactibilidad(BaseModel):
    """La rubrica de CLAUDE.md: 5 factores discretos que el LLM llena, con
    pesos fijos (35/20/20/15/10 %) que calcula Python, nunca el modelo."""

    competencia_legal: CompetenciaLegal
    consta_en_plan: ConstaEnPlan
    financiamiento_identificado: FinanciamientoIdentificado
    plazo_vs_periodo: PlazoVsPeriodo
    precedente_presupuestario: PrecedentePresupuestario


class InformeContrastacion(BaseModel):
    """`response_schema` de la llamada a Gemini Pro que genera el veredicto."""

    veredicto: Veredicto
    justificacion: str
    factores_factibilidad: FactoresFactibilidad
    # Auto-reporte del modelo: la afirmacion depende de una cifra
    # estadistica. El tool call de indicadores (CLAUDE.md, "Cifras: nunca
    # por RAG") no existe todavia (Entrega 3) -- mientras tanto,
    # requiere_indicador=True fuerza veredicto=incomprobable en Python
    # (ver services/validadores_informe.py), nunca se inventa una cifra.
    requiere_indicador: bool
    articulos_citados: list[str] = []
    # Matiz competencial (CLAUDE.md): "gestionare X ante quien tiene la
    # competencia" no es lo mismo que "ejecutare X". Marcar mal esto es "el
    # error mas danino del sistema".
    es_gestion_no_ejecucion: bool
    confianza: Literal["alta", "media", "baja"]


class ResultadoAnclaje(BaseModel):
    """`response_schema` del verificador de anclaje (segunda llamada barata
    a Flash): cada afirmacion del informe debe estar sustentada en un chunk
    de evidencia citado."""

    anclado: bool
    afirmaciones_sin_sustento: list[str] = []


class IndicadorSolicitado(BaseModel):
    """`response_schema` del paso de extraccion de indicador. `codigo`/`anio`
    solo pueden ser uno de los que se le ofrecieron como menu cerrado en el
    prompt -- nunca un valor libre inventado por el modelo."""

    requiere_cifra: bool
    codigo: str | None = None
    anio: int | None = None


class VeredictoRequest(BaseModel):
    declaracion_id: int
    candidatura_id: int


class VeredictoEventData(BaseModel):
    veredicto: Veredicto
    estado: EstadoAnalisis
    factibilidad_score: float | None
    factibilidad_factores: dict | None
    respuesta_candidato: str | None
    evidencias: list[EvidenciaItem]
