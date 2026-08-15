"""Conversion PDF -> Markdown con Docling.

CLAUDE.md: "preferir parsers de layout (Docling, Marker, MinerU); reservar
LLM solo para escaneados". Docling ya trae su propio OCR para paginas
escaneadas, asi que no hace falta una rama aparte con Gemini todavia — se
agrega despues si en la practica algun PDF no sale bien.
"""
from __future__ import annotations

import hashlib
from pathlib import Path


def convertir_pdf_a_markdown(ruta_pdf: Path) -> str:
    # Import perezoso: docling es pesado (baja modelos de layout la
    # primera vez que corre) — no tiene sentido cargarlo en el arranque
    # de toda la API si nadie esta convirtiendo nada en ese momento.
    from docling.document_converter import DocumentConverter

    conversor = DocumentConverter()
    resultado = conversor.convert(str(ruta_pdf))
    return resultado.document.export_to_markdown()


def calcular_sha256(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()
