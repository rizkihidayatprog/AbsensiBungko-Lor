"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";

export interface ConfirmOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}

export interface AlertOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: DialogVariant;
}

type DialogRequest =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void };

interface DialogContextValue {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  alert: (options?: AlertOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * Penyedia dialog global. Gantinya `window.confirm` / `window.alert` dari browser.
 *
 * Pemakaian:
 *   const confirmDialog = useConfirm();
 *   if (!(await confirmDialog({ title, description, variant: "danger" }))) return;
 *
 *   const alertDialog = useAlert();
 *   await alertDialog({ title: "Perhatian", description: "...", variant: "warning" });
 */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const requestRef = useRef<DialogRequest | null>(null);

  const open = useCallback((req: DialogRequest) => {
    // Bila masih ada dialog menggantung, selesaikan sebagai "dibatalkan".
    const prev = requestRef.current;
    if (prev) {
      if (prev.kind === "alert") prev.resolve();
      else prev.resolve(false);
    }
    requestRef.current = req;
    setRequest(req);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions = {}) =>
      new Promise<boolean>((resolve) =>
        open({ kind: "confirm", options, resolve })
      ),
    [open]
  );

  const alert = useCallback(
    (options: AlertOptions = {}) =>
      new Promise<void>((resolve) => open({ kind: "alert", options, resolve })),
    [open]
  );

  const close = useCallback((result: boolean) => {
    const req = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    if (!req) return;
    if (req.kind === "alert") req.resolve();
    else req.resolve(result);
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  const isAlert = request?.kind === "alert";

  return (
    <DialogContext.Provider value={value}>
      {children}
      {request && (
        <ConfirmDialog
          open
          mode={request.kind}
          variant={request.options.variant ?? (isAlert ? "info" : "danger")}
          title={request.options.title ?? (isAlert ? "Informasi" : "Konfirmasi")}
          description={request.options.description}
          confirmLabel={request.options.confirmLabel}
          cancelLabel={
            request.kind === "confirm" ? request.options.cancelLabel : undefined
          }
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog harus dipakai di dalam <DialogProvider>.");
  }
  return ctx;
}

export function useConfirm() {
  return useDialog().confirm;
}

export function useAlert() {
  return useDialog().alert;
}
