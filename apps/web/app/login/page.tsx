"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

const DEMO_ROLES = [
  {
    role: "Scrutiny Officer",
    email: "reviewer@aicte-demo.in",
    org: "AICTE Scrutiny Cell · Northern Region",
    description: "Evaluates extracted facts, cross-document discrepancies, and records review actions.",
    badge: "Primary demo role",
  },
  {
    role: "Senior Reviewer",
    email: "senior_reviewer@aicte-demo.in",
    org: "AICTE Approval Bureau · New Delhi",
    description: "Reviews escalations, inspects officer rationales, and oversees case queues.",
    badge: "Escalations",
  },
  {
    role: "Rules Administrator",
    email: "admin@aicte-demo.in",
    org: "AICTE IT & Policy Directorate",
    description: "Manages versioned rule packs, checklist schemas, and simulated connectors.",
    badge: "Admin",
  },
  {
    role: "Statutory Auditor",
    email: "auditor@aicte-demo.in",
    org: "Independent governance oversight",
    description: "Read-only access to the tamper-evident audit ledger and hash chain.",
    badge: "Read only",
  },
  {
    role: "Institute Applicant",
    email: "applicant@aicte-demo.in",
    org: "ABC Institute of Technology",
    description: "Restricted view of permitted deficiency notices and replacement evidence uploads.",
    badge: "Applicant view",
  },
];

const FLOW_POINTS = [
  {
    title: "Open the case",
    detail: "See the submitted bundle, extracted fields, and the exact source page behind every fact.",
  },
  {
    title: "Review the signals",
    detail: "Rule checks and registry lookups produce advisory findings, never automatic decisions.",
  },
  {
    title: "Record the rationale",
    detail: "A reviewer acknowledges alerts and signs off. The audit trail captures every action.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedEmail, setSelectedEmail] = useState(DEMO_ROLES[0].email);
  const [password, setPassword] = useState("DemoPass123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => DEMO_ROLES.find((role) => role.email === selectedEmail) || DEMO_ROLES[0],
    [selectedEmail]
  );

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-semibold tracking-tight text-foreground">VeriScope</span>
            <span className="block text-[11px] text-muted-foreground">Evidence-backed scrutiny workspace</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Back to overview
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-8 lg:pt-10">
        <section className="hidden lg:block">
          <div className="vs-eyebrow">Independent scrutiny workspace</div>
          <h1 className="mt-4 max-w-xl text-5xl leading-[1.04] text-foreground xl:text-6xl">
            A clear path from document bundle to reviewer decision.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            VeriScope organizes the evidence, the rule checks, and the registry signals so a scrutiny
            officer can see what matters and explain the outcome.
          </p>

          <ol className="mt-10 max-w-lg space-y-5">
            {FLOW_POINTS.map((point, index) => (
              <li key={point.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface-card font-mono text-xs text-accent">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{point.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 max-w-lg rounded-lg border border-surface-border bg-surface-card p-5">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-accent" />
              <span className="vs-eyebrow">What the demo covers</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Safe document intake
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Page-level evidence
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Versioned rule checks
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Human sign-off
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md lg:mx-0">
          <div className="vs-card p-6 sm:p-8">
            <div className="vs-eyebrow">Demo access</div>
            <h2 className="mt-1 text-3xl text-foreground">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose a seeded role to explore the reviewer workspace. Every account uses the same demo password.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Demo role</label>
                <select
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  className="vs-input text-sm"
                >
                  {DEMO_ROLES.map((role) => (
                    <option key={role.email} value={role.email}>
                      {role.role} — {role.badge}
                    </option>
                  ))}
                </select>
                <div className="mt-2 rounded-md border border-surface-border bg-surface px-3.5 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserRound className="h-3.5 w-3.5 text-accent" />
                    {selectedRole.org}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {selectedRole.description}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Email address</label>
                <input
                  type="email"
                  value={selectedEmail}
                  onChange={(e) => setSelectedEmail(e.target.value)}
                  required
                  className="vs-input font-mono text-sm"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Password</label>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <LockKeyhole className="h-3 w-3" /> Demo only
                  </span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="vs-input font-mono text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="vs-button-primary w-full py-3 text-sm">
                {loading ? "Signing in…" : "Enter the workspace"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-4 text-[11px] text-muted-foreground">
              <span>Demo password</span>
              <span className="font-mono text-foreground">DemoPass123!</span>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Synthetic records only. Findings are advisory and require human review.
          </p>
        </section>
      </main>
    </div>
  );
}
