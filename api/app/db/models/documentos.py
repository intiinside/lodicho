from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.enums import EstadoDocumento, TipoDocumento


class Documento(Base):
    __tablename__ = "documentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    doc_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    tipo: Mapped[TipoDocumento] = mapped_column(
        SAEnum(TipoDocumento, name="tipo_documento"), nullable=False
    )
    # Nullable: marco_legal y contexto no pertenecen a una candidatura.
    candidatura_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidaturas.id"), nullable=True, index=True
    )
    ruta_repo: Mapped[str] = mapped_column(String, nullable=False)
    sha256: Mapped[str] = mapped_column(String, nullable=False)
    pdf_sha256: Mapped[str | None] = mapped_column(String, nullable=True)
    git_sha: Mapped[str] = mapped_column(String, nullable=False)
    n_chunks: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    indexado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estado: Mapped[EstadoDocumento] = mapped_column(
        SAEnum(EstadoDocumento, name="estado_documento"),
        nullable=False,
        default=EstadoDocumento.activo,
        server_default=EstadoDocumento.activo.value,
        index=True,
    )

    candidatura: Mapped["Candidatura | None"] = relationship("Candidatura")
