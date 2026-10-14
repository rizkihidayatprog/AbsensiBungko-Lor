"use client";

import { useEffect, useState, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  User,
  Camera,
  Save,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Upload,
  RefreshCw,
  School,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { compressAvatar, formatFileSize } from "@/lib/image-compress";

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [loading, setLoading] = useState(true);

  // Form profil dasar
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Foto profil
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ original: number; compressed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ganti password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setName(data.user.name || "");
        setEmail(data.user.email || "");
        setUsername(data.user.username || "");
        setAvatarUrl(data.user.avatarUrl || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Upload & Kompresi Foto Profil
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setProfileError(null);
    setProfileSuccess(null);
    setCompressing(true);

    try {
      // 1. Kompres dan resize otomatis di sisi klien (320x320 px JPEG)
      const compressed = await compressAvatar(file, 320, 0.78);
      setUploadStats({
        original: compressed.originalSize,
        compressed: compressed.compressedSize,
      });

      // 2. Upload file ringan ke server
      const formData = new FormData();
      formData.append("file", compressed.blob, compressed.fileName);
      formData.append("type", "user");

      const uploadRes = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        setProfileError(uploadData.message || "Gagal mengunggah foto.");
        setCompressing(false);
        return;
      }

      const newAvatarUrl = uploadData.url;

      // 3. Simpan URL foto ke profil akun
      const updateRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newAvatarUrl }),
      });
      const updateData = await updateRes.json();

      if (!updateRes.ok || !updateData.success) {
        setProfileError(updateData.message || "Gagal memperbarui foto profil.");
        setCompressing(false);
        return;
      }

      setAvatarUrl(newAvatarUrl);
      setUser((prev: any) => ({ ...prev, avatarUrl: newAvatarUrl }));
      setProfileSuccess(
        `Foto profil berhasil diperbarui! Gambar di-resize dari ${formatFileSize(
          compressed.originalSize
        )} menjadi ${formatFileSize(compressed.compressedSize)} (hemat ${(
          (1 - compressed.compressedSize / compressed.originalSize) *
          100
        ).toFixed(0)}%).`
      );
    } catch (err: any) {
      setProfileError(err?.message || "Terjadi kesalahan saat memproses foto.");
    } finally {
      setCompressing(false);
    }
  };

  const handleRemovePhoto = async () => {
    const ok = await confirmDialog({
      title: "Hapus Foto Profil",
      description: "Hapus foto profil akun Anda?",
      variant: "danger",
      confirmLabel: "Ya, Hapus",
    });
    if (!ok) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      const data = await res.json();
      if (data.success) {
        setAvatarUrl(null);
        setUser((prev: any) => ({ ...prev, avatarUrl: null }));
        setUploadStats(null);
        setProfileSuccess("Foto profil berhasil dihapus.");
      }
    } catch {
      setProfileError("Gagal menghapus foto profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          username: username.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setProfileError(data.message || "Gagal memperbarui profil.");
        setSavingProfile(false);
        return;
      }

      setUser((prev: any) => ({
        ...prev,
        name: data.user.name,
        email: data.user.email,
        username: data.user.username,
      }));
      setProfileSuccess("Informasi profil berhasil disimpan.");
    } catch {
      setProfileError("Terjadi kesalahan jaringan.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordError(data.message || "Gagal mengganti password.");
        setSavingPassword(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Kata sandi berhasil diperbarui dengan aman.");
    } catch {
      setPasswordError("Terjadi kesalahan jaringan.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Memuat profil pengguna...
      </div>
    );
  }

  const roleBadgeLabel =
    user.role === "SUPERADMIN"
      ? "Super Administrator"
      : user.role === "ADMIN"
      ? "Administrator Sekolah"
      : "Guru / Wali Kelas";

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Profil */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-bold text-2xl flex items-center justify-center shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {user.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {roleBadgeLabel}
                </span>
                {user.teacher?.homeroomClass && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    <School className="w-3 h-3 text-slate-500" />
                    Wali Kelas {user.teacher.homeroomClass.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notifikasi Status Profil */}
        {profileSuccess && (
          <div role="alert" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5 animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{profileError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sisi Kiri: Manajemen Foto Profil (Dioptimasi & Dikompresi) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 text-center flex flex-col items-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 self-start">
              Foto Profil Akun
            </h2>

            <div className="relative my-2">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-blue-100 shadow-md mx-auto"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center mx-auto">
                  <User className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-[10px] font-medium mt-1">Belum ada foto</span>
                </div>
              )}

              {compressing && (
                <div className="absolute inset-0 bg-slate-900/60 rounded-full flex flex-col items-center justify-center text-white text-[11px] font-semibold backdrop-blur-2xs">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400 mb-1" />
                  <span>Kompresi...</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            <div className="w-full space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition min-h-[42px] cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Ganti Foto Profil</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={savingProfile || compressing}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition min-h-[38px] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Foto</span>
                </button>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Form Biodata & Ganti Password */}
          <div className="md:col-span-2 space-y-6">
            {/* Form Informasi Biodata */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                Informasi Akun
              </h2>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Nama Lengkap <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="profile-email" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Alamat Email <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-username" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Username (Untuk Login)
                    </label>
                    <input
                      id="profile-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username opsional"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-mono shadow-2xs min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition min-h-[42px] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingProfile ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Form Ganti Kata Sandi */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-600" />
                Keamanan & Ganti Kata Sandi
              </h2>

              {passwordSuccess && (
                <div role="alert" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label htmlFor="current-pw" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Kata Sandi Lama <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="current-pw"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi saat ini"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="new-pw" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Kata Sandi Baru <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      id="new-pw"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 karakter, kombinasi huruf & angka"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirm-pw" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Konfirmasi Kata Sandi Baru <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <input
                      id="confirm-pw"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPassword || !currentPassword || !newPassword}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition min-h-[42px] cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{savingPassword ? "Memperbarui..." : "Perbarui Kata Sandi"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
