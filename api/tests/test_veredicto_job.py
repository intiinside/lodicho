"""`ejecutar_generacion_veredicto` corre dentro del proceso worker con su
propia sesion -- se testea con SQLite en memoria + monkeypatch de
`recuperar_evidencia` y `generar_veredicto_con_salvaguardas` (sin Qdrant ni
Gemini reales)."""
from __future__ import annotations

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import Candidato, Candidatura, Consulta, Declaracion, Evidencia
from app.db.models.enums import (
    EstadoAnalisis,
    EstadoPlanCandidatura,
    PasoEvidencia,
    TipoDeclaracion,
    TipoInput,
    Veredicto,
)
from app.schemas.consulta import EvidenciaItem
from app.schemas.veredicto import (
    CompetenciaLegal,
    ConstaEnPlan,
    FactoresFactibilidad,
    FinanciamientoIdentificado,
    InformeContrastacion,
    PlazoVsPeriodo,
    PrecedentePresupuestario,
)
from app.services import veredicto_job
from app.services.generacion_veredicto import ResultadoVeredicto

@compiles(JSONB, "sqlite")
def _compile_jsonb_como_json_en_sqlite(type_, compiler, **kw):
    # SQLite no tiene JSONB nativo; para los tests basta con mapearlo al
    # tipo JSON generico que sqlite si soporta. No afecta produccion
    # (Postgres real), solo la compilacion de DDL en esta sesion de tests.
    return "JSON"


TABLAS = [
    Candidatura.__table__, Candidato.__table__, Consulta.__table__,
    Declaracion.__table__, veredicto_job.Analisis.__table__, Evidencia.__table__,
]


@pytest.fixture()
def db_session(monkeypatch):
    # StaticPool comparte una unica conexion sqlite en memoria entre todas
    # las sesiones -- el fixture usa una sesion para sembrar/verificar, y
    # `ejecutar_generacion_veredicto` crea la suya propia via SessionLocal()
    # (fiel a produccion, donde el worker nunca comparte sesion con el
    # caller). Si compartieran el mismo objeto Session, el
    # `session.close()` de la funcion bajo prueba dejaria los objetos del
    # fixture detached.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine, tables=TABLAS)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(veredicto_job, "SessionLocal", SessionLocal)

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _sembrar(session) -> tuple[Candidatura, Declaracion]:
    candidatura = Candidatura(
        organizacion_politica="Partido X", lista_numero="1", dignidad="alcalde",
        jurisdiccion_dpa="0201", periodo="2027-2031", estado_plan=EstadoPlanCandidatura.registrado,
    )
    session.add(candidatura)
    session.flush()
    session.add(Candidato(nombre="Ana Torres", candidatura_id=candidatura.id, posicion_lista=1))

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


def _resultado_veredicto() -> ResultadoVeredicto:
    informe = InformeContrastacion(
        veredicto=Veredicto.viable_y_en_plan,
        justificacion="justificacion",
        factores_factibilidad=FactoresFactibilidad(
            competencia_legal=CompetenciaLegal.exclusiva,
            consta_en_plan=ConstaEnPlan.explicito,
            financiamiento_identificado=FinanciamientoIdentificado.con_monto,
            plazo_vs_periodo=PlazoVsPeriodo.holgado,
            precedente_presupuestario=PrecedentePresupuestario.existe,
        ),
        requiere_indicador=False,
        articulos_citados=["Art. 55"],
        es_gestion_no_ejecucion=False,
        confianza="alta",
    )
    return ResultadoVeredicto(
        informe=informe, estado=EstadoAnalisis.borrador, modelo_usado="gemini-2.5-pro",
    )


def test_ejecutar_generacion_veredicto_persiste_analisis_evidencia_y_linkea_declaracion(monkeypatch, db_session):
    candidatura, declaracion = _sembrar(db_session)
    evidencias = [
        EvidenciaItem(paso=PasoEvidencia.marco_legal, texto="art 55", score=0.9, doc_id="cootad", git_sha="abc", point_id="p1"),
    ]
    monkeypatch.setattr(veredicto_job, "recuperar_evidencia", lambda *a, **k: evidencias)
    monkeypatch.setattr(veredicto_job, "generar_veredicto_con_salvaguardas", lambda **k: _resultado_veredicto())

    resultado = veredicto_job.ejecutar_generacion_veredicto(declaracion.id, candidatura.id)

    assert resultado["veredicto"] == Veredicto.viable_y_en_plan.value
    assert resultado["estado"] == EstadoAnalisis.borrador.value
    assert resultado["factibilidad_score"] == 100.0
    assert len(resultado["evidencias"]) == 1

    analisis = db_session.execute(select(veredicto_job.Analisis)).scalar_one()
    assert analisis.candidatura_id == candidatura.id
    evidencia_fila = db_session.execute(select(Evidencia)).scalar_one()
    assert evidencia_fila.analisis_id == analisis.id
    assert evidencia_fila.point_id == "p1"

    db_session.refresh(declaracion)
    assert declaracion.analisis_id == analisis.id


def test_declaracion_inexistente_lanza_error(monkeypatch, db_session):
    candidatura, _ = _sembrar(db_session)
    with pytest.raises(veredicto_job.DeclaracionOCandidaturaInexistenteError):
        veredicto_job.ejecutar_generacion_veredicto(9999, candidatura.id)


def test_candidatura_inexistente_lanza_error(monkeypatch, db_session):
    _, declaracion = _sembrar(db_session)
    with pytest.raises(veredicto_job.DeclaracionOCandidaturaInexistenteError):
        veredicto_job.ejecutar_generacion_veredicto(declaracion.id, 9999)
