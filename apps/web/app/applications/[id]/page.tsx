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
  Eye
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

interface ApplicationData {
  id: string;
  category: string;
  academic_year: string;
  assessment_date: string;
  status: string;
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
  const [activeTab, setActiveTab] = useState<"documents" | "findings" | "compliance" | "verification" | "audit" | "report">("documents");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

            <div className="flex items-center gap-3">
              <Link
                href={`/applications/${application.id}/workbench`}
                className="px-4 py-2.5 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Eye className="w-4 h-4" />
                <span>Open Evidence Workbench</span>
              </Link>
            </div>
          </div>

          {/* Stepper / Job Pipeline State */}
          <div className="mt-6 pt-5 border-t border-surface-border">
            <div className="text-[11px] font-mono uppercase text-muted-foreground mb-3 flex items-center justify-between">
              <span>Pipeline Stage Progression</span>
              <span className="text-accent">Stage 1 of 5 Verified</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="bg-surface p-2.5 rounded border border-emerald-800/60 text-xs">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 1. Safe Intake
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Ingested & Hashed</div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-surface-border text-xs opacity-70">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 2. Text & OCR
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M2 Extraction</div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-surface-border text-xs opacity-70">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 3. Rule Checks
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M3 Validation</div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-surface-border text-xs opacity-70">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 4. Discrepancies
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M3 Consistency</div>
              </div>

              <div className="bg-surface p-2.5 rounded border border-surface-border text-xs opacity-70">
                <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> 5. Officer Action
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">M5 Decision</div>
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
            onClick={() => setActiveTab("findings")}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "findings"
                ? "border-accent text-accent font-semibold"
                : "border-transparent text-muted-foreground hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Findings (M3)</span>
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

        {/* Placeholder tab views for subsequent milestones */}
        {activeTab !== "documents" && activeTab !== "audit" && (
          <div className="bg-surface-card p-12 rounded-lg border border-surface-border text-center space-y-3">
            <Layers className="w-8 h-8 text-accent mx-auto" />
            <h4 className="font-semibold text-slate-200 text-sm">
              Tab Scheduled for Subsequent Pipeline Milestone
            </h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              This module will be populated as extraction (M2), rule validation (M3), external verification (M4), 
              and the review action console (M5) are incrementally integrated.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
