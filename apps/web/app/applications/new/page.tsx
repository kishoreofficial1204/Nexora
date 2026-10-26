"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  ArrowLeft, 
  ArrowRight, 
  UploadCloud, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Info
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

interface ChecklistItem {
  id: string;
  document_type: string;
  title: string;
  is_required: boolean;
  description: string;
}

interface RulePackData {
  rule_pack: {
    id: string;
    name: string;
    version: string;
    banner_notice: string;
    effective_from: string;
    effective_to: string;
  };
  checklist_items: ChecklistItem[];
}

export default function NewApplicationPage() {
  const router = useRouter();
  const [rulePackData, setRulePackData] = useState<RulePackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [institutionName] = useState("ABC Institute of Technology");
  const [permanentId] = useState("1-9876543210");
  const [category, setCategory] = useState("Extension of Approval (EoA)");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [assessmentDate, setAssessmentDate] = useState("2026-10-26");

  // Document Uploads
  const [filesByDocType, setFilesByDocType] = useState<Record<string, File>>({});

  useEffect(() => {
    async function loadRules() {
      try {
        const data = await fetchApi<RulePackData>("/rules");
        setRulePackData(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  const handleFileChange = (docType: string, file: File | null) => {
    if (!file) {
      const updated = { ...filesByDocType };
      delete updated[docType];
      setFilesByDocType(updated);
      return;
    }

    // Check extension
    const validExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      alert(`Invalid file extension '${ext}'. Only PDF and JPG/PNG images are permitted.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("File exceeds maximum allowed size of 25MB.");
      return;
    }

    setFilesByDocType({ ...filesByDocType, [docType]: file });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create Application
      const app = await fetchApi<{ id: string }>("/applications", {
        method: "POST",
        body: JSON.stringify({
          category,
          academic_year: academicYear,
          assessment_date: assessmentDate,
          rule_pack_id: rulePackData?.rule_pack.id || "pack_eoa_ug_2026",
        }),
      });

      // 2. Upload any selected files
      const uploadPromises = Object.entries(filesByDocType).map(async ([docType, file]) => {
        const formData = new FormData();
        formData.append("files", file);
        formData.append("document_type", docType);

        return fetchApi(`/applications/${app.id}/documents`, {
          method: "POST",
          body: formData,
        });
      });

      await Promise.all(uploadPromises);

      // Redirect to newly created application case
      router.push(`/applications/${app.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-200 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Application Queue
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Create Application Intake Case
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Specify institutional parameters, configure assessment baseline date, and attach supporting evidence documents.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-md bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Regulatory Rule Pack Banner */}
        {rulePackData && (
          <div className="mb-6 p-4 rounded-lg bg-surface-card border border-amber-900/50 flex flex-col sm:flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status="warning" customLabel="Draft Rule Pack" size="sm" />
                <span className="text-xs font-mono font-semibold text-amber-200">
                  {rulePackData.rule_pack.name} ({rulePackData.rule_pack.version})
                </span>
              </div>
              <p className="text-xs text-amber-300/80 font-mono">
                {rulePackData.rule_pack.banner_notice}
              </p>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground sm:text-right shrink-0">
              Effective: {rulePackData.rule_pack.effective_from} to {rulePackData.rule_pack.effective_to}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Institution & Case Parameters */}
          <div className="bg-surface-card p-6 rounded-lg border border-surface-border space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 uppercase font-mono tracking-wider">
              1. Institutional & Assessment Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Institution Name (Synthetic Profile)
                </label>
                <input
                  type="text"
                  value={institutionName}
                  disabled
                  className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-xs text-slate-400 font-sans cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  AICTE Permanent Institute ID (PID)
                </label>
                <input
                  type="text"
                  value={permanentId}
                  disabled
                  className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-xs text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Application Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-xs text-slate-200 focus:outline-none focus:border-accent"
                >
                  <option value="Extension of Approval (EoA)">Extension of Approval (EoA)</option>
                  <option value="Increase in Intake">Increase in Intake (Chapter IV)</option>
                  <option value="New Programme Addition">New Programme Addition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-surface rounded-md border border-surface-border text-xs text-slate-200 focus:outline-none focus:border-accent font-mono"
                >
                  <option value="2026-27">2026-27</option>
                  <option value="2025-26">2025-26</option>
                </select>
              </div>

              <div className="sm:col-span-2 bg-surface p-3.5 rounded-md border border-surface-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200">
                      Assessment Baseline Date
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Fixed assessment date for certificate expiry and rule evaluation. System never silently uses dynamic today.
                    </p>
                  </div>
                  <input
                    type="date"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    required
                    className="px-3 py-1.5 bg-background rounded-md border border-surface-border text-xs font-mono text-accent focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Checklist & Document Uploads */}
          <div className="bg-surface-card p-6 rounded-lg border border-surface-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 uppercase font-mono tracking-wider">
                  2. Mandatory Checklist & Supporting Documents
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select and attach local files to fulfill the required document slots.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {Object.keys(filesByDocType).length} / {rulePackData?.checklist_items.length || 0} Attached
              </span>
            </div>

            <div className="space-y-3 pt-2">
              {rulePackData?.checklist_items.map((item) => {
                const attachedFile = filesByDocType[item.document_type];
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-md border transition-all ${
                      attachedFile
                        ? "bg-surface-hover border-emerald-900/60"
                        : "bg-surface border-surface-border"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-200">{item.title}</span>
                          {item.is_required ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                              Mandatory
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{item.description}</p>
                        <span className="text-[10px] font-mono text-slate-500">Slot: {item.document_type}</span>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {attachedFile ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {attachedFile.name.length > 20
                                ? attachedFile.name.substring(0, 18) + "..."
                                : attachedFile.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFileChange(item.document_type, null)}
                              className="text-xs text-rose-400 hover:underline px-1"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-card hover:bg-surface-hover border border-surface-border text-xs text-slate-300 hover:text-white transition-colors">
                            <UploadCloud className="w-3.5 h-3.5 text-accent" />
                            <span>Select File</span>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) =>
                                handleFileChange(
                                  item.document_type,
                                  e.target.files && e.target.files[0] ? e.target.files[0] : null
                                )
                              }
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-4">
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-slate-200"
            >
              Cancel and Return
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {submitting ? "Creating Case & Ingesting Files..." : "Create Case & Upload Evidence"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
