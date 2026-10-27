"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Inbox,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface AlertItem {
  id: string;
  application_id: string;
  finding_id?: string | null;
  verification_id?: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  missing_document: "Missing document",
  expired_document: "Expired document",
  inconsistency: "Cross-document inconsistency",
  anomaly_signal: "Anomaly signal",
  verification: "External verification",
  manual_review: "Manual review",
  rectification: "Rectification",
};

function relativeTime(value: string): string {
  if (!value) return "just now";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AlertCentrePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolveAlert, setResolveAlert] = useState<AlertItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const suffix = statusFilter ? `?status=${statusFilter}` : "";
      const data = await fetchApi<AlertItem[]>(`/alerts${suffix}`);
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || "Unable to load alerts.");
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
    if (user) loadAlerts();
  }, [user, statusFilter]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return alerts;
    return alerts.filter((alert) => alert.alert_type === typeFilter);
  }, [alerts, typeFilter]);

  const openCount = alerts.filter((a) => a.status === "open").length;
  const criticalCount = alerts.filter((a) => a.severity === "fail").length;

  const acknowledge = async (alert: AlertItem) => {
    try {
      setBusyId(alert.id);
      await fetchApi(`/alerts/${alert.id}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ note: "Acknowledged in reviewer alert centre." }),
      });
      await loadAlerts();
    } catch (err: any) {
      setError(err.message || "Unable to acknowledge alert.");
    } finally {
      setBusyId(null);
    }
  };

  const submitResolution = async () => {
    if (!resolveAlert) return;
    if (resolutionNote.trim().length < 5) {
      setError("Please enter a resolution note of at least 5 characters.");
      return;
    }
    try {
      setBusyId(resolveAlert.id);
      await fetchApi(`/alerts/${resolveAlert.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_note: resolutionNote.trim() }),
      });
      setResolveAlert(null);
      setResolutionNote("");
      setError(null);
      await loadAlerts();
    } catch (err: any) {
      setError(err.message || "Unable to resolve alert.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
                <Bell className="w-4.5 h-4.5 text-rose-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100">Reviewer Alert Centre</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A single triage queue for document deficiencies, anomalies, and external verification outcomes.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={loadAlerts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-surface-card border border-surface-border text-xs text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh queue
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground">
              <span>Open queue</span>
              <Inbox className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1">{openCount}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Requires reviewer triage</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground">
              <span>High priority</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-300 mt-1">{criticalCount}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Deficiency-level signals</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground">
              <span>Shown</span>
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{filtered.length}</div>
            <div className="text-[10px] text-muted-foreground mt-1">Matching current filters</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-muted-foreground">
              <span>Workflow</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-semibold text-emerald-300 mt-2">Advisory only</div>
            <div className="text-[10px] text-muted-foreground mt-1">No automatic approval / rejection</div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md border border-rose-800 bg-rose-950/30 text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-lg bg-surface-card border border-surface-border">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: "open", label: "Open" },
              { key: "acknowledged", label: "Acknowledged" },
              { key: "resolved", label: "Resolved" },
              { key: "", label: "All" },
            ].map((tab) => (
              <button
                key={tab.key || "all"}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  statusFilter === tab.key
                    ? "bg-accent-muted border-accent text-accent"
                    : "bg-surface border-surface-border text-slate-300 hover:border-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-64 bg-surface border border-surface-border rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
          >
            <option value="all">All alert types</option>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-16 text-center text-xs text-muted-foreground bg-surface-card border border-surface-border rounded-lg">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
            Loading reviewer alert queue...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center bg-surface-card border border-surface-border rounded-lg space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-200">No alerts in this view</h3>
            <p className="text-xs text-muted-foreground">
              Try a different status filter, or run scrutiny on a synthetic case to generate signals.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border bg-surface-card p-4 space-y-3 ${
                  alert.severity === "fail"
                    ? "border-rose-800/80"
                    : alert.severity === "manual_review_required"
                    ? "border-pink-800/70"
                    : "border-amber-800/70"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-md border flex items-center justify-center shrink-0 ${
                      alert.severity === "fail"
                        ? "bg-rose-950/60 border-rose-800 text-rose-300"
                        : alert.severity === "manual_review_required"
                        ? "bg-pink-950/60 border-pink-800 text-pink-300"
                        : "bg-amber-950/60 border-amber-800 text-amber-300"
                    }`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={alert.severity} size="sm" />
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {TYPE_LABELS[alert.alert_type] || alert.alert_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {relativeTime(alert.created_at)}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-100 mt-1.5">{alert.title}</h3>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-4xl">{alert.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                      alert.status === "open"
                        ? "bg-amber-950/60 text-amber-300 border-amber-800"
                        : alert.status === "acknowledged"
                        ? "bg-cyan-950/60 text-cyan-300 border-cyan-800"
                        : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                    }`}>
                      {alert.status}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-surface-border/60 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/applications/${alert.application_id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-medium"
                  >
                    Open case {alert.application_id.substring(0, 8)}...
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  <div className="flex items-center gap-2">
                    {alert.status === "open" && (
                      <button
                        onClick={() => acknowledge(alert)}
                        disabled={busyId === alert.id}
                        className="px-3 py-1.5 rounded-md border border-cyan-800 bg-cyan-950/40 text-cyan-200 text-[11px] font-semibold hover:bg-cyan-900/50 disabled:opacity-50"
                      >
                        {busyId === alert.id ? "Updating..." : "Acknowledge"}
                      </button>
                    )}
                    {alert.status !== "resolved" && (
                      <button
                        onClick={() => {
                          setResolveAlert(alert);
                          setResolutionNote("");
                        }}
                        className="px-3 py-1.5 rounded-md border border-emerald-800 bg-emerald-950/40 text-emerald-200 text-[11px] font-semibold hover:bg-emerald-900/50"
                      >
                        Resolve with note
                      </button>
                    )}
                    {alert.status === "resolved" && alert.resolution_note && (
                      <span className="text-[11px] text-muted-foreground italic max-w-xl truncate">
                        “{alert.resolution_note}”
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {resolveAlert && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-surface-card border border-surface-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Resolve alert with rationale</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{resolveAlert.title}</p>
              </div>
              <button
                onClick={() => setResolveAlert(null)}
                className="text-muted-foreground hover:text-slate-200"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{resolveAlert.message}</p>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Resolution note <span className="text-rose-300">*</span>
              </label>
              <textarea
                rows={4}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe the reviewer action, evidence checked, or why the signal is no longer actionable..."
                className="w-full rounded-md bg-surface border border-surface-border p-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <button
                onClick={() => setResolveAlert(null)}
                className="px-4 py-2 rounded-md border border-surface-border text-xs text-slate-300 hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                disabled={busyId === resolveAlert.id}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {busyId === resolveAlert.id ? "Resolving..." : "Resolve alert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
