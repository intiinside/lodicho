from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import EstadoAnalisis, PasoEvidencia, Veredicto


class Analisis(Base):
    __tablename__ = "analisis"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidatura_id: Mapped[int] = mapped_column(
        ForeignKey("candidaturas.id"), nullable=False, index=True
    )
    afirmacion: Mapped[str] = mapped_column(Text, nullable=False)
    # no_consta_en_plan solo es valido si hubo retrieval exitoso sobre
    # planes_trabajo; ver validador semantico a nivel de Pydantic, no de DB.
    veredicto: Mapped[Veredicto] = mapped_column(
        SAEnum(Veredicto, name="veredicto"), nullable=False, index=True
    )
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Nunca lo genera el LLM: Python calcula el numero con pesos fijos.
    factibilidad_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    factibilidad_factores: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    modelo_usado: Mapped[str] = mapped_column(String, nullable=False)
    estado: Mapped[EstadoAnalisis] = mapped_column(
        SAEnum(EstadoAnalisis, name="estado_analisis"),
        nullable=False,
        default=EstadoAnalisis.borrador,
        server_default=EstadoAnalisis.borrador.value,
        index=True,
    )
    revisor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    revisado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Derecho a replica: presente desde la primera migracion, no se retrofitea.
    respuesta_candidato: Mapped[str | None] = mapped_column(Text, nullable=True)
    publicado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    declaraciones: Mapped[list["Declaracion"]] = relationship(
        "Declaracion", back_populates="analisis"
    )
    evidencias: Mapped[list["Evidencia"]] = relationship(
        "Evidencia", back_populates="analisis", cascade="all, delete-orphan"
    )


class Evidencia(Base):
    __tablename__ = "evidencias"

    id: Mapped[int] = mapped_column(primary_key=True)
    analisis_id: Mapped[int] = mapped_column(
        ForeignKey("analisis.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Distingue el paso del pipeline que produjo esta evidencia. La ausencia
    # de filas con paso=planes_trabajo para un analisis es como se detecta
    # sin_plan_recuperado, sin necesitar una columna dedicada para ese estado.
    paso: Mapped[PasoEvidencia] = mapped_column(
        SAEnum(PasoEvidencia, name="paso_evidencia"), nullable=False
    )
    coleccion: Mapped[str] = mapped_column(String, nullable=False)
    point_id: Mapped[str] = mapped_column(String, nullable=False)
    doc_id: Mapped[str] = mapped_column(String, nullable=False)
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    git_sha: Mapped[str] = mapped_column(String, nullable=False)

    analisis: Mapped["Analisis"] = relationship("Analisis", back_populates="evidencias")
