.PHONY: up down logs migrate shell init-qdrant

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
