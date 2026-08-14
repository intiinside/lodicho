"""esquema inicial

Revision ID: 625edeb20616
Revises:
Create Date: 2026-08-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.db.models.enums import (
    EstadoAnalisis,
    EstadoDocumento,
    EstadoPlanCandidatura,
    PasoEvidencia,
    TipoDeclaracion,
    TipoDocumento,
    TipoInput,
    Veredicto,
)

# revision identifiers, used by Alembic.
revision: str = "625edeb20616"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidaturas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organizacion_politica", sa.String(), nullable=False),
        sa.Column("lista_numero", sa.String(), nullable=False),
        sa.Column("dignidad", sa.String(), nullable=False),
        sa.Column("jurisdiccion_dpa", sa.String(), nullable=False),
        sa.Column("periodo", sa.String(), nullable=False),
        sa.Column("doc_id_plan", sa.String(), nullable=True),
        sa.Column(
            "estado_plan",
            sa.Enum(EstadoPlanCandidatura, name="estado_plan_candidatura"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_candidaturas_jurisdiccion_dpa", "candidaturas", ["jurisdiccion_dpa"]
    )
    op.create_index("ix_candidaturas_estado_plan", "candidaturas", ["estado_plan"])

    op.create_table(
        "candidatos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column(
            "candidatura_id",
            sa.Integer(),
            sa.ForeignKey("candidaturas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("posicion_lista", sa.Integer(), nullable=False),
    )
    op.create_index("ix_candidatos_candidatura_id", "candidatos", ["candidatura_id"])

    op.create_table(
        "documentos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doc_id", sa.String(), nullable=False, unique=True),
        sa.Column(
            "tipo", sa.Enum(TipoDocumento, name="tipo_documento"), nullable=False
        ),
        sa.Column(
            "candidatura_id",
            sa.Integer(),
            sa.ForeignKey("candidaturas.id"),
            nullable=True,
        ),
        sa.Column("ruta_repo", sa.String(), nullable=False),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("pdf_sha256", sa.String(), nullable=True),
        sa.Column("git_sha", sa.String(), nullable=False),
        sa.Column("n_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("indexado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "estado",
            sa.Enum(EstadoDocumento, name="estado_documento"),
            nullable=False,
            server_default=EstadoDocumento.activo.value,
        ),
    )
    op.create_index("ix_documentos_doc_id", "documentos", ["doc_id"], unique=True)
    op.create_index("ix_documentos_candidatura_id", "documentos", ["candidatura_id"])
    op.create_index("ix_documentos_estado", "documentos", ["estado"])

    op.create_table(
        "indicadores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("codigo", sa.String(), nullable=False),
        sa.Column("descripcion", sa.String(), nullable=False),
        sa.Column("jurisdiccion_dpa", sa.String(), nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("valor", sa.Numeric(14, 4), nullable=False),
        sa.Column("unidad", sa.String(), nullable=False),
        sa.Column("fuente", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=True),
        sa.UniqueConstraint(
            "codigo",
            "jurisdiccion_dpa",
            "anio",
            name="uq_indicadores_codigo_jurisdiccion_anio",
        ),
    )
    op.create_index("ix_indicadores_codigo", "indicadores", ["codigo"])
    op.create_index("ix_indicadores_jurisdiccion_dpa", "indicadores", ["jurisdiccion_dpa"])

    op.create_table(
        "consultas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tipo_input", sa.Enum(TipoInput, name="tipo_input"), nullable=False),
        sa.Column("texto", sa.Text(), nullable=True),
        sa.Column("audio_path", sa.String(), nullable=True),
        sa.Column("url_fuente", sa.String(), nullable=True),
        sa.Column("contenido_archivado", sa.Text(), nullable=True),
        sa.Column("hash_contenido", sa.String(), nullable=True),
        sa.Column("intencion_detectada", sa.String(), nullable=True),
        sa.Column(
            "desde_cache", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "analisis",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "candidatura_id",
            sa.Integer(),
            sa.ForeignKey("candidaturas.id"),
            nullable=False,
        ),
        sa.Column("afirmacion", sa.Text(), nullable=False),
        sa.Column("veredicto", sa.Enum(Veredicto, name="veredicto"), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False),
        sa.Column("factibilidad_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("factibilidad_factores", postgresql.JSONB(), nullable=True),
        sa.Column("modelo_usado", sa.String(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum(EstadoAnalisis, name="estado_analisis"),
            nullable=False,
            server_default=EstadoAnalisis.borrador.value,
        ),
        sa.Column("revisor_id", sa.String(), nullable=True),
        sa.Column("revisado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("respuesta_candidato", sa.Text(), nullable=True),
        sa.Column("publicado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_analisis_candidatura_id", "analisis", ["candidatura_id"])
    op.create_index("ix_analisis_veredicto", "analisis", ["veredicto"])
    op.create_index("ix_analisis_estado", "analisis", ["estado"])

    op.create_table(
        "declaraciones",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "consulta_id",
            sa.Integer(),
            sa.ForeignKey("consultas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column(
            "tipo", sa.Enum(TipoDeclaracion, name="tipo_declaracion"), nullable=False
        ),
        sa.Column("atribuible", sa.Boolean(), nullable=False),
        sa.Column(
            "analisis_id",
            sa.Integer(),
            sa.ForeignKey("analisis.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_declaraciones_consulta_id", "declaraciones", ["consulta_id"])
    op.create_index("ix_declaraciones_analisis_id", "declaraciones", ["analisis_id"])

    op.create_table(
        "evidencias",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "analisis_id",
            sa.Integer(),
            sa.ForeignKey("analisis.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "paso", sa.Enum(PasoEvidencia, name="paso_evidencia"), nullable=False
        ),
        sa.Column("coleccion", sa.String(), nullable=False),
        sa.Column("point_id", sa.String(), nullable=False),
        sa.Column("doc_id", sa.String(), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("git_sha", sa.String(), nullable=False),
    )
    op.create_index("ix_evidencias_analisis_id", "evidencias", ["analisis_id"])


def downgrade() -> None:
    op.drop_table("evidencias")
    op.drop_table("declaraciones")
    op.drop_table("analisis")
    op.drop_table("consultas")
    op.drop_table("indicadores")
    op.drop_table("documentos")
    op.drop_table("candidatos")
    op.drop_table("candidaturas")

    bind = op.get_bind()
    sa.Enum(PasoEvidencia, name="paso_evidencia").drop(bind, checkfirst=True)
    sa.Enum(TipoDeclaracion, name="tipo_declaracion").drop(bind, checkfirst=True)
    sa.Enum(TipoInput, name="tipo_input").drop(bind, checkfirst=True)
    sa.Enum(EstadoAnalisis, name="estado_analisis").drop(bind, checkfirst=True)
    sa.Enum(Veredicto, name="veredicto").drop(bind, checkfirst=True)
    sa.Enum(EstadoDocumento, name="estado_documento").drop(bind, checkfirst=True)
    sa.Enum(TipoDocumento, name="tipo_documento").drop(bind, checkfirst=True)
    sa.Enum(EstadoPlanCandidatura, name="estado_plan_candidatura").drop(
        bind, checkfirst=True
    )
