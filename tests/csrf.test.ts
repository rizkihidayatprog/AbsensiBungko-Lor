import { describe, it, expect, afterEach, vi } from "vitest";
import {
  assertSameOrigin,
  extractHost,
  getAllowedHosts,
  isMutatingMethod,
  type RequestLike,
} from "@/lib/csrf";

function makeReq(overrides?: {
  method?: string;
  headers?: Record<string, string | null | undefined>;
}): RequestLike {
  const headers = overrides?.headers ?? {};
  return {
    method: overrides?.method ?? "GET",
    headers: {
      get(name: string) {
        return Object.prototype.hasOwnProperty.call(headers, name.toLowerCase())
          ? headers[name.toLowerCase()]
          : null;
      },
    },
  };
}

function expectRejected(host: string, origin: string) {
  const req = makeReq({ method: "POST", headers: { host, origin } });
  expect(assertSameOrigin(req)).toBe(false);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMutatingMethod", () => {
  it("menandai metode yang mengubah state", () => {
    expect(isMutatingMethod("POST")).toBe(true);
    expect(isMutatingMethod("PUT")).toBe(true);
    expect(isMutatingMethod("PATCH")).toBe(true);
    expect(isMutatingMethod("DELETE")).toBe(true);
  });

  it("menandai metode aman sebagai non-mutasi", () => {
    expect(isMutatingMethod("GET")).toBe(false);
    expect(isMutatingMethod("HEAD")).toBe(false);
    expect(isMutatingMethod("OPTIONS")).toBe(false);
  });

  it("tahan terhadap huruf besar/kecil dan nilai kosong", () => {
    expect(isMutatingMethod("post")).toBe(true);
    expect(isMutatingMethod("")).toBe(false);
    expect(isMutatingMethod(null)).toBe(false);
    expect(isMutatingMethod(undefined)).toBe(false);
  });
});

describe("extractHost", () => {
  it("mengurai host dari URL absolut", () => {
    expect(extractHost("https://sekolah.sch.id")).toBe("sekolah.sch.id");
    expect(extractHost("http://192.168.1.5:3000")).toBe("192.168.1.5:3000");
    expect(extractHost("https://Sub.example.com/path?a=1")).toBe("sub.example.com");
  });

  it("mengembalikan null untuk nilai tidak sah", () => {
    expect(extractHost("bukan url")).toBe(null);
    expect(extractHost("")).toBe(null);
    expect(extractHost(null)).toBe(null);
    expect(extractHost(undefined)).toBe(null);
  });
});

describe("getAllowedHosts", () => {
  it("menggabungkan host, x-forwarded-host, dan ALLOWED_ORIGINS", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://sekolah.sch.id, sekolah.example.co.id");
    const req = makeReq({
      headers: { host: "localhost:3000", "x-forwarded-host": "proxy.sch.id" },
    });
    const hosts = getAllowedHosts(req);
    expect(hosts.has("localhost:3000")).toBe(true);
    expect(hosts.has("proxy.sch.id")).toBe(true);
    expect(hosts.has("sekolah.sch.id")).toBe(true);
    expect(hosts.has("sekolah.example.co.id")).toBe(true);
  });
});

describe("assertSameOrigin", () => {
  it("menerima mutasi dengan Origin yang cocok (host + port)", () => {
    const req = makeReq({
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("menerima mutasi dengan Origin cocok di belakang proxy HTTPS", () => {
    const req = makeReq({
      method: "POST",
      headers: { host: "192.168.1.5:3443", origin: "https://192.168.1.5:3443" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("menolak mutasi dengan Origin asing", () => {
    expectRejected("localhost:3000", "https://jahat.example.com");
    expectRejected("sekolah.sch.id", "http://localhost:9999");
    expectRejected("sekolah.sch.id", "http://sekolah.sch.id.evil.com");
  });

  it("menolak Origin bernilai 'null' (opaque/sandbox)", () => {
    expectRejected("localhost:3000", "null");
  });

  it("menolak Origin yang bukan URL (garbage)", () => {
    expectRejected("localhost:3000", "tidak-valid");
  });

  it("menerima saat Origin kosong namun Referer cocok (fallback)", () => {
    const req = makeReq({
      method: "PATCH",
      headers: { host: "localhost:3000", referer: "http://localhost:3000/pengaturan" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("menolak saat Origin kosong namun Referer asing", () => {
    const req = makeReq({
      method: "PATCH",
      headers: { host: "localhost:3000", referer: "http://evil.com/x" },
    });
    expect(assertSameOrigin(req)).toBe(false);
  });

  it("meloloskan request tanpa Origin dan tanpa Referer (curl/internal)", () => {
    const req = makeReq({ method: "POST", headers: { host: "localhost:3000" } });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("metode GET tidak pernah ditolak meski Origin asing", () => {
    const req = makeReq({
      method: "GET",
      headers: { host: "localhost:3000", origin: "https://jahat.example.com" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("menerima origin dari daftar ALLOWED_ORIGINS", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://sekolah.sch.id");
    const req = makeReq({
      method: "POST",
      headers: { host: "internal:8080", origin: "https://sekolah.sch.id" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });
});