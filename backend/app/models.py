from datetime import datetime, timezone
from sqlalchemy import Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    org_type: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str | None] = mapped_column(String, nullable=True)

    enrichment_status: Mapped[str] = mapped_column(String, default="pending")
    enrichment_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    web_sources: Mapped[str | None] = mapped_column(Text, nullable=True)

    sector_fit_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    sector_fit_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    sector_fit_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    halo_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    halo_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    halo_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    emerging_manager_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    emerging_manager_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    emerging_manager_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    estimated_aum: Mapped[str | None] = mapped_column(String, nullable=True)
    estimated_check_size: Mapped[str | None] = mapped_column(String, nullable=True)
    is_gp_or_service_provider: Mapped[bool] = mapped_column(Boolean, default=False)

    enriched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    contacts: Mapped[list["Contact"]] = relationship(back_populates="organization")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contact_name: Mapped[str] = mapped_column(String, nullable=False)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=False)
    role: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_status: Mapped[str | None] = mapped_column(String, nullable=True)
    relationship_depth: Mapped[float | None] = mapped_column(Float, nullable=True)

    composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    tier: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="contacts")


class EnrichmentJob(Base):
    __tablename__ = "enrichment_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    total_orgs: Mapped[int] = mapped_column(Integer, default=0)
    completed_orgs: Mapped[int] = mapped_column(Integer, default=0)
    failed_orgs: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CostLog(Base):
    __tablename__ = "cost_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True)
    enrichment_job_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("enrichment_jobs.id"), nullable=True)
    tavily_searches: Mapped[int] = mapped_column(Integer, default=0)
    tavily_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    openai_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    openai_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    openai_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
