"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldCheck,
  LogOut,
  ChevronDown,
  Check,
  Bell,
  BookOpen,
  LayoutDashboard,
  Scale,
  Menu,
  X,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchApi } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

const QUICK_ROLES = [
  { label: "Scrutiny Officer", email: "reviewer@aicte-demo.in" },
  { label: "Senior Reviewer", email: "senior_reviewer@aicte-demo.in" },
  { label: "Admin", email: "admin@aicte-demo.in" },
  { label: "Auditor", email: "auditor@aicte-demo.in" },
  { label: "Applicant", email: "applicant@aicte-demo.in" },
];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Queue", icon: LayoutDashboard, match: ["/dashboard", "/applications"] },
  { href: "/alerts", label: "Alerts", icon: Bell, match: ["/alerts"] },
  { href: "/rules", label: "Rules", icon: Scale, match: ["/rules"] },
  { href: "/evaluation", label: "Evaluation", icon: BarChart3, match: ["/evaluation"] },
  { href: "/governance", label: "Governance", icon: BookOpen, match: ["/governance"] },
];

export function NavHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, switchRole } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);

  useEffect(() => {
    if (!user) {
      setOpenAlerts(0);
      return;
    }
    let cancelled = false;
    fetchApi<Array<{ id: string }>>("/alerts?status=open")
      .then((alerts) => {
        if (!cancelled) setOpenAlerts(alerts.length);
      })
      .catch(() => {
        if (!cancelled) setOpenAlerts(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setRoleMenuOpen(false);
  }, [pathname]);

  const handleRoleSwitch = async (email: string) => {
    setRoleMenuOpen(false);
    await switchRole(email);
    router.refresh();
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isActive = (match: string[]) =>
    match.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-background backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-foreground">VeriScope</span>
                <span className="rounded border border-surface-border bg-surface px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  Demo
                </span>
              </div>
              <span className="hidden text-[10px] text-muted-foreground sm:block">Evidence-backed scrutiny workspace</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.match);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-surface-hover text-foreground"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-accent" : "text-muted-foreground"}`} />
                  {item.label}
                  {item.label === "Alerts" && openAlerts > 0 && (
                    <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-1 font-mono text-[9px] text-rose-700">
                      {openAlerts > 99 ? "99+" : openAlerts}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <ThemeToggle className="hidden sm:inline-flex" />

              <div className="relative hidden sm:block">
                <button
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-hover focus:outline-none"
                  aria-label="Switch demo role"
                  aria-expanded={roleMenuOpen}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {user.role.replace("_", " ")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border border-surface-border bg-surface-card py-1 shadow-xl">
                    <div className="border-b border-surface-border px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      Demo role switcher
                    </div>
                    {QUICK_ROLES.map((role) => (
                      <button
                        key={role.email}
                        onClick={() => handleRoleSwitch(role.email)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-hover"
                      >
                        <span>{role.label}</span>
                        {user.email === role.email && <Check className="h-3.5 w-3.5 text-accent" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="hidden text-right md:block">
                <div className="text-[11px] font-medium text-foreground">{user.full_name}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{user.email}</div>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-rose-700"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <Link href="/login" className="vs-button-primary">
              Sign in
            </Link>
          )}
        </div>
      </div>

      {mobileMenuOpen && user && (
        <div className="border-t border-surface-border bg-surface px-4 pb-4 pt-2 lg:hidden">
          <nav className="space-y-1" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.match);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-surface-hover text-foreground"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-muted-foreground"}`} />
                  {item.label}
                  {item.label === "Alerts" && openAlerts > 0 && (
                    <span className="ml-auto rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[9px] text-rose-700">
                      {openAlerts}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-surface-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Demo role</div>
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_ROLES.map((role) => (
                <button
                  key={role.email}
                  onClick={() => handleRoleSwitch(role.email)}
                  className={`rounded-md border px-2.5 py-2 text-left text-[11px] transition-colors ${
                    user.email === role.email
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-surface-border bg-surface-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
