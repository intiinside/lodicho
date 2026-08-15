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

RUN pip install --no-cache-dir .

# Pre-descarga los modelos de layout/tableformer/OCR de Docling en el
# build, para que no se bajen (y bloqueen el primer request real) la
# primera vez que alguien convierte un PDF en produccion.
RUN docling-tools models download

# Evita que Docling sature todos los cores del VPS con threads en
# competencia con uvicorn/otros procesos.
ENV OMP_NUM_THREADS=4

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]