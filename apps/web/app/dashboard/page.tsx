"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Plus,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  X,
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

interface AlertItem {
  id: string;
  application_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
}

const BUNDLE_OPTIONS = [
  { key: "bundle_a_clean", label: "Clean benchmark", detail: "All documents present, dates valid, intake consistent" },
  { key: "bundle_b_missing_doc", label: "Missing affiliation document", detail: "A required university affiliation order is absent" },
  { key: "bundle_c_expired_cert", label: "Expired fire NOC", detail: "Certificate lapsed before the assessment date" },
  { key: "bundle_d_intake_mismatch", label: "Intake mismatch", detail: "Application says 60 seats; prior approval says 120" },
  { key: "bundle_e_exact_duplicate", label: "Exact duplicate file", detail: "Identical SHA-256 hash used for two requirements" },
  { key: "bundle_f_near_duplicate", label: "Near-duplicate scan", detail: "Rescanned document signal, treated as advisory" },
  { key: "bundle_g_modified_pdf", label: "Modified PDF", detail: "Incremental revision signal in document structure" },
  { key: "bundle_h_low_quality_ocr", label: "Low-quality scan", detail: "OCR stress test with uncertain extracted fields" },
  { key: "bundle_i_name_variant", label: "Institution name variant", detail: "Name differs across submitted documents" },
];

const WORKFLOW_STEPS = [
  {
    icon: FileText,
    title: "Open a case",
    detail: "Start with the application bundle and its immutable evidence record.",
  },
  {
    icon: ScanSearch,
    title: "Run scrutiny",
    detail: "Extract facts, apply rule checks, and query simulated registries.",
  },
  {
    icon: ClipboardCheck,
    title: "Review the evidence",
    detail: "Follow every finding back to the source page and extracted value.",
  },
  {
    icon: ShieldCheck,
    title: "Record a decision",
    detail: "A human reviewer acknowledges alerts and signs off with a rationale.",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
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
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    loadApplications();
    fetchApi<AlertItem[]>("/alerts?status=open")
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, [user, statusFilter, yearFilter]);

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

  const totalCount = applications.length;
  const needsAttentionCount = applications.filter((a) =>
    ["deficiencies_flagged", "escalated"].includes(a.status)
  ).length;
  const completedCount = applications.filter((a) => a.status === "review_completed").length;
  const cleanCase = applications.find((a) => a.status === "review_completed") || applications[0];
  const flaggedCase =
    applications.find((a) => a.status === "deficiencies_flagged") ||
    applications.find((a) => a.status === "escalated") ||
    applications[1];

  const formatDate = (value: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <NavHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 border-b border-surface-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="vs-eyebrow">Reviewer workspace</div>
            <h1 className="mt-2 text-3xl text-foreground sm:text-4xl">Scrutiny queue</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Every application arrives with its evidence, extracted facts, rule checks, and registry signals.
              Your job is to review the case, not reconstruct it from scratch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSeedModalOpen(true)} className="vs-button-secondary">
              <Sparkles className="h-4 w-4 text-accent" />
              Add demo case
            </button>
            <Link href="/applications/new" className="vs-button-primary">
              <Plus className="h-4 w-4" />
              New intake
            </Link>
          </div>
        </header>

        <section className="vs-card mt-8 overflow-hidden">
          <div className="grid divide-y divide-surface-border md:grid-cols-4 md:divide-x md:divide-y-0">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-border bg-surface font-mono text-[11px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <Icon className="h-4 w-4 text-accent" />
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-foreground">{step.title}</h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Active cases", value: totalCount, detail: "In the current queue", icon: FileText, tone: "text-foreground" },
            { label: "Needs attention", value: needsAttentionCount, detail: "Flagged or escalated", icon: AlertTriangle, tone: "text-rose-700" },
            { label: "Open alerts", value: alerts.length, detail: "Awaiting triage", icon: Bell, tone: "text-amber-700" },
            { label: "Completed", value: completedCount, detail: "Decision recorded", icon: CheckCircle2, tone: "text-emerald-700" },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="vs-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                  <Icon className={`h-4 w-4 ${metric.tone}`} />
                </div>
                <div className={`mt-3 font-mono text-3xl font-semibold tracking-tight ${metric.tone}`}>
                  {metric.value}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
              </div>
            );
          })}
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl text-foreground">Application queue</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open a case to inspect its evidence and reviewer actions.
                </p>
              </div>
              <Link href="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Open Alert Centre <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="vs-card mt-4 overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-surface-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search institution, PID, or case ID"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="vs-input py-2 pl-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="vs-input w-auto py-2 text-xs"
                  >
                    <option value="">All statuses</option>
                    <option value="preliminary_review">Preliminary review</option>
                    <option value="in_progress">In progress</option>
                    <option value="deficiencies_flagged">Deficiencies flagged</option>
                    <option value="escalated">Escalated</option>
                    <option value="review_completed">Review completed</option>
                  </select>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="vs-input w-auto py-2 font-mono text-xs"
                  >
                    <option value="">All years</option>
                    <option value="2026-27">2026-27</option>
                    <option value="2025-26">2025-26</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 p-14 text-xs text-muted-foreground">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Loading the review queue…
                </div>
              ) : filteredApps.length === 0 ? (
                <div className="p-14 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold text-foreground">No applications found</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Adjust the filters, or add a synthetic demo case to start a walkthrough.
                  </p>
                  <button onClick={() => setSeedModalOpen(true)} className="vs-button-secondary mt-4">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Add a demo case
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b border-surface-border bg-surface font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3.5">Institution & application</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Evidence</th>
                        <th className="px-4 py-3.5">Updated</th>
                        <th className="px-4 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {filteredApps.map((app) => (
                        <tr key={app.id} className="transition-colors hover:bg-surface-hover">
                          <td className="px-4 py-4">
                            <div className="text-sm font-semibold text-foreground">
                              {app.institution?.name || "Institution name unavailable"}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              PID {app.institution?.permanent_id || "—"} · {app.category} · {app.academic_year}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge
                              status={app.status === "preliminary_review" ? "pending" : app.status}
                              customLabel={
                                app.status === "preliminary_review"
                                  ? "Preliminary review"
                                  : app.status.replace(/_/g, " ")
                              }
                              size="sm"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface px-2 py-1 font-mono text-[11px] text-muted-foreground">
                              <FileText className="h-3.5 w-3.5 text-accent" />
                              {app.documents?.length || 0} files
                            </span>
                          </td>
                          <td className="px-4 py-4 font-mono text-[11px] text-muted-foreground">
                            {formatDate(app.created_at)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/applications/${app.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                            >
                              Review case
                              <ChevronRight className="h-3.5 w-3.5 text-accent" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="vs-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-rose-600" />
                  <h2 className="text-sm font-semibold text-foreground">Priority alerts</h2>
                </div>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-[10px] text-rose-700">
                  {alerts.length} open
                </span>
              </div>
              {alerts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                  <p className="mt-2 text-xs font-medium text-foreground">No open alerts</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Run scrutiny on a case to generate reviewer signals.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {alerts.slice(0, 4).map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/applications/${alert.application_id}`}
                      className="block px-5 py-4 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            alert.severity === "fail" ? "bg-rose-500" : "bg-amber-500"
                          }`}
                        />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {alert.alert_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                        {alert.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {alert.message}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="border-t border-surface-border px-5 py-3">
                <Link href="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  View all alerts <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>

            <section className="rounded-lg border border-surface-border bg-accent-muted p-5">
              <div className="vs-eyebrow text-accent">Suggested demo path</div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Explain the flow in three steps</h2>
              <ol className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    1
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Start with a clean case</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Show a complete evidence chain with no deficiencies.
                    </p>
                    {cleanCase && (
                      <Link
                        href={`/applications/${cleanCase.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        Open clean case <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    2
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Then open a flagged case</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Follow a finding from the rule check back to the source page.
                    </p>
                    {flaggedCase && (
                      <Link
                        href={`/applications/${flaggedCase.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                      >
                        Open flagged case <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                    3
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Finish in the Alert Centre</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      Acknowledge or resolve each signal with a written rationale.
                    </p>
                    <Link
                      href="/alerts"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                    >
                      Open Alert Centre <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </li>
              </ol>
            </section>
          </aside>
        </div>

        {seedModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4">
                <div>
                  <div className="vs-eyebrow">Synthetic test corpus</div>
                  <h2 className="mt-1 text-xl text-foreground">Add a demo case</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Each bundle is ingested, hashed, and registered in the audit trail. Choose a scenario to explain.
                  </p>
                </div>
                <button
                  onClick={() => setSeedModalOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {BUNDLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    disabled={seedingLoading}
                    onClick={() => handleSeedBundle(opt.key)}
                    className="group flex w-full items-center justify-between gap-3 rounded-md border border-surface-border bg-surface p-3.5 text-left transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground group-hover:text-accent">
                        {opt.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {opt.detail}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-accent" />
                  </button>
                ))}
              </div>

              {seedingLoading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-accent">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Ingesting documents and computing hashes…
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
