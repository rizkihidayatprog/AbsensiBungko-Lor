import { describe, it, expect } from "vitest";
import { formatFileSize, compressAvatar } from "@/lib/image-compress";

describe("formatFileSize Helper", () => {
  it("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(25600)).toBe("25.0 KB");
    expect(formatFileSize(1048000)).toBe("1023.4 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatFileSize(1048576)).toBe("1.00 MB");
    expect(formatFileSize(5242880)).toBe("5.00 MB");
  });
});

describe("compressAvatar Validation", () => {
  it("rejects non-image files with a clear error", async () => {
    const fakeFile = new File(["not an image"], "test.pdf", { type: "application/pdf" });
    await expect(compressAvatar(fakeFile)).rejects.toThrow(
      "Berkas harus berupa gambar (JPG, PNG, atau WebP)."
    );
  });
});
