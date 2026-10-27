"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Scale,
  Eye,
  Lock,
  FileCheck2,
  GitBranch,
  Users,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  BookOpen,
  ServerCog,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface AuditVerification {
  verified: boolean;
  chain_length: number;
  status: string;
  broken_linkage?: boolean;
  tampered_event_id?: string | null;
}

const PRINCIPLES = [
  {
    icon: Scale,
    title: "Decision support, never automation",
    body: "Nexora does not approve, reject, or penalise an institution. It assembles evidence, applies versioned rules, and surfaces advisory signals for a human scrutiny officer.",
  },
  {
    icon: AlertTriangle,
    title: "Signals are not proof of fraud",
    body: "Anomaly checks are heuristic prompts. Every finding uses cautious language and must be confirmed, dismissed, escalated, or clarified by a reviewer with a written rationale.",
  },
  {
    icon: Eye,
    title: "Provenance before assertion",
    body: "Extracted facts point back to the source document, page, bounding box, extraction method, and confidence. Missing values stay missing and route to manual review.",
  },
  {
    icon: Lock,
    title: "Immutable originals, auditable edits",
    body: "Uploaded files keep their SHA-256 digest. Reviewer corrections create a new field version while the raw extracted value remains in the audit trail.",
  },
];

const ROLE_MATRIX = [
  { role: "Applicant", can: "View redacted status, notices and re-upload simulation", cannot: "See internal signals, confidence scores or officer notes" },
  { role: "Scrutiny Officer", can: "Run extraction, validation and registry checks; triage findings", cannot: "Auto-approve or delete the audit trail" },
  { role: "Senior Reviewer", can: "Review escalations and endorse a recommendation", cannot: "Bypass the mandatory rationale requirement" },
  { role: "Auditor", can: "Read the ledger, verify hash-chain integrity and export dossiers", cannot: "Modify case findings or applicant evidence" },
  { role: "Administrator", can: "Manage rule-pack versions and demo accounts", cannot: "Silently alter historical review decisions" },
];

const DEMO_BOUNDARIES = [
  "External issuer connectors are simulated and visibly watermarked. No government registry is contacted.",
  "Synthetic PDFs are marked “SAMPLE: NOT AN OFFICIAL DOCUMENT”; all institution names and identifiers are fictional.",
  "The evaluation page reports a small curated benchmark, not production accuracy or a certified model score.",
  "Applicant re-upload is a front-end simulation; the reviewer action and audit event are persisted.",
  "Authentication and role switching are demo conveniences, not a production identity provider.",
  "PDF exports are watermarked and carry no legal validity.",
];

export default function GovernancePage() {
  const { user } = useAuth();
  const [ledger, setLedger] = useState<AuditVerification | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const loadLedger = async () => {
    if (!user) return;
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const result = await fetchApi<AuditVerification>("/audit/verify");
      setLedger(result);
    } catch (err: any) {
      setLedgerError(err.message || "Could not verify the audit ledger.");
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-surface-border">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-teal-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Responsible deployment
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
              Governance, assurance & demo boundaries
            </h1>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Nexora is a human-in-the-loop decision-support prototype. This page explains the safeguards that make
              the workflow defensible, what is simulated in this demo, and what would be required before any
              production deployment.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600 self-start lg:self-auto"
          >
            Return to scrutiny queue
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Live audit ledger card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-surface-border bg-surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-300" />
                  <h2 className="text-sm font-semibold text-slate-100">Tamper-evident audit ledger</h2>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xl leading-relaxed">
                  Every intake, extraction, validation, verification, alert and review action is appended to a SHA-256
                  hash chain. The live check below recomputes the chain over the current demo database.
                </p>
              </div>
              <button
                onClick={loadLedger}
                disabled={!user || ledgerLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-surface-border bg-surface text-[11px] text-slate-200 hover:border-slate-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${ledgerLoading ? "animate-spin" : ""}`} />
                Re-verify
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-md bg-surface border border-surface-border p-3">
                <div className="text-[9px] font-mono uppercase text-muted-foreground">Chain status</div>
                {ledgerLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-cyan-300 mt-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
                  </div>
                ) : ledgerError ? (
                  <div className="text-xs text-amber-300 mt-1.5">Check unavailable</div>
                ) : ledger ? (
                  <div className={`text-xs font-bold mt-1.5 inline-flex items-center gap-1.5 ${
                    ledger.verified ? "text-emerald-300" : "text-rose-300"
                  }`}>
                    {ledger.verified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {ledger.verified ? "Verified" : "Attention required"}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1.5">Sign in to check</div>
                )}
              </div>
              <div className="rounded-md bg-surface border border-surface-border p-3">
                <div className="text-[9px] font-mono uppercase text-muted-foreground">Events chained</div>
                <div className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
                  {ledger?.chain_length ?? "—"}
                </div>
              </div>
              <div className="rounded-md bg-surface border border-surface-border p-3">
                <div className="text-[9px] font-mono uppercase text-muted-foreground">Reported state</div>
                <div className="text-xs font-semibold text-slate-200 mt-1.5">
                  {ledger?.status?.replace(/_/g, " ") || (ledgerError ? "Unavailable" : "Awaiting check")}
                </div>
              </div>
            </div>

            {ledgerError && (
              <p className="text-[10px] text-amber-300/90 mt-3">
                {ledgerError}. The governance principles below still describe the intended control design.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-5">
            <div className="flex items-center gap-2">
              <ServerCog className="w-4 h-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Demo environment</h2>
            </div>
            <div className="mt-3 space-y-2 text-[11px] text-cyan-100/80 leading-relaxed">
              <p><span className="font-mono text-cyan-300">DATA</span> · Synthetic institutions, documents and registry responses only.</p>
              <p><span className="font-mono text-cyan-300">CONNECTORS</span> · Simulated external issuers, clearly labelled in the UI.</p>
              <p><span className="font-mono text-cyan-300">DECISIONS</span> · No automatic approval or rejection; officer rationale required.</p>
              <p><span className="font-mono text-cyan-300">SCOPE</span> · Independent decision-support prototype, not a production certification.</p>
            </div>
          </div>
        </div>

        {/* Principles */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-300" />
            <h2 className="text-sm font-semibold text-slate-100">Design principles enforced in the workflow</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="rounded-lg border border-surface-border bg-surface-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-teal-500/10 border border-teal-500/25 flex items-center justify-center shrink-0">
                    <principle.icon className="w-4 h-4 text-teal-300" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-100">{principle.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{principle.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roles and boundaries */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-300" />
              <h2 className="text-sm font-semibold text-slate-100">Role boundaries</h2>
            </div>
            <div className="divide-y divide-surface-border">
              {ROLE_MATRIX.map((row) => (
                <div key={row.role} className="p-4">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-3 h-3 text-teal-300" />
                    <span className="text-xs font-semibold text-slate-200">{row.role}</span>
                  </div>
                  <p className="text-[10px] text-emerald-300/90 mt-1.5">Can: {row.can}</p>
                  <p className="text-[10px] text-rose-300/80 mt-0.5">Cannot: {row.cannot}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-amber-900/60 bg-amber-950/15 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-900/50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-slate-100">Explicit demo boundaries</h2>
              </div>
              <ul className="p-4 space-y-2">
                {DEMO_BOUNDARIES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] text-amber-100/80 leading-relaxed">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-teal-300" />
                <h2 className="text-sm font-semibold text-slate-100">Before production</h2>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "Formal rule-pack approval with AICTE handbook owners and change control.",
                  "Authenticated identity provider, least-privilege roles and production secret management.",
                  "Real issuer integrations with signed responses, retries, timeouts and escalation paths.",
                  "Validated extraction metrics, bias review, monitoring and human-factors testing.",
                  "Data-retention, consent, grievance-redressal and accessibility conformance.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-[11px] text-slate-300 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
              <Link
                href="/evaluation"
                className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-3"
              >
                View the curated benchmark caveat <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-surface-border bg-surface px-4 py-3 text-[10px] font-mono text-muted-foreground text-center">
          Nexora · decision-support prototype · synthetic data only · no legal validity
        </div>
      </main>
    </div>
  );
}
