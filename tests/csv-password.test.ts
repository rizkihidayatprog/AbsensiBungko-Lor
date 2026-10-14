import { describe, it, expect } from "vitest";
import { parseCsvRows, parseCsv, generateCsv } from "@/lib/csv";
import { validatePasswordStrength, MIN_PASSWORD_LENGTH } from "@/lib/password";

describe("parseCsvRows", () => {
  it("mem-parsing baris sederhana", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("menangani koma di dalam field berquote", () => {
    expect(parseCsvRows('nama,alamat\n"Ahmad, Fauzi","Jl. Merdeka 1"')).toEqual([
      ["nama", "alamat"],
      ["Ahmad, Fauzi", "Jl. Merdeka 1"],
    ]);
  });

  it("menangani escaped quote di dalam field", () => {
    expect(parseCsvRows('nama,catatan\n"Andi","Dia bilang ""halo"""')).toEqual([
      ["nama", "catatan"],
      ["Andi", 'Dia bilang "halo"'],
    ]);
  });

  it("menangani newline di dalam field berquote", () => {
    expect(parseCsvRows('a,b\n"baris1\nbaris2",x')).toEqual([
      ["a", "b"],
      ["baris1\nbaris2", "x"],
    ]);
  });

  it("menormalisasi line-ending CRLF", () => {
    expect(parseCsvRows("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mengabaikan baris kosong", () => {
    expect(parseCsvRows("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mengembalikan array kosong untuk input kosong", () => {
    expect(parseCsvRows("")).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("menormalkan header ke snake_case dan membuat objek baris", () => {
    const { headers, rows, errors } = parseCsv("NIS, Nama Lengkap\n20261001, Ahmad Fauzi");
    expect(headers).toEqual(["nis", "nama_lengkap"]);
    expect(rows[0]).toEqual({ nis: "20261001", nama_lengkap: "Ahmad Fauzi" });
    expect(errors).toEqual([]);
  });

  it("mengisi kolom hilang dengan string kosong", () => {
    const { rows } = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("melaporkan file kosong", () => {
    expect(parseCsv("").errors).toEqual(["File CSV kosong."]);
  });
});

describe("generateCsv", () => {
  it("menghasilkan header + baris dengan CRLF", () => {
    expect(generateCsv(["a", "b"], [[1, 2]])).toBe("a,b\r\n1,2");
  });

  it("meng-escape field yang mengandung koma, quote, atau newline", () => {
    expect(generateCsv(["nama"], [["Ahmad, Fauzi"]])).toBe('nama\r\n"Ahmad, Fauzi"');
    expect(generateCsv(["nama"], [['Dia "halo"']])).toBe('nama\r\n"Dia ""halo"""');
  });

  it("mengubah null/undefined menjadi string kosong", () => {
    expect(generateCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });

  it("round-trip: hasil generate dapat di-parse kembali", () => {
    const csv = generateCsv(["nama", "alamat"], [["Ahmad, Fauzi", 'Jl "Merdeka"']]);
    const { rows } = parseCsv(csv);
    expect(rows[0]).toEqual({ nama: "Ahmad, Fauzi", alamat: 'Jl "Merdeka"' });
  });
});

describe("validatePasswordStrength", () => {
  it("menolak password kosong / non-string", () => {
    expect(validatePasswordStrength("").valid).toBe(false);
    expect(validatePasswordStrength(undefined).valid).toBe(false);
    expect(validatePasswordStrength(12345678).valid).toBe(false);
  });

  it("menolak password terlalu pendek", () => {
    const hasil = validatePasswordStrength("Ab1");
    expect(hasil.valid).toBe(false);
    expect(hasil.message).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("menolak password tanpa angka", () => {
    expect(validatePasswordStrength("abcdefghij").message).toMatch(/angka/i);
  });

  it("menolak password tanpa huruf", () => {
    expect(validatePasswordStrength("1234567890").message).toMatch(/huruf/i);
  });

  it("menolak password umum yang cukup panjang", () => {
    expect(validatePasswordStrength("admin123").message).toMatch(/umum/i);
    expect(validatePasswordStrength("password123").message).toMatch(/umum/i);
    expect(validatePasswordStrength("sekolah123").message).toMatch(/umum/i);
  });

  it("urutan pemeriksaan: panjang lebih dulu daripada daftar umum", () => {
    // "guru123" hanya 7 karakter, jadi ditolak karena panjang, bukan daftar umum.
    expect(validatePasswordStrength("guru123").message).toMatch(/minimal/i);
  });

  it("menerima password yang kuat", () => {
    expect(validatePasswordStrength("Sekolah#2026").valid).toBe(true);
  });
});
