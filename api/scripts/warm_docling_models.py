"""Pre-descarga los modelos de layout/OCR de Docling durante el build de la
imagen.

Sin esto, la primera conversion real de PDF en el panel de admin dispara la
descarga desde HuggingFace en caliente, dentro del request — eso es lo que
supera el `proxy_read_timeout` de nginx y produce el 502/504 documentado en
CLAUDE.md ("Panel de admin" / gotchas operativas). Corriendo una conversion
dummy aca, los modelos quedan cacheados en la capa de la imagen y el
contenedor arranca ya con todo listo.

Uso: python scripts/warm_docling_models.py  (se corre en el build, ver Dockerfile)
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from pypdf import PdfWriter

from app.services.pdf_conversion import convertir_pdf_a_markdown


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        ruta_pdf = Path(tmp) / "warmup.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        with ruta_pdf.open("wb") as f:
            writer.write(f)
        convertir_pdf_a_markdown(ruta_pdf)


if __name__ == "__main__":
    main()
