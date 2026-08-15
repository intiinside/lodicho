.PHONY: up down logs migrate shell init-qdrant init-letsencrypt reload-nginx ingest

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec api alembic upgrade head

shell:
	docker compose exec api bash

init-qdrant:
	docker compose exec api python scripts/init_qdrant.py

# make ingest                                    -> todo el corpus
# make ingest ARGS=marco_legal/cootad-art-1.md    -> un archivo
ingest:
	docker compose exec api python scripts/ingest_corpus.py $(ARGS)

# Correr una sola vez, con `make up` ya corrido y CERTBOT_EMAIL en .env.
init-letsencrypt:
	bash scripts/init-letsencrypt.sh

# El contenedor certbot renueva el certificado en disco solo, pero nginx
# no lo relee sin esto. Conviene un cron periodico corriendo este target.
reload-nginx:
	docker compose exec nginx nginx -s reload
