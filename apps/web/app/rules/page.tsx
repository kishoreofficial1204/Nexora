"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  BookOpen, 
  Search, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Play, 
  Filter, 
  HelpCircle,
  FileText,
  Clock,
  Layers,
  Sparkles
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

const todayIso = new Date().toISOString().slice(0, 10);
const lastYearIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const currentYear = new Date().getFullYear();
const currentAcademicYear = `${currentYear}-${String((currentYear + 1) % 100).padStart(2, "0")}`;
const previousAcademicYear = `${currentYear - 1}-${String(currentYear % 100).padStart(2, "0")}`;

interface RuleItem {
  rule_id: string;
  title: string;
  source_document: string;
  source_url: string;
  section_page: string;
  version: string;
  effective_from: string;
  effective_to: string;
  status: string;
  severity: "fail" | "warning" | "manual_review" | "info";
  is_heuristic: boolean;
  applicability: {
    category: string;
    institution_type: string;
    academic_year: string;
  };
  required_evidence: string[];
  expected_fields: string[];
  validation_logic: {
    operator: string;
    target?: string;
    field?: string;
    source_doc?: string;
    source_field?: string;
    target_doc?: string;
    target_field?: string;
    threshold?: number;
  };
  explanation_template: string;
  reviewer_action?: string;
}

interface RulePackData {
  rule_pack: {
    id: string;
    name: string;
    academic_year: string;
    version: string;
    status: string;
    banner_notice: string;
    effective_from: string;
    effective_to: string;
    source_register_ref: string;
  };
  checklist_items: Array<{
    id: string;
    document_type: string;
    title: string;
    is_required: boolean;
    description: string;
  }>;
  rules: RuleItem[];
}

interface SearchResult {
  source_type: string;
  chapter?: string;
  section?: string;
  citation: string;
  title: string;
  excerpt: string;
  source_url: string;
  related_rules: string[];
  draft_notice: string;
  relevance_score: number;
}

interface SearchResponse {
  query: string;
  banner_notice: string;
  placeholder_notice: string;
  total_matches: number;
  results: SearchResult[];
}

interface TestEvalResult {
  rule_id: string;
  title: string;
  source_document: string;
  section_page: string;
  status: string;
  explanation: string;
  severity: string;
  is_heuristic: boolean;
  banner_notice: string;
  placeholder_notice: string;
}

export default function RuleExplorerPage() {
  const [rulePack, setRulePack] = useState<RulePackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [textFilter, setTextFilter] = useState<string>("");

  // Test Harness State
  const [activeTestRule, setActiveTestRule] = useState<string | null>(null);
  const [testFactsJson, setTestFactsJson] = useState<string>("{}");
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<TestEvalResult | null>(null);

  useEffect(() => {
    async function loadRules() {
      try {
        setLoading(true);
        const data = await fetchApi<RulePackData>("/rules");
        setRulePack(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      setSearching(true);
      const res = await fetchApi<SearchResponse>("/rules/search", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery, limit: 6 })
      });
      setSearchResults(res.results);
    } catch (err: any) {
      alert(`Search failed: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const openTestHarness = (rule: RuleItem) => {
    setActiveTestRule(rule.rule_id);
    setEvalResult(null);

    // Seed realistic mock facts based on rule type
    let initialFacts = {};
    if (rule.rule_id === "RULE-EOA-001") {
      initialFacts = {
        present_docs: ["doc_eoa_app", "doc_prev_eoa", "doc_univ_affil", "doc_fire_safety"]
      };
    } else if (rule.rule_id === "RULE-EOA-002" || rule.rule_id === "RULE-EOA-003") {
      initialFacts = {
        valid_until_date: lastYearIso,
        assessment_date: todayIso
      };
    } else if (rule.rule_id === "RULE-EOA-004") {
      initialFacts = {
        academic_year: previousAcademicYear,
        expected_year: currentAcademicYear
      };
    } else if (rule.rule_id === "RULE-EOA-005") {
      initialFacts = {
        app_intake: 60,
        prev_intake: 120
      };
    } else if (rule.rule_id === "RULE-EOA-006") {
      initialFacts = {
        name_a: "ABC Institute of Technology",
        name_b: "A.B.C. Inst. of Tech."
      };
    } else if (rule.rule_id === "RULE-EOA-007") {
      initialFacts = {
        pid_a: "1-9876543210",
        pid_b: "1-9876543210"
      };
    } else if (rule.rule_id === "RULE-EOA-008") {
      initialFacts = {
        photo_count: 4
      };
    } else {
      initialFacts = {
        hashes: ["hash_a1", "hash_b2", "hash_c3"]
      };
    }

    setTestFactsJson(JSON.stringify(initialFacts, null, 2));
  };

  const runTestEval = async () => {
    if (!activeTestRule) return;

    try {
      setEvaluating(true);
      let parsed = {};
      try {
        parsed = JSON.parse(testFactsJson);
      } catch (pErr) {
        alert("Invalid JSON format in test facts.");
        return;
      }

      const res = await fetchApi<TestEvalResult>("/rules/test-eval", {
        method: "POST",
        body: JSON.stringify({
          rule_id: activeTestRule,
          test_facts: parsed
        })
      });
      setEvalResult(res);
    } catch (err: any) {
      alert(`Evaluation failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const filteredRules = rulePack?.rules.filter((r) => {
    const matchesSeverity = severityFilter === "all" || r.severity === severityFilter;
    const matchesText =
      textFilter === "" ||
      r.rule_id.toLowerCase().includes(textFilter.toLowerCase()) ||
      r.title.toLowerCase().includes(textFilter.toLowerCase()) ||
      r.source_document.toLowerCase().includes(textFilter.toLowerCase());
    return matchesSeverity && matchesText;
  }) || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Mandatory Draft Banner per Non-Negotiable Principle 10 */}
        <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold tracking-wide uppercase font-mono text-[11px] text-amber-300">
              Draft rule pack · verify against the current handbook
            </div>
            <p className="text-amber-200/90 leading-relaxed text-[11px]">
              Rule definitions, citations, and clauses are draft-only for this prototype. Confirm every rule against the official published Approval Process Handbook before operational use.
            </p>
          </div>
        </div>

        {/* Header & Pack Overview */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-surface-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Rule Pack & Regulatory Sources Explorer
              </h1>
              {rulePack?.rule_pack.version && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-surface-border text-muted-foreground">
                  v{rulePack.rule_pack.version}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active Pack: <strong className="text-slate-200">{rulePack?.rule_pack.name}</strong> · Academic Year: <strong className="font-mono text-cyan-400">{rulePack?.rule_pack.academic_year}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source Register:</span>
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-surface border border-surface-border text-accent font-semibold">
              {rulePack?.rule_pack.source_register_ref || "S1"} (APH 2024-27)
            </span>
          </div>
        </div>

        {/* Regulatory Search Bar (Handbook Semantic & Clause Search) */}
        <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-slate-200">
              Regulatory Handbook Source Search & Citations
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Search official handbook clauses, chapters, norms for intake revisions, structural stability, and safety certifications.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder='Query handbook citations (e.g. "intake increase Chapter IV", "fire safety validity period", "structural stability criteria")...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-md pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-muted-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{searching ? "Searching..." : "Search Sources"}</span>
            </button>
          </form>

          {/* Search Results Display */}
          {searchResults && (
            <div className="pt-3 border-t border-surface-border/60 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{searchResults.length} relevant handbook citation{searchResults.length === 1 ? "" : "s"} found</span>
                <button
                  onClick={() => setSearchResults(null)}
                  className="text-accent hover:underline text-[11px]"
                >
                  Clear search
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-md bg-surface border border-surface-border space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] text-accent block font-semibold uppercase">
                          {res.chapter || "Handbook Clause"}
                        </span>
                        <h4 className="font-semibold text-slate-100 text-xs mt-0.5">{res.title}</h4>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-border text-slate-400 shrink-0">
                        Score: {res.relevance_score}
                      </span>
                    </div>

                    <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-3">
                      "{res.excerpt}"
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-border/40 text-[11px] text-muted-foreground">
                      <span className="font-mono text-cyan-400">{res.citation}</span>
                      <a
                        href={res.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline font-medium text-[10px]"
                      >
                        <span>Official Source PDF</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rules Catalog Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Active Scrutiny Rules Catalog ({filteredRules.length} Rules)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic rules evaluated automatically on ingested application bundles.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Filter rules..."
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                className="bg-surface border border-surface-border rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-muted-foreground w-40 focus:outline-none focus:border-accent"
              />

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-surface border border-surface-border rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                <option value="all">All Severities</option>
                <option value="fail">Fail Only</option>
                <option value="warning">Warning Only</option>
              </select>
            </div>
          </div>

          {/* Rule Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.rule_id}
                className={`p-5 rounded-lg border bg-surface-card space-y-4 flex flex-col justify-between transition-all ${
                  activeTestRule === rule.rule_id
                    ? "border-accent ring-1 ring-accent"
                    : "border-surface-border hover:border-slate-600"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Rule ID, Severity, Heuristic Pill */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-100 bg-surface px-2 py-0.5 rounded border border-surface-border">
                        {rule.rule_id}
                      </span>
                      <StatusBadge status={rule.severity} />
                    </div>

                    {rule.is_heuristic ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800">
                        HEURISTIC ANOMALY SIGNAL
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800">
                        DETERMINISTIC RULE
                      </span>
                    )}
                  </div>

                  {/* Title & Applicability */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                      {rule.title}
                    </h4>
                    <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Category: <strong className="text-slate-300">{rule.applicability.category}</strong></span>
                      <span>·</span>
                      <span>AY: <strong className="font-mono text-slate-300">{rule.applicability.academic_year}</strong></span>
                    </div>
                  </div>

                  {/* Official Source Citation Box per Principle 10 */}
                  <div className="bg-surface p-3 rounded border border-surface-border space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-accent flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        Official Source Citation
                      </span>
                      <a
                        href={rule.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-accent inline-flex items-center gap-1"
                      >
                        <span>Open PDF</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono">
                      {rule.source_document}
                    </div>
                    <div className="text-[11px] text-amber-400 font-mono">
                      {rule.section_page}
                    </div>
                  </div>

                  {/* Validation Logic Details */}
                  <div className="text-xs space-y-1.5 pt-1">
                    <div className="text-[11px] text-slate-400">
                      Operator: <span className="font-mono text-cyan-400 font-semibold">{rule.validation_logic.operator}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Required Evidence: <span className="font-mono text-slate-300">{rule.required_evidence.join(", ") || "N/A"}</span>
                    </div>
                    {rule.reviewer_action && (
                      <div className="text-[11px] text-slate-400">
                        Action: <span className="text-slate-300">{rule.reviewer_action}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Test Harness Action Bar */}
                <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Effective: {rule.effective_from} to {rule.effective_to}
                  </span>
                  <button
                    onClick={() => openTestHarness(rule)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-surface hover:bg-surface-hover border border-surface-border text-xs text-accent font-semibold transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>Test in Harness</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Rule Evaluation Test Harness Drawer / Modal */}
        {activeTestRule && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-card border border-surface-border rounded-lg max-w-xl w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    Rule Evaluation Test Harness: <span className="font-mono text-accent">{activeTestRule}</span>
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTestRule(null)}
                  className="text-muted-foreground hover:text-slate-200 text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Input Synthetic Facts (JSON)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Edit values below to test rules</span>
                </label>
                <textarea
                  rows={6}
                  value={testFactsJson}
                  onChange={(e) => setTestFactsJson(e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              {evalResult && (
                <div className={`p-4 rounded border text-xs space-y-2 ${
                  evalResult.status === "pass"
                    ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                    : evalResult.status === "fail"
                    ? "bg-rose-950/40 border-rose-800 text-rose-200"
                    : "bg-amber-950/40 border-amber-800 text-amber-200"
                }`}>
                  <div className="flex items-center justify-between font-mono font-bold uppercase">
                    <span>Evaluation Outcome: {evalResult.status.toUpperCase()}</span>
                    <span>Severity: {evalResult.severity.toUpperCase()}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{evalResult.explanation}</p>
                  <div className="text-[10px] font-mono opacity-80 pt-1 border-t border-current/20">
                    Citation: {evalResult.source_document} ({evalResult.section_page})
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  onClick={() => setActiveTestRule(null)}
                  className="px-4 py-2 rounded border border-surface-border text-xs text-slate-300 hover:bg-surface"
                >
                  Close
                </button>
                <button
                  onClick={runTestEval}
                  disabled={evaluating}
                  className="px-4 py-2 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Play className={`w-3.5 h-3.5 ${evaluating ? "animate-spin" : ""}`} />
                  <span>{evaluating ? "Evaluating Rule..." : "Execute Test Evaluation"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
