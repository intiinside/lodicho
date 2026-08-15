"""Prompt del verificador de anclaje: segunda llamada barata a Flash que
chequea si cada afirmacion del informe esta sustentada en un chunk de
evidencia citado (CLAUDE.md, "Salvaguardas del veredicto") -- detecta
razonamiento no anclado en la evidencia provista.
"""
from __future__ import annotations

PROMPT_VERIFICADOR_ANCLAJE = """\
A continuacion hay una justificacion generada para un veredicto de \
contrastacion factual, y la evidencia que se le provisto para generarla. \
Tu tarea es verificar si CADA afirmacion factual de la justificacion esta \
sustentada por al menos un fragmento de la evidencia -- no si es correcta \
en terminos absolutos, solo si esta anclada en lo que dice la evidencia.

Justificacion a verificar:
\"\"\"
{justificacion}
\"\"\"

Evidencia disponible:
{evidencia_formateada}

Si toda afirmacion factual esta anclada en la evidencia, responde \
anclado=true. Si alguna afirmacion no tiene sustento en ningun fragmento \
de la evidencia, responde anclado=false y lista esas afirmaciones."""
