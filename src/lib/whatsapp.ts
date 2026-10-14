import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import pino from "pino";
import prisma from "@/lib/prisma";

export interface WhatsAppSessionState {
  status: "disconnected" | "connecting" | "qrcode" | "connected";
  qrCode: string | null;
  phoneNumber: string | null;
  userName: string | null;
  lastConnectedAt: string | null;
  error: string | null;
  client: any | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __wa_session: WhatsAppSessionState | undefined;
}

const AUTH_DIR = path.join(process.cwd(), "storage", "whatsapp-auth");

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

export function formatIndonesianPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Hapus karakter non-angka
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (!cleaned) return null;

  // Jika diawali 08, ganti 0 dengan 62
  if (cleaned.startsWith("08")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  } else if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  // Nomor HP Indonesia biasanya 10-15 digit
  if (cleaned.length < 9 || cleaned.length > 16) {
    return null;
  }

  return cleaned;
}

import { DEFAULT_WA_TEMPLATES } from "./whatsapp-templates";
export { DEFAULT_WA_TEMPLATES };

export function renderWaTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  let rendered = template;
  for (const [key, val] of Object.entries(vars)) {
    const placeholder = `{${key}}`;
    const replacement = val !== undefined && val !== null ? String(val) : "-";
    rendered = rendered.split(placeholder).join(replacement);
  }
  return rendered;
}

function getSessionState(): WhatsAppSessionState {
  if (!globalThis.__wa_session) {
    globalThis.__wa_session = {
      status: "disconnected",
      qrCode: null,
      phoneNumber: null,
      userName: null,
      lastConnectedAt: null,
      error: null,
      client: null,
    };
  }
  return globalThis.__wa_session;
}

let ongoingInitPromise: Promise<ReturnType<typeof getWhatsAppStatus>> | null = null;

function hasRegisteredCreds(): boolean {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (!fs.existsSync(credsPath)) return false;
    const raw = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    return Boolean(raw && (raw.registered === true || raw.me?.id));
  } catch {
    return false;
  }
}

export function getWhatsAppStatus() {
  const session = getSessionState();
  let status = session.status;
  // Jika qrCode ada tapi status masih connecting, normalkan jadi qrcode
  if (session.qrCode && status !== "connected") {
    status = "qrcode";
  }

  // Jika sesi belum aktif tetapi creds sudah terdaftar, pulihkan koneksi di background
  if (session.status === "disconnected" && hasRegisteredCreds() && !ongoingInitPromise) {
    initWhatsAppSocket(false).catch((err) => {
      console.error("[WhatsApp] Auto-restore session error:", err);
    });
  }

  return {
    status,
    qrCode: session.qrCode,
    phoneNumber: session.phoneNumber,
    userName: session.userName,
    lastConnectedAt: session.lastConnectedAt,
    error: session.error,
  };
}

export async function initWhatsAppSocket(forceNewQR = false): Promise<ReturnType<typeof getWhatsAppStatus>> {
  const session = getSessionState();

  // Jika sudah terhubung dan tidak dipaksa baru, kembalikan status aktif
  if (session.status === "connected" && session.client && !forceNewQR) {
    return getWhatsAppStatus();
  }

  // Jika inisialisasi sedang berlangsung dan tidak diminta force baru, tunggu inisialisasi tersebut
  if (ongoingInitPromise && !forceNewQR) {
    return ongoingInitPromise;
  }

  ongoingInitPromise = (async () => {
    // Tutup dan bersihkan socket lama terlebih dahulu agar tidak terjadi WebSocket conflict
    if (session.client) {
      try {
        session.client.ev?.removeAllListeners();
        session.client.ws?.close();
        session.client.end?.(new Error("Resetting session"));
      } catch {}
      session.client = null;
    }

    try {
      ensureAuthDir();

      const registered = hasRegisteredCreds();

      // HANYA hapus folder auth jika diminta QR baru (forceNewQR)
      if (forceNewQR) {
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          ensureAuthDir();
        } catch {}
        session.qrCode = null;
        session.phoneNumber = null;
        session.userName = null;
      }

      session.status = "connecting";
      session.error = null;

      // Import baileys secara dinamis
      const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = await import(
        "@whiskeysockets/baileys"
      );

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const logger = pino({ level: "silent" }) as any;

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: ["Absensi Sekolah", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      session.client = sock;

      sock.ev.on("creds.update", saveCreds);

      let waitResolve: (() => void) | null = null;
      const waitPromise = new Promise<void>((resolve) => {
        waitResolve = resolve;
      });

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
            session.qrCode = qrDataUrl;
            session.status = "qrcode";
            session.error = null;
            if (waitResolve) {
              waitResolve();
              waitResolve = null;
            }
          } catch (err: any) {
            console.error("Gagal generate QR Code WA:", err);
          }
        }

        if (connection === "open") {
          session.status = "connected";
          session.qrCode = null;
          session.lastConnectedAt = new Date().toISOString();
          session.error = null;

          // Ambil nomor HP staf yang terhubung
          const jid = sock.user?.id || "";
          const cleanNumber = jid.split(":")[0]?.split("@")[0] || null;
          session.phoneNumber = cleanNumber;
          session.userName = sock.user?.name || (sock.user as any)?.verifiedName || (sock.user as any)?.notify || "Staf Tata Usaha";

          console.log(`[WhatsApp] Terhubung berhasil! Nomor: +${cleanNumber}, Akun: ${session.userName}`);

          if (waitResolve) {
            waitResolve();
            waitResolve = null;
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;

          console.log(`[WhatsApp] Connection closed. StatusCode: ${statusCode}, loggedOut: ${isLoggedOut}, restartRequired: ${isRestartRequired}`);

          if (session.client) {
            try {
              session.client.ev?.removeAllListeners();
            } catch {}
            session.client = null;
          }

          if (isLoggedOut) {
            session.status = "disconnected";
            session.qrCode = null;
            session.phoneNumber = null;
            session.userName = null;
            session.error = "Sesi WhatsApp telah keluar (Logged out). Silakan hubungkan kembali.";
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            } catch {}
            if (waitResolve) {
              waitResolve();
              waitResolve = null;
            }
          } else if (isRestartRequired || statusCode === 428 || statusCode === 408) {
            // Restart required (scan QR berhasil di HP) atau transient connection drop
            console.log("[WhatsApp] Scan terdeteksi / restart required. Melakukan rekoneksi autentikasi...");
            session.status = "connecting";
            session.qrCode = null; // Bersihkan QR yang sudah discan
            if (waitResolve) {
              waitResolve();
              waitResolve = null;
            }
            setTimeout(() => {
              initWhatsAppSocket(false).catch((err) => {
                console.error("[WhatsApp] Reconnect error:", err);
              });
            }, 800);
          } else if (statusCode === DisconnectReason.connectionReplaced) {
            session.status = "disconnected";
            session.error = "Koneksi terputus: Sesi WhatsApp dibuka di perangkat/browser lain.";
            if (waitResolve) {
              waitResolve();
              waitResolve = null;
            }
          } else {
            if (hasRegisteredCreds()) {
              console.log("[WhatsApp] Sesi terputus sementara, mencoba rekoneksi otomatis...");
              session.status = "connecting";
              session.qrCode = null;
              setTimeout(() => {
                initWhatsAppSocket(false).catch(console.error);
              }, 1500);
            } else {
              session.status = "disconnected";
              if (!session.qrCode) {
                session.error = "Koneksi terputus. Silakan klik Hubungkan WhatsApp kembali.";
              }
            }
            if (waitResolve) {
              waitResolve();
              waitResolve = null;
            }
          }
        }
      });

      // Tunggu maksimal 5 detik agar respons HTTP dapat langsung menyertakan QR code
      await Promise.race([
        waitPromise,
        new Promise<void>((r) => setTimeout(r, 5000)),
      ]);

      return getWhatsAppStatus();
    } catch (err: any) {
      console.error("Init WhatsApp Error:", err);
      session.status = "disconnected";
      session.error = err.message || "Gagal menginisialisasi WhatsApp client";
      return getWhatsAppStatus();
    }
  })().finally(() => {
    ongoingInitPromise = null;
  });

  return ongoingInitPromise;
}

export async function disconnectWhatsApp() {
  const session = getSessionState();
  try {
    if (session.client) {
      try {
        await session.client.logout?.();
      } catch {}
      try {
        session.client.end?.();
      } catch {}
    }
    session.client = null;
    session.status = "disconnected";
    session.qrCode = null;
    session.phoneNumber = null;
    session.userName = null;
    session.error = null;

    ensureAuthDir();
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    return { success: true, message: "Koneksi WhatsApp berhasil diputuskan." };
  } catch (err: any) {
    console.error("Disconnect WA Error:", err);
    return { success: false, message: err.message || "Gagal memutuskan WhatsApp." };
  }
}

export async function sendWhatsAppMessage(
  targetPhone: string,
  messageText: string,
  options?: {
    studentId?: string;
    recipientName?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanPhone = formatIndonesianPhone(targetPhone);
  if (!cleanPhone) {
    const errMsg = `Nomor telepon '${targetPhone}' tidak valid untuk WhatsApp.`;
    try {
      await prisma.whatsAppLog.create({
        data: {
          recipient: targetPhone || "-",
          recipientName: options?.recipientName || null,
          studentId: options?.studentId || null,
          message: messageText,
          status: "FAILED",
          error: errMsg,
        },
      });
    } catch {}
    return { success: false, error: errMsg };
  }

  // Periksa pengaturan sekolah untuk gateway type
  let gatewayType = "BAILEYS";
  let apiUrl: string | null = null;
  let apiKey: string | null = null;
  let waEnabled = true;

  try {
    const setting = await prisma.schoolSetting.findFirst({ where: { id: 1 } });
    if (setting) {
      waEnabled = setting.waEnabled;
      gatewayType = setting.waGatewayType || "BAILEYS";
      apiUrl = setting.waApiUrl;
      apiKey = setting.waApiKey;
    }
  } catch {}

  if (!waEnabled) {
    return { success: false, error: "Fitur notifikasi WhatsApp dinonaktifkan di pengaturan sekolah." };
  }

  // 1. Jika menggunakan API gateway eksternal (Fonnte / Generic Webhook)
  if (gatewayType === "GENERIC_API" && apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: apiKey } : {}),
        },
        body: JSON.stringify({
          target: cleanPhone,
          phone: cleanPhone,
          message: messageText,
        }),
      });

      const resJson = await response.json().catch(() => ({}));
      const isSuccess = response.ok;

      await prisma.whatsAppLog.create({
        data: {
          recipient: cleanPhone,
          recipientName: options?.recipientName || null,
          studentId: options?.studentId || null,
          message: messageText,
          status: isSuccess ? "SENT" : "FAILED",
          error: isSuccess ? null : JSON.stringify(resJson) || `HTTP ${response.status}`,
        },
      });

      return {
        success: isSuccess,
        messageId: resJson?.id || resJson?.messageId || "API_SUCCESS",
        error: isSuccess ? undefined : "Gagal mengirim via API eksternal.",
      };
    } catch (apiErr: any) {
      await prisma.whatsAppLog.create({
        data: {
          recipient: cleanPhone,
          recipientName: options?.recipientName || null,
          studentId: options?.studentId || null,
          message: messageText,
          status: "FAILED",
          error: apiErr.message || "Network Error pada API Gateway",
        },
      });
      return { success: false, error: apiErr.message };
    }
  }

  // 2. Default: Baileys Web Socket yang terhubung via Scan QR Staf TU
  const session = getSessionState();
  if (session.status !== "connected" || !session.client) {
    const errMsg = "WhatsApp Staf TU belum terhubung. Silakan scan QR code di menu Pengaturan.";
    await prisma.whatsAppLog.create({
      data: {
        recipient: cleanPhone,
        recipientName: options?.recipientName || null,
        studentId: options?.studentId || null,
        message: messageText,
        status: "FAILED",
        error: errMsg,
      },
    });
    return { success: false, error: errMsg };
  }

  try {
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const result = await session.client.sendMessage(jid, { text: messageText });

    await prisma.whatsAppLog.create({
      data: {
        recipient: cleanPhone,
        recipientName: options?.recipientName || null,
        studentId: options?.studentId || null,
        message: messageText,
        status: "SENT",
        error: null,
      },
    });

    return {
      success: true,
      messageId: result?.key?.id || "BAILEYS_SENT",
    };
  } catch (sendErr: any) {
    console.error("Gagal kirim pesan WhatsApp:", sendErr);
    await prisma.whatsAppLog.create({
      data: {
        recipient: cleanPhone,
        recipientName: options?.recipientName || null,
        studentId: options?.studentId || null,
        message: messageText,
        status: "FAILED",
        error: sendErr.message || "Gagal mengirim pesan WhatsApp",
      },
    });

    return { success: false, error: sendErr.message || "Gagal mengirim pesan WhatsApp" };
  }
}

/**
 * Helper non-blocking untuk mengirim notifikasi presensi siswa ke orang tua
 */
export async function notifyParentAttendance(params: {
  studentId: string;
  studentName: string;
  className: string;
  parentName?: string | null;
  parentPhone?: string | null;
  status: "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALFA";
  checkInTime?: string;
  dateStr?: string;
  lateMinutes?: number;
  reason?: string;
}) {
  try {
    const {
      studentId,
      studentName,
      className,
      parentName,
      parentPhone,
      status,
      checkInTime = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      dateStr = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      lateMinutes = 0,
      reason = "-",
    } = params;

    // Jika siswa tidak punya nomor telepon orang tua, lewati
    if (!parentPhone) return;

    const setting = await prisma.schoolSetting.findFirst({ where: { id: 1 } });
    if (!setting || !setting.waEnabled) return;

    // Periksa apakah notifikasi untuk status ini diaktifkan
    if (status === "HADIR" && !setting.waNotifyHadir) return;
    if (status === "TERLAMBAT" && !setting.waNotifyTerlambat) return;
    if ((status === "IZIN" || status === "SAKIT") && !setting.waNotifyIzin) return;
    if (status === "ALFA" && !setting.waNotifyAlfa) return;

    const schoolName = setting.schoolName || "Sekolah";

    // Pilih template sesuai status
    let template = "";
    if (status === "HADIR") {
      template = setting.waTemplateHadir || DEFAULT_WA_TEMPLATES.hadir;
    } else if (status === "TERLAMBAT") {
      template = setting.waTemplateTerlambat || DEFAULT_WA_TEMPLATES.terlambat;
    } else if (status === "IZIN" || status === "SAKIT") {
      template = setting.waTemplateIzin || DEFAULT_WA_TEMPLATES.izin;
    } else if (status === "ALFA") {
      template = setting.waTemplateAlfa || DEFAULT_WA_TEMPLATES.alfa;
    }

    const message = renderWaTemplate(template, {
      nama_siswa: studentName,
      nama_ortu: parentName || "Orang Tua / Wali",
      kelas: className,
      status: status,
      jam: checkInTime,
      tanggal: dateStr,
      sekolah: schoolName,
      menit_terlambat: lateMinutes,
      alasan: reason,
    });

    // Kirim pesan tanpa memblokir thread pemindaian
    sendWhatsAppMessage(parentPhone, message, {
      studentId,
      recipientName: parentName || `Ortu ${studentName}`,
    }).catch((e) => console.error("Kirim WA background error:", e));
  } catch (err: any) {
    console.error("notifyParentAttendance Error:", err);
  }
}
