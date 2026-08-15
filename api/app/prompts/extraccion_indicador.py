"""Prompt de extraccion de indicador (CLAUDE.md, "Cifras: nunca por RAG"):
le ofrece al modelo un menu CERRADO con los indicadores que realmente
existen en Postgres para la jurisdiccion -- nunca le pide que invente un
codigo o un anio, solo que elija entre lo que ya esta disponible (o que
diga que no aplica ninguno).
"""
from __future__ import annotations

PROMPT_EXTRACCION_INDICADOR = """\
Determina si la siguiente afirmacion depende de una cifra estadistica \
oficial para poder evaluarse, y si es asi, cual de los indicadores \
disponibles abajo corresponde.

Afirmacion:
\"\"\"
{afirmacion}
\"\"\"

Indicadores disponibles (unicas opciones validas -- si ninguno corresponde \
o la afirmacion no depende de una cifra, responde requiere_cifra=false y \
deja codigo/anio en null; NUNCA inventes un codigo o un anio que no este \
en esta lista):
{menu_indicadores}
"""


def formatear_menu_indicadores(indicadores: list[tuple[str, str, int]]) -> str:
    """`indicadores` es una lista de (codigo, descripcion, anio)."""
    return "\n".join(
        f"- codigo={codigo!r}, anio={anio}: {descripcion}" for codigo, descripcion, anio in indicadores
    )
