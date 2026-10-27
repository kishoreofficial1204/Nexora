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
  BookOpen,
  Bell,
  Play,
  Loader2,
  X,
  Check,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  Activity,
  LayoutDashboard,
  ArrowRight,
  ListChecks
} from "lucide-react";
import { NavHeader } from "@/components/layout/nav-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { downloadApiFile, fetchApi, openApiFile } from "@/lib/api";

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
  broken_linkage?: boolean;
  tampered_event_id?: string | null;
}

interface AlertItem {
  id: string;
  application_id: string;
  finding_id?: string | null;
  verification_id?: string | null;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

interface VerificationRecord {
  id: string;
  application_id: string;
  document_id?: string | null;
  authority_id: string;
  authority_name: string;
  status: string;
  query_payload: Record<string, any>;
  response_payload: Record<string, any>;
  matched_fields: Array<{ field: string; submitted: string; registry: string }>;
  mismatch_fields: Array<{ field: string; submitted: string; registry: string }>;
  source_timestamp?: string | null;
  checked_at?: string | null;
  checked_by_id?: string | null;
  badge?: string | null;
  is_simulated: boolean;
  error_message?: string | null;
  notes?: string | null;
}

interface PipelineStep {
  id: string;
  label: string;
  detail: string;
  status: "pending" | "running" | "complete" | "error";
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditItem[]>([]);
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "findings" | "compliance" | "verification" | "alerts" | "audit" | "report">("overview");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Milestone 4: Rules, Sources & Verification States
  const [rulePack, setRulePack] = useState<any | null>(null);
  const [selectedAuthority, setSelectedAuthority] = useState<string>("fire_department");
  const [selectedMode, setSelectedMode] = useState<string>("match");
  const [verificationDocumentId, setVerificationDocumentId] = useState<string>("");
  const [verificationQuerying, setVerificationQuerying] = useState<boolean>(false);
  const [verificationResponse, setVerificationResponse] = useState<VerificationRecord | null>(null);

  // Demo pipeline runner
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineFinished, setPipelineFinished] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineSummary, setPipelineSummary] = useState<{ findings: number; alerts: number; verifications: number } | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: "intake", label: "Safe intake & integrity", detail: "SHA-256 hashes and audit events already recorded", status: "complete" },
    { id: "extract", label: "Extract facts", detail: "OCR + text extraction with page/bbox provenance", status: "pending" },
    { id: "validate", label: "Run rule pack", detail: "19 deterministic rules + advisory anomaly signals", status: "pending" },
    { id: "verify", label: "Cross-check registries", detail: "Simulated issuer lookups persisted to the case", status: "pending" },
    { id: "review", label: "Build reviewer queue", detail: "Findings, alerts and evidence links refreshed", status: "pending" },
  ]);

  // Alert actions
  const [alertBusyId, setAlertBusyId] = useState<string | null>(null);
  const [resolveAlert, setResolveAlert] = useState<AlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

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

      // Load reviewer alerts
      try {
        const alertData = await fetchApi<AlertItem[]>(`/applications/${id}/alerts`);
        setAlerts(alertData);
      } catch (aErr) {
        setAlerts([]);
      }

      // Load persisted external verification history
      try {
        const history = await fetchApi<VerificationRecord[]>(`/verification/applications/${id}/verifications`);
        setVerifications(history);
      } catch (vErr) {
        setVerifications([]);
      }

      // Load rules for compliance matrix
      try {
        const rulesData = await fetchApi<any>("/rules");
        setRulePack(rulesData);
      } catch (rErr) {
        setRulePack(null);
      }

      if (appData.documents.length > 0) {
        setVerificationDocumentId((current) => current || appData.documents[0].id);
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
      const res = await fetchApi<VerificationRecord>(`/verification/applications/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          authority_id: selectedAuthority,
          document_id: verificationDocumentId || undefined,
          mode: selectedMode,
          simulated_delay_ms: 180,
        }),
      });
      setVerificationResponse(res);
      await loadData();
    } catch (err: any) {
      alert(`Verification query failed: ${err.message}`);
    } finally {
      setVerificationQuerying(false);
    }
  };

  const markStep = (stepId: string, status: PipelineStep["status"], detail?: string) => {
    setPipelineSteps((steps) =>
      steps.map((step) =>
        step.id === stepId ? { ...step, status, detail: detail || step.detail } : step
      )
    );
  };

  const handleRunFullScrutiny = async () => {
    setPipelineModalOpen(true);
    setPipelineRunning(true);
    setPipelineFinished(false);
    setPipelineError(null);
    setPipelineSummary(null);
    setPipelineSteps((steps) =>
      steps.map((step) => ({
        ...step,
        status: step.id === "intake" ? "complete" : "pending",
      }))
    );

    try {
      markStep("extract", "running");
      await fetchApi(`/applications/${id}/extract`, { method: "POST" });
      markStep("extract", "complete", "Structured facts extracted with page provenance");

      markStep("validate", "running");
      const found = await fetchApi<FindingItem[]>(`/applications/${id}/validate`, { method: "POST" });
      setFindings(found);
      markStep(
        "validate",
        "complete",
        `${found.length} finding${found.length === 1 ? "" : "s"} generated from the active rule pack`
      );

      markStep("verify", "running");
      const docs = application?.documents || [];
      const has = (type: string) => docs.some((doc) => doc.document_type === type);
      const expiredFinding = found.some(
        (finding) => finding.finding_type === "certificate_expired" || finding.rule_id.includes("002") || finding.rule_id.includes("003")
      );
      const intakeFinding = found.some(
        (finding) => finding.finding_type === "intake_mismatch" || finding.rule_id === "RULE-EOA-005"
      );
      let verificationCount = 0;
      if (has("doc_fire_safety")) {
        await fetchApi(`/verification/applications/${id}/verify`, {
          method: "POST",
          body: JSON.stringify({
            authority_id: "fire_department",
            mode: expiredFinding ? "expired" : "match",
            simulated_delay_ms: 120,
          }),
        });
        verificationCount += 1;
      }
      if (has("doc_univ_affil")) {
        await fetchApi(`/verification/applications/${id}/verify`, {
          method: "POST",
          body: JSON.stringify({ authority_id: "state_university", mode: "match", simulated_delay_ms: 120 }),
        });
        verificationCount += 1;
      }
      if (has("doc_eoa_app") || has("doc_prev_eoa")) {
        await fetchApi(`/verification/applications/${id}/verify`, {
          method: "POST",
          body: JSON.stringify({
            authority_id: "aicte_portal",
            mode: intakeFinding ? "mismatch" : "match",
            simulated_delay_ms: 120,
          }),
        });
        verificationCount += 1;
      }
      markStep(
        "verify",
        "complete",
        `${verificationCount} simulated registry lookup${verificationCount === 1 ? "" : "s"} persisted`
      );

      markStep("review", "running");
      await loadData();
      const refreshedFindings = await fetchApi<FindingItem[]>(`/applications/${id}/findings`);
      const refreshedAlerts = await fetchApi<AlertItem[]>(`/applications/${id}/alerts`);
      const refreshedVerifications = await fetchApi<VerificationRecord[]>(
        `/verification/applications/${id}/verifications`
      );
      setFindings(refreshedFindings);
      setAlerts(refreshedAlerts);
      setVerifications(refreshedVerifications);
      setPipelineSummary({
        findings: refreshedFindings.length,
        alerts: refreshedAlerts.length,
        verifications: refreshedVerifications.length,
      });
      markStep("review", "complete", "Reviewer queue, alerts and evidence links refreshed");
      setPipelineFinished(true);
    } catch (err: any) {
      setPipelineError(err.message || "The scrutiny pipeline could not complete.");
      setPipelineSteps((steps) =>
        steps.map((step) => (step.status === "running" ? { ...step, status: "error" } : step))
      );
    } finally {
      setPipelineRunning(false);
    }
  };

  const handleAcknowledgeAlert = async (item: AlertItem) => {
    try {
      setAlertBusyId(item.id);
      await fetchApi(`/alerts/${item.id}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ note: "Acknowledged from case review workspace." }),
      });
      await loadData();
    } catch (err: any) {
      window.alert(`Could not acknowledge alert: ${err.message}`);
    } finally {
      setAlertBusyId(null);
    }
  };

  const handleResolveAlert = async () => {
    if (!resolveAlert) return;
    if (resolveNote.trim().length < 5) {
      alert("Please enter a resolution note of at least 5 characters.");
      return;
    }
    try {
      setAlertBusyId(resolveAlert.id);
      await fetchApi(`/alerts/${resolveAlert.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_note: resolveNote.trim() }),
      });
      setResolveAlert(null);
      setResolveNote("");
      await loadData();
    } catch (err: any) {
      alert(`Could not resolve alert: ${err.message}`);
    } finally {
      setAlertBusyId(null);
    }
  };

  const handleRequestClarification = async (item: AlertItem) => {
    if (!item.finding_id) {
      window.alert("This alert is not linked to a specific finding.");
      return;
    }
    const rationale = window.prompt(
      "Enter the clarification requested from the applicant (logged in the audit trail):",
      "Please upload the current renewed certificate / supporting document."
    );
    if (!rationale || rationale.trim().length < 5) return;
    try {
      setAlertBusyId(item.id);
      await fetchApi(`/findings/${item.finding_id}/review`, {
        method: "POST",
        body: JSON.stringify({
          action: "request_clarification",
          rationale: rationale.trim(),
          clarification_item: "Replacement evidence requested from applicant portal",
        }),
      });
      await loadData();
    } catch (err: any) {
      window.alert(`Could not request clarification: ${err.message}`);
    } finally {
      setAlertBusyId(null);
    }
  };

  const handleExport = async (format: "pdf" | "json") => {
    try {
      setExporting(format);
      const filename = `VeriScope_${application?.institution?.permanent_id || "case"}_${id.substring(0, 8)}.${format}`;
      await downloadApiFile(`/applications/${id}/export/${format}`, filename);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleOpenDocument = async (documentId: string) => {
    try {
      await openApiFile(`/documents/${documentId}/file`);
    } catch (err: any) {
      alert(`Could not open document: ${err.message}`);
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

  const openAlertCount = alerts.filter((item) => item.status === "open").length;
  const openFindingCount = findings.filter((item) => item.status === "open").length;
  const failFindingCount = findings.filter((item) => item.severity === "fail").length;
  const warningFindingCount = findings.filter(
    (item) => item.severity === "warning" || item.severity === "manual_review"
  ).length;
  const flowSteps = [
    {
      label: "Safe intake",
      detail: `${application?.documents.length ?? 0} document${application?.documents.length === 1 ? "" : "s"} hashed`,
      state: "done" as const,
    },
    {
      label: "OCR & fields",
      detail: "Page-level provenance",
      state: "done" as const,
    },
    {
      label: "Rule checks",
      detail: `${findings.length} finding${findings.length === 1 ? "" : "s"}`,
      state: failFindingCount > 0 ? ("attention" as const) : findings.length > 0 ? ("warning" as const) : ("done" as const),
    },
    {
      label: "Registry checks",
      detail: `${verifications.length} record${verifications.length === 1 ? "" : "s"}`,
      state: verifications.length > 0 ? ("done" as const) : ("pending" as const),
    },
    {
      label: "Officer decision",
      detail: application?.recommendation ? application.recommendation.replace(/_/g, " ") : "Awaiting decision",
      state: application?.recommendation ? ("done" as const) : ("pending" as const),
    },
  ];
  const nextStep = application?.recommendation
    ? {
        title: "Decision recorded — prepare the dossier",
        body: "The officer recommendation is stored. Review the audit trail, then export the PDF or JSON dossier.",
        label: "Open reports",
        tab: "report" as const,
        kind: "tab" as const,
        icon: Download,
      }
    : openAlertCount > 0
    ? {
        title: "Triage the open alerts",
        body: "Acknowledge or resolve each signal with a written rationale before recording the final officer decision.",
        label: "Review alerts",
        tab: "alerts" as const,
        kind: "tab" as const,
        icon: Bell,
      }
    : openFindingCount > 0
    ? {
        title: "Review the open findings",
        body: "Open each evidence-linked finding, inspect the source page, and confirm, dismiss, or request clarification.",
        label: "Open findings",
        tab: "findings" as const,
        kind: "tab" as const,
        icon: AlertTriangle,
      }
    : verifications.length === 0
    ? {
        title: "Run the scrutiny pipeline",
        body: "Extract facts, execute the rule pack, and check the simulated registries to build the reviewer queue.",
        label: "Run full scrutiny",
        tab: "overview" as const,
        kind: "run" as const,
        icon: Play,
      }
    : {
        title: "Record the officer decision",
        body: "The evidence checks are complete. Record a recommendation with a mandatory written rationale.",
        label: "Record decision",
        tab: "overview" as const,
        kind: "decision" as const,
        icon: CheckCircle2,
      };

  const handleNextStep = () => {
    if (nextStep.kind === "run") {
      handleRunFullScrutiny();
    } else if (nextStep.kind === "decision") {
      setRecommendationModalOpen(true);
    } else {
      setActiveTab(nextStep.tab);
    }
  };

  const NextStepIcon = nextStep.icon;
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    {
      id: "findings" as const,
      label: "Findings",
      icon: AlertTriangle,
      count: findings.length,
      tone: failFindingCount > 0 ? ("danger" as const) : ("warning" as const),
    },
    { id: "documents" as const, label: "Evidence", icon: FileText, count: application?.documents.length ?? 0 },
    {
      id: "verification" as const,
      label: "Registry checks",
      icon: Cpu,
      count: verifications.length,
    },
    {
      id: "alerts" as const,
      label: "Alerts",
      icon: Bell,
      count: openAlertCount,
      tone: openAlertCount > 0 ? ("danger" as const) : ("neutral" as const),
    },
    { id: "compliance" as const, label: "Rule checks", icon: Layers },
    { id: "audit" as const, label: "Audit trail", icon: History, count: auditEvents.length },
    { id: "report" as const, label: "Reports", icon: Download },
  ];

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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to scrutiny queue
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">Case {application.id.substring(0, 13)}…</span>
            <StatusBadge status="simulated" size="sm" />
          </div>
        </div>

        {/* Header Summary Banner */}
        <div className="my-6 overflow-hidden rounded-lg border border-surface-border bg-surface-card p-6 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="vs-eyebrow">Review case</div>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl text-foreground sm:text-3xl">
                  {application.institution?.name || "Institution name unavailable"}
                </h1>
                <StatusBadge
                  status={
                    application.status === "deficiencies_flagged"
                      ? "fail"
                      : application.status === "review_completed"
                      ? "pass"
                      : application.status === "manual_review_required"
                      ? "manual_review_required"
                      : "pending"
                  }
                  customLabel={application.status.replace(/_/g, " ")}
                />
                {application.recommendation && (
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-700">
                    {application.recommendation.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span>PID <strong className="font-mono text-foreground">{application.institution?.permanent_id || "—"}</strong></span>
                <span className="text-muted-foreground">·</span>
                <span>{application.category}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono">{application.academic_year}</span>
                <span className="text-muted-foreground">·</span>
                <span>Assessment date <strong className="font-mono text-foreground">{application.assessment_date}</strong></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Link
                href={`/applications/${application.id}/applicant`}
                className="vs-button-ghost"
              >
                <ExternalLink className="h-3.5 w-3.5 text-accent" />
                Applicant portal
              </Link>
              <Link
                href={`/applications/${application.id}/workbench`}
                className="vs-button-secondary"
              >
                <Eye className="h-3.5 w-3.5 text-accent" />
                Evidence workbench
              </Link>
              <button
                onClick={() => setRecommendationModalOpen(true)}
                className="vs-button-secondary"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {application.recommendation ? "Update recommendation" : "Record decision"}
              </button>
              <button
                onClick={handleRunFullScrutiny}
                disabled={pipelineRunning}
                className="vs-button-primary"
              >
                <Play className="h-3.5 w-3.5" />
                {pipelineRunning ? "Running scrutiny…" : "Run scrutiny"}
              </button>
            </div>
          </div>

          {/* Compact review flow */}
          <div className="mt-5 border-t border-surface-border pt-4">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="vs-eyebrow">Review flow</span>
              <span className="text-[10px] text-slate-500">
                {application.recommendation
                  ? "All stages complete — recommendation recorded"
                  : findings.length > 0 || verifications.length > 0
                  ? "Reviewer queue ready — inspect findings and verification evidence"
                  : "Ready for end-to-end scrutiny"}
              </span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {flowSteps.map((step, index) => (
                <React.Fragment key={step.label}>
                  <div
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                      step.state === "done"
                        ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                        : step.state === "attention"
                        ? "border-rose-500/25 bg-rose-500/[0.07]"
                        : step.state === "warning"
                        ? "border-amber-500/25 bg-amber-500/[0.07]"
                        : "border-surface-border bg-surface"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] ${
                        step.state === "done"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : step.state === "attention"
                          ? "bg-rose-500/15 text-rose-300"
                          : step.state === "warning"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {step.state === "done" ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <span>
                      <span className="block text-[11px] font-medium text-slate-200">{step.label}</span>
                      <span className="block max-w-[160px] truncate text-[10px] text-muted-foreground">{step.detail}</span>
                    </span>
                  </div>
                  {index < flowSteps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-surface-border text-xs font-medium">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = "count" in tab ? tab.count : undefined;
            const tone = "tone" in tab ? tab.tone : "neutral";
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 transition-colors ${
                  active
                    ? "border-accent font-semibold text-teal-300"
                    : "border-transparent text-slate-500 hover:text-slate-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-teal-300" : "text-slate-600"}`} />
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] ${
                      tone === "danger"
                        ? "bg-rose-500/15 text-rose-300"
                        : tone === "warning"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-surface-hover text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 0: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="vs-card p-4">
                <div className="flex items-center justify-between">
                  <span className="vs-eyebrow">Findings</span>
                  <AlertTriangle className={`h-4 w-4 ${failFindingCount > 0 ? "text-rose-400" : warningFindingCount > 0 ? "text-amber-400" : "text-emerald-400"}`} />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{findings.length}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {failFindingCount} fail · {warningFindingCount} manual review
                </div>
              </div>
              <div className="vs-card p-4">
                <div className="flex items-center justify-between">
                  <span className="vs-eyebrow">Open alerts</span>
                  <Bell className={`h-4 w-4 ${openAlertCount > 0 ? "text-rose-400" : "text-emerald-400"}`} />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{openAlertCount}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {alerts.length} total signal{alerts.length === 1 ? "" : "s"} in this case
                </div>
              </div>
              <div className="vs-card p-4">
                <div className="flex items-center justify-between">
                  <span className="vs-eyebrow">Registry checks</span>
                  <Cpu className={`h-4 w-4 ${verifications.length > 0 ? "text-emerald-400" : "text-slate-500"}`} />
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{verifications.length}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {verifications.filter((item) => item.status === "verified").length} verified · {verifications.filter((item) => item.status === "mismatch").length} mismatch
                </div>
              </div>
              <div className="vs-card p-4">
                <div className="flex items-center justify-between">
                  <span className="vs-eyebrow">Officer decision</span>
                  <CheckCircle2 className={`h-4 w-4 ${application.recommendation ? "text-emerald-400" : "text-slate-500"}`} />
                </div>
                <div className="mt-2 truncate text-sm font-semibold capitalize tracking-tight text-slate-100">
                  {application.recommendation ? application.recommendation.replace(/_/g, " ") : "Not recorded"}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {application.recommendation ? "Recommendation stored in audit trail" : "Advisory only — reviewer signs off"}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative overflow-hidden rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/[0.09] via-surface-card to-surface-card p-5">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
                      <NextStepIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="vs-eyebrow">Next best action</div>
                      <h3 className="text-sm font-semibold text-slate-100">{nextStep.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate-400">{nextStep.body}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={handleNextStep} className="vs-button-primary">
                      {nextStep.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <Link href={`/applications/${application.id}/workbench`} className="vs-button-secondary">
                      <Eye className="h-3.5 w-3.5" />
                      Inspect evidence
                    </Link>
                  </div>
                </div>
              </div>

              <div className="vs-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="vs-eyebrow">Review flow</div>
                    <h3 className="text-sm font-semibold text-slate-100">How this case moves</h3>
                  </div>
                  <ListChecks className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-4 space-y-2.5">
                  {flowSteps.map((step, index) => (
                    <div key={step.label} className="flex items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                          step.state === "done"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                            : step.state === "attention"
                            ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                            : step.state === "warning"
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                            : "border-surface-border bg-surface text-muted-foreground"
                        }`}
                      >
                        {step.state === "done" ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-slate-200">{step.label}</div>
                        <div className="truncate text-[10px] text-slate-500">{step.detail}</div>
                      </div>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          step.state === "done"
                            ? "bg-emerald-400"
                            : step.state === "attention"
                            ? "bg-rose-400"
                            : step.state === "warning"
                            ? "bg-amber-400"
                            : "bg-slate-600"
                        }`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="vs-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="vs-eyebrow">Quick access</div>
                  <h3 className="text-sm font-semibold text-slate-100">Go straight to the evidence you need</h3>
                </div>
                <span className="text-[10px] text-slate-500">All findings are advisory. A reviewer records the final decision.</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Evidence bundle", detail: `${application.documents.length} files`, tab: "documents" as const, icon: FileText },
                  { label: "Findings", detail: `${findings.length} signals`, tab: "findings" as const, icon: AlertTriangle },
                  { label: "Registry checks", detail: `${verifications.length} records`, tab: "verification" as const, icon: Cpu },
                  { label: "Audit trail", detail: `${auditEvents.length} events`, tab: "audit" as const, icon: History },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => setActiveTab(item.tab)}
                      className="group flex items-center justify-between rounded-lg border border-surface-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-surface-hover"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-teal-300" />
                        <span>
                          <span className="block text-[11px] font-medium text-slate-200">{item.label}</span>
                          <span className="block text-[10px] text-slate-500">{item.detail}</span>
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-teal-300" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

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
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/applications/${application.id}/workbench?doc=${doc.id}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white font-mono"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </Link>
                          <button
                            onClick={() => handleOpenDocument(doc.id)}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-mono"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
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

        {/* Tab: Alerts & Rectification */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Alert Triage & Applicant Rectification</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acknowledge signals, record a resolution rationale, or send a clarification request to the applicant portal.
                </p>
              </div>
              <Link
                href="/alerts"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-surface-border text-xs text-slate-200 hover:border-slate-600"
              >
                <Bell className="w-3.5 h-3.5 text-accent" />
                Open Alert Centre
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Open signals</div>
                <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                  {alerts.filter((a) => a.status === "open").length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Require reviewer triage</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Clarification requests</div>
                <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                  {findings.filter((f) => f.status === "clarification_requested").length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Visible in applicant portal</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-card border border-surface-border">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Resolved</div>
                <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                  {alerts.filter((a) => a.status === "resolved").length}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">Rationale retained in audit trail</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-3">
                <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Current alert queue</div>
                {alerts.length === 0 ? (
                  <div className="p-10 rounded-lg bg-surface-card border border-surface-border text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-semibold text-slate-200">No active alerts</h4>
                    <p className="text-xs text-muted-foreground">
                      Run full scrutiny to generate findings and reviewer alerts for this case.
                    </p>
                  </div>
                ) : (
                  alerts.map((item) => (
                    <div key={item.id} className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 ${
                            item.severity === "fail"
                              ? "bg-rose-950/60 border-rose-800 text-rose-300"
                              : "bg-amber-950/60 border-amber-800 text-amber-300"
                          }`}>
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={item.severity} size="sm" />
                              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                                {item.alert_type.replace(/_/g, " ")}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${
                                item.status === "open"
                                  ? "bg-amber-950/60 text-amber-300 border-amber-800"
                                  : item.status === "acknowledged"
                                  ? "bg-cyan-950/60 text-cyan-300 border-cyan-800"
                                  : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                              }`}>
                                {item.status}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100 mt-1">{item.title}</h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.message}</p>
                            {item.resolution_note && (
                              <p className="text-[11px] text-emerald-300/90 italic mt-2">Resolution: “{item.resolution_note}”</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-surface-border/60">
                        {item.status === "open" && (
                          <button
                            onClick={() => handleAcknowledgeAlert(item)}
                            disabled={alertBusyId === item.id}
                            className="px-2.5 py-1 rounded border border-cyan-800 bg-cyan-950/40 text-cyan-200 text-[11px] font-semibold hover:bg-cyan-900/50 disabled:opacity-50"
                          >
                            Acknowledge
                          </button>
                        )}
                        {item.finding_id && item.status !== "resolved" && (
                          <button
                            onClick={() => handleRequestClarification(item)}
                            disabled={alertBusyId === item.id}
                            className="px-2.5 py-1 rounded border border-amber-800 bg-amber-950/40 text-amber-200 text-[11px] font-semibold hover:bg-amber-900/50 disabled:opacity-50"
                          >
                            Request clarification
                          </button>
                        )}
                        {item.status !== "resolved" && (
                          <button
                            onClick={() => {
                              setResolveAlert(item);
                              setResolveNote("");
                            }}
                            className="px-2.5 py-1 rounded border border-emerald-800 bg-emerald-950/40 text-emerald-200 text-[11px] font-semibold hover:bg-emerald-900/50"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Rectification timeline</div>
                <div className="p-4 rounded-lg bg-surface-card border border-surface-border space-y-4">
                  {[
                    {
                      label: "Reviewer identifies signal",
                      detail: findings.length > 0 ? `${findings.length} finding(s) recorded` : "Awaiting validation run",
                      done: findings.length > 0,
                    },
                    {
                      label: "Clarification requested",
                      detail: `${findings.filter((f) => f.status === "clarification_requested").length} notice(s) sent to applicant`,
                      done: findings.some((f) => f.status === "clarification_requested"),
                    },
                    {
                      label: "Applicant re-upload",
                      detail: "Simulated applicant portal response",
                      done: false,
                    },
                    {
                      label: "Reviewer re-validates",
                      detail: "Re-run rule pack after replacement evidence",
                      done: false,
                    },
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        step.done
                          ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                          : "bg-surface border-surface-border text-slate-500"
                      }`}>
                        {step.done ? <Check className="w-3 h-3" /> : <span className="text-[9px] font-mono">{idx + 1}</span>}
                      </div>
                      <div>
                        <div className={`text-xs font-semibold ${step.done ? "text-slate-200" : "text-slate-400"}`}>
                          {step.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{step.detail}</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-surface-border/60">
                    <Link
                      href={`/applications/${application.id}/applicant`}
                      className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline font-semibold"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open applicant portal preview
                    </Link>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-900/60 text-[11px] text-cyan-100/80 leading-relaxed">
                  <div className="font-mono uppercase text-[10px] text-cyan-300 mb-1">Demo note</div>
                  Applicant re-upload is simulated in this prototype. The reviewer action, rationale, and audit event are persisted.
                </div>
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
                        <tr key={rule.rule_id} className="hover:bg-surface-hover transition-colors">
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

        {/* Tab 5: External Verification */}
        {activeTab === "verification" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">External Authority Registry Verification</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Persisted cross-checks against simulated statutory registries. Every response keeps its provenance, matched fields and reviewer identity.
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Persisted lookups</div>
                <div className="text-lg font-bold font-mono text-cyan-300">{verifications.length}</div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-800 text-cyan-200 text-xs flex items-start gap-3">
              <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold font-mono tracking-wide uppercase text-[11px] text-cyan-300 block">
                  SIMULATED EXTERNAL ISSUER - DEMO ONLY
                </span>
                <p className="text-cyan-200/90 text-[11px] leading-relaxed">
                  Connectors below simulate asynchronous queries to state registries. Use the scenario mode switcher to test confirmed credentials, discrepancies, expiry, timeouts or authority outages. No external system is contacted.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
              <h4 className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                New verification query
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Authority</label>
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
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Source document</label>
                  <select
                    value={verificationDocumentId}
                    onChange={(e) => setVerificationDocumentId(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    {application.documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>{doc.original_filename}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Simulation response</label>
                  <select
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-accent"
                  >
                    <option value="match">Match — active registry record</option>
                    <option value="mismatch">Mismatch — contradictory record</option>
                    <option value="expired">Expired — lapsed credential</option>
                    <option value="not_found">Not found — absent from registry</option>
                    <option value="timeout">Timeout — 504 gateway delay</option>
                    <option value="service_down">Service down — 503 maintenance</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleExecuteVerification}
                    disabled={verificationQuerying}
                    className="w-full py-2 px-4 rounded bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Cpu className={`w-3.5 h-3.5 ${verificationQuerying ? "animate-spin" : ""}`} />
                    <span>{verificationQuerying ? "Querying registry..." : "Run & persist verification"}</span>
                  </button>
                </div>
              </div>
            </div>

            {verificationResponse && (
              <div className="p-5 rounded-lg bg-surface-card border border-surface-border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{verificationResponse.authority_name}</span>
                    <StatusBadge status={verificationResponse.status} />
                    {verificationResponse.is_simulated && <StatusBadge status="simulated" size="sm" />}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                    <span>{verificationResponse.checked_at ? new Date(verificationResponse.checked_at).toLocaleString() : "Just now"}</span>
                  </div>
                </div>

                {verificationResponse.error_message && (
                  <div className="p-3 rounded bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
                    <strong>Registry note:</strong> {verificationResponse.error_message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-muted-foreground block font-bold font-mono">Matched fields</span>
                    {verificationResponse.matched_fields.length === 0 ? (
                      <div className="p-3 rounded bg-surface border border-surface-border text-[11px] text-muted-foreground">No comparable fields returned.</div>
                    ) : (
                      verificationResponse.matched_fields.map((field) => (
                        <div key={field.field} className="p-2.5 rounded bg-emerald-950/20 border border-emerald-900/60 text-[11px]">
                          <span className="font-mono text-emerald-300">{field.field}</span>
                          <span className="text-muted-foreground"> · submitted “{field.submitted}” = registry “{field.registry}”</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-muted-foreground block font-bold font-mono">Mismatch fields</span>
                    {verificationResponse.mismatch_fields.length === 0 ? (
                      <div className="p-3 rounded bg-surface border border-surface-border text-[11px] text-muted-foreground">No mismatches recorded.</div>
                    ) : (
                      verificationResponse.mismatch_fields.map((field) => (
                        <div key={field.field} className="p-2.5 rounded bg-rose-950/20 border border-rose-900/60 text-[11px]">
                          <span className="font-mono text-rose-300">{field.field}</span>
                          <span className="text-muted-foreground"> · submitted “{field.submitted}” ≠ registry “{field.registry}”</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-[11px] font-mono text-accent hover:underline">View raw query / response payload</summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <pre className="p-3 rounded bg-surface border border-surface-border text-slate-300 overflow-x-auto text-[10px]">
                      {JSON.stringify(verificationResponse.query_payload, null, 2)}
                    </pre>
                    <pre className="p-3 rounded bg-surface border border-surface-border text-slate-300 overflow-x-auto text-[10px]">
                      {JSON.stringify(verificationResponse.response_payload, null, 2)}
                    </pre>
                  </div>
                </details>

                <div className="pt-2 text-[10px] font-mono text-cyan-400/80 border-t border-surface-border/40">
                  {verificationResponse.badge || "SIMULATED EXTERNAL ISSUER - DEMO ONLY"} · {verificationResponse.notes || "Persisted prototype verification."}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Verification history</div>
              {verifications.length === 0 ? (
                <div className="p-8 rounded-lg bg-surface-card border border-surface-border text-center text-xs text-muted-foreground">
                  No persisted verification records yet. Run a query above or use “Run Full Scrutiny”.
                </div>
              ) : (
                <div className="bg-surface-card rounded-lg border border-surface-border overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-surface text-muted-foreground font-mono uppercase text-[10px] border-b border-surface-border">
                      <tr>
                        <th className="py-2.5 px-3">Authority</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Matched / mismatch</th>
                        <th className="py-2.5 px-3">Checked</th>
                        <th className="py-2.5 px-3">Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {verifications.map((record) => (
                        <tr key={record.id} className="hover:bg-surface-hover">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">{record.authority_name}</td>
                          <td className="py-2.5 px-3"><StatusBadge status={record.status} size="sm" /></td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className="text-emerald-400">{record.matched_fields.length}</span>
                            <span className="text-muted-foreground"> / </span>
                            <span className="text-rose-400">{record.mismatch_fields.length}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                            {record.checked_at ? new Date(record.checked_at).toLocaleString() : "—"}
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => setVerificationResponse(record)}
                              className="text-[11px] text-accent hover:underline font-medium"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exporting === "pdf"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-teal-600 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${exporting === "pdf" ? "animate-bounce" : ""}`} />
                  <span>{exporting === "pdf" ? "Building PDF..." : "Download Signed PDF Dossier"}</span>
                </button>

                <button
                  onClick={() => handleExport("json")}
                  disabled={exporting === "json"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-surface hover:bg-surface-hover border border-surface-border text-xs text-slate-200 font-semibold transition-colors disabled:opacity-50"
                >
                  <FileCode className="w-3.5 h-3.5 text-accent" />
                  <span>{exporting === "json" ? "Building JSON..." : "Download Structured JSON"}</span>
                </button>
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
                  <p><strong>Rule pack:</strong> {application.rule_pack_id}</p>
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

        {/* Modal: End-to-end scrutiny pipeline runner */}
        {pipelineModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-xl bg-surface-card border border-surface-border p-6 space-y-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-border">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-teal-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">End-to-end scrutiny run</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Intake → extraction → rules → simulated registries → reviewer queue
                      </p>
                    </div>
                  </div>
                </div>
                {!pipelineRunning && (
                  <button
                    onClick={() => setPipelineModalOpen(false)}
                    className="text-muted-foreground hover:text-slate-200"
                    aria-label="Close pipeline runner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {pipelineSteps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${
                      step.status === "complete"
                        ? "bg-emerald-950 border-emerald-700 text-emerald-300"
                        : step.status === "running"
                        ? "bg-cyan-950 border-cyan-700 text-cyan-300"
                        : step.status === "error"
                        ? "bg-rose-950 border-rose-700 text-rose-300"
                        : "bg-surface border-surface-border text-slate-500"
                    }`}>
                      {step.status === "complete" ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : step.status === "running" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : step.status === "error" ? (
                        <X className="w-3.5 h-3.5" />
                      ) : (
                        <span className="text-[10px] font-mono">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${
                          step.status === "pending" ? "text-slate-400" : "text-slate-200"
                        }`}>{step.label}</span>
                        {step.status === "running" && (
                          <span className="text-[9px] font-mono uppercase text-cyan-300">running</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {pipelineError && (
                <div className="p-3 rounded-md border border-rose-800 bg-rose-950/30 text-[11px] text-rose-200">
                  {pipelineError}
                </div>
              )}

              {pipelineFinished && pipelineSummary && (
                <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-surface border border-surface-border">
                  <div className="text-center">
                    <div className="text-lg font-bold font-mono text-amber-300">{pipelineSummary.findings}</div>
                    <div className="text-[9px] font-mono uppercase text-muted-foreground">findings</div>
                  </div>
                  <div className="text-center border-x border-surface-border">
                    <div className="text-lg font-bold font-mono text-rose-300">{pipelineSummary.alerts}</div>
                    <div className="text-[9px] font-mono uppercase text-muted-foreground">alerts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold font-mono text-cyan-300">{pipelineSummary.verifications}</div>
                    <div className="text-[9px] font-mono uppercase text-muted-foreground">registry records</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                {!pipelineRunning && !pipelineFinished && (
                  <button
                    onClick={() => setPipelineModalOpen(false)}
                    className="px-4 py-2 rounded-md border border-surface-border text-xs text-slate-300 hover:bg-surface"
                  >
                    Close
                  </button>
                )}
                {pipelineFinished && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab("verification");
                        setPipelineModalOpen(false);
                      }}
                      className="px-3 py-2 rounded-md border border-cyan-800 bg-cyan-950/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-900/50"
                    >
                      Verification history
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab("findings");
                        setPipelineModalOpen(false);
                      }}
                      className="px-4 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:bg-teal-600"
                    >
                      Review findings
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Resolve alert */}
        {resolveAlert && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-lg bg-surface-card border border-surface-border p-6 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-border">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Resolve alert with rationale</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{resolveAlert.title}</p>
                </div>
                <button onClick={() => setResolveAlert(null)} className="text-muted-foreground hover:text-slate-200" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{resolveAlert.message}</p>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Resolution note <span className="text-rose-300">*</span>
                </label>
                <textarea
                  rows={4}
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Describe the evidence checked and why this signal is no longer actionable..."
                  className="w-full rounded-md bg-surface border border-surface-border p-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
                <button onClick={() => setResolveAlert(null)} className="px-4 py-2 rounded-md border border-surface-border text-xs text-slate-300 hover:bg-surface">
                  Cancel
                </button>
                <button
                  onClick={handleResolveAlert}
                  disabled={alertBusyId === resolveAlert.id}
                  className="px-4 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                  {alertBusyId === resolveAlert.id ? "Resolving..." : "Resolve alert"}
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
                    Advisory recommendation only. A human reviewer remains accountable for the final decision.
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
