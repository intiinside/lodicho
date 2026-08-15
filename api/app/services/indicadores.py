"""Tool call de indicadores (CLAUDE.md, "Cifras: nunca por RAG. Los
indicadores estadisticos viven en la tabla `indicadores` y se exponen como
tool call con parametros (`codigo`, `jurisdiccion_dpa`, `anio`)").

Corre ANTES de generar el veredicto (mismo lugar en el pipeline que
`resolucion_candidatura.extraer_nombre_candidato`): el modelo recien decide
si la afirmacion depende de una cifra dentro de `InformeContrastacion`, y
para entonces ya seria tarde para haberle dado el dato.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Indicador
from app.db.models.enums import PasoEvidencia
from app.prompts.extraccion_indicador import PROMPT_EXTRACCION_INDICADOR, formatear_menu_indicadores
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import IndicadorSolicitado
from app.services.generacion import generar_structured


def resolver_indicador(
    session: Session, afirmacion: str, jurisdiccion_dpa: str
) -> EvidenciaItem | None:
    menu = session.execute(
        select(Indicador.codigo, Indicador.descripcion, Indicador.anio)
        .where(Indicador.jurisdiccion_dpa == jurisdiccion_dpa)
        .distinct()
    ).all()
    if not menu:
        # Nada que ofrecer -- no tiene sentido gastar una llamada a Gemini.
        return None

    resultado = generar_structured(
        PROMPT_EXTRACCION_INDICADOR.format(
            afirmacion=afirmacion,
            menu_indicadores=formatear_menu_indicadores([tuple(fila) for fila in menu]),
        ),
        IndicadorSolicitado,
    )
    assert isinstance(resultado, IndicadorSolicitado)

    if not resultado.requiere_cifra or resultado.codigo is None or resultado.anio is None:
        return None

    indicador = session.execute(
        select(Indicador).where(
            Indicador.codigo == resultado.codigo,
            Indicador.jurisdiccion_dpa == jurisdiccion_dpa,
            Indicador.anio == resultado.anio,
        )
    ).scalar_one_or_none()
    if indicador is None:
        return None

    return EvidenciaItem(
        paso=PasoEvidencia.indicadores,
        texto=f"{indicador.descripcion}: {indicador.valor} {indicador.unidad} ({indicador.anio}, fuente: {indicador.fuente})",
        score=1.0,
        doc_id=f"indicador:{indicador.codigo}:{indicador.jurisdiccion_dpa}:{indicador.anio}",
        git_sha="",
        point_id=str(indicador.id),
    )
