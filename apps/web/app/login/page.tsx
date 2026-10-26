"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const DEMO_ROLES = [
  {
    role: "Scrutiny Officer (Reviewer)",
    email: "reviewer@aicte-demo.in",
    org: "AICTE Scrutiny Cell, Northern Region",
    description: "Evaluates extracted facts, cross-document discrepancies, and records review actions.",
    badge: "Primary Demo Role"
  },
  {
    role: "Senior Reviewer / Bureau Approver",
    email: "senior_reviewer@aicte-demo.in",
    org: "AICTE Approval Bureau, New Delhi",
    description: "Reviews escalations, inspects officer rationales, and oversees case queues.",
    badge: "Escalations"
  },
  {
    role: "System & Rules Administrator",
    email: "admin@aicte-demo.in",
    org: "AICTE IT & Policy Directorate",
    description: "Manages versioned regulatory rule packs, checklist schemas, and connectors.",
    badge: "Admin"
  },
  {
    role: "Statutory Auditor",
    email: "auditor@aicte-demo.in",
    org: "Independent Governance Oversight",
    description: "Read-only access to tamper-evident audit ledger and cryptographic hash chain.",
    badge: "Read-Only"
  },
  {
    role: "Institute Applicant",
    email: "applicant@aicte-demo.in",
    org: "ABC Institute of Technology",
    description: "Restricted view: sees permitted deficiency notices and uploads replacement evidence.",
    badge: "Applicant View"
  }
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedEmail, setSelectedEmail] = useState(DEMO_ROLES[0].email);
  const [password, setPassword] = useState("DemoPass123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(selectedEmail, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (email: string) => {
    setSelectedEmail(email);
    setPassword("DemoPass123!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-100">VeriScope</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">
          Sign In to Scrutiny Workspace
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a pre-seeded synthetic role profile or enter credentials manually.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-surface-card py-8 px-4 shadow-xl border border-surface-border sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-md bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Role Switcher */}
          <div className="mb-6">
            <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
              1-Click Demo Role Switcher
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {DEMO_ROLES.map((r) => {
                const isSelected = selectedEmail === r.email;
                return (
                  <button
                    key={r.email}
                    type="button"
                    onClick={() => handleQuickSelect(r.email)}
                    className={`text-left p-3 rounded-md border text-xs transition-all flex items-start justify-between ${
                      isSelected
                        ? "bg-accent/15 border-accent text-slate-100"
                        : "bg-surface border-surface-border text-muted-foreground hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <span>{r.role}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                          {r.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{r.email}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{r.description}</div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-4 border-t border-surface-border">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={selectedEmail}
                onChange={(e) => setSelectedEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-sm text-slate-100 focus:outline-none focus:border-accent font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-sm text-slate-100 focus:outline-none focus:border-accent font-mono text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors focus:outline-none disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In with Role"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-[11px] text-muted-foreground">
            Default demo password: <span className="font-mono text-slate-300">DemoPass123!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
