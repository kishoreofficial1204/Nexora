"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowLeft, 
  UploadCloud, 
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

interface ApplicantNotice {
  notice_id: string;
  document_reference: string;
  notice_type: string;
  title: string;
  requirement_summary: string;
  scrutiny_rationale: string;
  status: string;
}

interface ApplicantViewData {
  application_id: string;
  academic_year: string;
  category: string;
  institution_name: string;
  permanent_id: string;
  current_scrutiny_stage: string;
  overall_status: string;
  submitted_documents: Array<{
    document_type: string;
    filename: string;
    upload_timestamp: string;
    page_count: number;
  }>;
  action_items_for_applicant: ApplicantNotice[];
  note: string;
}

export default function ApplicantPortalPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<ApplicantViewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApplicantData() {
      try {
        setLoading(true);
        const res = await fetchApi<ApplicantViewData>(`/applications/${id}/applicant-view`);
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadApplicantData();
    }
  }, [id]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center p-12 text-xs text-muted-foreground">
          Loading applicant scrutiny communication portal...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Link back to Officer Case Overview */}
        <div className="flex items-center justify-between">
          <Link
            href={`/applications/${id}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Scrutiny Officer Workspace</span>
          </Link>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-400">
            Applicant Communication Mode (Internal Signals Redacted)
          </span>
        </div>

        {/* Header Institution Card */}
        <div className="bg-surface-card p-6 rounded-lg border border-surface-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100">{data.institution_name}</h1>
                <StatusBadge status={data.overall_status} />
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                <span>PID: <strong className="font-mono text-slate-200">{data.permanent_id}</strong></span>
                <span>·</span>
                <span>Category: <strong className="text-slate-200">{data.category}</strong></span>
                <span>·</span>
                <span>Academic Year: <strong className="font-mono text-cyan-400">{data.academic_year}</strong></span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">Current Stage</span>
              <span className="text-xs font-semibold text-accent">{data.current_scrutiny_stage}</span>
            </div>
          </div>
        </div>

        {/* Action Items / Clarification Requests Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Action Items & Official Clarification Requests ({data.action_items_for_applicant.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Items requiring institutional endorsement, re-upload, or explanation per Scrutiny Committee directives.
              </p>
            </div>
          </div>

          {data.action_items_for_applicant.length === 0 ? (
            <div className="bg-surface-card p-8 rounded-lg border border-surface-border text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-200">
                No Pending Deficiencies or Clarification Notices
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Your submitted documents are currently undergoing review. No statutory notices or missing items have been flagged for response.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.action_items_for_applicant.map((item) => (
                <div
                  key={item.notice_id}
                  className="p-5 rounded-lg border border-amber-800/80 bg-surface-card space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        {item.notice_type}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        Ref: {item.document_reference}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-muted-foreground uppercase">
                      Status: {item.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-slate-100">{item.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {item.requirement_summary}
                    </p>
                  </div>

                  {item.scrutiny_rationale && (
                    <div className="bg-surface p-3 rounded border border-surface-border text-xs text-slate-300 space-y-1">
                      <span className="font-semibold text-amber-400 text-[11px] block">
                        Official Scrutiny Officer Directives:
                      </span>
                      <p>{item.scrutiny_rationale}</p>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => alert("Clarification document upload submission simulated for demo.")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors shadow-sm"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Submit Clarification / Re-upload</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submitted Document Inventory */}
        <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Acknowledged Document Submissions ({data.submitted_documents.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Original files registered in AICTE scrutiny intake records.
          </p>

          <div className="divide-y divide-surface-border">
            {data.submitted_documents.map((doc, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  <span className="font-semibold text-slate-200">{doc.filename}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">({doc.document_type})</span>
                </div>
                <div className="text-right text-muted-foreground text-[11px] font-mono">
                  {doc.page_count} Pages · {doc.upload_timestamp ? new Date(doc.upload_timestamp).toLocaleDateString() : "Uploaded"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-[11px] text-muted-foreground">
          {data.note}
        </div>
      </main>
    </div>
  );
}
