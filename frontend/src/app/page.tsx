"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { StatsOverview, CostOverview, EnrichmentJob } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  "PRIORITY CLOSE": "bg-emerald-600",
  "STRONG FIT": "bg-blue-600",
  "MODERATE FIT": "bg-amber-500",
  "WEAK FIT": "bg-gray-400",
};

const TIER_ORDER = ["PRIORITY CLOSE", "STRONG FIT", "MODERATE FIT", "WEAK FIT"];

export default function DashboardPage() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [costs, setCosts] = useState<CostOverview | null>(null);
  const [distribution, setDistribution] = useState<
    { range: string; count: number }[]
  >([]);
  const [orgTypeData, setOrgTypeData] = useState<
    {
      org_type: string;
      avg_sector_fit: number | null;
      avg_halo: number | null;
      avg_emerging_manager: number | null;
      count: number;
    }[]
  >([]);
  const [latestJob, setLatestJob] = useState<EnrichmentJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ov, co, dist, orgType, jobs] = await Promise.all([
          api.getOverview(),
          api.getCosts(),
          api.getScoreDistribution(),
          api.getScoresByOrgType(),
          api.getJobs(),
        ]);
        setOverview(ov);
        setCosts(co);
        setDistribution(dist.distribution);
        setOrgTypeData(orgType.by_org_type);
        if (jobs.length > 0) setLatestJob(jobs[0] as EnrichmentJob);
      } catch {
        // API not available yet
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (!overview || overview.total_contacts === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">
          No data yet. Upload a CSV to get started.
        </p>
        <a href="/upload" className="text-emerald-700 underline font-medium">
          Go to Upload
        </a>
      </div>
    );
  }

  const tierData = TIER_ORDER.map((tier) => ({
    tier,
    count: overview.tier_distribution[tier] || 0,
  }));

  const avgDimData = [
    {
      dimension: "Sector Fit",
      score: overview.avg_scores_by_dimension.sector_fit ?? 0,
    },
    {
      dimension: "Relationship",
      score: overview.avg_scores_by_dimension.relationship_depth ?? 0,
    },
    {
      dimension: "Halo Value",
      score: overview.avg_scores_by_dimension.halo_value ?? 0,
    },
    {
      dimension: "Emerging Mgr",
      score: overview.avg_scores_by_dimension.emerging_manager ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pipeline Dashboard</h1>
        <div className="flex items-center gap-3">
          {latestJob && latestJob.status === "running" && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-amber-600 font-medium">
                Enriching... {latestJob.completed_orgs + latestJob.failed_orgs}/
                {latestJob.total_orgs}
              </span>
              <Progress
                value={
                  ((latestJob.completed_orgs + latestJob.failed_orgs) /
                    Math.max(latestJob.total_orgs, 1)) *
                  100
                }
                className="w-48"
              />
            </div>
          )}
          {(overview.pending_orgs > 0 || overview.failed_orgs > 0) && !(latestJob && latestJob.status === "running") && (
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={async () => {
                try {
                  await api.startEnrichment();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to start enrichment");
                }
              }}
            >
              Start Enrichment ({overview.pending_orgs + overview.failed_orgs} orgs)
            </Button>
          )}
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={async () => {
              if (!window.confirm("Delete ALL data? This cannot be undone.")) return;
              try {
                await api.resetAllData();
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to reset data");
              }
            }}
          >
            Reset All Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview.total_contacts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overview.enriched_orgs}
              <span className="text-lg text-gray-400">
                /{overview.total_orgs}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">enriched</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Avg Composite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {overview.avg_composite_score?.toFixed(1) ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total API Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              ${costs?.total_cost_usd.toFixed(2) ?? "0.00"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              est. ${costs?.estimated_cost_1000_orgs.toFixed(2) ?? "0"}/1K orgs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution + Avg Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tierData.map(({ tier, count }) => (
                <div key={tier} className="flex items-center gap-3">
                  <Badge
                    className={`${TIER_COLORS[tier]} text-white text-xs w-32 justify-center`}
                  >
                    {tier}
                  </Badge>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className={`${TIER_COLORS[tier]} h-full rounded-full transition-all`}
                      style={{
                        width: `${Math.max(
                          (count / Math.max(overview.total_contacts, 1)) * 100,
                          count > 0 ? 2 : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono w-8 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Average Scores by Dimension
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={avgDimData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" className="text-xs" />
                <PolarRadiusAxis angle={30} domain={[0, 10]} />
                <Radar
                  dataKey="score"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution + By Org Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Composite Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" className="text-xs" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Avg Sector Fit by Org Type
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...orgTypeData].sort(
                  (a, b) => (b.avg_sector_fit ?? 0) - (a.avg_sector_fit ?? 0)
                )}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis
                  dataKey="org_type"
                  type="category"
                  width={120}
                  className="text-xs"
                />
                <Tooltip />
                <Bar
                  dataKey="avg_sector_fit"
                  fill="#2563eb"
                  radius={[0, 4, 4, 0]}
                  name="Sector Fit"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      {costs && costs.org_count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Tavily Searches</p>
                <p className="font-mono font-medium">
                  {costs.total_tavily_searches}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Tavily Cost</p>
                <p className="font-mono font-medium">
                  ${costs.total_tavily_cost.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">OpenAI Tokens (in/out)</p>
                <p className="font-mono font-medium">
                  {costs.total_openai_input_tokens.toLocaleString()}/
                  {costs.total_openai_output_tokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500">OpenAI Cost</p>
                <p className="font-mono font-medium">
                  ${costs.total_openai_cost.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
