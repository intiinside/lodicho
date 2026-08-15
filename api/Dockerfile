FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    openssh-client \
    # Docling usa OpenCV para el analisis de layout de cada pagina, que
    # en Debian slim necesita estas libs graficas/X11 aunque no haya
    # ningun display real (headless) — sin ellas falla con
    # "libxcb.so.1: cannot open shared object file" o equivalente.
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libxcb1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY app ./app
COPY alembic.ini .
COPY migrations ./migrations
COPY scripts ./scripts

# Docling arrastra torch como dependencia transitiva (modelos de layout).
# El wheel default de PyPI para torch trae CUDA + cuDNN (~1GB extra) aunque
# este contenedor nunca corre con GPU — eso solo hace el build mas lento y
# mas propenso a timeout de red sin ningun beneficio. Instalar primero la
# variante CPU desde el indice oficial de PyTorch para que el resolver de
# pip la use en vez de bajar la de CUDA al instalar el resto de deps.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir . --extra-index-url https://download.pytorch.org/whl/cpu

# Pre-descarga los modelos de layout/OCR de Docling en el build (ver
# scripts/warm_docling_models.py) para que la primera conversion real no
# la dispare en caliente dentro de un request.
RUN python scripts/warm_docling_models.py

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
