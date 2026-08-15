"""`resolver_indicador` es el tool call de CLAUDE.md ("Cifras: nunca por
RAG"). El punto critico a testear: el modelo solo puede elegir entre lo que
YA existe en Postgres (menu cerrado) -- nunca se le pide un codigo/anio
libre, y si igual "elige" algo que no calza con el lookup exacto, no
crashea, simplemente no hay evidencia de indicador."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import Indicador
from app.db.models.enums import PasoEvidencia
from app.schemas.veredicto import IndicadorSolicitado
from app.services import indicadores as ind


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine, tables=[Indicador.__table__])
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _sembrar_indicador(session, **overrides) -> Indicador:
    base = dict(
        codigo="desempleo", descripcion="Tasa de desempleo", jurisdiccion_dpa="0201",
        anio=2025, valor="5.2000", unidad="%", fuente="INEC", url=None,
    )
    base.update(overrides)
    indicador = Indicador(**base)
    session.add(indicador)
    session.commit()
    session.refresh(indicador)
    return indicador


def test_sin_indicadores_en_la_jurisdiccion_no_llama_a_gemini(monkeypatch, db_session):
    def _fail_si_se_llama(*a, **k):
        raise AssertionError("no deberia llamar a Gemini si no hay indicadores para ofrecer")

    monkeypatch.setattr(ind, "generar_structured", _fail_si_se_llama)

    resultado = ind.resolver_indicador(db_session, "el desempleo subio", "0201")

    assert resultado is None


def test_modelo_dice_que_no_requiere_cifra(monkeypatch, db_session):
    _sembrar_indicador(db_session)
    monkeypatch.setattr(
        ind, "generar_structured", lambda *a, **k: IndicadorSolicitado(requiere_cifra=False)
    )

    resultado = ind.resolver_indicador(db_session, "una propuesta sin cifras", "0201")

    assert resultado is None


def test_modelo_elige_una_combinacion_que_existe(monkeypatch, db_session):
    _sembrar_indicador(db_session)
    monkeypatch.setattr(
        ind,
        "generar_structured",
        lambda *a, **k: IndicadorSolicitado(requiere_cifra=True, codigo="desempleo", anio=2025),
    )

    resultado = ind.resolver_indicador(db_session, "el desempleo es del 5.2%", "0201")

    assert resultado is not None
    assert resultado.paso == PasoEvidencia.indicadores
    assert resultado.score == 1.0
    assert "5.2000" in resultado.texto or "5.2" in resultado.texto
    assert resultado.git_sha == ""


def test_modelo_elige_una_combinacion_que_no_existe_no_crashea(monkeypatch, db_session):
    _sembrar_indicador(db_session)
    # El modelo "elige" un anio que no esta en el menu que se le ofrecio --
    # no deberia pasar en la practica (menu cerrado), pero el lookup exacto
    # es la ultima linea de defensa si igual pasa.
    monkeypatch.setattr(
        ind,
        "generar_structured",
        lambda *a, **k: IndicadorSolicitado(requiere_cifra=True, codigo="desempleo", anio=1999),
    )

    resultado = ind.resolver_indicador(db_session, "el desempleo es del 5.2%", "0201")

    assert resultado is None


def test_solo_ofrece_indicadores_de_la_jurisdiccion_pedida(monkeypatch, db_session):
    _sembrar_indicador(db_session, jurisdiccion_dpa="0999")

    def _fail_si_se_llama(*a, **k):
        raise AssertionError("no deberia ofrecer indicadores de otra jurisdiccion")

    monkeypatch.setattr(ind, "generar_structured", _fail_si_se_llama)

    resultado = ind.resolver_indicador(db_session, "el desempleo subio", "0201")

    assert resultado is None
