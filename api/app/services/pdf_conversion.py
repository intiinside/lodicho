"""Conversion PDF -> Markdown con Docling.

CLAUDE.md: "preferir parsers de layout (Docling, Marker, MinerU); reservar
LLM solo para escaneados". Docling ya trae su propio OCR para paginas
escaneadas, asi que no hace falta una rama aparte con Gemini todavia — se
agrega despues si en la practica algun PDF no sale bien.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

_LINEAS_EN_BLANCO_RE = re.compile(r"\n{3,}")


def convertir_pdf_a_markdown(ruta_pdf: Path) -> str:
    # Import perezoso: docling es pesado (baja modelos de layout la
    # primera vez que corre) — no tiene sentido cargarlo en el arranque
    # de toda la API si nadie esta convirtiendo nada en ese momento.
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling_core.types.doc.common.content_layer import ContentLayer

    # Fijados explicitamente (coinciden con los defaults de docling
    # 2.120.1) para que un futuro upgrade de la libreria no los cambie en
    # silencio: tablas con matching de celdas en modo preciso (los planes
    # de trabajo suelen traer tablas de presupuesto) y OCR activo para
    # paginas escaneadas.
    opciones = PdfPipelineOptions()
    opciones.do_table_structure = True
    opciones.table_structure_options.mode = TableFormerMode.ACCURATE
    opciones.table_structure_options.do_cell_matching = True
    opciones.do_ocr = True

    conversor = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opciones)}
    )
    resultado = conversor.convert(str(ruta_pdf))
    markdown = resultado.document.export_to_markdown(
        # Sin encabezados/pies de pagina repetidos (ContentLayer.FURNITURE)
        # ni marcas de agua/fondo — solo el cuerpo real del documento.
        included_content_layers={ContentLayer.BODY},
        # "" en vez del placeholder "<!-- image -->": una imagen sin
        # descripcion no aporta nada a un documento de texto y ensucia el
        # markdown que despues se chunkea para RAG.
        image_placeholder="",
    )
    return _limpiar_markdown(markdown)


def _limpiar_markdown(markdown: str) -> str:
    lineas = [linea.rstrip() for linea in markdown.split("\n")]
    return _LINEAS_EN_BLANCO_RE.sub("\n\n", "\n".join(lineas)).strip() + "\n"


def calcular_sha256(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()
