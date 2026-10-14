"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  LogIn,
  LogOut,
  Search,
  Volume2,
  VolumeX,
  History,
  Maximize2,
  Minimize2,
  SwitchCamera,
  Trash2,
  RefreshCw,
  QrCode,
  Scan,
  Check,
  ArrowLeft,
  UserPlus,
  X,
} from "lucide-react";
import ManualAttendanceModal from "@/components/ManualAttendanceModal";

/**
 * Satu AudioContext dipakai bersama untuk seluruh bip pada sesi ini.
 * Membuat AudioContext baru untuk tiap bip adalah salah satu penyebab paling
 * umum scan terasa lambat di HP karena konteks baru memakan biaya ratusan ms.
 */
let sharedAudioContext: AudioContext | null = null;
function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioContext) {
      const Ctor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      sharedAudioContext = new Ctor();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

interface ScanResult {
  condition: "BERHASIL" | "SUDAH_TERCATAT" | "DITOLAK";
  message: string;
  timestamp: number;
  data?: {
    name: string;
    nis?: string;
    nisn?: string;
    gender?: string;
    nip?: string;
    class: string;
    status: string;
    lateMinutes?: number;
    time: string;
    type?: string;
    photoUrl?: string;
    semester?: string;
  };
}

export default function ScannerPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mode, setMode] = useState<"IN" | "OUT">("IN");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [sessionLogs, setSessionLogs] = useState<ScanResult[]>([]);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  // Sesi pulang bisa dinonaktifkan admin lewat halaman /pengaturan
  const [checkOutEnabled, setCheckOutEnabled] = useState(true);

  // Jam real-time (WIB). Dimulai null agar render server & klien sama
  // (menghindari hydration mismatch), lalu diisi setelah komponen ter-mount.
  const [now, setNow] = useState<Date | null>(null);
  const [checkInEnd, setCheckInEnd] = useState("07:15");
  const [checkOutStart, setCheckOutStart] = useState("14:30");
  const [checkOutEnd, setCheckOutEnd] = useState("17:00");

  // Perangkat kamera
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  // "environment" = kamera belakang, "user" = kamera depan (HP)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const modeRef = useRef<"IN" | "OUT">("IN");
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);

  // ---------------------------------------------------------------------
  // Visual deteksi barcode + dukungan multi-scan
  // ---------------------------------------------------------------------
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // code -> { corners, box, state: "detected" | "scanned", at, scannedAt }
  const detectionsRef = useRef<
    Map<
      string,
      {
        corners: { x: number; y: number }[];
        box: { x: number; y: number; width: number; height: number };
        state: "detected" | "scanned";
        at: number;
        scannedAt: number;
      }
    >
  >(new Map());
  // Kode yang baru saja diproses (anti duplikasi lintas jalur deteksi)
  const recentCodesRef = useRef<Map<string, number>>(new Map());
  const inFlightCodesRef = useRef<Set<string>>(new Set());
  const multiScanSupportedRef = useRef<boolean | null>(null);
  const [multiScanReady, setMultiScanReady] = useState(false);

  // Ref callback agar loop deteksi tidak perlu restart saat kamera/urutan render berubah
  const playAudioBeepRef = useRef<(type: "success" | "warning" | "error") => void>(
    () => {}
  );
  const processQrTokenRef = useRef<(token: string) => void>(() => {});

  const DUPLICATE_WINDOW_MS = 2500; // jeda per kartu yang sama
  const VISUAL_LINGER_MS = 1400; // lama visual menetap setelah discan
  const DETECTION_TTL_MS = 3000; // biaya frame yang hilang dari layar
  // Jeda antar deteksi visual. Diuji langsung di HP: memperlambat loop ini
  // justru membuat pemindaian terasa lambat (kode baru tertangkap setelah
  // satu-beberapa tick), jadi intervalnya sengaja tetap rapat.
  const DETECT_INTERVAL_MS = 110;

  /**
   * Klaim pemrosesan satu kode. Mengembalikan true bila kode ini boleh
   * diproses sekarang (belum diproses dalam `DUPLICATE_WINDOW_MS` terakhir dan
   * tidak sedang berjalan). Kode berbeda tidak saling tunggu sehingga multi-scan berjalan.
   */
  const claimCode = useCallback((code: string): boolean => {
    const now = Date.now();
    const last = recentCodesRef.current.get(code);
    if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) {
      return false;
    }
    if (inFlightCodesRef.current.has(code)) {
      return false;
    }
    recentCodesRef.current.set(code, now);

    // Bersihkan entri basi agar tidak tumbuh tanpa batas
    if (recentCodesRef.current.size > 300) {
      for (const [k, v] of recentCodesRef.current) {
        if (now - v > DUPLICATE_WINDOW_MS) recentCodesRef.current.delete(k);
      }
    }
    return true;
  }, []);

  const releaseCode = useCallback((code: string) => {
    inFlightCodesRef.current.delete(code);
  }, []);

  // Sinkronkan modeRef tanpa perlu mematikan dan menyalakan kamera
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Jika sesi pulang dinonaktifkan, pastikan mode selalu "Masuk"
  useEffect(() => {
    if (!checkOutEnabled && mode === "OUT") {
      setMode("IN");
    }
  }, [checkOutEnabled, mode]);

  // Ambil data user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentUser(data.user);
        }
      });
  }, []);

  // Ambil pengaturan sekolah (sesi pulang + batas jam untuk jam real-time)
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.setting) {
          setCheckOutEnabled(data.setting.checkOutEnabled !== false);
          setCheckInEnd(data.setting.checkInEnd || "07:15");
          setCheckOutStart(data.setting.checkOutStart || "14:30");
          setCheckOutEnd(data.setting.checkOutEnd || "17:00");
        }
      })
      .catch(() => {
        // Abaikan, gunakan nilai bawaan
      });
  }, []);

  // Jam real-time: diperbarui setiap detik mengikuti zona waktu sekolah (Asia/Jakarta)
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Sinkronisasi status fullscreen browser
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Audio synthesizer Web Audio API.
  // AudioContext dipakai ulang (dibuat sekali, lalu di-resume bila suspended):
  // membuat context baru untuk tiap bip menambah ratusan milidetik blokir pada
  // HP dan delaying pemrosesan scan.
  const playAudioBeep = useCallback(
    (type: "success" | "warning" | "error") => {
      if (!soundEnabled || typeof window === "undefined") return;
      try {
        const audioCtx = getSharedAudioContext();
        if (!audioCtx) return;
        if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === "success") {
          // Bip pemindai optik bersih (950Hz -> 1400Hz)
          osc.type = "sine";
          osc.frequency.setValueAtTime(950, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.12);
        } else if (type === "warning") {
          osc.type = "triangle";
          osc.frequency.setValueAtTime(500, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.2);
        } else {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(250, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.25);
        }
      } catch {
        // Fallback
      }
    },
    [soundEnabled]
  );

  useEffect(() => {
    playAudioBeepRef.current = playAudioBeep;
  }, [playAudioBeep]);

  // Proses token QR ke backend
  const processQrToken = async (token: string) => {
    setIsProcessing(true);
    const activeMode = modeRef.current;

    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, mode: activeMode }),
      });

      const json = await res.json();
      const result: ScanResult = {
        condition: json.condition,
        message: json.message,
        timestamp: Date.now(),
        data: json.data,
      };

      setLastResult(result);
      setSessionLogs((prev) => [result, ...prev.slice(0, 49)]);

      // Tandai kartu ini sebagai sudah discan supaya visual di overlay langsung
      // berstatus "selesai" lalu menghilang (tidak lagi menggantung di kamera).
      const det = detectionsRef.current.get(token);
      if (det) {
        det.state = "scanned";
        det.scannedAt = Date.now();
      }

      if (result.condition === "BERHASIL") {
        // Suara bip sukses sudah dibunyikan
      } else if (result.condition === "SUDAH_TERCATAT") {
        playAudioBeep("warning");
      } else {
        playAudioBeep("error");
      }
    } catch {
      const errRes: ScanResult = {
        condition: "DITOLAK",
        message: "Koneksi ke server terputus saat memproses presensi.",
        timestamp: Date.now(),
      };
      setLastResult(errRes);
      playAudioBeep("error");
    } finally {
      releaseCode(token);
      setIsProcessing(false);
    }
  };

  // Handler callback deteksi QR dengan respon instan 0ms (Optimistic Reaction)
  const handleScanSuccess = useCallback(
    (decodedText: string) => {
      // Penjaga anti-duplikasi per-kode, dipakai bersama oleh semua jalur deteksi
      // (html5-qrcode, detektor multi-frame, dan scanner barcode fisik) sehingga
      // kartu yang sama tidak pernah terkirim dua kali, namun beberapa kartu
      // berbeda tetap dapat diproses bersamaan.
      if (!claimCode(decodedText)) {
        return;
      }

      // Kirim validasi backend LEBIH DAHULU, lalu bunyikan bip. Menyiapkan audio
      // dulu menambah jeda di HP karena pembuatan node audio bisa mahal.
      processQrToken(decodedText);

      // RESPON SUARA KILAT (setelah request terkirim)
      playAudioBeep("success");
    },
    [playAudioBeep]
  );

  // Ref agar efek kamera tidak ikut restart saat handleScanSuccess berganti (mis. toggle suara)
  const handleScanSuccessRef = useRef(handleScanSuccess);
  useEffect(() => {
    handleScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

  useEffect(() => {
    processQrTokenRef.current = (token: string) => {
      void processQrToken(token);
    };
  });

  // Dukungan instan untuk alat pemindai fisik (USB / Bluetooth Handheld Barcode Scanner Gun)
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika operator sedang mengetik di form input manual
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      const now = Date.now();
      // Scanner barcode fisik mengetik sangat cepat (biasanya < 40ms per huruf).
      // Jika jeda antar karakter > 160ms, anggap itu ketikan keyboard manusia biasa -> reset buffer
      if (now - lastKeyTime > 160) {
        barcodeBuffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        const code = barcodeBuffer.trim();
        if (code.length > 0) {
          e.preventDefault();
          handleScanSuccessRef.current(code);
          barcodeBuffer = "";
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refresh daftar kamera via enumerateDevices (dipanggil setelah kamera aktif & izin diberikan,
  // agar label kamera terbaca di iOS tanpa membuka stream kedua yang bentrok dengan scanner).
  const refreshCameraList = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, idx) => ({ id: d.deviceId, label: d.label || `Kamera ${idx + 1}` }));
      if (videoInputs.length > 0) {
        setCameras(videoInputs);
      }
    } catch {
      // Abaikan bila enumerateDevices tidak tersedia/ditolak
    }
  }, []);

  // Start scanner kamera
  useEffect(() => {
    let isMounted = true;
    let scannerInstance: any = null;

    const stopAndClear = (scanner: any) => {
      if (!scanner) return;
      try {
        const p = scanner.isScanning ? scanner.stop() : Promise.resolve();
        Promise.resolve(p)
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear?.();
            } catch {}
          });
      } catch {}
    };

    const startScanner = async () => {
      try {
        setScannerError(null);
        setNeedsUserGesture(false);
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

        const qrContainer = document.getElementById("qr-reader");
        if (!qrContainer || !isMounted) return;

        // Bersihkan sisa DOM hasil run sebelumnya (video lama) sebelum mount instance baru
        qrContainer.innerHTML = "";

        // Format barcode 1D dan QR Code 2D esensial sekolah untuk deteksi secepat kilat (<100ms)
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ];

        scannerInstance = new Html5Qrcode("qr-reader", {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // Native GPU hardware decoding jika tersedia
          },
        });
        scannerRef.current = scannerInstance;

        // Kamera spesifik bila pengguna memilih dari dropdown, selain itu pakai facingMode
        // (HP: environment = belakang, user = depan). Safari desktop hanya mengekspos
        // kamera bawaan sebagai "user", sehingga permintaan environment kerap gagal
        // OverconstrainedError — dicoba ulang ke kamera depan, lalu ke kamera otomatis.
        const fallbackConfigs: (MediaTrackConstraints | boolean)[] = selectedCameraId
          ? [{ deviceId: { exact: selectedCameraId } }]
          : [
              { facingMode },
              { facingMode: facingMode === "environment" ? "user" : "environment" },
              true,
            ];

        let started = false;
        let lastStartErr: any = null;
        for (const cfg of fallbackConfigs) {
          try {
            await scannerInstance.start(
              cfg,
              { fps: 30 }, // Seluruh frame kamera aktif membaca tanpa pembatasan qrbox
              (decodedText: string) => {
                if (isMounted) {
                  handleScanSuccessRef.current(decodedText);
                }
              },
              () => {
                // Frame tanpa barcode dilewati tanpa jeda
              }
            );
            started = true;
            break;
          } catch (startErr) {
            lastStartErr = startErr;
            console.warn("Camera start gagal untuk konfigurasi", cfg, startErr);
          }
        }

        if (!started) throw lastStartErr;

        if (isMounted) {
          setCameraActive(true);
          // Izin sudah diberikan -> ambil daftar kamera + label untuk kontrol depan/belakang
          refreshCameraList();
        } else {
          stopAndClear(scannerInstance);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Camera start error:", err);
          const name = err?.name || "";
          if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            setNeedsUserGesture(true);
            setScannerError(
              "Izin kamera belum diberikan. Tekan tombol 'Aktifkan Kamera' atau izinkan akses kamera pada browser."
            );
          } else if (name === "NotFoundError" || name === "OverconstrainedError") {
            setScannerError(
              "Kamera yang dipilih tidak tersedia. Pilih kamera lain di menu pojok kanan atas atau gunakan input manual."
            );
          } else {
            setScannerError(
              "Kamera tidak dapat diakses. Tekan 'Aktifkan Kamera' atau gunakan input manual."
            );
          }
          setCameraActive(false);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      stopAndClear(scanner || scannerInstance);
    };
  }, [selectedCameraId, facingMode, refreshCameraList, retryToken]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processQrToken(manualInput.trim());
    setManualInput("");
  };

  const handleClearLogs = () => {
    setSessionLogs([]);
    setLastResult(null);
    detectionsRef.current.clear();
  };

  // ---------------------------------------------------------------------
  // Deteksi barcode real-time (visual + multi-scan)
  //
  // Memakai BarcodeDetector bawaan browser bila tersedia (Chrome/Android/
  // Edge). Detektor ini membaca frame dari <video> milik html5-qrcode lewat
  // canvas kerja — sehingga kamera tetap hanya dimiliki satu library, tidak
  // ada dua stream yang berebut. Hasilnya:
  //   1. SEMUA barcode dalam satu frame terdeteksi sekaligus (multi-scan),
  //      bukan hanya satu kode pertama.
  //   2. Titik & frame digambar mengikuti posisi barcode, bertahan sampai
  //      kartu selesai diproses, lalu menghilang.
  // Bila BarcodeDecoder tidak tersedia, pemindaian tetap berjalan seperti
  // sebelumnya lewat html5-qrcode (hanya tanpa visual dan multi-frame).
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!cameraActive) return;

    let cancelled = false;
    let timer: any = null;
    let work: HTMLCanvasElement | null = null;
    let workCtx: CanvasRenderingContext2D | null = null;
    let detector: any = null;
    // Penjaga re-entrancy: native BarcodeDetector.detect() bisa berjalan
    // ratusan milidetik hingga beberapa detik. Tanpa penjaga ini, tick baru
    // tetap berjalan setiap DETECT_INTERVAL_MS walau detect sebelumnya belum
    // selesai, sehingga puluhan detect() menumpuk bersamaan, membanjiri
    // detektor, membekukan tampilan, dan membuat pemindaian tidak realtime.
    let detecting = false;
    let nextAllowedAt = 0;

    const SUPPORTED_FORMATS = [
      "qr_code",
      "code_128",
      "code_39",
      "code_93",
      "ean_13",
      "ean_8",
      "upc_a",
      "upc_e",
      "data_matrix",
    ];

    const init = async () => {
      // Hanya mengandalkan BarcodeDetector bawaan browser (Chrome/Android/Edge).      // Tidak ada dependensi polyfill; bila tidak tersedia, pemindaian tetap
      // berjalan lewat html5-qrcode (tanpa visual & multi-frame).
      const BD: any = (window as any).BarcodeDetector;

      if (!BD) {
        multiScanSupportedRef.current = false;
        setMultiScanReady(false);
        return;
      }

      try {
        detector = new BD({
          formats: SUPPORTED_FORMATS.filter((f) => {
            try {
              return BD.getSupportedFormats?.().includes(f) ?? true;
            } catch {
              return true;
            }
          }),
        });
      } catch {
        try {
          detector = new BD();
        } catch {
          detector = null;
        }
      }

      multiScanSupportedRef.current = !!detector;
      setMultiScanReady(!!detector);
      if (cancelled || !detector) return;

      work = document.createElement("canvas");
      workCtx = work.getContext("2d", { willReadFrequently: true });

      const loop = async () => {
        if (cancelled) return;
        timer = window.setTimeout(loop, DETECT_INTERVAL_MS);

        // Lewati tick ini bila detect sebelumnya masih berjalan, atau bila
        // jeda antar deteksi belum habis.
        if (detecting || Date.now() < nextAllowedAt) return;

        const video = document.querySelector("#qr-reader video") as HTMLVideoElement | null;
        const overlay = overlayCanvasRef.current;
        if (!video || !overlay || !workCtx || video.readyState < 2) return;

        // --- BERSIHKAN CANVAS -------------------------------------------
        const ctx = overlay.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const panelW = overlay.clientWidth;
        const panelH = overlay.clientHeight;
        if (overlay.width !== panelW * dpr || overlay.height !== panelH * dpr) {
          overlay.width = panelW * dpr;
          overlay.height = panelH * dpr;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, panelW, panelH);

        // --- PETAKAN KOORDINAT VIDEO KE PANEL ---------------------------
        // Video memakai object-fit: contain => ada letterbox; hitung kotak
        // video yang benar-benar terlihat agar titik menempel tepat pada kode.
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        const scale = Math.min(panelW / vw, panelH / vh);
        const dispW = vw * scale;
        const dispH = vh * scale;
        const offX = (panelW - dispW) / 2;
        const offY = (panelH - dispH) / 2;

        // --- DETEKSI ------------------------------------------------------
        const workW = Math.min(720, vw);
        const workH = Math.round((workW * vh) / vw);
        if (work!.width !== workW || work!.height !== workH) {
          work!.width = workW;
          work!.height = workH;
        }
        workCtx.drawImage(video, 0, 0, workW, workH);

        let barcodes: any[] = [];
        detecting = true;
        try {
          barcodes = await detector.detect(work!);
        } catch {
          barcodes = [];
        } finally {
          detecting = false;
          // Jeda setelah tiap deteksi selesai: memberi kesempatan decoder utama
          // html5-qrcode memakai sumber daya yang sama.
          nextAllowedAt = Date.now() + DETECT_INTERVAL_MS;
        }
        if (cancelled) return;

        const now = Date.now();
        const dets = detectionsRef.current;
        const toPanel = (p: any) => ({
          x: offX + (p.x / workW) * dispW,
          y: offY + (p.y / workH) * dispH,
        });

        // --- PERBARUI DAFTAR KODE YANG TERDETEKSI -------------------------
        const seen = new Set<string>();
        for (const bc of barcodes) {
          const raw = bc.rawValue;
          if (!raw) continue;
          seen.add(raw);

          // Kartu yang barusan sudah diproses: jangan digambar lagi dan jangan
          // diproses ulang meski masih tertahan di depan kamera.
          const lastProcessed = recentCodesRef.current.get(raw);
          if (lastProcessed !== undefined && now - lastProcessed < DUPLICATE_WINDOW_MS) {
            dets.delete(raw);
            continue;
          }

          const corners = (bc.cornerPoints || []).map(toPanel);
          const box = bc.boundingBox
            ? {
                x: offX + (bc.boundingBox.x / workW) * dispW,
                y: offY + (bc.boundingBox.y / workH) * dispH,
                width: (bc.boundingBox.width / workW) * dispW,
                height: (bc.boundingBox.height / workH) * dispH,
              }
            : null;
          const existing = dets.get(raw);
          if (existing) {
            existing.corners = corners;
            existing.box = box || existing.box;
            existing.at = now;
          } else {
            dets.set(raw, {
              corners,
              box: box || { x: 0, y: 0, width: 0, height: 0 },
              state: "detected",
              at: now,
              scannedAt: 0,
            });
          }
        }

        // --- MULTI-SCAN: proses SETIAP kode yang terlihat -----------------
        for (const [raw, d] of dets) {
          if (d.state !== "detected") continue;
          if (!seen.has(raw)) continue;
          if (now - d.at > DETECTION_TTL_MS) continue;

          if (claimCode(raw)) {
            // Tandai sedang diproses agar visual berubah dan tak menggantung.
            d.scannedAt = now;
            inFlightCodesRef.current.add(raw);
            processQrTokenRef.current(raw);
            playAudioBeepRef.current("success");
          }
        }

        // --- BUANG KODE YANG SUDAH SELESAI / HILANG ---------------------
        for (const [raw, d] of dets) {
          const doneGone =
            d.state === "scanned" && now - d.scannedAt > VISUAL_LINGER_MS;
          const lostTooLong = now - d.at > DETECTION_TTL_MS * 2;
          if (doneGone || (lostTooLong && d.state === "detected")) {
            dets.delete(raw);
          }
        }

        // --- GAMBAR VISUAL -------------------------------------------------
        const drawCorners = (
          pts: { x: number; y: number }[],
          color: string,
          glow: string,
          lw: number
        ) => {
          if (pts.length < 3) return;
          ctx.strokeStyle = glow;
          ctx.lineWidth = lw + 3;
          ctx.lineJoin = "round";
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.stroke();
        };

        for (const d of dets.values()) {
          const scanned = d.state === "scanned";
          const pts =
            d.corners.length >= 3
              ? d.corners
              : d.box.width > 0
              ? [
                  { x: d.box.x, y: d.box.y },
                  { x: d.box.x + d.box.width, y: d.box.y },
                  { x: d.box.x + d.box.width, y: d.box.y + d.box.height },
                  { x: d.box.x, y: d.box.y + d.box.height },
                ]
              : [];
          if (pts.length === 0) continue;

          const base = scanned ? "#34d399" : "#60a5fa";
          const glow = scanned ? "rgba(52,211,153,0.35)" : "rgba(96,165,250,0.35)";

          drawCorners(pts, base, glow, 3);

          // Titik di tiap sudut barcode
          pts.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, scanned ? 5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = base;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.stroke();
          });

          // Isian tipis agar barcode terlihat "terkunci"
          ctx.fillStyle = scanned ? "rgba(52,211,153,0.10)" : "rgba(96,165,250,0.08)";
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.closePath();
          ctx.fill();

          // Label status di atas frame
          const topY = Math.min(...pts.map((p) => p.y));
          const label = scanned ? "TERSCAN ✓" : "TERDETEKSI";
          ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
          const tw = ctx.measureText(label).width;
          const lx = Math.min(...pts.map((p) => p.x));
          const ly = Math.max(4, topY - 20);
          ctx.fillStyle = scanned ? "#059669" : "#2563eb";
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw + 14, 16, 8);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(label, lx + 7, ly + 12);
        }
      };

      loop();
    };

    init().catch(() => {
      setMultiScanReady(false);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      detectionsRef.current.clear();
    };
  }, [cameraActive]);

  // Ringkasan metrik sesi ini
  const countSuccess = sessionLogs.filter((l) => l.condition === "BERHASIL").length;
  const countOnTime = sessionLogs.filter(
    (l) => l.condition === "BERHASIL" && l.data?.status === "HADIR"
  ).length;
  const countLate = sessionLogs.filter(
    (l) => l.condition === "BERHASIL" && l.data?.status === "TERLAMBAT"
  ).length;

  // Jam & tanggal real-time dalam zona waktu sekolah (WIB).
  // Format dirakit manual dengan "en-GB" karena "id-ID" memakai titik sebagai
  // pemisah jam ("20.59.18") sehingga kurang terbaca di panel scanner.
  const waktuWIB = now
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
      }).format(now)
    : "--:--:--";

  const tanggalWIB = now
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(now)
    : "";

  // Hitung sisa waktu menuju batas jam sesi yang sedang aktif (menit)
  const menitSekarang = now
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta",
        }).format(now)
      ) || 0
    : 0;

  const toMenit = (hhmm: string) => {
    const [h, m] = (hhmm || "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
  };

  const batasSesi =
    mode === "IN" ? checkInEnd : checkOutEnabled ? checkOutEnd : checkInEnd;
  const selisihMenit = toMenit(batasSesi) - menitSekarang;
  const batasTercapai = selisihMenit <= 0;

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen bg-slate-950 text-white md:h-screen md:min-h-0 md:overflow-hidden flex flex-col font-sans select-none"
    >
      {/* ========================================================= */}
      {/* TOP KIOSK BAR: NAVIGASI, PILIHAN SESI & STATUS (48px)     */}
      {/* ========================================================= */}
      <header className="min-h-12 shrink-0 z-20 bg-slate-900 border-b border-slate-800 px-2 sm:px-4 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2">
        {/* Sisi Kiri: Tombol Kembali & Judul Pos Scanner */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Kembali ke Dashboard Utama"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 hidden md:flex">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <h1 className="text-xs font-bold tracking-wide uppercase text-slate-200">
              Pos Scanner Presensi QR
            </h1>
          </div>
        </div>

        {/* Jam Real-Time & Status Batas Sesi Presensi */}
        <div className="shrink-0 flex items-center gap-3.5 px-3 py-1.5 rounded-lg bg-slate-800/70 border border-slate-700/70">
          <div className="text-center leading-none">
            <div
              className="font-mono text-xl sm:text-2xl font-black tabular-nums leading-none text-white"
              title={`Waktu resmi server (WIB) per ${tanggalWIB}`}
            >
              {waktuWIB}
              <span className="text-[11px] font-bold text-slate-400 ml-1.5">
                WIB
              </span>
            </div>
            <div className="text-[10px] text-slate-400 capitalize mt-1 hidden sm:block">
              {tanggalWIB}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700" />

          <div className="text-[10px] leading-tight">
            <div className="text-slate-400 uppercase tracking-wider font-bold">
              Batas {mode === "IN" ? "Masuk" : "Pulang"}
            </div>
            <div
              className={`font-mono text-sm font-bold tabular-nums mt-0.5 ${
                batasTercapai ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {batasSesi}
              {!batasTercapai && (
                <span className="text-slate-400 font-medium">
                  {" "}
                  ({selisihMenit} mnt)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tengah: Mode Masuk vs Pulang */}
        <div className="inline-flex shrink-0 rounded-lg border border-slate-700/80 p-0.5 bg-slate-800">
          <button
            onClick={() => setMode("IN")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
              mode === "IN"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LogIn className="w-3 h-3" />
            Masuk
          </button>
          {checkOutEnabled && (
            <button
              onClick={() => setMode("OUT")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                mode === "OUT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogOut className="w-3 h-3" />
              Pulang
            </button>
          )}
        </div>

        {/* Sisi Kanan: Kontrol Kamera, Suara & Fullscreen */}
        <div className="flex items-center gap-2 shrink-0">
          {cameras.length > 1 && (
            <div className="flex items-center gap-1">
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="text-xs px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none max-w-[110px]"
                title="Pilih kamera yang dipakai"
              >
                <option value="">Otomatis ({facingMode === "environment" ? "Belakang" : "Depan"})</option>
                {cameras.map((cam, idx) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {cameras.length > 1 && (
            <button
              onClick={() => {
                // Balik kamera depan <-> belakang (HP)
                setSelectedCameraId("");
                setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={
                facingMode === "environment"
                  ? "Ganti ke Kamera Depan"
                  : "Ganti ke Kamera Belakang"
              }
            >
              <SwitchCamera
                className={`w-4 h-4 ${
                  facingMode === "environment" ? "text-indigo-400" : "text-emerald-400"
                }`}
              />
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={soundEnabled ? "Bunyi Bip On" : "Bunyi Bip Off"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={isFullscreen ? "Keluar Fullscreen" : "Layar Penuh (F11)"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-rose-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-indigo-400" />
            )}
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN SPLIT VIEW (100% TINGGI LAYAR): 50% KIRI & 50% KANAN */}
      {/* ========================================================= */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 md:h-[calc(100vh-3rem)] overflow-visible md:overflow-hidden">
        {/* ======================================================= */}
        {/* SISI KIRI (50% LAYAR): FULL CAMERA VIEW DENGAN QR HUD   */}
        {/* ======================================================= */}
        <div className="relative w-full h-[60vh] md:h-full bg-black flex items-center justify-center overflow-hidden border-r border-slate-800">
          {/* Mount Point Video HTML5-QRCode (100% Full Height & Width) */}
          <div id="qr-reader" className="absolute inset-0 w-full h-full" />

          {/* Overlay visual: frame + titik mengikuti barcode yang terdeteksi.
              Digitambar di atas video, hilang otomatis setelah kartu discan. */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            aria-hidden="true"
          />

          {/* Petunjuk Ziel frame pemindaian */}
          <div className="absolute bottom-4 right-4 z-20 pointer-events-none flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 rounded-lg border border-slate-700 shadow-lg text-white text-[11px] font-semibold backdrop-blur-sm">
            <Scan className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {multiScanReady
                ? "Multi-scan aktif — beberapa kartu sekaligus terdeteksi"
                : cameraActive
                ? "Arahkan QR / barcode ke kamera"
                : "Kamera nonaktif"}
            </span>
          </div>

          {/* Indikator Verifikasi Server Ringan di Pojok Bawah */}
          {isProcessing && (
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 rounded-lg border border-slate-700 shadow-lg text-white text-xs font-semibold backdrop-blur-sm">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Memproses...</span>
            </div>
          )}

          {/* Pesan Error Akses Kamera */}
          {scannerError && (
            <div className="absolute inset-x-6 top-6 z-30 p-4 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-200 text-xs text-center backdrop-blur-md shadow-2xl space-y-3">
              <p>{scannerError}</p>
              {needsUserGesture && (
                <button
                  onClick={() => setRetryToken((t) => t + 1)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Aktifkan Kamera
                </button>
              )}
            </div>
          )}
        </div>

        {/* ======================================================= */}
        {/* SISI KANAN (50% LAYAR): HASIL SCAN & RIWAYAT SESI INI   */}
        {/* ======================================================= */}
        <div className="w-full h-auto md:h-full bg-slate-900 p-4 lg:p-6 flex flex-col justify-between overflow-visible md:overflow-hidden space-y-4">
          {/* 1. HASIL PEMINDAIAN TERAKHIR (SPOTLIGHT CARD BESAR) */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-400" /> Hasil Pemindaian Terkini
              </span>
              {lastResult && (
                <span className="text-xs font-mono text-slate-400">
                  {lastResult.data?.time} WIB
                </span>
              )}
            </div>

            {!lastResult ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-xl bg-slate-700/60 text-slate-400 flex items-center justify-center border border-slate-600">
                  <Camera className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-200">Menunggu Pemindaian Siswa</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Arahkan QR Code siswa ke kamera sebelah kiri atau ketik NIS pada form manual.
                </p>
              </div>
            ) : lastResult.condition === "BERHASIL" ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-2 border-emerald-500/80 text-white space-y-4 animate-in fade-in zoom-in-95 duration-150 shadow-xl shadow-emerald-950/30">
                {/* Header status bar */}
                <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Presensi Berhasil
                    </span>
                    <span className="text-xs font-semibold text-emerald-300">
                      {mode === "IN" ? "Sesi Masuk" : "Sesi Pulang"}
                    </span>
                  </div>
                  <div>
                    {lastResult.data?.status === "HADIR" ? (
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-black bg-emerald-500 text-white shadow-xs">
                        Tepat Waktu
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-black bg-amber-500 text-white shadow-xs">
                        Terlambat {lastResult.data?.lateMinutes}m
                      </span>
                    )}
                  </div>
                </div>

                {/* Profil Utama: Foto + Nama Lengkap + Kelas + Gender */}
                <div className="flex items-start gap-4">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-400 shrink-0 shadow-lg flex items-center justify-center">
                    {lastResult.data?.photoUrl ? (
                      <img
                        src={lastResult.data.photoUrl}
                        alt={lastResult.data.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-emerald-400 font-black text-2xl">
                        {lastResult.data?.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight truncate">
                      {lastResult.data?.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/40">
                        Kelas {lastResult.data?.class || "-"}
                      </span>
                      {lastResult.data?.gender && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            lastResult.data.gender === "L"
                              ? "bg-blue-900/50 text-blue-200 border-blue-500/40"
                              : "bg-pink-900/50 text-pink-200 border-pink-500/40"
                          }`}
                        >
                          {lastResult.data.gender === "L" ? "Laki-laki (L)" : "Perempuan (P)"}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {lastResult.data?.type || "SISWA"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid Identitas Siswa Lengkap: NIS, NISN, Gender, Waktu Scan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-700/80">
                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/90">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      NIS Siswa
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-white truncate block">
                      {lastResult.data?.nis || "-"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/90">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      NISN Nasional
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-white truncate block">
                      {lastResult.data?.nisn || "-"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/90">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Jenis Kelamin
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white truncate block">
                      {lastResult.data?.gender === "L"
                        ? "Laki-laki"
                        : lastResult.data?.gender === "P"
                        ? "Perempuan"
                        : "-"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700/90">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Waktu Pemindaian
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-300 truncate block">
                      {lastResult.data?.time} WIB
                    </span>
                  </div>
                </div>
              </div>
            ) : lastResult.condition === "SUDAH_TERCATAT" ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-900 border-2 border-amber-500/80 text-white space-y-4 animate-in fade-in duration-150 shadow-xl shadow-amber-950/30">
                <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Sudah Pernah Tercatat
                    </span>
                    <span className="text-xs font-semibold text-amber-200">
                      {mode === "IN" ? "Sesi Masuk Hari Ini" : "Sesi Pulang Hari Ini"}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {lastResult.data?.time ? `${lastResult.data.time} WIB` : ""}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-800 border-2 border-amber-400 shrink-0 shadow-lg flex items-center justify-center">
                    {lastResult.data?.photoUrl ? (
                      <img
                        src={lastResult.data.photoUrl}
                        alt={lastResult.data?.name || "Siswa"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-amber-400 font-black text-xl">
                        {lastResult.data?.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h2 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
                      {lastResult.data?.name || "Siswa Terdaftar"}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {lastResult.data?.class && (
                        <span className="font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">
                          Kelas {lastResult.data.class}
                        </span>
                      )}
                      {lastResult.data?.gender && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            lastResult.data.gender === "L"
                              ? "bg-blue-900/50 text-blue-200 border-blue-500/40"
                              : "bg-pink-900/50 text-pink-200 border-pink-500/40"
                          }`}
                        >
                          {lastResult.data.gender === "L" ? "Laki-laki (L)" : "Perempuan (P)"}
                        </span>
                      )}
                      {lastResult.data?.nis && (
                        <span className="font-mono text-xs text-slate-300">
                          NIS: {lastResult.data.nis}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-100 font-medium">
                  {lastResult.message}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rose-500/15 border-2 border-rose-500 text-rose-200 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300">
                      Presensi Ditolak
                    </span>
                    <h3 className="text-sm font-bold text-white">Kartu Tidak Diterima</h3>
                  </div>
                </div>
                <p className="text-xs text-rose-100 font-medium">{lastResult.message}</p>
              </div>
            )}
          </div>

          {/* 2. RINGKASAN METRIK SESI INI */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Sesi
              </span>
              <span className="text-xl font-black text-blue-400">{countSuccess}</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Tepat Waktu
              </span>
              <span className="text-xl font-black text-emerald-400">{countOnTime}</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Terlambat
              </span>
              <span className="text-xl font-black text-amber-400">{countLate}</span>
            </div>
          </div>

          {/* 3. RIWAYAT SESI INI (LIVE LOG SCROLLABLE) */}
          <div className="flex-1 min-h-[220px] md:min-h-0 flex flex-col p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 overflow-hidden">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700">
              <h4 className="text-xs font-bold flex items-center gap-1.5 text-slate-200">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Riwayat Sesi Ini ({sessionLogs.length})
              </h4>
              {sessionLogs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="text-[11px] text-slate-400 hover:text-rose-400 inline-flex items-center gap-1 transition"
                  title="Hapus riwayat lokal sesi ini"
                >
                  <Trash2 className="w-3 h-3" /> Bersihkan
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sessionLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Belum ada presensi yang di-scan pada sesi ini.
                </div>
              ) : (
                sessionLogs.map((log, idx) => (
                  <div
                    key={`${log.timestamp}-${idx}`}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                      idx === 0
                        ? "bg-slate-700/80 border-blue-500/50"
                        : "bg-slate-800/60 border-slate-700/50"
                    }`}
                  >
                    <div className="truncate mr-3">
                      <div className="font-bold text-white truncate">
                        {log.data?.name || "Kartu Tidak Valid"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {log.data?.class && <span>{log.data.class} • </span>}
                        <span className="font-mono">{log.data?.nis || log.data?.nip || "-"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-400">
                        {log.data?.time || "-"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.condition === "BERHASIL"
                            ? log.data?.status === "HADIR"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : log.condition === "SUDAH_TERCATAT"
                            ? "bg-slate-700 text-slate-300"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {log.condition === "BERHASIL"
                          ? log.data?.status === "HADIR"
                            ? "Tepat Waktu"
                            : "Terlambat"
                          : log.condition === "SUDAH_TERCATAT"
                          ? "Sudah Scan"
                          : "Gagal"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. ALTERNATIF PROPER: INPUT MANUAL NIS / NISN & MODAL PRESENSI LENGKAP */}
          <div className="space-y-2.5 pt-1 border-t border-slate-700/80">
            <form
              onSubmit={handleManualSubmit}
              className="p-3 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-2 shadow-xs"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Search className="w-3.5 h-3.5 text-blue-400" />
                  Input Cepat NIS / NISN
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Tekan Enter untuk memproses
                </span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ketik nomor NIS atau NISN siswa..."
                    className="w-full pl-3 pr-8 py-2 text-xs border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-900 text-white placeholder:text-slate-500 font-mono font-semibold"
                  />
                  {manualInput && (
                    <button
                      type="button"
                      onClick={() => setManualInput("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !manualInput.trim()}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Proses Presensi</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Gunakan bila kartu QR siswa tertinggal atau barcode fisik tidak dapat dibaca kamera.
              </p>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 text-slate-400">
              <span>Kartu tertinggal / kendala scan?</span>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-left text-blue-400 hover:text-blue-300 font-bold hover:underline transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Form Presensi Manual Lengkap (dengan Alasan)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Input Presensi Manual Langsung di Layar Scanner */}
      <ManualAttendanceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        currentUser={currentUser}
        onSuccess={(msg) => {
          if (soundEnabled) {
            playAudioBeepRef.current("success");
          }
        }}
      />
    </div>
  );
}
