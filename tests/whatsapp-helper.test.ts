import { describe, it, expect } from "vitest";
import {
  formatIndonesianPhone,
  renderWaTemplate,
  DEFAULT_WA_TEMPLATES,
} from "../src/lib/whatsapp";

describe("WhatsApp Phone Formatter", () => {
  it("converts 08xx to 628xx format", () => {
    expect(formatIndonesianPhone("081234567890")).toBe("6281234567890");
    expect(formatIndonesianPhone("085712345678")).toBe("6285712345678");
  });

  it("handles numbers with spaces, dashes, and parentheses", () => {
    expect(formatIndonesianPhone("0812-3456-7890")).toBe("6281234567890");
    expect(formatIndonesianPhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(formatIndonesianPhone("(0812) 3456-7890")).toBe("6281234567890");
  });

  it("keeps numbers already starting with 62", () => {
    expect(formatIndonesianPhone("6281234567890")).toBe("6281234567890");
    expect(formatIndonesianPhone("+6281234567890")).toBe("6281234567890");
  });

  it("handles 8xxx by adding 62", () => {
    expect(formatIndonesianPhone("81234567890")).toBe("6281234567890");
  });

  it("returns null for invalid or too short inputs", () => {
    expect(formatIndonesianPhone("")).toBeNull();
    expect(formatIndonesianPhone(null)).toBeNull();
    expect(formatIndonesianPhone("123")).toBeNull();
    expect(formatIndonesianPhone("abcdefghijk")).toBeNull();
  });
});

describe("WhatsApp Message Template Renderer", () => {
  it("renders variables into template correctly", () => {
    const template = "Halo {nama_ortu}, {nama_siswa} dari kelas {kelas} telah hadir jam {jam}.";
    const rendered = renderWaTemplate(template, {
      nama_ortu: "Bapak Budi",
      nama_siswa: "Ahmad",
      kelas: "7A",
      jam: "07:05",
    });

    expect(rendered).toBe("Halo Bapak Budi, Ahmad dari kelas 7A telah hadir jam 07:05.");
  });

  it("replaces missing variables with '-' fallback", () => {
    const template = "Halo {nama_ortu}, siswa {nama_siswa} terlambat {menit_terlambat} menit.";
    const rendered = renderWaTemplate(template, {
      nama_ortu: "Ibu Siti",
      nama_siswa: "Rani",
      menit_terlambat: undefined,
    });

    expect(rendered).toBe("Halo Ibu Siti, siswa Rani terlambat - menit.");
  });

  it("provides valid default templates for all attendance states", () => {
    expect(DEFAULT_WA_TEMPLATES.hadir).toContain("{nama_siswa}");
    expect(DEFAULT_WA_TEMPLATES.hadir).toContain("{sekolah}");
    expect(DEFAULT_WA_TEMPLATES.terlambat).toContain("{menit_terlambat}");
    expect(DEFAULT_WA_TEMPLATES.izin).toContain("{alasan}");
    expect(DEFAULT_WA_TEMPLATES.alfa).toContain("ALFA");
  });
});
