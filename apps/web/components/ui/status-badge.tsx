import React from "react";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  HelpCircle, 
  MinusCircle, 
  Eye, 
  Activity, 
  Cpu 
} from "lucide-react";

export type StatusType = 
  | "pass" 
  | "fail" 
  | "warning" 
  | "pending" 
  | "not_verified" 
  | "not_applicable" 
  | "manual_review_required"
  | "heuristic_signal"
  | "simulated";

interface StatusBadgeProps {
  status: StatusType | string;
  customLabel?: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, customLabel, className = "", size = "md" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim();

  let label = customLabel || status;
  let icon = <HelpCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
  let colorClasses = "bg-slate-800/80 text-slate-300 border-slate-700";

  switch (normalized) {
    case "pass":
    case "verified":
      label = customLabel || "Pass";
      icon = <CheckCircle2 className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-emerald-950/60 text-emerald-300 border-emerald-800/70";
      break;

    case "fail":
    case "mismatch_detected":
    case "expired":
      label = customLabel || (normalized === "expired" ? "Expired" : normalized === "mismatch_detected" ? "Mismatch Detected" : "Fail");
      icon = <XCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-rose-950/60 text-rose-300 border-rose-800/70";
      break;

    case "warning":
      label = customLabel || "Warning";
      icon = <AlertTriangle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-amber-950/60 text-amber-300 border-amber-800/70";
      break;

    case "pending":
      label = customLabel || "Pending";
      icon = <Clock className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-slate-900 text-slate-400 border-slate-800";
      break;

    case "not_verified":
    case "not_independently_verified":
      label = customLabel || "Not Independently Verified";
      icon = <HelpCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-purple-950/60 text-purple-300 border-purple-800/70";
      break;

    case "not_applicable":
    case "n/a":
      label = customLabel || "N/A";
      icon = <MinusCircle className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-zinc-900 text-zinc-400 border-zinc-800";
      break;

    case "manual_review_required":
    case "manual_review":
      label = customLabel || "Manual Review Required";
      icon = <Eye className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-pink-950/60 text-pink-300 border-pink-800/70";
      break;

    case "heuristic_signal":
    case "heuristic":
      label = customLabel || "Heuristic Signal";
      icon = <Activity className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-cyan-950/60 text-cyan-300 border-cyan-800/70";
      break;

    case "simulated":
      label = customLabel || "SIMULATED";
      icon = <Cpu className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />;
      colorClasses = "bg-sky-950/70 text-sky-300 border-sky-700 font-mono tracking-wider font-semibold";
      break;
  }

  const paddingClass = size === "sm" ? "px-2 py-0.5 text-xs gap-1" : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${paddingClass} ${colorClasses} ${className}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
