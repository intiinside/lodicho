from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Indicador(Base):
    """Cifras oficiales. Nunca se recuperan por RAG, solo por tool call SQL
    con (codigo, jurisdiccion_dpa, anio)."""

    __tablename__ = "indicadores"
    __table_args__ = (
        UniqueConstraint(
            "codigo", "jurisdiccion_dpa", "anio", name="uq_indicadores_codigo_jurisdiccion_anio"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String, nullable=False, index=True)
    descripcion: Mapped[str] = mapped_column(String, nullable=False)
    jurisdiccion_dpa: Mapped[str] = mapped_column(String, nullable=False, index=True)
    anio: Mapped[int] = mapped_column(nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unidad: Mapped[str] = mapped_column(String, nullable=False)
    fuente: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
