"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Settings,
  School,
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building,
  UserCheck,
  CalendarDays,
  GraduationCap,
  Loader2,
  Check,
  X,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  History,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { DEFAULT_WA_TEMPLATES } from "@/lib/whatsapp-templates";

export default function PengaturanPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profil" | "jam" | "libur" | "nilai" | "whatsapp">("profil");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State WhatsApp Gateway & Notifikasi
  const [waEnabled, setWaEnabled] = useState(true);
  const [waNotifyHadir, setWaNotifyHadir] = useState(true);
  const [waNotifyTerlambat, setWaNotifyTerlambat] = useState(true);
  const [waNotifyIzin, setWaNotifyIzin] = useState(true);
  const [waNotifyAlfa, setWaNotifyAlfa] = useState(true);
  const [waTemplateHadir, setWaTemplateHadir] = useState(DEFAULT_WA_TEMPLATES.hadir);
  const [waTemplateTerlambat, setWaTemplateTerlambat] = useState(DEFAULT_WA_TEMPLATES.terlambat);
  const [waTemplateIzin, setWaTemplateIzin] = useState(DEFAULT_WA_TEMPLATES.izin);
  const [waTemplateAlfa, setWaTemplateAlfa] = useState(DEFAULT_WA_TEMPLATES.alfa);
  const [waGatewayType, setWaGatewayType] = useState("BAILEYS");
  const [waApiUrl, setWaApiUrl] = useState("");
  const [waApiKey, setWaApiKey] = useState("");

  // WhatsApp Live Connection State (Staf TU QR Session)
  const [waStatus, setWaStatus] = useState<"disconnected" | "connecting" | "qrcode" | "connected">("disconnected");
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [waUserName, setWaUserName] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<"hadir" | "terlambat" | "izin" | "alfa">("hadir");

  // State Pesan Uji Coba (Test WhatsApp)
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Assalamu'alaikum Wr. Wb. Ini adalah pesan uji coba integrasi WhatsApp dari Sistem Presensi Sekolah.");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form State Profil Sekolah
  const [schoolName, setSchoolName] = useState("");
  const [npsn, setNpsn] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [principalNip, setPrincipalNip] = useState("");

  // Form State Jam Operasional Presensi
  const [checkInStart, setCheckInStart] = useState("06:00");
  const [checkInEnd, setCheckInEnd] = useState("07:15");
  const [checkInTolerance, setCheckInTolerance] = useState("07:30");
  const [checkOutStart, setCheckOutStart] = useState("14:30");
  const [checkOutEnd, setCheckOutEnd] = useState("17:00");
  const [checkOutEnabled, setCheckOutEnabled] = useState(true);
  const [autoAlphaTime, setAutoAlphaTime] = useState("12:00");
  const [activeDays, setActiveDays] = useState<string[]>(["1", "2", "3", "4", "5"]);

  // Form State Ambang Rekap & Nilai Laporan
  const [gradeExcellentMin, setGradeExcellentMin] = useState("95");
  const [gradeGoodMin, setGradeGoodMin] = useState("90");
  const [gradeWarningMin, setGradeWarningMin] = useState("80");
  const [gradeCallParentMin, setGradeCallParentMin] = useState("70");
  const [semesterEligibleMin, setSemesterEligibleMin] = useState("90");

  // Hari Libur
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");
  const [addingHoliday, setAddingHoliday] = useState(false);

  const fetchSettingsAndHolidays = async () => {
    try {
      setLoading(true);
      const [resMe, resSettings, resHolidays] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/settings"),
        fetch("/api/holidays"),
      ]);

      const [dataMe, dataSettings, dataHolidays] = await Promise.all([
        resMe.json(),
        resSettings.json(),
        resHolidays.json(),
      ]);

      if (dataMe.success) setUser(dataMe.user);

      if (dataSettings.success && dataSettings.setting) {
        const s = dataSettings.setting;
        setSchoolName(s.schoolName || "");
        setNpsn(s.npsn || "");
        setAddress(s.address || "");
        setPhone(s.phone || "");
        setEmail(s.email || "");
        setPrincipalName(s.principalName || "");
        setPrincipalNip(s.principalNip || "");
        setCheckInStart(s.checkInStart || "06:00");
        setCheckInEnd(s.checkInEnd || "07:15");
        setCheckInTolerance(s.checkInTolerance || "07:30");
        setCheckOutStart(s.checkOutStart || "14:30");
        setCheckOutEnd(s.checkOutEnd || "17:00");
        setCheckOutEnabled(s.checkOutEnabled !== false);
        setAutoAlphaTime(s.autoAlphaTime || "12:00");
        if (s.activeDays) {
          setActiveDays(s.activeDays.split(","));
        }
        setGradeExcellentMin(String(s.gradeExcellentMin ?? 95));
        setGradeGoodMin(String(s.gradeGoodMin ?? 90));
        setGradeWarningMin(String(s.gradeWarningMin ?? 80));
        setGradeCallParentMin(String(s.gradeCallParentMin ?? 70));
        setSemesterEligibleMin(String(s.semesterEligibleMin ?? 90));

        // Pengaturan WhatsApp
        setWaEnabled(s.waEnabled !== false);
        setWaNotifyHadir(s.waNotifyHadir !== false);
        setWaNotifyTerlambat(s.waNotifyTerlambat !== false);
        setWaNotifyIzin(s.waNotifyIzin !== false);
        setWaNotifyAlfa(s.waNotifyAlfa !== false);
        if (s.waTemplateHadir) setWaTemplateHadir(s.waTemplateHadir);
        if (s.waTemplateTerlambat) setWaTemplateTerlambat(s.waTemplateTerlambat);
        if (s.waTemplateIzin) setWaTemplateIzin(s.waTemplateIzin);
        if (s.waTemplateAlfa) setWaTemplateAlfa(s.waTemplateAlfa);
        if (s.waGatewayType) setWaGatewayType(s.waGatewayType);
        if (s.waApiUrl) setWaApiUrl(s.waApiUrl);
        if (s.waApiKey) setWaApiKey(s.waApiKey);
      }

      if (dataHolidays.success) {
        setHolidays(dataHolidays.holidays || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      if (data.success) {
        setWaStatus(data.status);
        setWaQrCode(data.qrCode);
        setWaPhone(data.phoneNumber);
        setWaUserName(data.userName);
        setWaError(data.error);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettingsAndHolidays();
  }, []);

  useEffect(() => {
    if (activeTab === "whatsapp") {
      fetchWaStatus();
      const interval = setInterval(
        fetchWaStatus,
        waStatus === "connected" ? 6000 : 2000
      );
      return () => clearInterval(interval);
    }
  }, [activeTab, waStatus]);

  const handleConnectWa = async (forceNew = false) => {
    setWaConnecting(true);
    setWaError(null);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew }),
      });
      const data = await res.json();
      if (data.success) {
        setWaStatus(data.status);
        setWaQrCode(data.qrCode);
        setWaPhone(data.phoneNumber);
        setWaUserName(data.userName);
      } else {
        setWaError(data.message || "Gagal menghubungkan WhatsApp.");
      }
    } catch {
      setWaError("Terjadi kesalahan jaringan saat menghubungkan WhatsApp.");
    } finally {
      setWaConnecting(false);
    }
  };

  const handleDisconnectWa = async () => {
    const ok = await confirmDialog({
      title: "Putuskan WhatsApp",
      description: "Putuskan koneksi WhatsApp Staf TU? Anda perlu scan QR ulang jika ingin menghubungkannya kembali.",
      variant: "danger",
      confirmLabel: "Ya, Putuskan",
    });
    if (!ok) return;
    setWaDisconnecting(true);
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setWaStatus("disconnected");
        setWaQrCode(null);
        setWaPhone(null);
        setWaUserName(null);
        setMsg({ type: "success", text: "Koneksi WhatsApp berhasil diputuskan." });
        fetchWaStatus();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal memutuskan WhatsApp." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setWaDisconnecting(false);
    }
  };

  const handleSendTestWa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || !testMessage) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim(), message: testMessage.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: data.message || "Pesan uji coba berhasil terkirim!" });
        fetchWaStatus();
      } else {
        setTestResult({ success: false, message: data.message || "Gagal mengirim pesan uji coba." });
      }
    } catch {
      setTestResult({ success: false, message: "Kesalahan jaringan saat mengirim pesan." });
    } finally {
      setTestSending(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName,
          npsn,
          address,
          phone,
          email,
          principalName,
          principalNip,
          checkInStart,
          checkInEnd,
          checkInTolerance,
          checkOutStart,
          checkOutEnd,
          checkOutEnabled,
          autoAlphaTime,
          activeDays: activeDays.sort().join(","),
          gradeExcellentMin: Number(gradeExcellentMin),
          gradeGoodMin: Number(gradeGoodMin),
          gradeWarningMin: Number(gradeWarningMin),
          gradeCallParentMin: Number(gradeCallParentMin),
          semesterEligibleMin: Number(semesterEligibleMin),
          waEnabled,
          waNotifyHadir,
          waNotifyTerlambat,
          waNotifyIzin,
          waNotifyAlfa,
          waTemplateHadir,
          waTemplateTerlambat,
          waTemplateIzin,
          waTemplateAlfa,
          waGatewayType,
          waApiUrl: waApiUrl.trim() || undefined,
          waApiKey: waApiKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: "Pengaturan berhasil disimpan." });
        // Tampilkan kembali nilai ambang yang sudah dinormalisasi oleh server
        if (data.setting) {
          setGradeExcellentMin(String(data.setting.gradeExcellentMin ?? 95));
          setGradeGoodMin(String(data.setting.gradeGoodMin ?? 90));
          setGradeWarningMin(String(data.setting.gradeWarningMin ?? 80));
          setGradeCallParentMin(String(data.setting.gradeCallParentMin ?? 70));
          setSemesterEligibleMin(String(data.setting.semesterEligibleMin ?? 90));
        }
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menyimpan pengaturan." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan saat menyimpan." });
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayDesc) return;

    setAddingHoliday(true);
    setMsg(null);
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newHolidayDate,
          description: newHolidayDesc,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setNewHolidayDate("");
        setNewHolidayDesc("");
        // Refresh daftar libur
        const resH = await fetch("/api/holidays");
        const dataH = await resH.json();
        if (dataH.success) setHolidays(dataH.holidays);
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menambahkan hari libur." });
      }
    } catch {
      setMsg({ type: "error", text: "Gagal menambahkan hari libur." });
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string, desc: string) => {
    const ok = await confirmDialog({
      title: "Hapus Hari Libur",
      description: `Hapus hari libur "${desc}"?`,
      variant: "danger",
      confirmLabel: "Ya, Hapus",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/holidays?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setHolidays(holidays.filter((h) => h.id !== id));
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menghapus hari libur." });
      }
    } catch {
      setMsg({ type: "error", text: "Gagal menghapus hari libur." });
    }
  };

  const toggleDay = (dayNum: string) => {
    if (activeDays.includes(dayNum)) {
      if (activeDays.length === 1) return; // jangan biarkan kosong
      setActiveDays(activeDays.filter((d) => d !== dayNum));
    } else {
      setActiveDays([...activeDays, dayNum]);
    }
  };

  const dayLabels: { [key: string]: string } = {
    "1": "Senin",
    "2": "Selasa",
    "3": "Rabu",
    "4": "Kamis",
    "5": "Jumat",
    "6": "Sabtu",
    "7": "Minggu",
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat pengaturan sistem...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              Pengaturan Sekolah & Operasional
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Konfigurasi identitas instansi, batas jam masuk, toleransi keterlambatan, dan kalender libur.
            </p>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Simpan Pengaturan
              </>
            )}
          </button>
        </div>

        {/* Notifikasi Message */}
        {msg && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {msg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
            <button
              onClick={() => setMsg(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md ml-2"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigasi */}
        <div className="flex flex-wrap border-b border-slate-200 bg-white px-4 rounded-xl shadow-xs">
          <button
            onClick={() => setActiveTab("profil")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "profil"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" /> Profil Sekolah & Kepala
          </button>
          <button
            onClick={() => setActiveTab("jam")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "jam"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" /> Jam Operasional & Presensi
          </button>
          <button
            onClick={() => setActiveTab("libur")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "libur"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CalendarDays className="w-4 h-4" /> Hari Aktif & Kalender Libur
          </button>
          <button
            onClick={() => setActiveTab("nilai")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "nilai"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Rekap & Ambang Nilai
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "whatsapp"
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Integrasi WhatsApp (Staf TU)</span>
            {waStatus === "connected" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="WhatsApp Terhubung" />
            )}
          </button>
        </div>

        {/* TAB 1: PROFIL SEKOLAH */}
        {activeTab === "profil" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <School className="w-4 h-4 text-blue-600" /> Identitas Instansi Sekolah
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Data ini ditampilkan pada kop surat laporan resmi dan kartu presensi siswa.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Resmi Sekolah:
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Contoh: SMP Negeri 1 Cerdas Bangsa"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPSN (Nomor Pokok Sekolah Nasional):
                </label>
                <input
                  type="text"
                  value={npsn}
                  onChange={(e) => setNpsn(e.target.value)}
                  placeholder="Contoh: 20102030"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Sekolah:
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Pendidikan No. 45, Kecamatan Gambir, Jakarta Pusat"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Telepon Kantor:
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="021-5551234"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Resmi Sekolah:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@smpn1cerdas.sch.id"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <UserCheck className="w-4 h-4 text-blue-600" /> Pejabat Penandatangan Laporan
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Kepala Sekolah (beserta gelar):
                  </label>
                  <input
                    type="text"
                    value={principalName}
                    onChange={(e) => setPrincipalName(e.target.value)}
                    placeholder="Contoh: Dr. H. Bambang, M.Pd."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NIP Kepala Sekolah:
                  </label>
                  <input
                    type="text"
                    value={principalNip}
                    onChange={(e) => setPrincipalNip(e.target.value)}
                    placeholder="Contoh: 197001011995011001"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: JAM KERJA & PRESENSI */}
        {activeTab === "jam" && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Aturan Waktu Pemindaian Presensi
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Waktu server yang menentukan apakah kehadiran siswa/guru tergolong tepat waktu, terlambat, atau tidak sah.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Sesi Masuk (Check-In)</span>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Jam Mulai Dibuka Scan Masuk:
                  </label>
                  <input
                    type="time"
                    value={checkInStart}
                    onChange={(e) => setCheckInStart(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Batas Masuk Tepat Waktu:
                  </label>
                  <input
                    type="time"
                    value={checkInEnd}
                    onChange={(e) => setCheckInEnd(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                <span className="text-xs font-bold text-amber-900 block">Toleransi & Alfa</span>
                <div>
                  <label className="block text-[11px] font-medium text-amber-800 mb-1">
                    Batas Maksimal Toleransi Terlambat:
                  </label>
                  <input
                    type="time"
                    value={checkInTolerance}
                    onChange={(e) => setCheckInTolerance(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    Scan antara batas masuk dan batas toleransi otomatis berstatus <strong>TERLAMBAT</strong>.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-amber-800 mb-1">
                    Waktu Finalisasi Alfa Otomatis:
                  </label>
                  <input
                    type="time"
                    value={autoAlphaTime}
                    onChange={(e) => setAutoAlphaTime(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Sesi Pulang (Check-Out)
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Nonaktifkan bila sekolah tidak mencatat kehadiran pulang.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckOutEnabled((v) => !v)}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition ${
                      checkOutEnabled ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    title={
                      checkOutEnabled
                        ? "Sesi Pulang aktif - klik untuk menonaktifkan"
                        : "Sesi Pulang nonaktif - klik untuk mengaktifkan"
                    }
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        checkOutEnabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div
                  className={`space-y-3 ${checkOutEnabled ? "" : "opacity-40 pointer-events-none"}`}
                >
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Jam Mulai Dibuka Scan Pulang:
                    </label>
                    <input
                      type="time"
                      value={checkOutStart}
                      onChange={(e) => setCheckOutStart(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Batas Akhir Scan Pulang:
                    </label>
                    <input
                      type="time"
                      value={checkOutEnd}
                      onChange={(e) => setCheckOutEnd(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                {!checkOutEnabled && (
                  <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    Sesi Pulang dinonaktifkan. Di halaman scanner, tombol "Pulang" tidak
                    muncul dan scan pulang akan ditolak sistem.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HARI AKTIF & KALENDER LIBUR */}
        {activeTab === "libur" && (
          <div className="space-y-6">
            {/* Hari Aktif Belajar */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" /> Hari Aktif Pembelajaran Sekolah
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tandai hari-hari di mana presensi aktif berlaku bagi seluruh siswa dan guru.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {Object.entries(dayLabels).map(([num, label]) => {
                  const isActive = activeDays.includes(num);
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => toggleDay(num)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        isActive
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{label}</span>
                      {isActive && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kalender Libur Khusus */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-purple-600" /> Daftar Hari Libur Khusus / Nasional
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Pada tanggal libur ini, mesin absensi tidak akan menandai siswa/guru sebagai alfa.
                  </p>
                </div>
              </div>

              {/* Form Tambah Hari Libur */}
              <form
                onSubmit={handleAddHoliday}
                className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="sm:w-48">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tanggal Libur:</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Keterangan Hari Libur:</label>
                  <input
                    type="text"
                    value={newHolidayDesc}
                    onChange={(e) => setNewHolidayDesc(e.target.value)}
                    placeholder="Contoh: Hari Raya Idul Fitri, Libur Semester Ganjil"
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={addingHoliday}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    <Plus className="w-4 h-4" /> Tambah Libur
                  </button>
                </div>
              </form>

              {/* Tabel Daftar Hari Libur */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 w-12 text-center">No</th>
                      <th className="px-4 py-2.5 w-44">Tanggal</th>
                      <th className="px-4 py-2.5">Keterangan</th>
                      <th className="px-4 py-2.5 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          Belum ada tanggal libur khusus yang didaftarkan.
                        </td>
                      </tr>
                    ) : (
                      holidays.map((h, idx) => (
                        <tr key={h.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 text-center text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {new Date(h.date).toLocaleDateString("id-ID", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">{h.description}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => handleDeleteHoliday(h.id, h.description)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>

                {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
                <div className="xl:hidden divide-y divide-slate-100">
                  {holidays.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 text-xs">
                      Belum ada tanggal libur khusus yang didaftarkan.
                    </div>
                  ) : (
                    holidays.map((h, idx) => (
                      <div key={h.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] text-slate-400 font-bold">{idx + 1}.</div>
                            <div className="font-semibold text-slate-800">
                              {new Date(h.date).toLocaleDateString("id-ID", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteHoliday(h.id, h.description)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition shrink-0"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Keterangan</div>
                          <div className="text-slate-700 break-words">{h.description}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REKAP & AMBANG NILAI */}
        {activeTab === "nilai" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" /> Ambang Rekomendasi
                  Laporan Bulanan
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Persentase kehadiran dihitung dari jumlah hari efektif (hari belajar aktif
                  dikurangi hari libur). Siswa yang tidak tercatat pada hari efektif dihitung
                  sebagai Alfa. Status keterlambatan dihitung sebagai Hadir.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Batas Bawah "Sangat Baik" (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeExcellentMin}
                    onChange={(e) => setGradeExcellentMin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-semibold border border-emerald-300 rounded-lg focus:outline-none"
                  />
                  <p className="text-[10px] text-emerald-700 mt-1.5">
                    ≥ nilai ini berstatus <strong>Sangat Baik</strong>.
                  </p>
                </div>

                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Batas Bawah "Baik" (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeGoodMin}
                    onChange={(e) => setGradeGoodMin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-semibold border border-blue-300 rounded-lg focus:outline-none"
                  />
                  <p className="text-[10px] text-blue-700 mt-1.5">
                    ≥ nilai ini berstatus <strong>Baik</strong> (di bawahnya masuk
                    teguran).
                  </p>
                </div>

                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Batas Bawah "Teguran Lisan Wali Kelas" (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeWarningMin}
                    onChange={(e) => setGradeWarningMin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-semibold border border-amber-300 rounded-lg focus:outline-none"
                  />
                  <p className="text-[10px] text-amber-700 mt-1.5">
                    ≥ nilai ini berstatus <strong>Teguran Lisan Wali Kelas</strong>.
                  </p>
                </div>

                <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200">
                  <label className="block text-xs font-bold text-rose-900 mb-1">
                    Batas Bawah "Peringatan / Panggil Orang Tua" (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={gradeCallParentMin}
                    onChange={(e) => setGradeCallParentMin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-semibold border border-rose-300 rounded-lg focus:outline-none"
                  />
                  <p className="text-[10px] text-rose-700 mt-1.5">
                    Di bawah nilai ini berstatus <strong>Tindakan Khusus</strong> (konfirmasi
                    wali kelas).
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ambang Kelayakan Ujian
                  Akhir Semester
                </h2>
                <div className="max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Persentase Minimum untuk Dinyatakan "Layak" (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={semesterEligibleMin}
                    onChange={(e) => setSemesterEligibleMin(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-semibold border border-slate-300 rounded-lg focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Siswa dengan persentase akumulasi ≥ nilai ini dinyatakan <strong>Layak</strong>{" "}
                    mengikuti ujian; di bawahnya <strong>Tidak Layak (Butuh Tugas Sanksi)</strong>.
                    Rekap ini dilampirkan pada rapor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: INTEGRASI WHATSAPP & PEMBERITAHUAN ORANG TUA */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6">
            {/* 1. KARTU SESI KONEKSI WHATSAPP STAF TU */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    Koneksi WhatsApp Staf Tata Usaha (Pengirim Notifikasi)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Hubungkan akun WhatsApp resmi sekolah agar sistem dapat mengirim notifikasi presensi langsung ke nomor orang tua siswa.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {waStatus === "connected" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      TERHUBUNG
                    </span>
                  )}
                  {waStatus !== "connected" && Boolean(waQrCode) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                      MENUNGGU SCAN
                    </span>
                  )}
                  {waStatus === "connecting" && !waQrCode && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                      MENGHUBUNGKAN...
                    </span>
                  )}
                  {waStatus === "disconnected" && !waQrCode && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      TERPUTUS
                    </span>
                  )}
                </div>
              </div>

              {/* TAMPILAN SESUAI STATUS KONEKSI */}
              {waStatus === "connected" ? (
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>WhatsApp Aktif</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      </div>
                      <div className="text-xs text-slate-700 font-mono mt-0.5">
                        Nomor HP: <strong className="text-emerald-950 font-bold">+{waPhone || "-"}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Nama Akun: {waUserName || "Staf Tata Usaha"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConnectWa(true)}
                      disabled={waConnecting}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-emerald-300 bg-white hover:bg-emerald-100/50 text-emerald-800 transition shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
                      Perbarui Sesi
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectWa}
                      disabled={waDisconnecting}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition shadow-2xs"
                    >
                      {waDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />}
                      Putuskan Koneksi
                    </button>
                  </div>
                </div>
              ) : waQrCode ? (
                <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/90 text-center space-y-4">
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="font-bold text-slate-900 text-sm">Pindai QR Code Menggunakan WhatsApp di HP</h3>
                    <p className="text-xs text-slate-600">
                      Gunakan WhatsApp di HP Staf TU atau HP Sekolah untuk memindai kode QR di bawah ini:
                    </p>
                  </div>

                  <div className="inline-block p-3 bg-white rounded-2xl border border-slate-300 shadow-md">
                    <img
                      src={waQrCode}
                      alt="WhatsApp Web QR Code"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl mx-auto"
                    />
                  </div>

                  {/* Panduan Langkah */}
                  <div className="max-w-md mx-auto bg-white/90 p-3.5 rounded-xl border border-amber-200 text-left text-xs text-slate-700 space-y-1.5 shadow-2xs">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <QrCode className="w-3.5 h-3.5 text-amber-600" />
                      Langkah Pemindaian:
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 text-xs">
                      <li>Buka aplikasi <strong>WhatsApp</strong> di HP Anda</li>
                      <li>Ketuk ikon <strong>Menu (⋮)</strong> (Android) atau <strong>Pengaturan</strong> (iPhone)</li>
                      <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong></li>
                      <li>Ketuk tombol <strong>Tautkan Perangkat</strong> dan arahkan kamera HP ke QR di atas</li>
                    </ol>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleConnectWa(true)}
                      disabled={waConnecting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${waConnecting ? "animate-spin" : ""}`} />
                      <span>Muat Ulang QR Baru</span>
                    </button>
                  </div>
                </div>
              ) : waStatus === "connecting" ? (
                <div className="p-8 rounded-2xl bg-blue-50/60 border border-blue-200 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <h3 className="font-bold text-slate-900 text-sm">Menghubungkan Sesi WhatsApp...</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Sedang memproses penautan dan menyinkronkan status dengan perangkat HP Anda. Mohon tunggu beberapa detik...
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="font-bold text-slate-900 text-sm">WhatsApp Belum Terhubung</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Klik tombol di bawah ini untuk menampilkan QR Code dan menautkan WhatsApp Staf Tata Usaha sekolah.
                    </p>
                  </div>

                  {waError && (
                    <div className="max-w-md mx-auto p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-left">
                      {waError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleConnectWa(false)}
                    disabled={waConnecting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition disabled:opacity-50"
                  >
                    {waConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Menyiapkan QR...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" /> Hubungkan WhatsApp (Scan QR)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 2. PENGATURAN PEMICU NOTIFIKASI KEHADIRAN */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Kondisi Pemicu Notifikasi Presensi
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tentukan peristiwa presensi apa saja yang akan otomatis mengirimkan pesan WhatsApp ke nomor HP orang tua/wali siswa.
                </p>
              </div>

              {/* Master Toggle */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">Aktifkan Notifikasi WhatsApp (Global)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Jika dinonaktifkan, semua pengiriman pesan otomatis ke orang tua akan dihentikan sementara.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waEnabled}
                    onChange={(e) => setWaEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Pemicu Per Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={waNotifyHadir}
                    onChange={(e) => setWaNotifyHadir(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Siswa Hadir Tepat Waktu</span>
                    <span className="text-[11px] text-slate-500">Kirim notifikasi saat siswa memindai QR sebelum batas waktu.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={waNotifyTerlambat}
                    onChange={(e) => setWaNotifyTerlambat(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Siswa Terlambat Masuk</span>
                    <span className="text-[11px] text-slate-500">Kirim notifikasi beserta rincian jumlah menit keterlambatan siswa.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={waNotifyIzin}
                    onChange={(e) => setWaNotifyIzin(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Siswa Izin atau Sakit</span>
                    <span className="text-[11px] text-slate-500">Kirim konfirmasi saat izin/sakit siswa tercatat di sistem presensi.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={waNotifyAlfa}
                    onChange={(e) => setWaNotifyAlfa(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Siswa Alfa (Tidak Hadir)</span>
                    <span className="text-[11px] text-slate-500">Pemberitahuan penting kepada orang tua saat siswa tidak hadir tanpa keterangan.</span>
                  </div>
                </label>
              </div>

              {/* Pilihan Tipe Gateway */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-700">Metode Pengiriman WhatsApp</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${waGatewayType === "BAILEYS" ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="waGatewayType"
                      value="BAILEYS"
                      checked={waGatewayType === "BAILEYS"}
                      onChange={() => setWaGatewayType("BAILEYS")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">WhatsApp Web Langsung (Scan QR)</div>
                      <div className="text-[10px] text-slate-500">Gratis & terhubung langsung via nomor WhatsApp HP Staf TU.</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${waGatewayType === "GENERIC_API" ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="waGatewayType"
                      value="GENERIC_API"
                      checked={waGatewayType === "GENERIC_API"}
                      onChange={() => setWaGatewayType("GENERIC_API")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">API Gateway Eksternal (Fonnte / Wablas)</div>
                      <div className="text-[10px] text-slate-500">Menggunakan webhook / API token pihak ketiga.</div>
                    </div>
                  </label>
                </div>

                {waGatewayType === "GENERIC_API" && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">API URL Gateway (Endpoint POST)</label>
                      <input
                        type="url"
                        value={waApiUrl}
                        onChange={(e) => setWaApiUrl(e.target.value)}
                        placeholder="Contoh: https://api.fonnte.com/send"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">API Key / Token Authorization</label>
                      <input
                        type="text"
                        value={waApiKey}
                        onChange={(e) => setWaApiKey(e.target.value)}
                        placeholder="Masukkan API Token atau Bearer Key"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. KUSTOMISASI TEMPLATE PESAN WHATSAPP */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    Kustomisasi Template Pesan WhatsApp
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesuaikan redaksi kata-kata pesan untuk masing-masing status kehadiran.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: "Reset Template",
                      description: "Reset template pesan ke format standar default?",
                      variant: "warning",
                      confirmLabel: "Ya, Reset",
                    });
                    if (ok) {
                      if (activeTemplateTab === "hadir") setWaTemplateHadir(DEFAULT_WA_TEMPLATES.hadir);
                      if (activeTemplateTab === "terlambat") setWaTemplateTerlambat(DEFAULT_WA_TEMPLATES.terlambat);
                      if (activeTemplateTab === "izin") setWaTemplateIzin(DEFAULT_WA_TEMPLATES.izin);
                      if (activeTemplateTab === "alfa") setWaTemplateAlfa(DEFAULT_WA_TEMPLATES.alfa);
                    }
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
                >
                  Reset Template Ini ke Standar
                </button>
              </div>

              {/* Sub-tab template */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
                {(["hadir", "terlambat", "izin", "alfa"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTemplateTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      activeTemplateTab === tab
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Template {tab}
                  </button>
                ))}
              </div>

              {/* Textarea Template */}
              <div>
                <textarea
                  rows={8}
                  value={
                    activeTemplateTab === "hadir"
                      ? waTemplateHadir
                      : activeTemplateTab === "terlambat"
                      ? waTemplateTerlambat
                      : activeTemplateTab === "izin"
                      ? waTemplateIzin
                      : waTemplateAlfa
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (activeTemplateTab === "hadir") setWaTemplateHadir(v);
                    if (activeTemplateTab === "terlambat") setWaTemplateTerlambat(v);
                    if (activeTemplateTab === "izin") setWaTemplateIzin(v);
                    if (activeTemplateTab === "alfa") setWaTemplateAlfa(v);
                  }}
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
                />
              </div>

              {/* Variabel yang Tersedia */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider">
                  Variabel Dinamis yang Dapat Digunakan:
                </span>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{nama_siswa}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{nama_ortu}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{kelas}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{status}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{jam}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{tanggal}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{sekolah}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{menit_terlambat}"}</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-300 rounded text-blue-700">{"{alasan}"}</span>
                </div>
              </div>
            </div>

            {/* 4. KIRIM PESAN UJI COBA (TEST WHATSAPP) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  Kirim Pesan Uji Coba (Test WhatsApp)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Kirimkan pesan uji coba ke nomor WhatsApp Anda sendiri untuk memastikan koneksi pengiriman berjalan lancar.
                </p>
              </div>

              <form onSubmit={handleSendTestWa} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor WhatsApp Tujuan <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Isi Pesan Uji Coba <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                      testResult.success
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={testSending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50"
                  >
                    {testSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengirim...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Kirim Pesan Uji Coba
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>


          </div>
        )}
      </div>
    </AppShell>
  );
}
