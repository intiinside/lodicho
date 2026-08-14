from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import TipoDeclaracion, TipoInput


class Consulta(Base):
    __tablename__ = "consultas"

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo_input: Mapped[TipoInput] = mapped_column(
        SAEnum(TipoInput, name="tipo_input"), nullable=False
    )
    texto: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String, nullable=True)
    url_fuente: Mapped[str | None] = mapped_column(String, nullable=True)
    contenido_archivado: Mapped[str | None] = mapped_column(Text, nullable=True)
    hash_contenido: Mapped[str | None] = mapped_column(String, nullable=True)
    intencion_detectada: Mapped[str | None] = mapped_column(String, nullable=True)
    desde_cache: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    declaraciones: Mapped[list["Declaracion"]] = relationship(
        "Declaracion", back_populates="consulta", cascade="all, delete-orphan"
    )


class Declaracion(Base):
    __tablename__ = "declaraciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    consulta_id: Mapped[int] = mapped_column(
        ForeignKey("consultas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    texto: Mapped[str] = mapped_column(Text, nullable=False)
    tipo: Mapped[TipoDeclaracion] = mapped_column(
        SAEnum(TipoDeclaracion, name="tipo_declaracion"), nullable=False
    )
    # Solo cita_directa y dictado_usuario son atribuibles al candidato.
    atribuible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    analisis_id: Mapped[int | None] = mapped_column(
        ForeignKey("analisis.id"), nullable=True, index=True
    )

    consulta: Mapped["Consulta"] = relationship("Consulta", back_populates="declaraciones")
    analisis: Mapped["Analisis | None"] = relationship(
        "Analisis", back_populates="declaraciones"
    )
