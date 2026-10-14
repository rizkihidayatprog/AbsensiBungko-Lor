// Proteksi CSRF untuk request mutasi (POST/PUT/PATCH/DELETE).
//
// Strategi: same-origin check. Browser modern SELALU mengirim header `Origin`
// pada request non-GET (terutama untuk fetch/XHR). Bila `Origin` ada namun
// host-nya tidak cocok dengan host aplikasi, request ditolak. Ini menutup
// serangan cross-site form submission walau cookie `SameSite=Lax` sudah
// memberi lapisan pertama.
//
// Bila `Origin` (dan `Referer`) sama sekali tidak ada — mis. `curl`, alat
// internal, atau skrip server-to-server — request DILOLOSKAN agar operasional
// dan smoke test tidak terganggu. Perlindungan utama untuk sesi pengguna tetap
// berasal dari cookie `SameSite=Lax` + `httpOnly`.

export interface RequestLike {
  method: string;
  headers: {
    get(name: string): string | null | undefined;
  };
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Nilai `Origin` yang harus selalu ditolak (mis. iframe sandbox / opaque origin).
const REJECTED_ORIGINS = new Set(["null"]);

export function isMutatingMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return MUTATING_METHODS.has(method.toUpperCase());
}

// Ambil `host` (tanpa skema) dari sebuah URL absolut (Origin/Referer).
export function extractHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

// Kumpulkan seluruh host yang dianggap sah untuk instance ini.
export function getAllowedHosts(req: RequestLike): Set<string> {
  const hosts = new Set<string>();

  const hostHeader = req.headers.get("host");
  if (hostHeader) hosts.add(hostHeader.toLowerCase());

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    forwardedHost
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
      .forEach((h) => hosts.add(h));
  }

  // Daftar tambahan eksplisit (mis. domain publik di belakang proxy).
  const configured = process.env.ALLOWED_ORIGINS;
  if (configured) {
    configured
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((entry) => {
        hosts.add(extractHost(entry) ?? entry.toLowerCase());
      });
  }

  return hosts;
}

// Verifikasi same-origin untuk request mutasi. Selalu `true` untuk metode aman.
export function assertSameOrigin(req: RequestLike): boolean {
  if (!isMutatingMethod(req.method)) return true;

  const allowedHosts = getAllowedHosts(req);

  const origin = req.headers.get("origin");
  if (origin) {
    if (REJECTED_ORIGINS.has(origin.toLowerCase())) return false;
    const host = extractHost(origin);
    return host !== null && allowedHosts.has(host);
  }

  const referer = req.headers.get("referer");
  if (referer) {
    const host = extractHost(referer);
    return host !== null && allowedHosts.has(host);
  }

  // Tidak ada Origin maupun Referer: loloskan (dilindungi SameSite=Lax).
  return true;
}
