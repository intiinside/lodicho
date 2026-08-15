"""Prompt del clasificador de intencion.

CLAUDE.md, regla critica 5: el clasificador rechaza con mensaje fijo (no
generado por el modelo) recomendacion de voto, comparacion de calidad entre
candidatos, y opinion sobre la persona. Contrastar propuestas lado a lado si
se permite, sin juicio de calidad. Este prompt solo le pide al modelo UNA
categoria (via `response_schema`); el texto que ve el usuario nunca sale de
aca.
"""
from __future__ import annotations

PROMPT_CLASIFICACION_INTENCION = """\
Clasifica la intencion de la siguiente consulta ciudadana sobre una \
declaracion de un candidato politico, en exactamente una de estas \
categorias:

- contrastacion_declaracion: pide verificar o contrastar UNA declaracion o \
propuesta de UN candidato contra su plan de trabajo y la ley (COOTAD). Es \
el caso por defecto para cualquier declaracion o propuesta puntual.
- comparacion_factual: pide contrastar propuestas de DOS O MAS candidatos \
lado a lado, de forma factual (que dice cada uno, sin juicio de cual es \
mejor).
- recomendacion_voto: pide sugerir, recomendar o decidir por quien votar.
- comparacion_calidad: pide un juicio de calidad entre candidatos (quien es \
mejor, mas capaz, mas honesto, etc.), no un contraste factual.
- opinion_persona: pide una opinion sobre el caracter, la persona o la \
reputacion de un candidato, no sobre una propuesta o declaracion concreta.

Consulta:
\"\"\"
{texto}
\"\"\"

Responde solo con la categoria."""
