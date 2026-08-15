"""Alta de `Candidato` (persona) vinculado a una `Candidatura` -- hasta esta
entrega solo existia `POST /candidaturas` (la lista), no habia forma de
registrar a las personas de esa lista sin SQL a mano."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import Candidato, Candidatura
from app.db.models.enums import EstadoPlanCandidatura
from app.db.session import get_session
from app.main import app
from app.routers.admin import requiere_admin

TABLAS = [Candidatura.__table__, Candidato.__table__]


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine, tables=TABLAS)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session: Session):
    app.dependency_overrides[get_session] = lambda: db_session
    app.dependency_overrides[requiere_admin] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)
    app.dependency_overrides.pop(requiere_admin, None)


def _sembrar_candidatura(session) -> Candidatura:
    candidatura = Candidatura(
        organizacion_politica="Partido X", lista_numero="1", dignidad="alcalde",
        jurisdiccion_dpa="0201", periodo="2027-2031", estado_plan=EstadoPlanCandidatura.registrado,
    )
    session.add(candidatura)
    session.commit()
    session.refresh(candidatura)
    return candidatura


def test_crear_candidato_exitoso(client, db_session):
    candidatura = _sembrar_candidatura(db_session)

    respuesta = client.post(
        f"/api/v1/admin/candidaturas/{candidatura.id}/candidatos",
        json={"nombre": "Ana Torres", "posicion_lista": 1},
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Ana Torres"
    assert cuerpo["candidatura_id"] == candidatura.id


def test_crear_candidato_candidatura_inexistente(client, db_session):
    respuesta = client.post(
        "/api/v1/admin/candidaturas/9999/candidatos",
        json={"nombre": "Ana Torres", "posicion_lista": 1},
    )
    assert respuesta.status_code == 404


def test_crear_candidato_nombre_vacio(client, db_session):
    candidatura = _sembrar_candidatura(db_session)
    respuesta = client.post(
        f"/api/v1/admin/candidaturas/{candidatura.id}/candidatos",
        json={"nombre": "   ", "posicion_lista": 1},
    )
    assert respuesta.status_code == 422


def test_crear_candidato_posicion_invalida(client, db_session):
    candidatura = _sembrar_candidatura(db_session)
    respuesta = client.post(
        f"/api/v1/admin/candidaturas/{candidatura.id}/candidatos",
        json={"nombre": "Ana Torres", "posicion_lista": 0},
    )
    assert respuesta.status_code == 422


def test_listar_candidaturas_incluye_candidatos_ordenados_por_posicion(client, db_session):
    candidatura = _sembrar_candidatura(db_session)
    db_session.add(Candidato(nombre="Segundo", posicion_lista=2, candidatura_id=candidatura.id))
    db_session.add(Candidato(nombre="Primero", posicion_lista=1, candidatura_id=candidatura.id))
    db_session.commit()

    respuesta = client.get("/api/v1/admin/candidaturas")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    nombres = [c["nombre"] for c in cuerpo[0]["candidatos"]]
    assert nombres == ["Primero", "Segundo"]
