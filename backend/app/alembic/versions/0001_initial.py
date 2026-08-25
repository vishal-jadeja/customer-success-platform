"""initial

Revision ID: 0001
Revises:
Create Date: 2026-08-25 05:46:37.324173+00:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# --- Postgres enum types -----------------------------------------------------
# Declared with create_type=False so create_table() does NOT emit its own
# CREATE TYPE; upgrade()/downgrade() create and drop them explicitly with
# checkfirst=True, which keeps `downgrade base && upgrade head` round-trip clean.
user_role = postgresql.ENUM("admin", "manager", "csm", name="user_role", create_type=False)
customer_status = postgresql.ENUM(
    "onboarding", "active", "at_risk", "churned", name="customer_status", create_type=False
)
interaction_type = postgresql.ENUM(
    "meeting", "call", "email", "support_ticket", "qbr", name="interaction_type", create_type=False
)
sentiment = postgresql.ENUM("positive", "neutral", "negative", name="sentiment", create_type=False)
insight_status = postgresql.ENUM(
    "pending", "completed", "failed", name="insight_status", create_type=False
)
ENUM_TYPES = (user_role, customer_status, interaction_type, sentiment, insight_status)


def upgrade() -> None:
    bind = op.get_bind()
    for enum_type in ENUM_TYPES:
        enum_type.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("role", user_role, server_default=sa.text("'csm'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_table(
        "customers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("company", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("industry", sa.String(length=80), nullable=True),
        sa.Column(
            "status", customer_status, server_default=sa.text("'onboarding'"), nullable=False
        ),
        sa.Column("health_score", sa.SmallInteger(), server_default=sa.text("50"), nullable=False),
        sa.Column("arr", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "health_score BETWEEN 0 AND 100", name=op.f("ck_customers_health_score_range")
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_customers_owner_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customers")),
        sa.UniqueConstraint("email", name=op.f("uq_customers_email")),
    )
    op.create_index(
        "ix_customers_created_at", "customers", [sa.text("created_at DESC")], unique=False
    )
    op.create_index(op.f("ix_customers_owner_id"), "customers", ["owner_id"], unique=False)
    op.create_index(
        "ix_customers_owner_id_status", "customers", ["owner_id", "status"], unique=False
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)
    op.create_table(
        "interactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("type", interaction_type, nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.SmallInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("fk_interactions_customer_id_customers"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_interactions_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_interactions")),
    )
    op.create_index(
        op.f("ix_interactions_customer_id"), "interactions", ["customer_id"], unique=False
    )
    op.create_index(
        "ix_interactions_customer_id_occurred_at",
        "interactions",
        ["customer_id", sa.text("occurred_at DESC")],
        unique=False,
    )
    op.create_index(op.f("ix_interactions_user_id"), "interactions", ["user_id"], unique=False)
    op.create_table(
        "insights",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("interaction_id", sa.Uuid(), nullable=False),
        sa.Column("status", insight_status, server_default=sa.text("'pending'"), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("sentiment", sentiment, nullable=True),
        sa.Column(
            "action_items",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "risks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("model", sa.String(length=80), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("attempts", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["interaction_id"],
            ["interactions.id"],
            name=op.f("fk_insights_interaction_id_interactions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_insights")),
        sa.UniqueConstraint("interaction_id", name=op.f("uq_insights_interaction_id")),
    )


def downgrade() -> None:
    op.drop_table("insights")
    op.drop_index(op.f("ix_interactions_user_id"), table_name="interactions")
    op.drop_index("ix_interactions_customer_id_occurred_at", table_name="interactions")
    op.drop_index(op.f("ix_interactions_customer_id"), table_name="interactions")
    op.drop_table("interactions")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_customers_owner_id_status", table_name="customers")
    op.drop_index(op.f("ix_customers_owner_id"), table_name="customers")
    op.drop_index("ix_customers_created_at", table_name="customers")
    op.drop_table("customers")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    for enum_type in reversed(ENUM_TYPES):
        enum_type.drop(bind, checkfirst=True)
