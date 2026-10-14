"use client";

import { useEffect, useRef } from "react";

/**
 * Hook untuk membuat modal yang sudah ada menjadi aksesibel tanpa harus
 * menulis ulang seluruh markup-nya.
 *
 * Yang ditangani:
 *  - Escape menutup modal
 *  - klik pada lapisan luar (backdrop) menutup modal
 *  - fokus terkurung di dalam panel + dikembalikan ke pemicu saat ditutup
 *  - scroll bodyweight terkunci selama modal terbuka
 *
 * Pemakaian:
 *   const panelRef = useModalA11y<HTMLElement>(modalOpen, closeModal);
 *   ...
 *   <div className="fixed inset-0 ..." onMouseDown={handleBackdrop}>
 *     <div ref={panelRef} role="dialog" aria-modal="true">...</div>
 *   </div>
 *
 * `handleBackdrop` sengaja TIDAK menutup bila klik berawal dari dalam panel,
 * supaya pengguna tidak kehilangan isi form yang sedang diketik.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void
) {
  const panelRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel) {
      if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
      if (!panel.hasAttribute("role")) panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const current = panelRef.current;
      if (!current) return;

      const focusables = Array.from(
        current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) {
        event.preventDefault();
        current.focus();
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
  }, [open]);

  /** Pasang pada elemen lapisan luar: menutup hanya bila klik benar-benar di luar panel. */
  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) onCloseRef.current();
  };

  return { panelRef, handleBackdropMouseDown };
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");
