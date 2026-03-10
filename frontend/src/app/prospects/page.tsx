"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Prospect } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TIER_COLORS: Record<string, string> = {
  "PRIORITY CLOSE": "bg-emerald-600 hover:bg-emerald-700",
  "STRONG FIT": "bg-blue-600 hover:bg-blue-700",
  "MODERATE FIT": "bg-amber-500 hover:bg-amber-600",
  "WEAK FIT": "bg-gray-400 hover:bg-gray-500",
};

const ORG_TYPES = [
  "Single Family Office",
  "Multi-Family Office",
  "Fund of Funds",
  "Foundation",
  "Endowment",
  "Pension",
  "Insurance",
  "Asset Manager",
  "RIA/FIA",
  "HNWI",
  "Private Capital Firm",
];

function ScoreCell({ score, confidence }: { score: number | null; confidence?: number | null }) {
  if (score === null || score === undefined) return <span className="text-gray-300">—</span>;
  const color =
    score >= 8 ? "text-emerald-700" :
    score >= 6 ? "text-blue-600" :
    score >= 4 ? "text-amber-600" :
    "text-gray-500";
  const confDot = confidence !== null && confidence !== undefined
    ? confidence >= 0.7 ? "bg-emerald-500" : confidence >= 0.4 ? "bg-amber-500" : "bg-red-400"
    : null;
  return (
    <span className={`font-mono font-medium ${color} flex items-center gap-1`}>
      {score.toFixed(1)}
      {confDot && <span className={`w-1.5 h-1.5 rounded-full ${confDot}`} />}
    </span>
  );
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [orgTypeFilter, setOrgTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("composite_score");
  const [order, setOrder] = useState("desc");

  const loadData = useCallback(async () => {
    try {
      const data = await api.getProspects({
        search: search || undefined,
        tier: tierFilter || undefined,
        org_type: orgTypeFilter || undefined,
        sort_by: sortBy,
        order,
        limit: 200,
      });
      setProspects(data);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter, orgTypeFilter, sortBy, order]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setOrder("desc");
    }
  };

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-gray-50 select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}
      {sortBy === col && (
        <span className="ml-1">{order === "desc" ? "↓" : "↑"}</span>
      )}
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Prospects</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search contacts or orgs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Tiers</option>
          <option value="PRIORITY CLOSE">Priority Close</option>
          <option value="STRONG FIT">Strong Fit</option>
          <option value="MODERATE FIT">Moderate Fit</option>
          <option value="WEAK FIT">Weak Fit</option>
        </select>
        <select
          value={orgTypeFilter}
          onChange={(e) => setOrgTypeFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">All Org Types</option>
          {ORG_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {prospects.length} prospects
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          Loading...
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader col="contact_name" label="Contact" />
                <SortHeader col="org_name" label="Organization" />
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <SortHeader col="sector_fit_score" label="Sector" />
                <SortHeader col="relationship_depth" label="Rel." />
                <SortHeader col="halo_score" label="Halo" />
                <SortHeader col="emerging_manager_score" label="EM" />
                <SortHeader col="composite_score" label="Composite" />
                <TableHead>Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((p) => (
                <TableRow key={p.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Link
                      href={`/prospects/${p.id}`}
                      className="text-emerald-700 hover:underline font-medium"
                    >
                      {p.contact_name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {p.org_name}
                    {p.is_gp_or_service_provider && (
                      <Badge variant="outline" className="ml-2 text-xs text-red-600 border-red-200">
                        GP/SP
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {p.org_type}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">
                    {p.role}
                  </TableCell>
                  <TableCell>
                    <ScoreCell score={p.sector_fit_score} confidence={p.sector_fit_confidence} />
                  </TableCell>
                  <TableCell>
                    <ScoreCell score={p.relationship_depth} />
                  </TableCell>
                  <TableCell>
                    <ScoreCell score={p.halo_score} confidence={p.halo_confidence} />
                  </TableCell>
                  <TableCell>
                    <ScoreCell score={p.emerging_manager_score} confidence={p.emerging_manager_confidence} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold text-base">
                      {p.composite_score?.toFixed(1) ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.tier ? (
                      <Badge className={`${TIER_COLORS[p.tier]} text-white text-xs`}>
                        {p.tier}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {prospects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                    No prospects found. Upload a CSV and run enrichment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
