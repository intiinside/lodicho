"""CLAUDE.md, regla critica 5: el clasificador de intencion rechaza con
mensaje fijo (no generado por el modelo). Estos tests verifican que
`clasificar_intencion` solo consume la categoria devuelta por Gemini (nunca
un texto libre), y que `MENSAJES_RECHAZO` cubre exactamente las categorias
marcadas como rechazadas -- ni de mas ni de menos."""
from __future__ import annotations

import pytest

from app.schemas.consulta import CATEGORIAS_RECHAZADAS, CategoriaIntencion, IntencionClasificada
from app.services import intencion
from app.services.generacion import GeminiGenerationError


def test_clasificar_intencion_devuelve_la_categoria_del_modelo(monkeypatch):
    monkeypatch.setattr(
        intencion,
        "generar_structured",
        lambda *a, **k: IntencionClasificada(categoria=CategoriaIntencion.recomendacion_voto),
    )

    assert intencion.clasificar_intencion("por quien debo votar?") == CategoriaIntencion.recomendacion_voto


def test_clasificar_intencion_propaga_fallo_de_gemini(monkeypatch):
    def _falla(*a, **k):
        raise GeminiGenerationError("timeout")

    monkeypatch.setattr(intencion, "generar_structured", _falla)

    with pytest.raises(GeminiGenerationError):
        intencion.clasificar_intencion("cualquier texto")


def test_mensajes_rechazo_cubre_exactamente_las_categorias_rechazadas():
    assert set(intencion.MENSAJES_RECHAZO.keys()) == set(CATEGORIAS_RECHAZADAS)


def test_mensajes_rechazo_no_estan_vacios():
    for mensaje in intencion.MENSAJES_RECHAZO.values():
        assert mensaje.strip()
