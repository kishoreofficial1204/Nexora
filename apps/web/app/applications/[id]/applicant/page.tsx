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
  ExternalLink,
  X,
  FileCheck2,
  Loader2
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

interface ApplicantNotice {
  notice_id: string;
  rectification_id?: string | null;
  rectification_status?: string | null;
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
  const [uploadNotice, setUploadNotice] = useState<ApplicantNotice | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadApplicantData = async () => {
    try {
      setLoading(true);
      const res = await fetchApi<ApplicantViewData>(`/applications/${id}/applicant-view`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadApplicantData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleReplacementUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadNotice || !uploadFile) return;
    if (!uploadNotice.rectification_id) {
      setUploadError("A formal clarification request is required before evidence can be submitted.");
      return;
    }

    setUploading(true);
    setUploadComplete(false);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("files", uploadFile);
      formData.append("document_type", "replacement_evidence");

      const uploaded = await fetchApi<Array<{ id: string }>>(
        `/applications/${id}/documents`,
        { method: "POST", body: formData }
      );
      if (!uploaded.length) {
        throw new Error("The replacement file was not accepted.");
      }

      await fetchApi(`/rectifications/${uploadNotice.rectification_id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          document_id: uploaded[0].id,
          applicant_note: "Replacement evidence submitted through the applicant portal.",
        }),
      });

      await loadApplicantData();
      setUploadComplete(true);
    } catch (err) {
      console.error(err);
      setUploadError(err instanceof Error ? err.message : "Replacement submission failed.");
    } finally {
      setUploading(false);
    }
  };

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
                      onClick={() => {
                        setUploadNotice(item);
                        setUploadFile(null);
                        setUploadComplete(false);
                        setUploadError(null);
                      }}
                      disabled={
                        !item.rectification_id ||
                        item.rectification_status === "submitted" ||
                        item.rectification_status === "resolved"
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {item.rectification_status === "submitted" || item.rectification_status === "resolved" ? (
                        <FileCheck2 className="w-3.5 h-3.5" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {!item.rectification_id
                          ? "Awaiting formal clarification request"
                          : item.rectification_status === "submitted" || item.rectification_status === "resolved"
                            ? "Replacement submitted"
                            : "Submit Clarification / Re-upload"}
                      </span>
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

      {uploadNotice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg bg-surface-card border border-surface-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Submit clarification / replacement evidence</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{uploadNotice.title}</p>
              </div>
              <button
                onClick={() => {
                  setUploadNotice(null);
                  setUploadFile(null);
                  setUploadComplete(false);
                }}
                className="text-muted-foreground hover:text-slate-200"
                aria-label="Close upload dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadComplete ? (
              <div className="py-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center mx-auto">
                  <FileCheck2 className="w-6 h-6 text-emerald-300" />
                </div>
                <h4 className="text-sm font-semibold text-slate-100">Replacement evidence submitted</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  The replacement file has been stored, linked to this clarification request, and added
                  to the audit trail. The reviewer can now re-run validation from the case workspace.
                </p>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-300 bg-emerald-950/40 border border-emerald-900 rounded px-2 py-1">
                  <ShieldCheck className="w-3 h-3" /> Persisted in the demo case record
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setUploadNotice(null);
                      setUploadFile(null);
                      setUploadComplete(false);
                    }}
                    className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReplacementUpload} className="space-y-4">
                <div className="p-3 rounded-md bg-surface border border-surface-border text-[11px] text-slate-300 leading-relaxed">
                  <span className="font-semibold text-amber-300">Requested item:</span> {uploadNotice.requirement_summary}
                </div>
                <label className="block cursor-pointer rounded-lg border border-dashed border-surface-border bg-surface hover:border-accent p-5 text-center transition-colors">
                  <UploadCloud className="w-7 h-7 text-accent mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-200">
                    {uploadFile ? uploadFile.name : "Choose a replacement PDF or image"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    PDF, JPG or PNG · up to 25 MB · stored in the demo case record
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
                {uploadError && (
                  <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-[11px] text-red-200">
                    {uploadError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                  <button
                    type="button"
                    onClick={() => setUploadNotice(null)}
                    className="px-4 py-2 rounded-md border border-surface-border text-xs text-slate-300 hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!uploadFile || uploading}
                    className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    {uploading ? "Submitting..." : "Submit replacement"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
