from pydantic import BaseModel, Field
from datetime import datetime


# --- Enrichment LLM Response Schema ---

class DimensionScore(BaseModel):
    score: float = Field(..., ge=1.0, le=10.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str
    key_evidence: list[str] = Field(default_factory=list)


class EnrichmentResult(BaseModel):
    organization_summary: str
    is_gp_or_service_provider: bool
    gp_service_provider_reasoning: str = ""
    estimated_aum: str | None = None
    estimated_check_size: str | None = None
    sector_fit: DimensionScore
    halo_strategic_value: DimensionScore
    emerging_manager_fit: DimensionScore
    web_sources_used: list[str] = Field(default_factory=list)


# --- API Response Schemas ---

class OrganizationOut(BaseModel):
    id: int
    name: str
    org_type: str
    region: str | None
    enrichment_status: str
    sector_fit_score: float | None
    sector_fit_reasoning: str | None
    sector_fit_confidence: float | None
    halo_score: float | None
    halo_reasoning: str | None
    halo_confidence: float | None
    emerging_manager_score: float | None
    emerging_manager_reasoning: str | None
    emerging_manager_confidence: float | None
    estimated_aum: str | None
    estimated_check_size: str | None
    is_gp_or_service_provider: bool
    enrichment_data: str | None
    web_sources: str | None

    class Config:
        from_attributes = True


class ContactOut(BaseModel):
    id: int
    contact_name: str
    organization_id: int
    role: str | None
    email: str | None
    contact_status: str | None
    relationship_depth: float | None
    composite_score: float | None
    tier: str | None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class ProspectOut(BaseModel):
    id: int
    contact_name: str
    organization_id: int
    org_name: str
    org_type: str
    region: str | None
    role: str | None
    email: str | None
    contact_status: str | None
    relationship_depth: float | None
    sector_fit_score: float | None
    sector_fit_confidence: float | None
    halo_score: float | None
    halo_confidence: float | None
    emerging_manager_score: float | None
    emerging_manager_confidence: float | None
    composite_score: float | None
    tier: str | None
    enrichment_status: str
    is_gp_or_service_provider: bool


class ProspectDetailOut(ProspectOut):
    sector_fit_reasoning: str | None
    halo_reasoning: str | None
    emerging_manager_reasoning: str | None
    enrichment_data: str | None
    web_sources: str | None
    estimated_aum: str | None
    estimated_check_size: str | None
    other_contacts: list[ContactOut] = []


class UploadResponse(BaseModel):
    contacts_created: int
    orgs_created: int
    orgs_existing: int
    total_contacts: int


class EnrichmentJobOut(BaseModel):
    id: int
    status: str
    total_orgs: int
    completed_orgs: int
    failed_orgs: int
    started_at: datetime | None
    completed_at: datetime | None

    class Config:
        from_attributes = True


class StatsOverview(BaseModel):
    total_contacts: int
    total_orgs: int
    enriched_orgs: int
    pending_orgs: int
    failed_orgs: int
    avg_composite_score: float | None
    tier_distribution: dict[str, int]
    avg_scores_by_dimension: dict[str, float | None]


class CostOverview(BaseModel):
    total_cost_usd: float
    total_tavily_cost: float
    total_openai_cost: float
    total_tavily_searches: int
    total_openai_input_tokens: int
    total_openai_output_tokens: int
    avg_cost_per_org: float
    org_count: int
    estimated_cost_1000_orgs: float
