"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Komponen modal yang aksesibel.
 *
 * Menangani hal yang sering terlewat pada modal buatan tangan:
 *  - ditutup dengan tombol Escape
 *  - ditutup dengan klik pada area gelap di belakang panel
 *  - fokus terkurung di dalam modal (focus trap) selama terbuka
 *  - fokus dikembalikan ke elemen pemicu saat modal ditutup
 *  - badan halaman terkunci agar tidak bisa di-scroll di belakang modal
 *  - ditandai dengan role="dialog" + aria-modal + aria-labelledby
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Id unik yang dipakai aria-labelledby. Default "modal-title". */
  titleId?: string;
  children: React.ReactNode;
  /** Maksimal lebar panel: "md" | "lg" | "xl" | "3xl". */
  size?: "md" | "lg" | "xl" | "3xl";
  /** Tampilkan tombol X di header. */
  showCloseButton?: boolean;
  /** Kelas tambahan untuk elemen <section> panel. */
  panelClassName?: string;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "3xl": "max-w-3xl",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  open,
  onClose,
  title,
  titleId = "modal-title",
  children,
  size = "lg",
  showCloseButton = true,
  panelClassName = "",
}: ModalProps) {
  const panelRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      // Fokuskan elemen pertama yang bisa difokus, atau panel itu sendiri.
      const first = panel.querySelector(FOCUSABLE_SELECTOR) as HTMLElement | null;
      (first ?? panel).focus();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;

      const focusables = Array.from(
        currentPanel.querySelectorAll(FOCUSABLE_SELECTOR)
      ).filter((el): el is HTMLElement => (el as HTMLElement).offsetParent !== null);

      if (focusables.length === 0) {
        event.preventDefault();
        currentPanel.focus();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Hanya tutup bila klik benar-benar pada lapisan luar,
        // bukan saat pengguna mulai menyeleksi teks di dalam panel.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white rounded-2xl border border-slate-200 shadow-xl w-full ${
          SIZE_CLASSES[size]
        } max-h-[90vh] flex flex-col outline-none ${panelClassName}`}
      >
        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <h2 id={titleId} className="text-base font-bold text-slate-900">
            {title}
          </h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="p-1.5 -mr-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </header>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </section>
    </div>,
    document.body
  );
}
