const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }
  return res.json();
}

export const api = {
  // Upload
  uploadCSV: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetchAPI<{ contacts_created: number; orgs_created: number; orgs_existing: number; total_contacts: number }>("/api/upload/csv", {
      method: "POST",
      body: form,
    });
  },

  // Enrichment
  startEnrichment: () =>
    fetchAPI<{ id: number; status: string }>("/api/enrichment/start", { method: "POST" }),

  getEnrichmentStatus: (jobId: number) =>
    fetchAPI<{
      id: number;
      status: string;
      total_orgs: number;
      completed_orgs: number;
      failed_orgs: number;
    }>(`/api/enrichment/status/${jobId}`),

  getJobs: () =>
    fetchAPI<{ id: number; status: string; total_orgs: number; completed_orgs: number; failed_orgs: number }[]>(
      "/api/enrichment/jobs"
    ),

  retryOrg: (orgId: number) =>
    fetchAPI<{ message: string }>(`/api/enrichment/retry/${orgId}`, { method: "POST" }),

  resetAllData: () =>
    fetchAPI<{ contacts_deleted: number; orgs_deleted: number; jobs_deleted: number; cost_logs_deleted: number }>(
      "/api/enrichment/reset",
      { method: "DELETE" }
    ),

  // Prospects
  getProspects: (params?: {
    tier?: string;
    org_type?: string;
    search?: string;
    sort_by?: string;
    order?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") searchParams.set(k, String(v));
      });
    }
    return fetchAPI<import("./types").Prospect[]>(`/api/prospects?${searchParams}`);
  },

  getProspectCount: (params?: { tier?: string; org_type?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") searchParams.set(k, String(v));
      });
    }
    return fetchAPI<{ count: number }>(`/api/prospects/count?${searchParams}`);
  },

  getProspectDetail: (id: number) =>
    fetchAPI<import("./types").ProspectDetail>(`/api/prospects/${id}`),

  // Stats
  getOverview: () => fetchAPI<import("./types").StatsOverview>("/api/stats/overview"),
  getCosts: () => fetchAPI<import("./types").CostOverview>("/api/stats/costs"),
  getScoreDistribution: () =>
    fetchAPI<{ distribution: { range: string; count: number }[] }>("/api/stats/score-distribution"),
  getScoresByOrgType: () =>
    fetchAPI<{
      by_org_type: {
        org_type: string;
        avg_sector_fit: number | null;
        avg_halo: number | null;
        avg_emerging_manager: number | null;
        count: number;
      }[];
    }>("/api/stats/by-org-type"),
};
