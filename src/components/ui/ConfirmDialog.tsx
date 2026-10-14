"use client";

import { AlertTriangle, CheckCircle2, Info, Trash2 } from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";

export type DialogVariant = "danger" | "warning" | "success" | "info";

export interface ConfirmDialogProps {
  open: boolean;
  mode: "confirm" | "alert";
  variant?: DialogVariant;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLE: Record<
  DialogVariant,
  { icon: React.ElementType; iconWrap: string; confirmBtn: string }
> = {
  danger: {
    icon: Trash2,
    iconWrap: "bg-rose-100 text-rose-600",
    confirmBtn: "bg-rose-600 hover:bg-rose-700 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: "bg-amber-100 text-amber-600",
    confirmBtn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-100 text-emerald-600",
    confirmBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  info: {
    icon: Info,
    iconWrap: "bg-blue-100 text-blue-600",
    confirmBtn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

/**
 * Dialog konfirmasi/informasi buatan sendiri, pengganti `window.confirm`/`window.alert`.
 *
 * Aksesibel lewat `useModalA11y` (Escape, klik backdrop, focus-trap, kunci scroll).
 * Fokus awal jatuh ke tombol Batal agar tindakan destruktif tidak tak sengaja
 * terpicu; untuk mode `alert` hanya ada satu tombol sehingga fokus ke sana.
 */
export default function ConfirmDialog({
  open,
  mode,
  variant = "info",
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { panelRef, handleBackdropMouseDown } = useModalA11y<HTMLDivElement>(
    open,
    onCancel
  );

  if (!open) return null;

  const style = VARIANT_STYLE[variant];
  const Icon = style.icon;

  const finalConfirm =
    confirmLabel ??
    (mode === "alert"
      ? "Mengerti"
      : variant === "danger"
        ? "Ya, Hapus"
        : "Ya, Lanjutkan");
  const finalCancel = cancelLabel ?? "Batal";

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="p-6 text-center space-y-3">
          <div
            className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${style.iconWrap}`}
          >
            <Icon className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2
            id="confirm-dialog-title"
            className="text-base font-bold text-slate-900"
          >
            {title}
          </h2>
          {description && (
            <div
              id="confirm-dialog-desc"
              className="text-xs text-slate-600 leading-relaxed whitespace-pre-line"
            >
              {description}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2.5">
          {mode === "confirm" && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition"
            >
              {finalCancel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-xl transition shadow-sm ${style.confirmBtn}`}
          >
            {finalConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
