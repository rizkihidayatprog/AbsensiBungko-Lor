import React from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  HeartPulse,
  AlertCircle,
  HelpCircle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export type StatusType =
  | "HADIR"
  | "TERLAMBAT"
  | "IZIN"
  | "SAKIT"
  | "ALFA"
  | "BELUM_SCAN"
  | "PENDING"
  | "DISETUJUI"
  | "DITOLAK"
  | "AKTIF"
  | "NONAKTIF";

interface StatusBadgeProps {
  status: StatusType | string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
}: StatusBadgeProps) {
  const norm = (status || "").toUpperCase();

  const configs: Record<
    string,
    {
      label: string;
      icon: React.ElementType;
      bg: string;
      text: string;
      border: string;
      iconColor: string;
    }
  > = {
    HADIR: {
      label: "Hadir",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-300",
      iconColor: "text-emerald-600",
    },
    TERLAMBAT: {
      label: "Terlambat",
      icon: Clock,
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-300",
      iconColor: "text-amber-600",
    },
    IZIN: {
      label: "Izin",
      icon: FileText,
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-300",
      iconColor: "text-blue-600",
    },
    SAKIT: {
      label: "Sakit",
      icon: HeartPulse,
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-300",
      iconColor: "text-purple-600",
    },
    ALFA: {
      label: "Alfa",
      icon: AlertCircle,
      bg: "bg-rose-50",
      text: "text-rose-800",
      border: "border-rose-300",
      iconColor: "text-rose-600",
    },
    BELUM_SCAN: {
      label: "Belum Scan",
      icon: HelpCircle,
      bg: "bg-slate-100",
      text: "text-slate-800",
      border: "border-slate-300",
      iconColor: "text-slate-500",
    },
    PENDING: {
      label: "Menunggu Verifikasi",
      icon: Clock,
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-300",
      iconColor: "text-amber-600",
    },
    DISETUJUI: {
      label: "Disetujui",
      icon: CheckCircle2,
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-300",
      iconColor: "text-emerald-600",
    },
    DITOLAK: {
      label: "Ditolak",
      icon: XCircle,
      bg: "bg-rose-50",
      text: "text-rose-800",
      border: "border-rose-300",
      iconColor: "text-rose-600",
    },
    AKTIF: {
      label: "Aktif",
      icon: ShieldCheck,
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-300",
      iconColor: "text-emerald-600",
    },
    NONAKTIF: {
      label: "Nonaktif",
      icon: ShieldAlert,
      bg: "bg-slate-100",
      text: "text-slate-700",
      border: "border-slate-300",
      iconColor: "text-slate-500",
    },
  };

  const config = configs[norm] || {
    label: status,
    icon: HelpCircle,
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
    iconColor: "text-slate-500",
  };

  const Icon = config.icon;
  const sizeClasses =
    size === "sm"
      ? "text-[11px] px-2 py-0.5 gap-1"
      : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <span
      role="status"
      className={`inline-flex items-center font-medium rounded-md border shadow-2xs ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <Icon
          className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} ${config.iconColor} shrink-0`}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </span>
  );
}

export default StatusBadge;
