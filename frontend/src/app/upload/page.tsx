"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    contacts_created: number;
    orgs_created: number;
    orgs_existing: number;
  } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentJobId, setEnrichmentJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      setFile(dropped);
      setError(null);
    } else {
      setError("Please upload a .csv file");
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadCSV(file);
      setUploadResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setError(null);
    try {
      const job = await api.startEnrichment();
      setEnrichmentJobId(job.id);
      // Navigate to dashboard to watch progress
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start enrichment");
      setEnriching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Upload Prospects</h1>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => { setFile(null); setUploadResult(null); }}
                  className="text-xs text-red-500 hover:underline mt-2"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 mb-2">
                  Drag & drop a CSV file here, or
                </p>
                <label className="cursor-pointer text-emerald-700 hover:underline font-medium">
                  browse files
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setFile(f); setError(null); }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}

          {file && !uploadResult && (
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 bg-emerald-700 hover:bg-emerald-800"
            >
              {uploading ? "Uploading..." : "Upload CSV"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-emerald-700">
              Upload Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{uploadResult.contacts_created}</p>
                <p className="text-xs text-gray-500">Contacts Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{uploadResult.orgs_created}</p>
                <p className="text-xs text-gray-500">New Orgs</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{uploadResult.orgs_existing}</p>
                <p className="text-xs text-gray-500">Existing Orgs</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-600 mb-3">
                Ready to enrich organizations with AI-powered web search and scoring?
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  {enriching ? "Starting..." : "Start Enrichment"}
                </Button>
                <Button variant="outline" onClick={() => router.push("/prospects")}>
                  View Prospects
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                You can also start enrichment later from the Dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expected Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs font-mono bg-gray-50 p-3 rounded overflow-x-auto">
            Contact Name, Organization, Org Type, Role, Email, Region, Contact Status, Relationship Depth
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Org Types: Single Family Office, Multi-Family Office, Fund of Funds, Foundation, Endowment, Pension, Insurance, Asset Manager, RIA/FIA, HNWI, Private Capital Firm
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
