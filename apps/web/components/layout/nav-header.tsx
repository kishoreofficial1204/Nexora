"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, User, LogOut, RefreshCw, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const QUICK_ROLES = [
  { label: "Scrutiny Officer", email: "reviewer@aicte-demo.in" },
  { label: "Senior Reviewer", email: "senior_reviewer@aicte-demo.in" },
  { label: "Admin", email: "admin@aicte-demo.in" },
  { label: "Auditor", email: "auditor@aicte-demo.in" },
  { label: "Applicant", email: "applicant@aicte-demo.in" },
];

export function NavHeader() {
  const router = useRouter();
  const { user, logout, switchRole } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const handleRoleSwitch = async (email: string) => {
    setRoleMenuOpen(false);
    await switchRole(email);
    router.refresh();
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-slate-100">VeriScope</span>
              <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Decision Support
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-300">
            <Link href="/dashboard" className="hover:text-accent transition-colors">Queue</Link>
            <Link href="/applications/new" className="hover:text-accent transition-colors">New Intake</Link>
            <Link href="/rules" className="hover:text-accent transition-colors">Rule Explorer</Link>
            <Link href="/evaluation" className="hover:text-accent transition-colors">Evaluation Harness</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Role Switcher Pill */}
              <div className="relative">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-card border border-surface-border text-xs text-slate-200 hover:border-slate-600 focus:outline-none"
                  aria-label="Switch Role"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-medium font-mono text-[11px] capitalize">{user.role.replace("_", " ")}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md bg-surface-card border border-surface-border shadow-xl py-1 z-50 text-xs">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-mono text-muted-foreground border-b border-surface-border">
                      Switch Role
                    </div>
                    {QUICK_ROLES.map((r) => (
                      <button
                        key={r.email}
                        onClick={() => handleRoleSwitch(r.email)}
                        className="w-full text-left px-3 py-2 text-slate-300 hover:bg-surface-hover hover:text-white flex items-center justify-between"
                      >
                        <span>{r.label}</span>
                        {user.email === r.email && <Check className="w-3.5 h-3.5 text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium text-slate-200">{user.full_name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{user.email}</div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-surface-hover transition-colors focus:outline-none"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
