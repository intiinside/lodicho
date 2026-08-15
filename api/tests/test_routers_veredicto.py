"""Tests de integracion de `POST /api/v1/veredicto`: Redis/ARQ se reemplaza
por un pool falso (monkeypatch de `get_arq_pool`), Postgres por SQLite en
memoria -- igual patron que `test_routers_consulta.py`."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config.settings import settings
from app.db.base import Base
from app.db.models import Candidato, Candidatura, Consulta, Declaracion
from app.db.models.enums import EstadoPlanCandidatura, TipoDeclaracion, TipoInput
from app.db.session import get_session
from app.main import app

TABLAS = [Candidatura.__table__, Candidato.__table__, Consulta.__table__, Declaracion.__table__]


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
    def _override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_session, None)


def _parse_eventos(texto_sse: str) -> list[tuple[str, dict]]:
    eventos = []
    for bloque in texto_sse.strip().split("\n\n"):
        if not bloque.strip():
            continue
        evento = "message"
        data_lineas = []
        for linea in bloque.split("\n"):
            if linea.startswith("event:"):
                evento = linea[len("event:") :].strip()
            elif linea.startswith("data:"):
                data_lineas.append(linea[len("data:") :].strip())
        eventos.append((evento, json.loads("\n".join(data_lineas))))
    return eventos


def _sembrar(session):
    candidatura = Candidatura(
        organizacion_politica="Partido X", lista_numero="1", dignidad="alcalde",
        jurisdiccion_dpa="0201", periodo="2027-2031", estado_plan=EstadoPlanCandidatura.registrado,
    )
    session.add(candidatura)
    session.flush()
    consulta = Consulta(tipo_input=TipoInput.texto, texto="una propuesta", desde_cache=False)
    session.add(consulta)
    session.flush()
    declaracion = Declaracion(
        consulta_id=consulta.id, texto="una propuesta",
        tipo=TipoDeclaracion.dictado_usuario, atribuible=True,
    )
    session.add(declaracion)
    session.commit()
    return candidatura, declaracion


class _FakeJob:
    def __init__(self, resultado=None, excepcion=None):
        self._resultado = resultado
        self._excepcion = excepcion

    async def result(self, timeout=None):
        if self._excepcion:
            raise self._excepcion
        return self._resultado


class _FakePool:
    def __init__(self, resultado=None, excepcion=None):
        self._resultado = resultado
        self._excepcion = excepcion
        self.llamadas = []

    async def enqueue_job(self, nombre, *args):
        self.llamadas.append((nombre, args))
        return _FakeJob(self._resultado, self._excepcion)


def _resultado_ok(declaracion_id=None, candidatura_id=None):
    return {
        "veredicto": "viable_y_en_plan",
        "estado": "borrador",
        "factibilidad_score": 87.5,
        "factibilidad_factores": {"competencia_legal": "exclusiva"},
        "respuesta_candidato": None,
        "evidencias": [
            {"paso": "marco_legal", "texto": "art 55", "score": 0.9, "doc_id": "cootad", "git_sha": "abc", "point_id": "p1"}
        ],
    }


def _post_veredicto(client, declaracion_id, candidatura_id):
    return client.post(
        "/api/v1/veredicto",
        json={"declaracion_id": declaracion_id, "candidatura_id": candidatura_id},
    )


def test_silencio_electoral_activo_produce_solo_rechazo(client, db_session, monkeypatch):
    candidatura, declaracion = _sembrar(db_session)
    monkeypatch.setattr(settings, "modo_silencio_electoral", True)

    respuesta = _post_veredicto(client, declaracion.id, candidatura.id)
    eventos = _parse_eventos(respuesta.text)

    assert [e[0] for e in eventos] == ["rechazo"]


def test_declaracion_inexistente_produce_error(client, db_session):
    candidatura, _ = _sembrar(db_session)
    respuesta = _post_veredicto(client, 9999, candidatura.id)
    eventos = _parse_eventos(respuesta.text)
    assert [e[0] for e in eventos] == ["error"]


def test_candidatura_inexistente_produce_error(client, db_session):
    _, declaracion = _sembrar(db_session)
    respuesta = _post_veredicto(client, declaracion.id, 9999)
    eventos = _parse_eventos(respuesta.text)
    assert [e[0] for e in eventos] == ["error"]


def test_fallo_del_job_produce_error(client, db_session, monkeypatch):
    candidatura, declaracion = _sembrar(db_session)
    fake_pool = _FakePool(excepcion=RuntimeError("worker caido"))
    monkeypatch.setattr("app.routers.veredicto.get_arq_pool", lambda: _async_return(fake_pool))

    respuesta = _post_veredicto(client, declaracion.id, candidatura.id)
    eventos = _parse_eventos(respuesta.text)

    assert [e[0] for e in eventos] == ["error"]


def test_camino_feliz_encola_el_job_y_emite_veredicto(client, db_session, monkeypatch):
    candidatura, declaracion = _sembrar(db_session)
    fake_pool = _FakePool(resultado=_resultado_ok())
    monkeypatch.setattr("app.routers.veredicto.get_arq_pool", lambda: _async_return(fake_pool))

    respuesta = _post_veredicto(client, declaracion.id, candidatura.id)
    eventos = _parse_eventos(respuesta.text)

    assert [e[0] for e in eventos] == ["veredicto"]
    assert eventos[0][1]["veredicto"] == "viable_y_en_plan"
    assert fake_pool.llamadas == [("generar_veredicto", (declaracion.id, candidatura.id))]


async def _async_return(valor):
    return valor
