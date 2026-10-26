"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Plus, 
  Sparkles, 
  ExternalLink, 
  Eye, 
  Search,
  ChevronRight,
  Database
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface ApplicationItem {
  id: string;
  category: string;
  academic_year: string;
  assessment_date: string;
  status: string;
  created_at: string;
  institution?: {
    name: string;
    permanent_id: string;
  };
  documents: Array<{ id: string; document_type: string; filename: string }>;
}

const BUNDLE_OPTIONS = [
  { key: "bundle_a_clean", label: "Case A: Clean Benchmark (Matching intake 60, valid dates)" },
  { key: "bundle_b_missing_doc", label: "Case B: Missing Affiliation Document" },
  { key: "bundle_c_expired_cert", label: "Case C: Expired Fire NOC (Expired before 2026-10-26)" },
  { key: "bundle_d_intake_mismatch", label: "Case D: Intake Mismatch (Application 60 vs Letter 120)" },
  { key: "bundle_e_exact_duplicate", label: "Case E: Exact Duplicate File Upload (Identical SHA-256)" },
  { key: "bundle_f_near_duplicate", label: "Case F: Near Duplicate / Rescanned Document Signal" },
  { key: "bundle_g_modified_pdf", label: "Case G: Modified PDF (Incremental Revision Signal)" },
  { key: "bundle_h_low_quality_ocr", label: "Case H: Low Quality Scan (OCR Stress Test)" },
  { key: "bundle_i_name_variant", label: "Case I: Institution Name Variant (A.B.C. Inst. of Tech.)" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  const loadApplications = async () => {
    try {
      setLoading(true);
      let queryParams = new URLSearchParams();
      if (statusFilter) queryParams.set("status", statusFilter);
      if (yearFilter) queryParams.set("year", yearFilter);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const data = await fetchApi<ApplicationItem[]>(`/applications${qs}`);
      setApplications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [statusFilter, yearFilter]);

  const handleSeedBundle = async (bundleKey: string) => {
    try {
      setSeedingLoading(true);
      await fetchApi(`/applications/seed-demo?bundle_key=${bundleKey}`, {
        method: "POST",
      });
      setSeedModalOpen(false);
      await loadApplications();
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`);
    } finally {
      setSeedingLoading(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const instName = app.institution?.name?.toLowerCase() || "";
    const pid = app.institution?.permanent_id?.toLowerCase() || "";
    return instName.includes(q) || pid.includes(q) || app.id.toLowerCase().includes(q);
  });

  // Calculate real dashboard KPIs
  const totalCount = applications.length;
  const pendingCount = applications.filter((a) => a.status === "preliminary_review").length;
  const inProgressCount = applications.filter((a) => a.status === "in_progress").length;
  const deficienciesCount = applications.filter((a) => a.status === "deficiencies_flagged").length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Regulatory Scrutiny Queue
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                AY 2026-27
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active intake submissions for preliminary compliance, anomaly triaging, and evidence review.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSeedModalOpen(true)}
              className="px-3.5 py-2 rounded-md bg-surface-card border border-surface-border text-xs font-semibold text-slate-200 hover:bg-surface-hover hover:border-slate-600 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Load Synthetic Case</span>
            </button>

            <Link
              href="/applications/new"
              className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>New Intake Form</span>
            </Link>
          </div>
        </div>

        {/* Real KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
          <div className="bg-surface-card p-4 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Applications</span>
              <Database className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-2">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Seeded & Ingested Cases</div>
          </div>

          <div className="bg-surface-card p-4 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Preliminary Review</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">{pendingCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Pending Officer Scrutiny</div>
          </div>

          <div className="bg-surface-card p-4 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>In Verification</span>
              <FileText className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300 mt-2">{inProgressCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Extraction & Rule Checks</div>
          </div>

          <div className="bg-surface-card p-4 rounded-lg border border-surface-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Deficiencies Flagged</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-300 mt-2">{deficienciesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Evidence Discrepancies</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-surface-card p-4 rounded-lg border border-surface-border mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by institution name, PID, or case ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface rounded-md border border-surface-border text-xs text-slate-100 placeholder:text-muted-foreground focus:outline-none focus:border-accent font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface text-xs text-slate-200 border border-surface-border rounded-md px-3 py-1.5 focus:outline-none focus:border-accent"
            >
              <option value="">All Statuses</option>
              <option value="preliminary_review">Preliminary Review</option>
              <option value="in_progress">In Progress</option>
              <option value="deficiencies_flagged">Deficiencies Flagged</option>
              <option value="escalated">Escalated</option>
              <option value="review_completed">Review Completed</option>
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-surface text-xs text-slate-200 border border-surface-border rounded-md px-3 py-1.5 focus:outline-none focus:border-accent font-mono"
            >
              <option value="">All Years</option>
              <option value="2026-27">AY 2026-27</option>
              <option value="2025-26">AY 2025-26</option>
            </select>
          </div>
        </div>

        {/* Application Queue Table */}
        <div className="bg-surface-card rounded-lg border border-surface-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mx-auto" />
              <p>Loading application scrutiny queue...</p>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="p-16 text-center text-xs text-muted-foreground space-y-3">
              <FileText className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold">No applications found in queue</p>
              <p className="text-slate-500">
                Click <strong className="text-slate-300">"Load Synthetic Case"</strong> to instantly provision one of the 9 benchmark bundles.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-surface text-muted-foreground font-mono uppercase text-[11px] border-b border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Case ID</th>
                    <th className="py-3 px-4">Institution & Permanent ID</th>
                    <th className="py-3 px-4">Category & Year</th>
                    <th className="py-3 px-4">Assessment Date</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border font-sans">
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-surface-hover transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {app.id.substring(0, 8)}...
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">
                          {app.institution?.name || "ABC Institute of Technology"}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          PID: {app.institution?.permanent_id || "1-9876543210"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>{app.category}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{app.academic_year}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        {app.assessment_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          <FileText className="w-3 h-3 text-accent" />
                          {app.documents?.length || 0} files
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={app.status === "preliminary_review" ? "pending" : app.status}
                          customLabel={
                            app.status === "preliminary_review"
                              ? "Preliminary Review"
                              : app.status.replace("_", " ")
                          }
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/applications/${app.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-surface hover:bg-surface-card border border-surface-border text-xs font-medium text-slate-200 hover:text-white transition-colors"
                        >
                          <span>Review Case</span>
                          <ChevronRight className="w-3.5 h-3.5 text-accent" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Quick Seed Synthetic Case */}
        {seedModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-card rounded-lg border border-surface-border p-6 max-w-xl w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h3 className="font-bold text-slate-100 text-base">Select Synthetic Benchmark Case</h3>
                </div>
                <button
                  onClick={() => setSeedModalOpen(false)}
                  className="text-slate-400 hover:text-white text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Choose a pre-generated synthetic application scenario. The bundle will be ingested into safe storage,
                SHA-256 hashed, and registered in the append-only audit trail.
              </p>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {BUNDLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    disabled={seedingLoading}
                    onClick={() => handleSeedBundle(opt.key)}
                    className="w-full text-left p-3 rounded-md bg-surface border border-surface-border hover:border-accent hover:bg-surface-hover text-xs transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 group-hover:text-accent">{opt.label}</div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{opt.key}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent shrink-0" />
                  </button>
                ))}
              </div>

              {seedingLoading && (
                <div className="pt-2 text-center text-xs text-accent animate-pulse font-mono">
                  Ingesting documents and computing cryptographic hashes...
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
