// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useModalA11y } from "@/lib/useModalA11y";

/**
 * Komponen pembungkus minimal untuk menguji hook useModalA11y
 * tanpa perlu seluruh aplikasi.
 */
function TestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { panelRef, handleBackdropMouseDown } = useModalA11y<HTMLDivElement>(
    open,
    onClose
  );

  if (!open) return null;

  return createElement(
    "div",
    { "data-testid": "backdrop", onMouseDown: handleBackdropMouseDown },
    createElement(
      "div",
      { ref: panelRef, "data-testid": "panel" },
      createElement("button", { type: "button" }, "Satu"),
      createElement("button", { type: "button" }, "Dua")
    )
  );
}

describe("useModalA11y", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onClose: ReturnType<typeof vi.fn>;

  const mount = (open: boolean) => {
    act(() => {
      root.render(createElement(TestModal, { open, onClose }));
    });
  };

  const keyDown = (key: string) => {
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
  };

  const mouseDown = (target: Element) => {
    act(() => {
      target.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true })
      );
    });
  };

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.innerHTML = "";
    document.body.style.overflow = "";
  });

  it("mengunci scroll body saat terbuka & mengembalikannya saat tutup", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    expect(document.body.style.overflow).toBe("hidden");

    mount(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("menutup modal saat tombol Escape ditekan", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    keyDown("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tidak menutup saat tombol selain Escape", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    keyDown("Enter");
    keyDown("Tab");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("menutup saat klik tepat pada lapisan luar (backdrop)", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    const backdrop = document.querySelector('[data-testid="backdrop"]')!;
    mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("TIDAK menutup saat klik di dalam panel (target != currentTarget)", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    const panel = document.querySelector('[data-testid="panel"]')!;
    mouseDown(panel);
    const tombol = panel.querySelector("button")!;
    mouseDown(tombol);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("memfokuskan elemen pertama yang bisa difokus saat terbuka", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    const tombolPertama = document.querySelector(
      '[data-testid="panel"] button'
    ) as HTMLElement;
    expect(document.activeElement).toBe(tombolPertama);
  });

  it("mengembalikan fokus ke elemen pemicu saat ditutup", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    const pemicu = document.createElement("button");
    pemicu.textContent = "Buka";
    document.body.appendChild(pemicu);
    pemicu.focus();

    mount(true);
    expect(document.activeElement).not.toBe(pemicu);

    mount(false);
    expect(document.activeElement).toBe(pemicu);
  });

  it("TIDAK memindahkan fokus saat re-render dengan fungsi onClose baru (mengetik dalam form)", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onClose = vi.fn();

    mount(true);
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '[data-testid="panel"] button'
    );
    const tombolKedua = buttons[1];

    // Simulasikan pengguna memindahkan fokus ke elemen kedua (misal input field yang sedang diketik)
    tombolKedua.focus();
    expect(document.activeElement).toBe(tombolKedua);

    // Simulasikan re-render akibat pengetikan (onClose fungsi baru di-pass)
    const newOnClose = vi.fn();
    act(() => {
      root.render(createElement(TestModal, { open: true, onClose: newOnClose }));
    });

    // Fokus HARUS tetap pada elemen kedua, TIDAK BOLEH meloncat kembali ke elemen pertama
    expect(document.activeElement).toBe(tombolKedua);
  });
});
