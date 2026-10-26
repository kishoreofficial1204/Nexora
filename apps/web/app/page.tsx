"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X, 
  FileCheck, 
  FileSearch, 
  History, 
  Layers, 
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Lock,
  Compass
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const demoCases = [
    {
      id: "bundle_a_clean",
      tag: "Case A",
      title: "Clean Benchmark",
      badge: "pass",
      badgeText: "Valid Bundle",
      description: "All mandatory documents present, matching intake (60) and unexpired certificates.",
    },
    {
      id: "bundle_b_missing_doc",
      tag: "Case B",
      title: "Missing Affiliation",
      badge: "fail",
      badgeText: "Missing Required",
      description: "Checklist triggers deficiency flag: State Technical University affiliation order is absent.",
    },
    {
      id: "bundle_c_expired_cert",
      tag: "Case C",
      title: "Expired Fire Safety",
      badge: "fail",
      badgeText: "Validity Expired",
      description: "Fire NOC expired 2026-03-31, failing check against assessment baseline date 2026-10-26.",
    },
    {
      id: "bundle_d_intake_mismatch",
      tag: "Case D",
      title: "Intake Contradiction",
      badge: "warning",
      badgeText: "Intake Mismatch",
      description: "Application declares intake of 60; previous approval letter specifies 120 seats.",
    },
    {
      id: "bundle_e_exact_duplicate",
      tag: "Case E",
      title: "Exact Duplicate File",
      badge: "warning",
      badgeText: "Duplicate SHA-256",
      description: "Identical PDF file uploaded twice under both Fire Safety and Structural Safety requirements.",
    },
    {
      id: "bundle_g_modified_pdf",
      tag: "Case G",
      title: "Modified PDF Signal",
      badge: "heuristic_signal",
      badgeText: "Incremental PDF",
      description: "Structural change signal: multiple cross-reference sections and post-generation text updates.",
    },
  ];

  const faqs = [
    {
      q: "Does this platform automatically approve or reject applications?",
      a: "No. VeriScope is strictly a decision-support workspace. It generates preliminary, evidence-linked findings for AICTE scrutiny officers. Statutory scrutiny authority and all final decisions remain solely with AICTE.",
    },
    {
      q: "Is external issuer verification real or simulated in the demo?",
      a: "The demo uses a MockIssuerConnector clearly badged as SIMULATED. A real connection to issuing authorities (e.g. DigiLocker, state registries) requires formal authorization and partner onboarding.",
    },
    {
      q: "How does the system treat anomaly detection?",
      a: "Anomalies are treated as advisory signals, never proof of fraud or forgery. Innocent actions like rescanning, compression, or format conversion can cause visual and structural differences.",
    },
    {
      q: "Where do the compliance rules come from?",
      a: "Rules are derived from the AICTE Approval Process Handbook (APH) 2024–25 to 2026–27. In the prototype, all rules carry status 'draft' and an 'UNVERIFIED AGAINST CURRENT HANDBOOK' notice until approved by administrators.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center text-accent-foreground shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base sm:text-lg text-slate-100">VeriScope</span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  SIH26261
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                AI-Assisted Regulatory Decision Support
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <Link href="#overview" className="hover:text-accent transition-colors">Overview</Link>
            <Link href="#cases" className="hover:text-accent transition-colors">Demo Scenarios</Link>
            <Link href="#how-it-works" className="hover:text-accent transition-colors">How It Works</Link>
            <Link href="/governance" className="hover:text-accent transition-colors">Governance & Limits</Link>
            <Link href="/evaluation" className="hover:text-accent transition-colors">Evaluation Harness</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs font-semibold rounded-md bg-accent text-accent-foreground hover:bg-teal-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
            >
              Open Reviewer Console
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-100 focus:outline-none"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Collapsing Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-surface-border bg-surface px-4 pt-2 pb-4 space-y-2">
            <Link 
              href="#overview" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-accent"
            >
              Overview
            </Link>
            <Link 
              href="#cases" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-accent"
            >
              Demo Scenarios
            </Link>
            <Link 
              href="#how-it-works" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-accent"
            >
              How It Works
            </Link>
            <Link 
              href="/governance" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-accent"
            >
              Governance & Limits
            </Link>
            <Link 
              href="/evaluation" 
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-300 hover:text-accent"
            >
              Evaluation Harness
            </Link>
            <div className="pt-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center w-full py-2.5 text-xs font-semibold rounded-md bg-accent text-accent-foreground hover:bg-teal-600"
              >
                Open Reviewer Console
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section id="overview" className="relative pt-16 pb-20 border-b border-surface-border overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-card border border-surface-border text-xs text-muted-foreground mb-6 font-mono">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span>INDEPENDENT PROTOTYPE · SIH26261 · AY 2026-27</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100 leading-tight">
                Every application, with the evidence behind every flag.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
                VeriScope turns bundles of technical institution documents into structured, auditable review cases. 
                With deterministic rule checking, page-level field provenance, and tamper-evident audit logs, human scrutiny officers stay firmly in command.
              </p>

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <Link
                  href="/dashboard"
                  className="px-5 py-3 rounded-md bg-accent text-accent-foreground font-semibold text-sm hover:bg-teal-600 transition-colors flex items-center gap-2 shadow-sm"
                >
                  Enter Scrutiny Workspace <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="#cases"
                  className="px-5 py-3 rounded-md bg-surface-card border border-surface-border text-slate-300 font-semibold text-sm hover:bg-surface-hover hover:text-white transition-colors"
                >
                  Browse Synthetic Scenarios
                </Link>
              </div>

              <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>Zero automated rejection. All findings are advisory decision-support signals.</span>
              </p>
            </div>

            {/* Live Sample Finding Card */}
            <div className="mt-12 bg-surface-card rounded-lg border border-surface-border p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-slate-800 border-b border-l border-surface-border px-3 py-1 text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                <span>SIMULATED DEMO CASE</span>
                <StatusBadge status="simulated" size="sm" />
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                  Sample Finding Spotlight
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-muted-foreground">RULE-EOA-005 (Intake Consistency)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status="warning" customLabel="Intake Contradiction" />
                    <span className="text-sm font-semibold text-slate-200">
                      Declared intake does not match previous AICTE approval
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Application form declares an intake capacity of <strong className="text-slate-200 font-mono">60</strong>, 
                    while the submitted Previous AICTE Approval Order (AY 2025-26) records <strong className="text-slate-200 font-mono">120</strong> seats.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                      <FileText className="w-3 h-3 text-cyan-400" /> doc_eoa_app.pdf: Page 1, Row 1
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                      <FileText className="w-3 h-3 text-amber-400" /> doc_prev_eoa.pdf: Page 1, Table 1
                    </span>
                  </div>
                </div>

                <div className="bg-surface rounded-md p-4 border border-surface-border text-xs space-y-2">
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">Recommended Action</div>
                  <div className="text-slate-300 leading-snug">
                    Confirm whether institution applied for formal intake variation under Chapter IV norms.
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-surface-border">
                    <span>Severity: Warning</span>
                    <span>Confidence: 98%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* REAL STAT ROW (Not marketing figures) */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-surface-card p-4 rounded-md border border-surface-border">
                <div className="text-2xl font-bold font-mono text-slate-100">10</div>
                <div className="text-xs text-muted-foreground mt-1">Checklist Items Defined</div>
              </div>
              <div className="bg-surface-card p-4 rounded-md border border-surface-border">
                <div className="text-2xl font-bold font-mono text-slate-100">10</div>
                <div className="text-xs text-muted-foreground mt-1">Deterministic Draft Rules</div>
              </div>
              <div className="bg-surface-card p-4 rounded-md border border-surface-border">
                <div className="text-2xl font-bold font-mono text-slate-100">9</div>
                <div className="text-xs text-muted-foreground mt-1">Synthetic Test Bundles</div>
              </div>
              <div className="bg-surface-card p-4 rounded-md border border-surface-border">
                <div className="text-2xl font-bold font-mono text-slate-100">7</div>
                <div className="text-xs text-muted-foreground mt-1">Distinct Status Types</div>
              </div>
            </div>
          </div>
        </section>

        {/* Pick a Case Section */}
        <section id="cases" className="py-16 border-b border-surface-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                  Synthetic Test Corpus
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mt-2">
                  Pre-Seeded Demonstration Cases
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  Each scenario is deterministically generated and labelled with an upfront ground truth contract. 
                  All files carry the required synthetic watermark.
                </p>
              </div>
              <Link
                href="/evaluation"
                className="mt-4 md:mt-0 text-xs text-accent hover:underline flex items-center gap-1 font-medium"
              >
                View Evaluation Matrix <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {demoCases.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-card rounded-lg border border-surface-border p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono text-muted-foreground">{item.tag}</span>
                      <StatusBadge status={item.badge} customLabel={item.badgeText} size="sm" />
                    </div>
                    <h3 className="font-semibold text-base text-slate-100">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-surface-border flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-slate-500">{item.id}</span>
                    <Link
                      href={`/dashboard?case=${item.id}`}
                      className="text-accent hover:text-teal-400 font-medium inline-flex items-center gap-1"
                    >
                      Inspect Case <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Numbered Feature Cards 01-04 */}
        <section className="py-16 border-b border-surface-border bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                Core Architectural Pillars
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mt-2">
                Built For Regulatory Integrity
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface-card p-6 rounded-lg border border-surface-border relative">
                <div className="text-3xl font-black font-mono text-slate-700 mb-4">01</div>
                <h3 className="font-semibold text-slate-100 text-base">Evidence-Linked Findings</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Every extraction tracks document ID, page number, and bounding box coordinates. Discrepancies link both source locations.
                </p>
              </div>

              <div className="bg-surface-card p-6 rounded-lg border border-surface-border relative">
                <div className="text-3xl font-black font-mono text-slate-700 mb-4">02</div>
                <h3 className="font-semibold text-slate-100 text-base">Versioned Regulatory Rules</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Compliance criteria are stored in auditable YAML packs with handbook citations and effective date predicates.
                </p>
              </div>

              <div className="bg-surface-card p-6 rounded-lg border border-surface-border relative">
                <div className="text-3xl font-black font-mono text-slate-700 mb-4">03</div>
                <h3 className="font-semibold text-slate-100 text-base">Explicit Source States</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Never fabricate a pass. Connector timeouts, outages, and absent registries fail closed into visible unverified states.
                </p>
              </div>

              <div className="bg-surface-card p-6 rounded-lg border border-surface-border relative">
                <div className="text-3xl font-black font-mono text-slate-700 mb-4">04</div>
                <h3 className="font-semibold text-slate-100 text-base">Tamper-Evident Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Append-only ledger with cryptographic hash-chaining prevents retroactive modification of officer decisions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Steps */}
        <section id="how-it-works" className="py-16 border-b border-surface-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                Review Pipeline
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mt-2">
                From Document Bundle to Auditable Case
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {[
                { step: "1", title: "Safe Intake", desc: "PDF validation, SHA-256 computation, and protected storage." },
                { step: "2", title: "Text & OCR", desc: "Native PDF extraction with fallback to OCR for scanned pages." },
                { step: "3", title: "Rule Verification", desc: "Checklist presence, expiry vs. assessment date, and intake matches." },
                { step: "4", title: "Anomaly Signals", desc: "Duplicate hashes, perceptual similarities, and PDF structure checks." },
                { step: "5", title: "Officer Decision", desc: "Reviewer confirms, dismisses, or escalates with mandatory rationale." },
              ].map((s) => (
                <div key={s.step} className="bg-surface-card p-5 rounded-lg border border-surface-border flex flex-col justify-between">
                  <div>
                    <div className="w-7 h-7 rounded-full bg-accent/20 text-accent font-mono text-xs flex items-center justify-center font-bold mb-3">
                      {s.step}
                    </div>
                    <h4 className="font-semibold text-slate-100 text-sm">{s.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="py-16 border-b border-surface-border bg-surface">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                Frequently Asked Questions
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 mt-2">
                Operational & Regulatory Clarifications
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-surface-card rounded-lg border border-surface-border overflow-hidden"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between text-sm font-semibold text-slate-200 hover:text-white focus:outline-none"
                    aria-expanded={openFaq === idx}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                        openFaq === idx ? "transform rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 pb-4 text-xs text-muted-foreground leading-relaxed border-t border-surface-border/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Prominent Disclaimer Block */}
        <section className="py-12 bg-slate-950 border-b border-surface-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-lg border border-amber-900/50 bg-amber-950/20 flex flex-col sm:flex-row gap-4 items-start">
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-amber-200">
                  Statutory & Prototype Governance Disclaimer
                </h4>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  VeriScope is an independent technical prototype developed for Smart India Hackathon problem statement SIH26261. 
                  It is not an official system of the All India Council for Technical Education (AICTE), the Ministry of Education, 
                  or any statutory regulatory authority. All data models and sample documents represent synthetic scenarios.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Multi-Column Footer */}
      <footer className="bg-background border-t border-surface-border text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white font-bold text-xs">
                  V
                </div>
                <span className="font-bold text-slate-200 text-sm">VeriScope</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                One application, one evidence-backed review workspace.
              </p>
              <div className="text-[11px] font-mono text-slate-500">
                Rule Pack: eoa_v2026_draft (2026.1-draft)
              </div>
            </div>

            <div>
              <h5 className="font-semibold text-slate-300 mb-3 text-xs uppercase tracking-wider">Product</h5>
              <ul className="space-y-2">
                <li><Link href="/dashboard" className="hover:text-slate-200">Reviewer Console</Link></li>
                <li><Link href="#cases" className="hover:text-slate-200">Demo Scenarios</Link></li>
                <li><Link href="/evaluation" className="hover:text-slate-200">Evaluation Harness</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-slate-300 mb-3 text-xs uppercase tracking-wider">Governance</h5>
              <ul className="space-y-2">
                <li><Link href="/governance" className="hover:text-slate-200">System Boundaries</Link></li>
                <li><Link href="/governance#rules" className="hover:text-slate-200">Rule Versioning</Link></li>
                <li><Link href="/governance#sources" className="hover:text-slate-200">Source Register</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-slate-300 mb-3 text-xs uppercase tracking-wider">Compliance & Legal</h5>
              <ul className="space-y-2">
                <li><span className="text-slate-400">DPDP Act, 2023 Principles</span></li>
                <li><span className="text-slate-400">Zero Live Data Policy</span></li>
                <li><span className="text-slate-400">Tamper-Evident Ledger</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[11px] text-slate-500">
              © 2026 VeriScope Prototype. Built strictly for SIH26261 evaluation.
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Assessment Date Baseline: 2026-10-26
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
