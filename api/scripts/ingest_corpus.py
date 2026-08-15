#!/usr/bin/env python3
"""CLI manual de ingesta (`make ingest`). La logica real vive en
app/services/ingest.py — la comparte con el endpoint del panel de admin,
para no tener dos implementaciones del chunker/embeddings/git_sha.

Uso (dentro del contenedor api, donde vive /corpus montado desde el repo
hermano lodicho-corpus):

    python scripts/ingest_corpus.py                          # todo el corpus
    python scripts/ingest_corpus.py marco_legal/cootad-1.md   # un archivo

Las rutas son relativas a la raiz del corpus (--corpus-path, default
settings.corpus_path).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.db.session import SessionLocal
from app.services.ingest import DEFAULT_CORPUS_PATH, DIR_POR_TIPO, IngestaError, ingestar_archivo


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
                resumen = ingestar_archivo(archivo, corpus_path, session)
                print(f"[{resumen.doc_id}] {resumen.n_chunks} chunk(s), tipo={resumen.tipo}, git_sha={resumen.git_sha[:10]} — listo.")
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


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
