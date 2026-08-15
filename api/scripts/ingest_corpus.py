#!/usr/bin/env python3
"""Ingesta manual del corpus (lodicho-corpus) a Qdrant + Postgres.

Uso (dentro del contenedor api, donde vive `/corpus` montado desde el
repo hermano lodicho-corpus):

    python scripts/ingest_corpus.py                          # todo el corpus
    python scripts/ingest_corpus.py marco_legal/cootad-1.md   # un archivo

Las rutas son relativas a la raiz del corpus (--corpus-path, default
/corpus).

Este script hace, en Python, exactamente lo que CLAUDE.md describe para
`/api/v1/ingest` (el endpoint HTTP todavia no existe — esto es la version
manual/local de la misma logica, pensada para reusarse ahi despues):

  1. Parsea el frontmatter de cada .md
  2. Chunkea segun `tipo` (marco_legal: por articulo: planes_trabajo: por
     seccion/eje: contexto: semantico ~500 tokens)
  3. Embeddings densos (Gemini, normalizados L2) + dispersos (BM25) por
     chunk, via los mismos services/ que usa la app en consulta — nunca
     una llamada a Gemini aparte que pueda desincronizarse
  4. Nunca solo upsert: borra los chunks previos de ese doc_id antes de
     insertar los nuevos
  5. Actualiza la fila en `documentos` (Postgres) con git_sha, n_chunks,
     indexado_en, estado

Rechaza ingestar un archivo con cambios sin commitear en lodicho-corpus:
el git_sha debe reflejar exactamente la version del contenido indexado,
o la trazabilidad legal de evidencias.git_sha queda rota.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import yaml
from sqlalchemy import select

from app.db.models import Candidatura, Documento
from app.db.models.enums import EstadoDocumento, TipoDocumento
from app.db.session import SessionLocal
from app.services import embeddings, sparse
from app.services.qdrant_client import (
    ALIAS_CONTEXTO,
    ALIAS_MARCO_LEGAL,
    ALIAS_PLANES_TRABAJO,
    delete_by_doc_id,
    upsert_point,
)

DEFAULT_CORPUS_PATH = Path("/corpus")

DIR_POR_TIPO = {"marco_legal": "marco_legal", "plan_trabajo": "planes_trabajo", "contexto": "contexto"}
ALIAS_POR_TIPO = {"marco_legal": ALIAS_MARCO_LEGAL, "plan_trabajo": ALIAS_PLANES_TRABAJO, "contexto": ALIAS_CONTEXTO}

ARTICULO_RE = re.compile(r"^Art\.\s*(\d+)", re.MULTILINE)
# Solo nivel 1: un eje puede traer subtitulos (## Financiamiento, ## Plazo)
# que describen esa misma propuesta y tienen que quedar en el mismo chunk,
# no fragmentados aparte.
ENCABEZADO_EJE_RE = re.compile(r"^#\s+.+$", re.MULTILINE)

CHARS_POR_TOKEN_APROX = 4  # heuristica gruesa: no hay tokenizer de Gemini local
OBJETIVO_TOKENS_CONTEXTO = 500


class IngestaError(Exception):
    pass


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("archivos", nargs="*", help="Rutas .md relativas a --corpus-path (default: todo el corpus)")
    parser.add_argument("--corpus-path", type=Path, default=DEFAULT_CORPUS_PATH)
    args = parser.parse_args(argv)

    corpus_path = args.corpus_path
    if not corpus_path.is_dir():
        print(f"No existe el directorio del corpus: {corpus_path}", file=sys.stderr)
        return 2

    if args.archivos:
        archivos = [corpus_path / a for a in args.archivos]
    else:
        archivos = sorted(
            p for carpeta in DIR_POR_TIPO.values() for p in (corpus_path / carpeta).glob("*.md")
        )

    if not archivos:
        print("No hay archivos .md para ingestar.")
        return 0

    session = SessionLocal()
    fallos = 0
    try:
        for archivo in archivos:
            try:
                _ingestar_archivo(archivo, corpus_path, session)
            except IngestaError as exc:
                print(f"[ERROR] {archivo}: {exc}", file=sys.stderr)
                session.rollback()
                fallos += 1
            except Exception as exc:  # noqa: BLE001 — reportar y seguir con el resto
                print(f"[ERROR] {archivo}: error inesperado: {exc}", file=sys.stderr)
                session.rollback()
                fallos += 1
    finally:
        session.close()

    total = len(archivos)
    print(f"\n{total - fallos}/{total} documento(s) ingestados correctamente.")
    return 1 if fallos else 0


def _ingestar_archivo(archivo: Path, corpus_path: Path, session) -> None:
    if not archivo.exists():
        raise IngestaError("el archivo no existe")

    texto = archivo.read_text(encoding="utf-8")
    meta, body = _parsear_frontmatter(texto)

    tipo = meta.get("tipo")
    if tipo not in DIR_POR_TIPO:
        raise IngestaError(f"'tipo: {tipo}' invalido o ausente")

    doc_id = meta.get("doc_id")
    if not doc_id:
        raise IngestaError("falta 'doc_id' en el frontmatter")

    if tipo == "plan_trabajo":
        candidatura_id = meta.get("candidatura_id")
        if candidatura_id is None or session.get(Candidatura, candidatura_id) is None:
            raise IngestaError(
                f"candidatura_id={candidatura_id} no existe en la base de datos — registrala antes de ingestar su plan"
            )

    ruta_relativa = str(archivo.relative_to(corpus_path))
    git_sha = _git_sha_del_archivo(corpus_path, ruta_relativa)

    chunks = [c.strip() for c in _chunkear(body, tipo) if c.strip()]
    if not chunks:
        raise IngestaError("no se pudo dividir el documento en chunks (¿esta vacio?)")

    print(f"[{doc_id}] {len(chunks)} chunk(s), tipo={tipo}, git_sha={git_sha[:10]}")

    vectores_densos = embeddings.embed_documents(chunks)
    vectores_dispersos = sparse.embed_documents(chunks)

    alias = ALIAS_POR_TIPO[tipo]
    # Nunca solo upsert: si el doc paso de 12 a 9 chunks, los 3 viejos
    # tienen que desaparecer, no quedar dando vueltas con contenido stale.
    delete_by_doc_id(alias, doc_id)

    for i, (texto_chunk, denso, disperso) in enumerate(zip(chunks, vectores_densos, vectores_dispersos)):
        payload = _payload(meta, tipo, doc_id, texto_chunk, git_sha)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{doc_id}#{i}"))
        upsert_point(alias, point_id, denso, disperso, payload)

    try:
        _actualizar_documento(session, meta, tipo, ruta_relativa, archivo, git_sha, len(chunks))
    except Exception as exc:
        raise IngestaError(
            f"Qdrant ya quedo actualizado, pero fallo el registro en Postgres: {exc}. "
            "Los chunks SI estan indexados; revisa la fila en 'documentos' a mano."
        ) from exc

    print(f"[{doc_id}] listo.")


def _parsear_frontmatter(texto: str) -> tuple[dict, str]:
    if not texto.startswith("---"):
        raise IngestaError("falta el frontmatter (debe empezar con '---')")
    partes = texto.split("---", 2)
    if len(partes) < 3:
        raise IngestaError("frontmatter mal formado: falta el '---' de cierre")
    try:
        meta = yaml.safe_load(partes[1]) or {}
    except yaml.YAMLError as exc:
        raise IngestaError(f"frontmatter no es YAML valido: {exc}") from exc
    if not isinstance(meta, dict):
        raise IngestaError("el frontmatter debe ser un mapeo clave: valor")
    return meta, partes[2].lstrip("\n")


def _git_sha_del_archivo(corpus_path: Path, ruta_relativa: str) -> str:
    sucio = subprocess.run(
        ["git", "-C", str(corpus_path), "status", "--porcelain", "--", ruta_relativa],
        capture_output=True,
        text=True,
    )
    if sucio.stdout.strip():
        raise IngestaError(
            "tiene cambios sin commitear en lodicho-corpus — commitealo antes de ingestar "
            "(el git_sha tiene que reflejar exactamente el contenido que se esta indexando)"
        )

    log = subprocess.run(
        ["git", "-C", str(corpus_path), "log", "-1", "--format=%H", "--", ruta_relativa],
        capture_output=True,
        text=True,
    )
    sha = log.stdout.strip()
    if not sha:
        raise IngestaError("no tiene historial de git en lodicho-corpus — commitealo primero")
    return sha


def _chunkear(body: str, tipo: str) -> list[str]:
    if tipo == "marco_legal":
        return _dividir_por_indices(body, [m.start() for m in ARTICULO_RE.finditer(body)])
    if tipo == "plan_trabajo":
        indices = [m.start() for m in ENCABEZADO_EJE_RE.finditer(body)]
        return _dividir_por_indices(body, indices) if indices else [body]
    return _chunk_semantico(body)


def _dividir_por_indices(body: str, indices: list[int]) -> list[str]:
    if not indices:
        return [body]
    limites = indices + [len(body)]
    return [body[limites[i]:limites[i + 1]] for i in range(len(indices))]


def _chunk_semantico(body: str, objetivo_tokens: int = OBJETIVO_TOKENS_CONTEXTO) -> list[str]:
    """Chunker por parrafos para `contexto`: acumula parrafos hasta cerca
    del objetivo de tokens en vez de cortar a un tamano fijo de caracteres,
    para no partir una idea a la mitad quedando adentro del limite."""
    limite_chars = objetivo_tokens * CHARS_POR_TOKEN_APROX
    parrafos = [p for p in re.split(r"\n\s*\n", body) if p.strip()]

    chunks: list[str] = []
    actual: list[str] = []
    tamano_actual = 0

    for parrafo in parrafos:
        if len(parrafo) > limite_chars:
            if actual:
                chunks.append("\n\n".join(actual))
                actual, tamano_actual = [], 0
            chunks.extend(_dividir_parrafo_largo(parrafo, limite_chars))
            continue

        if tamano_actual + len(parrafo) > limite_chars and actual:
            chunks.append("\n\n".join(actual))
            actual, tamano_actual = [], 0

        actual.append(parrafo)
        tamano_actual += len(parrafo)

    if actual:
        chunks.append("\n\n".join(actual))

    return chunks


def _dividir_parrafo_largo(parrafo: str, limite_chars: int) -> list[str]:
    oraciones = re.split(r"(?<=[.!?])\s+", parrafo)
    chunks, actual, tamano = [], [], 0
    for oracion in oraciones:
        if tamano + len(oracion) > limite_chars and actual:
            chunks.append(" ".join(actual))
            actual, tamano = [], 0
        actual.append(oracion)
        tamano += len(oracion)
    if actual:
        chunks.append(" ".join(actual))
    return chunks


def _payload(meta: dict, tipo: str, doc_id: str, texto: str, git_sha: str) -> dict:
    payload = {"doc_id": doc_id, "texto": texto, "git_sha": git_sha, "tipo": tipo}
    if tipo == "plan_trabajo":
        payload["candidatura_id"] = meta.get("candidatura_id")
        payload["jurisdiccion_dpa"] = meta.get("jurisdiccion_dpa")
    elif tipo == "marco_legal":
        payload["nivel_gobierno"] = meta.get("nivel_gobierno")
        payload["vigente"] = bool(meta.get("vigente", True))
    elif tipo == "contexto":
        payload["jurisdiccion_dpa"] = meta.get("jurisdiccion_dpa")
    return payload


def _actualizar_documento(
    session, meta: dict, tipo: str, ruta_relativa: str, archivo: Path, git_sha: str, n_chunks: int
) -> None:
    doc_id = meta["doc_id"]
    sha256 = hashlib.sha256(archivo.read_bytes()).hexdigest()

    documento = session.execute(select(Documento).where(Documento.doc_id == doc_id)).scalar_one_or_none()
    if documento is None:
        documento = Documento(doc_id=doc_id)
        session.add(documento)

    documento.tipo = TipoDocumento(tipo)
    documento.candidatura_id = meta.get("candidatura_id") if tipo == "plan_trabajo" else None
    documento.ruta_repo = ruta_relativa
    documento.sha256 = sha256
    documento.pdf_sha256 = meta.get("pdf_sha256")
    documento.git_sha = git_sha
    documento.n_chunks = n_chunks
    documento.indexado_en = datetime.now(timezone.utc)
    documento.estado = EstadoDocumento.activo

    session.commit()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
