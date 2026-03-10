export interface Prospect {
  id: number;
  contact_name: string;
  organization_id: number;
  org_name: string;
  org_type: string;
  region: string | null;
  role: string | null;
  email: string | null;
  contact_status: string | null;
  relationship_depth: number | null;
  sector_fit_score: number | null;
  sector_fit_confidence: number | null;
  halo_score: number | null;
  halo_confidence: number | null;
  emerging_manager_score: number | null;
  emerging_manager_confidence: number | null;
  composite_score: number | null;
  tier: string | null;
  enrichment_status: string;
  is_gp_or_service_provider: boolean;
}

export interface ProspectDetail extends Prospect {
  sector_fit_reasoning: string | null;
  halo_reasoning: string | null;
  emerging_manager_reasoning: string | null;
  enrichment_data: string | null;
  web_sources: string | null;
  estimated_aum: string | null;
  estimated_check_size: string | null;
  other_contacts: {
    id: number;
    contact_name: string;
    role: string | null;
    email: string | null;
    relationship_depth: number | null;
    composite_score: number | null;
    tier: string | null;
  }[];
}

export interface StatsOverview {
  total_contacts: number;
  total_orgs: number;
  enriched_orgs: number;
  pending_orgs: number;
  failed_orgs: number;
  avg_composite_score: number | null;
  tier_distribution: Record<string, number>;
  avg_scores_by_dimension: Record<string, number | null>;
}

export interface CostOverview {
  total_cost_usd: number;
  total_tavily_cost: number;
  total_openai_cost: number;
  total_tavily_searches: number;
  total_openai_input_tokens: number;
  total_openai_output_tokens: number;
  avg_cost_per_org: number;
  org_count: number;
  estimated_cost_1000_orgs: number;
}

export interface EnrichmentJob {
  id: number;
  status: string;
  total_orgs: number;
  completed_orgs: number;
  failed_orgs: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface UploadResponse {
  contacts_created: number;
  orgs_created: number;
  orgs_existing: number;
  total_contacts: number;
}
