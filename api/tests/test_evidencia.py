"""`recuperar_evidencia` es donde vive en codigo la regla critica 1 de
CLAUDE.md: `search_planes_trabajo` nunca se llama sin una candidatura real
con plan registrado. Tambien se verifica que el embedding de la consulta
(denso y disperso) se calcula una sola vez, aunque haya dos busquedas --
reembeber el mismo texto dos veces seria puro desperdicio."""
from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.db.models import Candidatura
from app.db.models.enums import EstadoPlanCandidatura, PasoEvidencia
from app.services import embeddings, evidencia, qdrant_client, sparse


@dataclass
class _FakePunto:
    payload: dict
    score: float = 0.9


def _candidatura(estado: EstadoPlanCandidatura) -> Candidatura:
    return Candidatura(
        id=1,
        organizacion_politica="Partido X",
        lista_numero="1",
        dignidad="alcalde",
        jurisdiccion_dpa="0201",
        periodo="2027-2031",
        estado_plan=estado,
    )


@pytest.fixture(autouse=True)
def _mock_embeddings(monkeypatch):
    llamadas = {"dense": 0, "sparse": 0}

    def _fake_dense(texto):
        llamadas["dense"] += 1
        return [0.1]

    def _fake_sparse(texto):
        llamadas["sparse"] += 1
        return object()

    monkeypatch.setattr(embeddings, "embed_query", _fake_dense)
    monkeypatch.setattr(sparse, "embed_query", _fake_sparse)
    return llamadas


def test_recupera_planes_trabajo_y_marco_legal_cuando_hay_candidatura_registrada(monkeypatch, _mock_embeddings):
    monkeypatch.setattr(
        qdrant_client,
        "search_planes_trabajo",
        lambda *a, **k: [_FakePunto({"texto": "eje vial", "doc_id": "plan-1", "git_sha": "abc"})],
    )
    monkeypatch.setattr(
        qdrant_client,
        "search_marco_legal",
        lambda *a, **k: [_FakePunto({"texto": "art 55", "doc_id": "cootad", "git_sha": "def"})],
    )

    candidatura = _candidatura(EstadoPlanCandidatura.registrado)
    items = evidencia.recuperar_evidencia(
        "una propuesta", candidatura=candidatura, nivel_gobierno="cantonal"
    )

    pasos = {i.paso for i in items}
    assert pasos == {PasoEvidencia.planes_trabajo, PasoEvidencia.marco_legal}


def test_no_llama_search_planes_trabajo_sin_candidatura(monkeypatch, _mock_embeddings):
    def _fail_si_se_llama(*a, **k):
        raise AssertionError("nunca debe buscar planes_trabajo sin candidatura_id real")

    monkeypatch.setattr(qdrant_client, "search_planes_trabajo", _fail_si_se_llama)
    monkeypatch.setattr(qdrant_client, "search_marco_legal", lambda *a, **k: [])

    evidencia.recuperar_evidencia("texto", candidatura=None, nivel_gobierno="cantonal")


def test_no_llama_search_planes_trabajo_si_sin_plan_registrado(monkeypatch, _mock_embeddings):
    def _fail_si_se_llama(*a, **k):
        raise AssertionError("no debe buscar el plan de una candidatura sin plan registrado")

    monkeypatch.setattr(qdrant_client, "search_planes_trabajo", _fail_si_se_llama)
    monkeypatch.setattr(qdrant_client, "search_marco_legal", lambda *a, **k: [])

    candidatura = _candidatura(EstadoPlanCandidatura.sin_plan_registrado)
    evidencia.recuperar_evidencia("texto", candidatura=candidatura, nivel_gobierno="cantonal")


def test_no_llama_search_marco_legal_si_nivel_gobierno_es_none(monkeypatch, _mock_embeddings):
    def _fail_si_se_llama(*a, **k):
        raise AssertionError("no debe buscar marco_legal sin nivel_gobierno")

    monkeypatch.setattr(qdrant_client, "search_planes_trabajo", lambda *a, **k: [])
    monkeypatch.setattr(qdrant_client, "search_marco_legal", _fail_si_se_llama)

    candidatura = _candidatura(EstadoPlanCandidatura.registrado)
    evidencia.recuperar_evidencia("texto", candidatura=candidatura, nivel_gobierno=None)


def test_embed_query_se_llama_una_sola_vez_aunque_haya_dos_busquedas(monkeypatch, _mock_embeddings):
    monkeypatch.setattr(qdrant_client, "search_planes_trabajo", lambda *a, **k: [])
    monkeypatch.setattr(qdrant_client, "search_marco_legal", lambda *a, **k: [])

    candidatura = _candidatura(EstadoPlanCandidatura.registrado)
    evidencia.recuperar_evidencia("texto", candidatura=candidatura, nivel_gobierno="cantonal")

    assert _mock_embeddings["dense"] == 1
    assert _mock_embeddings["sparse"] == 1
