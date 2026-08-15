"""Logica de generacion de veredicto que corre DENTRO del proceso worker
(ver `app/worker.py::generar_veredicto`).

Funcion sincrona de punta a punta con su propia `SessionLocal()` -- el
worker no tiene un request de FastAPI, no puede usar `Depends(get_session)`.
"""
from __future__ import annotations

from app.db.models import Analisis, Candidatura, Declaracion, Evidencia
from app.db.session import SessionLocal
from app.services.evidencia import recuperar_evidencia
from app.services.factibilidad import calcular_factibilidad
from app.services.generacion_veredicto import generar_veredicto_con_salvaguardas
from app.services.indicadores import resolver_indicador
from app.services.resolucion_candidatura import (
    NivelGobiernoDesconocidoError,
    nivel_gobierno_para_dignidad,
)


class DeclaracionOCandidaturaInexistenteError(Exception):
    pass


def ejecutar_generacion_veredicto(declaracion_id: int, candidatura_id: int) -> dict:
    session = SessionLocal()
    try:
        declaracion = session.get(Declaracion, declaracion_id)
        candidatura = session.get(Candidatura, candidatura_id)
        if declaracion is None or candidatura is None:
            raise DeclaracionOCandidaturaInexistenteError(
                f"declaracion_id={declaracion_id} o candidatura_id={candidatura_id} no existen"
            )

        try:
            nivel_gobierno = nivel_gobierno_para_dignidad(candidatura.dignidad)
        except NivelGobiernoDesconocidoError:
            nivel_gobierno = None

        evidencias = recuperar_evidencia(
            declaracion.texto, candidatura=candidatura, nivel_gobierno=nivel_gobierno
        )

        indicador_evidencia = resolver_indicador(
            session, declaracion.texto, candidatura.jurisdiccion_dpa
        )
        if indicador_evidencia is not None:
            evidencias = [*evidencias, indicador_evidencia]

        resultado = generar_veredicto_con_salvaguardas(
            afirmacion=declaracion.texto,
            evidencias=evidencias,
            candidatura=candidatura,
            nivel_gobierno=nivel_gobierno,
        )
        factibilidad_score = calcular_factibilidad(resultado.informe.factores_factibilidad)

        analisis = Analisis(
            candidatura_id=candidatura.id,
            afirmacion=declaracion.texto,
            veredicto=resultado.informe.veredicto,
            payload_json={
                **resultado.informe.model_dump(mode="json"),
                **resultado.payload_extra,
            },
            factibilidad_score=factibilidad_score,
            factibilidad_factores=resultado.informe.factores_factibilidad.model_dump(mode="json"),
            modelo_usado=resultado.modelo_usado,
            estado=resultado.estado,
        )
        session.add(analisis)
        session.flush()

        for item in evidencias:
            session.add(
                Evidencia(
                    analisis_id=analisis.id,
                    paso=item.paso,
                    coleccion=item.paso.value,
                    point_id=item.point_id,
                    doc_id=item.doc_id,
                    texto=item.texto,
                    score=item.score,
                    git_sha=item.git_sha,
                )
            )

        declaracion.analisis_id = analisis.id
        session.commit()

        return {
            "veredicto": analisis.veredicto.value,
            "estado": analisis.estado.value,
            "factibilidad_score": float(analisis.factibilidad_score),
            "factibilidad_factores": analisis.factibilidad_factores,
            "respuesta_candidato": analisis.respuesta_candidato,
            "evidencias": [item.model_dump(mode="json") for item in evidencias],
        }
    finally:
        session.close()
