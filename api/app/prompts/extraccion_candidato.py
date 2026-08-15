"""Prompt de extraccion del nombre del candidato mencionado en la consulta.

Solo extrae el nombre tal como aparece en el texto -- no lo normaliza ni lo
completa. El matching contra la base (`resolucion_candidatura.py`) se hace
aparte, en Python, para no depender de que Gemini conozca el padron real de
candidatos.
"""
from __future__ import annotations

PROMPT_EXTRACCION_CANDIDATO = """\
Del siguiente texto, extrae el nombre del candidato o candidata politico \
al que se refiere la declaracion o propuesta, tal como aparece escrito en \
el texto. Si el texto no menciona a ningun candidato por nombre (por \
ejemplo, si solo describe una propuesta sin decir de quien es), responde \
con nombre_candidato en null. No inventes ni completes un nombre que no \
este en el texto.

Texto:
\"\"\"
{texto}
\"\"\"
"""
