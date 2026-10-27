"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  FileText, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Eye, 
  Split, 
  Sparkles,
  Layers,
  History,
  Info,
  Maximize2,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchApi } from "@/lib/api";

interface ExtractedField {
  id: string;
  document_id: string;
  field_name: string;
  raw_value: string;
  normalized_value: string;
  page: number;
  bbox: [number, number, number, number];
  method: string;
  confidence: number;
  review_status: string;
}

interface DocumentItem {
  id: string;
  document_type: string;
  filename: string;
  original_filename: string;
  page_count: number;
  file_size: number;
  source_status: string;
}

interface ApplicationData {
  id: string;
  category: string;
  academic_year: string;
  assessment_date: string;
  institution?: {
    name: string;
    permanent_id: string;
  };
  documents: DocumentItem[];
}

export default function EvidenceWorkbenchPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [compareDocId, setCompareDocId] = useState<string>("");
  const [compareMode, setCompareMode] = useState(false);

  // Viewer State (Primary)
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Viewer State (Compare Pane)
  const [comparePage, setComparePage] = useState(1);

  // Extracted Fields
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  // Correction Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [fieldToEdit, setFieldToEdit] = useState<ExtractedField | null>(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [correctionRationale, setCorrectionRationale] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  const loadApplication = async () => {
    try {
      setLoading(true);
      const app = await fetchApi<ApplicationData>(`/applications/${id}`);
      setApplication(app);

      if (app.documents && app.documents.length > 0) {
        const defaultDoc = app.documents[0];
        setSelectedDocId(defaultDoc.id);
        if (app.documents.length > 1) {
          setCompareDocId(app.documents[1].id);
        }
        await loadDocumentFields(defaultDoc.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentFields = async (docId: string) => {
    try {
      const data = await fetchApi<ExtractedField[]>(`/documents/${docId}/fields`);
      setFields(data);
      if (data.length > 0) {
        setSelectedFieldId(data[0].id);
        setCurrentPage(data[0].page);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  const handleSelectDoc = async (docId: string) => {
    setSelectedDocId(docId);
    setCurrentPage(1);
    await loadDocumentFields(docId);
  };

  const handleExtractAll = async () => {
    try {
      setExtracting(true);
      await fetchApi(`/applications/${id}/extract`, { method: "POST" });
      if (selectedDocId) {
        await loadDocumentFields(selectedDocId);
      }
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const handleSelectField = (field: ExtractedField) => {
    setSelectedFieldId(field.id);
    setCurrentPage(field.page);
  };

  const openCorrectionModal = (field: ExtractedField) => {
    setFieldToEdit(field);
    setCorrectedValue(field.normalized_value);
    setCorrectionRationale("");
    setEditModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldToEdit) return;

    try {
      setSavingCorrection(true);
      const updated = await fetchApi<ExtractedField>(`/fields/${fieldToEdit.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          normalized_value: correctedValue,
          review_status: "corrected",
          rationale: correctionRationale || "Reviewer correction in Evidence Workbench",
        }),
      });

      // Update state
      setFields(fields.map((f) => (f.id === updated.id ? updated : f)));
      setEditModalOpen(false);
    } catch (err: any) {
      alert(`Correction failed: ${err.message}`);
    } finally {
      setSavingCorrection(false);
    }
  };

  const currentDoc = application?.documents.find((d) => d.id === selectedDocId);
  const compareDoc = application?.documents.find((d) => d.id === compareDocId);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editModalOpen) return;
      if (e.key === "]" || e.key === "ArrowDown") {
        const curIdx = fields.findIndex((f) => f.id === selectedFieldId);
        if (curIdx >= 0 && curIdx < fields.length - 1) {
          handleSelectField(fields[curIdx + 1]);
        }
      } else if (e.key === "[" || e.key === "ArrowUp") {
        const curIdx = fields.findIndex((f) => f.id === selectedFieldId);
        if (curIdx > 0) {
          handleSelectField(fields[curIdx - 1]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fields, selectedFieldId, editModalOpen]);

  if (loading || !application) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center p-12 text-xs text-muted-foreground">
          <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mr-3" />
          Loading evidence workbench...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <NavHeader />

      {/* Top Workbench Action Bar */}
      <div className="bg-surface-card border-b border-surface-border px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/applications/${id}`}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-slate-200 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Case Overview
          </Link>
          <span className="text-slate-600">|</span>
          <span className="font-semibold text-slate-200">{application.institution?.name}</span>
          <span className="text-muted-foreground font-mono">PID: {application.institution?.permanent_id}</span>
          <span className="text-muted-foreground font-mono">Assessment: {application.assessment_date}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-2.5 py-1.5 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              compareMode
                ? "bg-accent-muted border-accent text-accent"
                : "bg-surface border-surface-border text-slate-300 hover:text-white"
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>{compareMode ? "Exit Side-by-Side" : "Side-by-Side Compare"}</span>
          </button>

          <button
            onClick={handleExtractAll}
            disabled={extracting}
            className="px-3 py-1.5 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{extracting ? "Extracting Facts..." : "Extract All Facts (M2)"}</span>
          </button>
        </div>
      </div>

      {/* 3-Column Split Workbench Workspace */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden h-[calc(100vh-105px)]">
        {/* Left Column: Documents Selector (2.5 Cols) */}
        <div className="col-span-12 md:col-span-3 lg:col-span-2.5 bg-surface border-r border-surface-border overflow-y-auto p-3 space-y-2">
          <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold px-2 py-1 flex items-center justify-between">
            <span>Case Documents</span>
            <span>{application.documents.length}</span>
          </div>

          <div className="space-y-1.5">
            {application.documents.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              return (
                <button
                  key={doc.id}
                  onClick={() => handleSelectDoc(doc.id)}
                  className={`w-full text-left p-2.5 rounded-md border text-xs transition-all ${
                    isSelected
                      ? "bg-accent-muted border-accent text-foreground shadow-sm"
                      : "bg-surface-card border-surface-border text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="font-semibold text-slate-200 truncate flex items-center justify-between">
                    <span className="truncate">{doc.original_filename}</span>
                    {doc.source_status === "parsed" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span className="truncate text-accent">{doc.document_type}</span>
                    <span>{doc.page_count}p</span>
                  </div>
                </button>
              );
            })}
          </div>

          {compareMode && (
            <div className="pt-4 border-t border-surface-border mt-4">
              <div className="text-[11px] font-mono uppercase text-muted-foreground font-semibold px-2 py-1">
                Compare Target Document
              </div>
              <select
                value={compareDocId}
                onChange={(e) => {
                  setCompareDocId(e.target.value);
                  setComparePage(1);
                }}
                className="w-full mt-1.5 bg-surface-card border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                {application.documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename} ({d.document_type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Center Pane: Evidence Viewer with Visual Page & Bounding Box Layer (6.5 Cols or 6 Cols in compare mode) */}
        <div className={`col-span-12 ${compareMode ? "md:col-span-5" : "md:col-span-5 lg:col-span-6"} bg-slate-950 flex flex-col border-r border-surface-border overflow-hidden`}>
          {/* Viewer Controls Bar */}
          <div className="bg-surface px-4 py-2 border-b border-surface-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-200 truncate max-w-[200px]">
                {currentDoc?.original_filename || "Document"}
              </span>
              <span className="text-muted-foreground font-mono">
                (Page {currentPage} of {currentDoc?.page_count || 1})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded bg-surface-card border border-surface-border disabled:opacity-30 text-slate-300 hover:text-white"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(currentDoc?.page_count || 1, currentPage + 1))}
                disabled={currentPage >= (currentDoc?.page_count || 1)}
                className="p-1 rounded bg-surface-card border border-surface-border disabled:opacity-30 text-slate-300 hover:text-white"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <span className="text-slate-600">|</span>

              <button
                onClick={() => setZoomLevel(Math.max(60, zoomLevel - 15))}
                className="p-1 rounded bg-surface-card border border-surface-border text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-muted-foreground w-10 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel(Math.min(180, zoomLevel + 15))}
                className="p-1 rounded bg-surface-card border border-surface-border text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 rounded bg-surface-card border border-surface-border text-slate-300 hover:text-white"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rendered Document Page with Visual Bounding Box Highlights */}
          <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-950/70">
            {selectedDocId ? (
              <div
                className="relative bg-white shadow-2xl transition-transform origin-top"
                style={{
                  width: `${(612 * zoomLevel) / 100}px`,
                  height: `${(792 * zoomLevel) / 100}px`,
                }}
              >
                {/* Visual Page Image Rendered directly by Backend PyMuPDF Engine */}
                <img
                  src={`http://127.0.0.1:8000/api/documents/${selectedDocId}/pages/${currentPage}/image?dpi=140`}
                  alt={`Page ${currentPage}`}
                  className="w-full h-full object-contain pointer-events-none select-none"
                />

                {/* Overlaid Bounding Box Highlights for Extracted Fields on this page */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 612 792"
                >
                  {fields
                    .filter((f) => f.page === currentPage)
                    .map((field) => {
                      const isHighlighted = field.id === selectedFieldId;
                      const [x0, y0, x1, y1] = field.bbox;
                      const w = Math.max(10, x1 - x0);
                      const h = Math.max(8, y1 - y0);

                      return (
                        <g key={field.id} className="transition-all duration-150">
                          <rect
                            x={x0}
                            y={y0}
                            width={w}
                            height={h}
                            fill={isHighlighted ? "rgba(6, 182, 212, 0.28)" : "rgba(245, 158, 11, 0.16)"}
                            stroke={isHighlighted ? "#06b6d4" : "#f59e0b"}
                            strokeWidth={isHighlighted ? 2.5 : 1.5}
                            strokeDasharray={isHighlighted ? "none" : "3,2"}
                            rx={2}
                          />
                          {isHighlighted && (
                            <text
                              x={x0}
                              y={Math.max(12, y0 - 4)}
                              fill="#06b6d4"
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {field.field_name}: {field.normalized_value}
                            </text>
                          )}
                        </g>
                      );
                    })}
                </svg>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground p-8">No document selected.</div>
            )}
          </div>
        </div>

        {/* Side-by-Side Compare Pane (shown when compareMode is active) */}
        {compareMode && (
          <div className="col-span-12 md:col-span-4 bg-slate-950 flex flex-col border-r border-surface-border overflow-hidden">
            <div className="bg-surface px-4 py-2 border-b border-surface-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-amber-300">Compare Reference</span>
                <span className="text-muted-foreground font-mono truncate max-w-[140px]">
                  {compareDoc?.original_filename}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  onClick={() => setComparePage(Math.max(1, comparePage - 1))}
                  disabled={comparePage <= 1}
                  className="p-1 rounded bg-surface-card border border-surface-border disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>{comparePage}/{compareDoc?.page_count || 1}</span>
                <button
                  onClick={() => setComparePage(Math.min(compareDoc?.page_count || 1, comparePage + 1))}
                  disabled={comparePage >= (compareDoc?.page_count || 1)}
                  className="p-1 rounded bg-surface-card border border-surface-border disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-950/70">
              {compareDocId && (
                <div className="bg-white shadow-xl relative" style={{ width: "100%", maxWidth: "420px" }}>
                  <img
                    src={`http://127.0.0.1:8000/api/documents/${compareDocId}/pages/${comparePage}/image?dpi=120`}
                    alt="Compare Reference"
                    className="w-full object-contain pointer-events-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Pane: Extracted Facts & Provenance Panel (3.5 Cols or 4 Cols) */}
        <div className={`col-span-12 ${compareMode ? "md:col-span-3" : "md:col-span-4 lg:col-span-3.5"} bg-surface flex flex-col overflow-hidden`}>
          <div className="p-3.5 border-b border-surface-border flex items-center justify-between bg-surface-card">
            <div>
              <h3 className="font-semibold text-xs text-slate-100 uppercase font-mono tracking-wider">
                Extracted Facts & Provenance
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {fields.length} critical fields mapped with page coordinates
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
              Keys: [ / ]
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {fields.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
                <Sparkles className="w-6 h-6 text-slate-600 mx-auto" />
                <p>No facts extracted yet.</p>
                <button
                  onClick={handleExtractAll}
                  disabled={extracting}
                  className="px-3 py-1.5 rounded bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600 transition-colors"
                >
                  Run Fact Extraction Now
                </button>
              </div>
            ) : (
              fields.map((field) => {
                const isSelected = field.id === selectedFieldId;
                return (
                  <div
                    key={field.id}
                    onClick={() => handleSelectField(field)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-surface-card border-accent shadow-md ring-1 ring-accent/30"
                        : "bg-surface-card border-surface-border hover:border-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-semibold text-slate-200">
                        {field.field_name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          p.{field.page}
                        </span>
                        <StatusBadge
                          status={field.review_status === "confirmed" ? "pass" : field.review_status === "corrected" ? "warning" : "pending"}
                          customLabel={field.review_status}
                          size="sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 bg-surface p-2 rounded border border-surface-border/50 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Normalized:</span>
                        <strong className="font-mono text-cyan-300">{field.normalized_value}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Original Raw:</span>
                        <span className="font-mono text-slate-400 truncate max-w-[140px]" title={field.raw_value}>
                          "{field.raw_value}"
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-surface-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        Method: <strong className="text-slate-300">{field.method}</strong>
                      </span>
                      <span>Conf: {(field.confidence * 100).toFixed(0)}%</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCorrectionModal(field);
                        }}
                        className="text-accent hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Correct
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Reviewer Correction Modal */}
      {editModalOpen && fieldToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-card rounded-lg border border-surface-border p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-accent" />
                <h3 className="font-bold text-slate-100 text-sm">Correct Extracted Fact</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Cancel
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Updating the normalized value retains the original extracted string unmodified in accordance with regulatory provenance principles. 
              The correction and rationale will be appended to the immutable audit ledger.
            </p>

            <form onSubmit={handleSaveCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Field Name</label>
                <input
                  type="text"
                  value={fieldToEdit.field_name}
                  disabled
                  className="w-full px-3 py-1.5 bg-surface rounded border border-surface-border font-mono text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Original Raw Value (Immutable)</label>
                <input
                  type="text"
                  value={fieldToEdit.raw_value}
                  disabled
                  className="w-full px-3 py-1.5 bg-surface rounded border border-surface-border font-mono text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-200 font-semibold mb-1">
                  Corrected / Normalized Value
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface rounded border border-accent font-mono text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-200 font-semibold mb-1">
                  Officer Rationale (Required for Audit Trail)
                </label>
                <textarea
                  value={correctionRationale}
                  onChange={(e) => setCorrectionRationale(e.target.value)}
                  placeholder="e.g. OCR misread digit '0' as letter 'O' on page 1 table..."
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-surface rounded border border-surface-border text-slate-100 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-surface border border-surface-border text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="px-4 py-1.5 rounded bg-accent text-accent-foreground font-semibold hover:bg-teal-600 transition-colors disabled:opacity-50"
                >
                  {savingCorrection ? "Recording in Audit Trail..." : "Save Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
