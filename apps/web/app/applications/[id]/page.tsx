"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  FileText, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  Layers, 
  History, 
  FileCheck2, 
  Cpu, 
  ExternalLink,
  UploadCloud,
  FileCode,
  Shield,
  Eye,
  BookOpen
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

interface DocumentItem {
  id: string;
  application_id: string;
  document_type: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  hash_sha256: string;
  page_count: number;
  source_status: string;
  upload_time: string;
}

interface AuditItem {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  metadata_json: string;
  prev_hash: string;
  current_hash: string;
}

interface FindingItem {
  id: string;
  application_id: string;
  rule_id: string;
  rule_version: string;
  finding_type: string;
  severity: "fail" | "warning" | "manual_review" | "info";
  title: string;
  explanation: string;
  recommended_action: string;
  evidence_refs: Array<{
    document_id?: string;
    document_name?: string;
    title?: string;
    document_type?: string;
    page?: number;
    field_name?: string;
    value?: any;
    bbox?: number[];
    note?: string;
    checklist_id?: string;
  }>;
  confidence: number;
  is_heuristic: boolean;
  status: "open" | "confirmed" | "dismissed" | "resolved" | "clarification_requested" | "escalated";
  review_rationale?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

interface ApplicationData {
  id: string;
  category: string;
  academic_year: string;
  assessment_date: string;
  status: string;
  recommendation?: string;
  recommendation_rationale?: string;
  recommendation_by?: string;
  recommendation_at?: string;
  rule_pack_id: string;
  created_at: string;
  institution?: {
    name: string;
    permanent_id: string;
    address: string;
    state: string;
  };
  documents: DocumentItem[];
}

interface AuditVerification {
  verified: boolean;
  chain_length: number;
  status: string;
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditItem[]>([]);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "findings" | "compliance" | "verification" | "audit" | "report">("documents");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Milestone 4: Rules, Sources & Verification States
  const [rulePack, setRulePack] = useState<any | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<string>("fire_department");
  const [selectedMode, setSelectedMode] = useState<string>("match");
  const [verificationQuerying, setVerificationQuerying] = useState<boolean>(false);
  const [verificationResponse, setVerificationResponse] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const appData = await fetchApi<ApplicationData>(`/applications/${id}`);
      setApplication(appData);

      // Load audit trail
      const audit = await fetchApi<AuditItem[]>(`/applications/${id}/audit`);
      setAuditEvents(audit);

      const verif = await fetchApi<AuditVerification>("/audit/verify");
      setVerification(verif);

      // Load findings
      try {
        const found = await fetchApi<FindingItem[]>(`/applications/${id}/findings`);
        setFindings(found);
      } catch (fErr) {
        setFindings([]);
      }

      // Load rules for compliance matrix
      try {
        const rulesData = await fetchApi<any>("/rules");
        setRulePack(rulesData);
      } catch (rErr) {
        setRulePack(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunValidation = async () => {
    try {
      setValidating(true);
      const res = await fetchApi<FindingItem[]>(`/applications/${id}/validate`, {
        method: "POST"
      });
      setFindings(res);
      await loadData();
    } catch (err: any) {
      alert(`Validation check failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteVerification = async () => {
    try {
      setVerificationQuerying(true);
      const payload: any = {
        institute_pid: application?.institution?.permanent_id || "1-9876543210",
        institution_name: application?.institution?.name || "ABC Institute of Technology"
      };

      if (selectedAuthority === "fire_department") {
        payload.certificate_number = "FS/2026/8891";
        payload.valid_until_date = "2027-01-09";
      } else if (selectedAuthority === "state_university") {
        payload.order_number = "AUT/AFFIL/2026-27/4491";
      } else if (selectedAuthority === "aicte_portal") {
        payload.intake_capacity = 60;
      }

      const res = await fetchApi<any>("/verification/query", {
        method: "POST",
        body: JSON.stringify({
          authority_id: selectedAuthority,
          query_payload: payload,
          mode: selectedMode,
          simulated_delay_ms: 180
        })
      });
      setVerificationResponse(res);
    } catch (err: any) {
      alert(`Verification query failed: ${err.message}`);
    } finally {
      setVerificationQuerying(false);
    }
  };

  // Milestone 5: Reviewer Decision & Recommendation States
  const [reviewModalFinding, setReviewModalFinding] = useState<FindingItem | null>(null);
  const [reviewAction, setReviewAction] = useState<string>("confirm");
  const [reviewRationale, setReviewRationale] = useState<string>("");
  const [clarificationItem, setClarificationItem] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const [recommendationModalOpen, setRecommendationModalOpen] = useState<boolean>(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<string>("RECOMMEND_APPROVAL");
  const [recommendationRationale, setRecommendationRationale] = useState<string>("");
  const [submittingRecommendation, setSubmittingRecommendation] = useState<boolean>(false);

  const handleFindingReviewSubmit = async () => {
    if (!reviewModalFinding) return;
    if (reviewRationale.trim().length < 5) {
      alert("Review rationale is mandatory (minimum 5 characters) for audit trail.");
      return;
    }

    try {
      setSubmittingReview(true);
      await fetchApi(`/findings/${reviewModalFinding.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          action: reviewAction,
          rationale: reviewRationale.trim(),
          clarification_item: clarificationItem.trim() || undefined
        })
      });
      setReviewModalFinding(null);
      setReviewRationale("");
      setClarificationItem("");
      await loadData();
    } catch (err: any) {
      alert(`Failed to submit review decision: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRecommendationSubmit = async () => {
    if (recommendationRationale.trim().length < 10) {
      alert("Scrutiny officer justification is mandatory (minimum 10 characters).");
      return;
    }

    try {
      setSubmittingRecommendation(true);
      await fetchApi(`/applications/${id}/recommendation`, {
        method: "POST",
        body: JSON.stringify({
          recommendation: selectedRecommendation,
          rationale: recommendationRationale.trim()
        })
      });
      setRecommendationModalOpen(false);
      setRecommendationRationale("");
      await loadData();
    } catch (err: any) {
      alert(`Failed to record recommendation: ${err.message}`);
    } finally {
      setSubmittingRecommendation(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("files", file);
      formData.append("document_type", "additional_evidence");

      await fetchApi(`/applications/${id}/documents`, {
        method: "POST",
        body: formData,
      });

      await loadData();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (loading || !application) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center p-12 text-xs text-muted-foreground">
          <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mr-3" />
          Loading application review case...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Application Queue
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Case ID: {application.id.substring(0, 13)}...</span>
            <StatusBadge status="simulated" size="sm" />
          </div>
        </div>

        {/* Header Summary Banner */}
        <div className="my-6 p-6 rounded-lg bg-surface-card border border-surface-border relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                  {application.institution?.name || "ABC Institute of Technology"}
                </h1>
                <StatusBadge 
                  status="pending" 
                  customLabel="Preliminary: Needs Review"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                <span>PID: <strong className="font-mono text-slate-300">{application.institution?.permanent_id || "1-9876543210"}</strong></span>
                <span>·</span>
                <span>Category: <strong className="text-slate-300">{application.category}</strong></span>
                <span>·</span>
                <span>Academic Year: <strong className="font-mono text-slate-300">{application.academic_year}</strong></span>
                <span>·</span>
                <span>Assessment Date: <strong className="font-mono text-cyan-400">{application.assessment_date}</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href={`/applications/${application.id}/applicant`}
                className="px-3 py-2 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-accent" />
                <span>Applicant Portal</span>
              </Link>

              <button
                onClick={() => setRecommendationModalOpen(true)}
                className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{application.recommendation ? "Update Recommendation" : "Officer Decision"}</span>
              </button>

              <Link
                href={`/applications/${application.id}/workbench`}
                className="px-3.5 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Workbench</span>
              </Link>
            </div>
          </div>

          {/* Stepper / Job Pipeline State */}
          <div className="mt-6 pt-5 border-t border-surface-border">
            <div className="text-[11px] font-mono uppercase text-muted-foreground mb-3 flex items-center justify-between">
              <span>Pipeline Stage Progression</span>
              <span className="text-accent">
                {application.recommendation 
                  ? "Stage 5 of 5 Complete (Recommendation Endorsed)" 
                  : findings.length > 0 
                  ? "Stage 4 of 5 (Findings Reviewed)" 
                  : "Stage 4 of 5 In Progress"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="bg-surface p-2.5 rounded border border-emerald-800/60 text-xs">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1. Safe Intake
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Ingested & Hashed</div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-emerald-800/60 text-xs">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 2. OCR / Facts
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M2 Extracted</div>
              </div>

              <div className={`bg-surface p-2.5 rounded border text-xs ${
                findings.some(f => f.severity === "fail") 
                  ? "border-rose-800/80 bg-rose-950/20" 
                  : findings.length > 0 
                  ? "border-amber-800/80 bg-amber-950/20" 
                  : "border-emerald-800/60"
              }`}>
                <div className={`font-semibold flex items-center gap-1.5 ${
                  findings.some(f => f.severity === "fail") ? "text-rose-400" : "text-amber-400"
                }`}>
                  <AlertTriangle className="w-3.5 h-3.5" /> 3. Rule Checks
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {findings.length} Finding{findings.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-emerald-800/60 text-xs">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 4. Verification
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M4 Registries</div>
              </div>

              <div className={`bg-surface p-2.5 rounded border text-xs ${
                application.recommendation 
                  ? "border-emerald-800/60 bg-emerald-950/20" 
                  : "border-surface-border text-slate-300"
              }`}>
                <div className={`font-semibold flex items-center gap-1.5 ${
                  application.recommendation ? "text-emerald-400" : "text-slate-300"
                }`}>
                  {application.recommendation ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>5. Officer Action</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {application.recommendation ? application.recommendation : "M5 Decision Pending"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-surface-border mb-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents ({application.documents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("findings")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "findings"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Findings ({findings.length})</span>
            {findings.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                findings.some(f => f.severity === "fail") ? "bg-rose-900 text-rose-200" : "bg-amber-900 text-amber-200"
              }`}>
                {findings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail ({auditEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("compliance")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "compliance"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Compliance Matrix (M4)</span>
          </button>

          <button
            onClick={() => setActiveTab("verification")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "verification"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>External Verification (M4)</span>
          </button>

          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "report"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (M5)</span>
          </button>
        </div>

        {/* Tab 1: Documents */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Ingested Application Documents
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Original uploaded files preserved immutably with SHA-256 cryptographic hashes.
                </p>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-200 hover:text-white transition-colors">
                <UploadCloud className="w-3.5 h-3.5 text-accent" />
                <span>{uploading ? "Uploading..." : "Upload Evidence"}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="bg-surface-card rounded-lg border border-surface-border overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-surface text-muted-foreground font-mono uppercase text-[11px] border-b border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Document Type</th>
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-4">Pages & Size</th>
                    <th className="py-3 px-4">SHA-256 Integrity Hash</th>
                    <th className="py-3 px-4">Upload Timestamp</th>
                    <th className="py-3 px-4 text-right">Raw File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border font-sans">
                  {application.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-surface-hover transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {doc.document_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {doc.original_filename}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} · {(doc.file_size / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        <span title={doc.hash_sha256}>
                          {doc.hash_sha256.substring(0, 16)}...
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {new Date(doc.upload_time).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`http://127.0.0.1:8000/api/documents/${doc.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-mono"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Trail */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface-card border border-surface-border">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Cryptographic Ledger Integrity
                    </h3>
                    {verification?.verified ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Unbroken Chain
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                        Tamper Detected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Every intake upload and review action is cryptographically hash-chained via SHA-256. Retroactive editing is mathematically detectable.
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 shrink-0">
                Verified Blocks: {verification?.chain_length || auditEvents.length}
              </div>
            </div>

            <div className="bg-surface-card rounded-lg border border-surface-border p-5 space-y-4">
              <h4 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Append-Only Audit Timeline
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-border">
                {auditEvents.map((ev, idx) => (
                  <div key={ev.id} className="relative">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
                    <div className="bg-surface p-3.5 rounded-md border border-surface-border space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-200">{ev.action}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Actor: <span className="font-mono text-slate-300">{ev.actor_id.substring(0, 12)}...</span> · Entity: <span className="font-mono">{ev.entity_type} ({ev.entity_id.substring(0, 8)})</span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 pt-1 border-t border-surface-border/50 flex flex-wrap gap-x-4">
                        <span>Prev: {ev.prev_hash.substring(0, 16)}...</span>
                        <span>Hash: {ev.current_hash.substring(0, 16)}...</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Findings & Anomaly Signals (M3) */}
        {activeTab === "findings" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Scrutiny Findings & Anomaly Signals
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deterministic rule evaluations against handbook draft norms and heuristic anomaly alerts.
                </p>
              </div>

              <button
                onClick={handleRunValidation}
                disabled={validating}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50"
              >
                <Cpu className={`w-3.5 h-3.5 ${validating ? "animate-spin" : ""}`} />
                <span>{validating ? "Running Rule Pack..." : "Re-run Validation & Signals"}</span>
              </button>
            </div>

            {/* Decision Support Advisory Banner */}
            <div className="p-3.5 rounded-lg bg-surface-card border border-surface-border text-xs flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-slate-200">
                  DECISION-SUPPORT NOTICE (Non-Negotiable Principles 1 & 2):
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Findings generated below are advisory signals designed to support scrutiny officers. They do not constitute an automated approval or rejection, nor legal proof of fraud. Scrutiny officers retain statutory discretion to confirm, dismiss, or request clarification.
                </p>
              </div>
            </div>

            {/* Findings List */}
            {findings.length === 0 ? (
              <div className="bg-surface-card p-12 rounded-lg border border-surface-border text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-semibold text-slate-200 text-sm">
                  Zero Compliance Deficiencies or Anomaly Signals
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  All automated checklist items, certificate expiration boundaries, and cross-document intake assertions pass without contradiction.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {findings.map((f) => (
                  <div
                    key={f.id}
                    className={`p-4 rounded-lg border bg-surface-card space-y-3 ${
                      f.severity === "fail"
                        ? "border-rose-800/80"
                        : f.severity === "warning"
                        ? "border-amber-800/80"
                        : "border-purple-800/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={f.severity} />
                        <span className="font-mono text-[11px] text-slate-400 bg-surface px-2 py-0.5 rounded border border-surface-border">
                          {f.rule_id} ({f.rule_version})
                        </span>
                        {f.is_heuristic ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800">
                            HEURISTIC ANOMALY SIGNAL (Advisory Only)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800">
                            DETERMINISTIC COMPLIANCE RULE
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-mono text-muted-foreground">
                        Confidence: {(f.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{f.title}</h4>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{f.explanation}</p>
                    </div>

                    {f.recommended_action && (
                      <div className="bg-surface p-2.5 rounded border border-surface-border text-xs text-slate-300">
                        <span className="font-semibold text-accent text-[11px] block mb-0.5">
                          Recommended Scrutiny Action:
                        </span>
                        {f.recommended_action}
                      </div>
                    )}

                    {/* Evidence Provenance (Cross-Document and Single Document) */}
                    {f.evidence_refs && f.evidence_refs.length > 0 && (
                      <div className="pt-2 border-t border-surface-border/60">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground mb-1.5">
                          Referenced Evidence & Provenance
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {f.evidence_refs.map((ref, idx) => (
                            <div
                              key={idx}
                              className="bg-surface p-2.5 rounded border border-surface-border text-[11px] space-y-1.5 flex flex-col justify-between"
                            >
                              <div>
                                <div className="font-semibold text-slate-200">
                                  {ref.document_name || ref.title || ref.document_type || "Evidence Slot"}
                                </div>
                                <div className="text-muted-foreground text-[10px] font-mono">
                                  {ref.field_name && <span>Field: {ref.field_name} · </span>}
                                  {ref.value !== undefined && <span>Value: "{String(ref.value)}" · </span>}
                                  {ref.page && <span>Page: {ref.page}</span>}
                                  {ref.note && <span>Note: {ref.note}</span>}
                                </div>
                              </div>

                              {ref.document_id && (
                                <Link
                                  href={`/applications/${application.id}/workbench?doc=${ref.document_id}&page=${ref.page || 1}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1 pt-1 border-t border-surface-border/40 font-medium"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Inspect Bounding Box in Workbench</span>
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reviewer Action & Disposition Block (M5) */}
                    <div className="pt-3 border-t border-surface-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        {f.status !== "open" ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                f.status === "confirmed" 
                                  ? "bg-rose-950 text-rose-300 border border-rose-800" 
                                  : f.status === "dismissed"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-amber-950 text-amber-300 border border-amber-800"
                              }`}>
                                Officer Disposition: {f.status}
                              </span>
                              {f.reviewed_by && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  by {f.reviewed_by}
                                </span>
                              )}
                            </div>
                            {f.review_rationale && (
                              <p className="text-[11px] text-slate-300 italic">
                                "{f.review_rationale}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Disposition: Open for Scrutiny Action
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setReviewModalFinding(f);
                            setReviewAction("confirm");
                            setReviewRationale("");
                          }}
                          className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-semibold transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setReviewModalFinding(f);
                            setReviewAction("dismiss");
                            setReviewRationale("");
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 text-xs font-semibold transition-colors"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => {
                            setReviewModalFinding(f);
                            setReviewAction("request_clarification");
                            setReviewRationale("");
                          }}
                          className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-200 text-xs font-semibold transition-colors"
                        >
                          Clarification
                        </button>
                        <button
                          onClick={() => {
                            setReviewModalFinding(f);
                            setReviewAction("escalate");
                            setReviewRationale("");
                          }}
                          className="px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-800 text-purple-200 text-xs font-semibold transition-colors"
                        >
                          Escalate
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Compliance Matrix (M4) */}
        {activeTab === "compliance" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Regulatory Compliance Matrix
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete cross-referencing of application evidence against Approval Process Handbook draft norms.
                </p>
              </div>

              <Link
                href="/rules"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-accent font-semibold transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Explore All Rules & Sources</span>
              </Link>
            </div>

            {/* Draft Citation Banner */}
            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/80 text-xs flex items-start gap-3 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-[11px] uppercase tracking-wide">
                  UNVERIFIED AGAINST CURRENT HANDBOOK: DRAFT RULES FOR DEMO DECISION SUPPORT
                </span>
                <p className="text-amber-200/80 text-[11px] mt-0.5">
                  Every cell below contains an official source citation marked "TBD: confirm against official handbook".
                </p>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-surface-card rounded-lg border border-surface-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-surface text-muted-foreground font-mono uppercase text-[10px] border-b border-surface-border">
                    <tr>
                      <th className="py-3 px-4">Rule ID</th>
                      <th className="py-3 px-4">Requirement</th>
                      <th className="py-3 px-4">Evidence Document</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Official Handbook Citation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {(rulePack?.rules || []).map((rule: any) => {
                      const relatedFinding = findings.find(f => f.rule_id === rule.rule_id);
                      const status = relatedFinding ? relatedFinding.severity : "pass";

                      return (
                        <tr key={rule.rule_id} className="hover:bg-surface/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-200 whitespace-nowrap">
                            {rule.rule_id}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-slate-200">{rule.title}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {rule.explanation_template}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            {rule.required_evidence?.join(", ") || "General Evidence"}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <StatusBadge status={status} />
                          </td>
                          <td className="py-3 px-4 max-w-sm">
                            <div className="font-mono text-[11px] text-slate-300">
                              {rule.source_document}
                            </div>
                            <div className="font-mono text-[10px] text-amber-400 mt-0.5">
                              {rule.section_page}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: External Verification (M4) */}
        {activeTab === "verification" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  External Authority Registry Verification
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct cross-referencing against external statutory databases (Fire NOC, University Affiliation, AICTE Central).
                </p>
              </div>
            </div>

            {/* Mandatory Simulated Banner per Non-Negotiable Principle 4 */}
            <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-800 text-cyan-200 text-xs flex items-start gap-3">
              <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold font-mono tracking-wide uppercase text-[11px] text-cyan-300 block">
                  SIMULATED EXTERNAL ISSUER - DEMO ONLY
                </span>
                <p className="text-cyan-200/90 text-[11px] leading-relaxed">
                  Connectors below simulate asynchronous queries to state registries. Use the scenario mode switcher to test handling of confirmed credentials, discrepancies, timeouts, or authority service outages.
                </p>
              </div>
            </div>

            {/* Query Control Bar */}
            <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
              <h4 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Select Authority & Simulation Mode
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Target External Authority
                  </label>
                  <select
                    value={selectedAuthority}
                    onChange={(e) => setSelectedAuthority(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="fire_department">State Fire & Rescue Services Licensing Portal</option>
                    <option value="state_university">Affiliating State Technical University Registry</option>
                    <option value="aicte_portal">AICTE Central Institutional Registry</option>
                    <option value="municipal_corporation">Municipal Corporation Structural Safety Cell</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Simulation Response Mode
                  </label>
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="match">Match (Verified Active Record)</option>
                    <option value="mismatch">Mismatch (Contradictory Record on File)</option>
                    <option value="not_found">Not Found (Record Absent from Registry)</option>
                    <option value="timeout">Timeout (504 Gateway Delay)</option>
                    <option value="service_down">Service Down (503 Maintenance)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleExecuteVerification}
                    disabled={verificationQuerying}
                    className="w-full py-2 px-4 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${verificationQuerying ? "animate-spin" : ""}`} />
                    <span>{verificationQuerying ? "Querying Registry..." : "Query External Registry"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Verification Response Inspector */}
            {verificationResponse && (
              <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">
                      {verificationResponse.authority_name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                      verificationResponse.status === "verified"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : verificationResponse.status === "mismatch"
                        ? "bg-rose-950 text-rose-300 border border-rose-800"
                        : "bg-amber-950 text-amber-300 border border-amber-800"
                    }`}>
                      {verificationResponse.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                    <span>Latency: <strong className="text-cyan-400">{verificationResponse.latency_ms} ms</strong></span>
                    <span>·</span>
                    <span>{new Date(verificationResponse.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {verificationResponse.error_message && (
                  <div className="p-3 rounded bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
                    <strong>Error / Alert:</strong> {verificationResponse.error_message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase text-muted-foreground block font-bold">
                      Query Sent to Registry:
                    </span>
                    <pre className="p-3 rounded bg-surface border border-surface-border text-slate-300 overflow-x-auto text-[11px]">
                      {JSON.stringify(verificationResponse.query_sent, null, 2)}
                    </pre>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase text-muted-foreground block font-bold">
                      Registry Response Payload:
                    </span>
                    <pre className="p-3 rounded bg-surface border border-surface-border text-slate-300 overflow-x-auto text-[11px]">
                      {JSON.stringify(verificationResponse.response_payload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="pt-2 text-[10px] font-mono text-cyan-400/80 border-t border-surface-border/40">
                  {verificationResponse.badge} · {verificationResponse.note}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Exportable Scrutiny Dossier & Report (M5) */}
        {activeTab === "report" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Exportable Case Dossier & Scrutiny Reports
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download certified decision-support reports with SHA-256 integrity hashes and cryptographic audit chain.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`http://localhost:8000/api/applications/${application.id}/export/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Signed PDF Dossier</span>
                </a>

                <a
                  href={`http://localhost:8000/api/applications/${application.id}/export/json`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-200 font-semibold transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-accent" />
                  <span>Download Structured JSON</span>
                </a>
              </div>
            </div>

            {/* Dossier Executive Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Document Inventory</span>
                <div className="text-lg font-bold text-slate-100">{application.documents.length} Files</div>
                <div className="text-[10px] text-emerald-400 font-mono">100% SHA-256 Hashed</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Audit Ledger State</span>
                <div className="text-lg font-bold text-slate-100">{verification?.chain_length || auditEvents.length} Blocks</div>
                <div className="text-[10px] text-emerald-400 font-mono">Unbroken Cryptographic Chain</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Findings Disposition</span>
                <div className="text-lg font-bold text-slate-100">
                  {findings.filter(f => f.status !== "open").length} / {findings.length} Reviewed
                </div>
                <div className="text-[10px] text-amber-400 font-mono">Mandatory Rationales Logged</div>
              </div>

              <div className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-1">
                <span className="text-[10px] uppercase font-mono text-muted-foreground">Officer Recommendation</span>
                <div className="text-sm font-bold text-accent truncate">
                  {application.recommendation || "Pending Decision"}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {application.recommendation_at ? new Date(application.recommendation_at).toLocaleDateString() : "Awaiting Endorsement"}
                </div>
              </div>
            </div>

            {/* Dossier Preview Details */}
            <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
              <h4 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Certified Dossier Contents Preview
              </h4>

              <div className="bg-surface p-4 rounded border border-surface-border space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                  <span className="font-semibold text-slate-200">
                    Institution: {application.institution?.name} ({application.institution?.permanent_id})
                  </span>
                  <span className="font-mono text-cyan-400 text-[11px]">
                    Academic Year {application.academic_year} · Assessment Date {application.assessment_date}
                  </span>
                </div>

                <div className="text-slate-300 space-y-1.5 text-[11px] leading-relaxed">
                  <p><strong>Category:</strong> {application.category}</p>
                  <p><strong>Rule Pack:</strong> {application.rule_pack_id} (v2026.1-draft)</p>
                  <p><strong>Officer Justification:</strong> {application.recommendation_rationale || "Pending final endorsement statement by scrutiny officer."}</p>
                  <p><strong>Cryptographic Ledger Root:</strong> <span className="font-mono text-[10px] text-slate-400">{auditEvents[0]?.current_hash ? `${auditEvents[0].current_hash.substring(0, 32)}...` : "Genesis"}</span></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 1: Finding Review Disposition Modal */}
        {reviewModalFinding && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-card border border-surface-border rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Record Officer Finding Disposition
                  </h3>
                  <div className="font-mono text-[10px] text-accent mt-0.5">
                    {reviewModalFinding.rule_id} · {reviewModalFinding.title}
                  </div>
                </div>
                <button
                  onClick={() => setReviewModalFinding(null)}
                  className="text-muted-foreground hover:text-slate-200 text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Select Review Decision Action
                  </label>
                  <select
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="confirm">Confirm Finding (Official Regulatory Deficiency)</option>
                    <option value="dismiss">Dismiss Finding (Clarification/Override on Record)</option>
                    <option value="request_clarification">Request Clarification from Applicant</option>
                    <option value="escalate">Escalate to Senior Scrutiny Officer</option>
                  </select>
                </div>

                {reviewAction === "request_clarification" && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Clarification Item Requested
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Valid Renewal Fee Receipt or Updated NOC"
                      value={clarificationItem}
                      onChange={(e) => setClarificationItem(e.target.value)}
                      className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>Mandatory Scrutiny Rationale</span>
                    <span className="text-[10px] text-amber-400 font-normal">Audit-Logged (Min 5 chars)</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter statutory justification for confirming, dismissing, or escalating this finding..."
                    value={reviewRationale}
                    onChange={(e) => setReviewRationale(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  onClick={() => setReviewModalFinding(null)}
                  className="px-4 py-2 rounded border border-surface-border text-xs text-slate-300 hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFindingReviewSubmit}
                  disabled={submittingReview}
                  className="px-4 py-2 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                  {submittingReview ? "Recording..." : "Save Audit Disposition"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Overall Scrutiny Officer Recommendation Modal */}
        {recommendationModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface-card border border-surface-border rounded-lg max-w-xl w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Record Final Scrutiny Officer Recommendation
                  </h3>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Statutory decision support endorsement for AICTE Executive Committee.
                  </div>
                </div>
                <button
                  onClick={() => setRecommendationModalOpen(false)}
                  className="text-muted-foreground hover:text-slate-200 text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Statutory Recommendation
                  </label>
                  <select
                    value={selectedRecommendation}
                    onChange={(e) => setSelectedRecommendation(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="RECOMMEND_APPROVAL">Recommend Extension of Approval (EoA)</option>
                    <option value="RECOMMEND_REJECTION">Recommend Rejection / Notice of Deficiency</option>
                    <option value="REQUEST_RESUBMISSION">Request Institutional Resubmission (14 Days)</option>
                    <option value="REFER_TO_HEARING">Refer to Standing Hearing Committee (SHC)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between mb-1">
                    <span>Officer Scrutiny Justification</span>
                    <span className="text-[10px] text-amber-400 font-normal">Mandatory (Min 10 chars)</span>
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Provide comprehensive statutory rationale citing verified documents, resolved findings, and handbook chapter compliance..."
                    value={recommendationRationale}
                    onChange={(e) => setRecommendationRationale(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button
                  onClick={() => setRecommendationModalOpen(false)}
                  className="px-4 py-2 rounded border border-surface-border text-xs text-slate-300 hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecommendationSubmit}
                  disabled={submittingRecommendation}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                >
                  {submittingRecommendation ? "Recording..." : "Record Statutory Recommendation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
