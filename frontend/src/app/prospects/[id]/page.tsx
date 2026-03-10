"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ProspectDetail } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  "PRIORITY CLOSE": "bg-emerald-600",
  "STRONG FIT": "bg-blue-600",
  "MODERATE FIT": "bg-amber-500",
  "WEAK FIT": "bg-gray-400",
};

function ConfidenceDots({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) return null;
  const level = confidence >= 0.7 ? "High" : confidence >= 0.4 ? "Medium" : "Low";
  const color = confidence >= 0.7 ? "text-emerald-600" : confidence >= 0.4 ? "text-amber-600" : "text-red-500";
  return <span className={`text-xs ${color}`}>{level} confidence ({(confidence * 100).toFixed(0)}%)</span>;
}

function ScoreBar({ score, label, confidence, reasoning, evidence }: {
  score: number | null;
  label: string;
  confidence?: number | null;
  reasoning?: string | null;
  evidence?: string[];
}) {
  const s = score ?? 0;
  const pct = (s / 10) * 100;
  const barColor =
    s >= 8 ? "bg-emerald-500" :
    s >= 6 ? "bg-blue-500" :
    s >= 4 ? "bg-amber-500" :
    "bg-gray-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <ConfidenceDots confidence={confidence ?? null} />
          <span className="font-mono font-bold text-lg">{score?.toFixed(1) ?? "—"}</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`${barColor} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {reasoning && (
        <p className="text-sm text-gray-600 mt-1">{reasoning}</p>
      )}
      {evidence && evidence.length > 0 && (
        <ul className="text-xs text-gray-500 list-disc list-inside mt-1 space-y-0.5">
          {evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ProspectDetailPage() {
  const params = useParams();
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProspectDetail(Number(params.id));
        setProspect(data);
      } catch {
        // not found
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading...</div>;
  if (!prospect) return <div className="text-center text-gray-500 py-8">Prospect not found.</div>;

  const radarData = [
    { dim: "Sector Fit", score: prospect.sector_fit_score ?? 0, fullMark: 10 },
    { dim: "Relationship", score: prospect.relationship_depth ?? 0, fullMark: 10 },
    { dim: "Halo Value", score: prospect.halo_score ?? 0, fullMark: 10 },
    { dim: "Emerging Mgr", score: prospect.emerging_manager_score ?? 0, fullMark: 10 },
  ];

  const enrichment = prospect.enrichment_data ? JSON.parse(prospect.enrichment_data) : null;
  const sources = prospect.web_sources ? JSON.parse(prospect.web_sources) as string[] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/prospects" className="hover:text-gray-900">Prospects</Link>
        <span>/</span>
        <span>{prospect.contact_name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{prospect.contact_name}</h1>
          <p className="text-gray-600">{prospect.role}</p>
          <p className="text-gray-500 text-sm">{prospect.org_name} · {prospect.org_type} · {prospect.region}</p>
          {prospect.email && <p className="text-sm text-emerald-700 mt-1">{prospect.email}</p>}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{prospect.contact_status}</Badge>
            {prospect.is_gp_or_service_provider && (
              <Badge variant="outline" className="text-red-600 border-red-200">GP / Service Provider</Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold font-mono">{prospect.composite_score?.toFixed(1) ?? "—"}</p>
          {prospect.tier && (
            <Badge className={`${TIER_COLORS[prospect.tier]} text-white mt-1`}>
              {prospect.tier}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Profile</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dim" className="text-xs" />
                <PolarRadiusAxis angle={30} domain={[0, 10]} />
                <Radar dataKey="score" stroke="#059669" fill="#059669" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score Breakdown */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Score Breakdown</CardTitle>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Composite = (Sector × 0.35) + (Relationship × 0.30) + (Halo × 0.20) + (Emerging × 0.15)
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <ScoreBar
              label="D1 — Sector & Mandate Fit (35%)"
              score={prospect.sector_fit_score}
              confidence={prospect.sector_fit_confidence}
              reasoning={prospect.sector_fit_reasoning}
            />
            <Separator />
            <ScoreBar
              label="D2 — Relationship Depth (30%)"
              score={prospect.relationship_depth}
              reasoning="Pre-computed from CRM data (lifecycle stage, notes, deal associations, recency)."
            />
            <Separator />
            <ScoreBar
              label="D3 — Halo & Strategic Value (20%)"
              score={prospect.halo_score}
              confidence={prospect.halo_confidence}
              reasoning={prospect.halo_reasoning}
            />
            <Separator />
            <ScoreBar
              label="D4 — Emerging Manager Fit (15%)"
              score={prospect.emerging_manager_score}
              confidence={prospect.emerging_manager_confidence}
              reasoning={prospect.emerging_manager_reasoning}
            />
          </CardContent>
        </Card>
      </div>

      {/* Enrichment Summary + AUM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {enrichment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">{enrichment.summary}</p>
              {enrichment.validation_warnings?.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <p className="font-medium mb-1">Validation Warnings:</p>
                  {enrichment.validation_warnings.map((w: string, i: number) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {(prospect.estimated_aum || prospect.estimated_check_size) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimated Size</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {prospect.estimated_aum && (
                  <p><span className="text-gray-500">AUM:</span> {prospect.estimated_aum}</p>
                )}
                {prospect.estimated_check_size && (
                  <p><span className="text-gray-500">Est. Check Size:</span> {prospect.estimated_check_size}</p>
                )}
              </CardContent>
            </Card>
          )}

          {sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Web Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1">
                  {sources.slice(0, 10).map((url, i) => (
                    <li key={i} className="truncate">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {prospect.other_contacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Other Contacts at {prospect.org_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {prospect.other_contacts.map((c) => (
                    <Link key={c.id} href={`/prospects/${c.id}`} className="block hover:bg-gray-50 p-2 rounded text-sm">
                      <p className="font-medium text-emerald-700">{c.contact_name}</p>
                      <p className="text-xs text-gray-500">{c.role} · Score: {c.composite_score?.toFixed(1) ?? "—"}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
