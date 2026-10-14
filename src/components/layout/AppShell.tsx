"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Users,
  GraduationCap,
  School,
  ClipboardList,
  FileText,
  CalendarCheck,
  Calendar,
  Settings,
  ShieldCheck,
  History,
  LogOut,
  Menu,
  X,
  Camera,
  Bell,
  TrendingUp,
  FileSpreadsheet,
  Clock,
  ChevronDown,
  User,
  FolderTree,
  DatabaseBackup,
} from "lucide-react";

interface AppShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "SUPERADMIN" | "ADMIN" | "GURU";
    avatarUrl?: string | null;
    teacherId?: string | null;
  };
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: ("SUPERADMIN" | "ADMIN" | "GURU")[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [timeStr, setTimeStr] = useState<string>("");
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  const sidebarRef = useRef<HTMLElement>(null);

  // Notifikasi pengajuan izin menunggu verifikasi (badge navbar desktop & tombol mobile)
  useEffect(() => {
    let active = true;
    const loadPending = () => {
      fetch("/api/leave-requests?status=PENDING&perPage=1")
        .then((res) => res.json())
        .then((data) => {
          if (active && data?.success) setPendingLeaveCount(Number(data.total) || 0);
        })
        .catch(() => {});
    };
    loadPending();
    const interval = setInterval(loadPending, 30000);
    const onFocus = () => loadPending();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  // Ambil nama sekolah dari database
  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.success && data.setting?.schoolName) {
          setSchoolName(data.setting.schoolName);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  // Jam digital live di header (zona WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Tutup menu mobile dengan tombol Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Kunci scroll saat drawer mobile terbuka
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
    }
  };

  // Navigasi Utama Standalone (Tanpa Dropdown)
  const primaryStandaloneItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["SUPERADMIN", "ADMIN", "GURU"],
    },
    {
      label: "Scanner QR",
      href: "/scanner",
      icon: Camera,
      roles: ["SUPERADMIN", "ADMIN", "GURU"],
    },
  ];

  // Kelompok Navigasi dengan Dropdown Kolapsibel
  const navDropdownGroups: NavGroup[] = [
    {
      id: "presensi",
      label: "Presensi & Laporan",
      icon: ClipboardList,
      items: [
        {
          label: "Data Presensi",
          href: "/presensi",
          icon: ClipboardList,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
        {
          label: "Laporan Resmi",
          href: "/laporan",
          icon: FileText,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
        {
          label: "Pengajuan Izin",
          href: "/pengajuan-izin",
          icon: CalendarCheck,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
      ],
    },
    {
      id: "master",
      label: "Master Data",
      icon: Users,
      items: [
        {
          label: "Data Siswa",
          href: "/siswa",
          icon: Users,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
        {
          label: "Data Guru",
          href: "/guru",
          icon: GraduationCap,
          roles: ["SUPERADMIN", "ADMIN"],
        },
        {
          label: "Data Kelas",
          href: "/kelas",
          icon: School,
          roles: ["SUPERADMIN", "ADMIN"],
        },
        {
          label: "Kartu QR Siswa",
          href: "/qr-code",
          icon: QrCode,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
        {
          label: "Impor Data CSV",
          href: "/impor",
          icon: FileSpreadsheet,
          roles: ["SUPERADMIN", "ADMIN"],
        },
      ],
    },
    {
      id: "akademik",
      label: "Akademik & Periode",
      icon: GraduationCap,
      items: [
        {
          label: "Periode Semester",
          href: "/semester",
          icon: Calendar,
          roles: ["SUPERADMIN", "ADMIN"],
        },
        {
          label: "Kenaikan Kelas",
          href: "/kenaikan-kelas",
          icon: TrendingUp,
          roles: ["SUPERADMIN", "ADMIN"],
        },
      ],
    },
    {
      id: "sistem",
      label: "Sistem & Pengaturan",
      icon: Settings,
      items: [
        {
          label: "Pengaturan Sekolah",
          href: "/pengaturan",
          icon: Settings,
          roles: ["SUPERADMIN", "ADMIN"],
        },
        {
          label: "Pengguna & Hak Akses",
          href: "/pengguna",
          icon: ShieldCheck,
          roles: ["SUPERADMIN"],
        },
        {
          label: "Audit Log Aktivitas",
          href: "/audit-log",
          icon: History,
          roles: ["SUPERADMIN"],
        },
        {
          label: "Backup & Restore",
          href: "/backup",
          icon: DatabaseBackup,
          roles: ["SUPERADMIN"],
        },
        {
          label: "Profil Akun Saya",
          href: "/profil",
          icon: User,
          roles: ["SUPERADMIN", "ADMIN", "GURU"],
        },
      ],
    },
  ];

  // Helper untuk menentukan apakah rute aktif berada di dalam grup tertentu
  const isGroupActive = (group: NavGroup) => {
    return group.items.some(
      (item) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
    );
  };

  // State untuk status buka/tutup tiap dropdown grup
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navDropdownGroups.forEach((group) => {
      initial[group.id] = isGroupActive(group);
    });
    return initial;
  });

  // Otomatis buka dropdown jika user berpindah ke rute di dalam grup tersebut
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      navDropdownGroups.forEach((group) => {
        if (isGroupActive(group) && !next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const roleBadgeText = {
    SUPERADMIN: "Superadmin",
    ADMIN: "Admin TU",
    GURU: "Guru / Piket",
  }[user.role];

  // Cari judul halaman aktif untuk breadcrumb header
  let activePageTitle = "Dashboard";
  for (const item of primaryStandaloneItems) {
    if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
      activePageTitle = item.label;
      break;
    }
  }
  for (const group of navDropdownGroups) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))) {
        activePageTitle = item.label;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen md:h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden text-slate-900">
      {/* Mobile Topbar */}
      <header className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 border-b border-slate-800 z-30 sticky top-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-tut-wuri-handayani.png"
            alt="Logo Tut Wuri Handayani"
            className="w-8 h-8 object-contain shrink-0"
          />
          <div>
            <span className="font-bold text-sm block leading-tight">Absensi Sekolah</span>
            <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
              {schoolName || "Sistem Presensi"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="p-2 -mr-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigasi (Desktop & Mobile Drawer) */}
      <aside
        ref={sidebarRef}
        aria-label="Navigasi Utama Sistem"
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-tut-wuri-handayani.png"
              alt="Logo Tut Wuri Handayani"
              className="w-9 h-9 object-contain shrink-0 drop-shadow"
            />
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm tracking-wide leading-tight truncate">
                ABSENSI SEKOLAH
              </h1>
              <p className="text-[11px] text-blue-400 font-medium truncate">
                {schoolName || "Sistem QR Code"}
              </p>
            </div>
          </div>
          {/* Tombol tutup pada mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Tutup menu"
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profil Akun Masuk */}
        <Link
          href="/profil"
          onClick={() => setMobileMenuOpen(false)}
          title="Buka profil saya"
          className="px-3 py-3 mx-3 my-2.5 bg-slate-800/60 hover:bg-slate-800/95 rounded-xl border border-slate-700/60 flex items-center gap-3 flex-shrink-0 transition cursor-pointer group"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover border border-blue-400 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
              <User className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate leading-snug group-hover:text-blue-300 transition">
              {user.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                {roleBadgeText}
              </span>
            </div>
          </div>
        </Link>

        {/* Daftar Navigasi: Menu Utama Standalone + Dropdown Groups */}
        <nav className="flex-1 min-h-0 px-3 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {/* 1. Menu Utama Standalone (Dashboard & Scanner QR) */}
          <div className="space-y-1">
            {primaryStandaloneItems
              .filter((item) => item.roles.includes(user.role))
              .map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[42px] ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-800/80 text-slate-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <span className="truncate">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
          </div>

          {/* Garis Pemisah Tipis */}
          <div className="pt-2 pb-1">
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Menu Kelompok
            </div>
          </div>

          {/* 2. Navigasi Dropdown Kolapsibel */}
          <div className="space-y-1">
            {navDropdownGroups.map((group) => {
              const visibleItems = group.items.filter((item) =>
                item.roles.includes(user.role)
              );
              if (visibleItems.length === 0) return null;

              const isOpen = Boolean(openGroups[group.id]);
              const groupActive = isGroupActive(group);
              const GroupIcon = group.icon;

              return (
                <div key={group.id} className="rounded-xl overflow-hidden">
                  {/* Header Tombol Dropdown */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[42px] select-none ${
                      groupActive && !isOpen
                        ? "bg-slate-800/90 text-white border border-blue-500/30"
                        : isOpen
                        ? "bg-slate-800/60 text-white"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          groupActive
                            ? "bg-blue-600/30 text-blue-400 border border-blue-500/40"
                            : "bg-slate-800/80 text-slate-400"
                        }`}
                      >
                        <GroupIcon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <span className="truncate">{group.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {groupActive && !isOpen && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-slate-200" : "rotate-0"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {/* Isi Submenu Dropdown */}
                  {isOpen && (
                    <div className="mt-1 ml-4 pl-3.5 border-l-2 border-slate-800 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {visibleItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-h-[38px] ${
                              isActive
                                ? "bg-blue-600 text-white font-semibold shadow-xs"
                                : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                            }`}
                          >
                            <ItemIcon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? "text-white" : "text-slate-500"
                              }`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Tombol Logout Terkunci di Bawah */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/95 flex-shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-900/50 rounded-xl transition min-h-[42px] disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 text-rose-400" aria-hidden="true" />
            <span>{loggingOut ? "Mengakhiri Sesi..." : "Keluar (Logout)"}</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama Aplikasi */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Desktop Sticky */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 hidden md:flex items-center justify-between flex-shrink-0 sticky top-0 z-20 shadow-2xs">
          {/* Breadcrumbs & Judul Halaman */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sistem Presensi
            </span>
            <span className="text-slate-300 text-sm">/</span>
            <span className="text-sm font-bold text-slate-800">
              {activePageTitle}
            </span>
          </div>

          {/* Jam WIB, Info Sekolah & Scanner Shortcut */}
          <div className="flex items-center gap-4 text-xs">
            {timeStr && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>{timeStr} WIB</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
              <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                {schoolName || "Memuat..."}
              </span>
            </div>

            <Link
              href="/scanner"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold shadow-xs hover:bg-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Camera className="w-3.5 h-3.5 text-blue-100" aria-hidden="true" />
              <span>Buka Scanner QR</span>
            </Link>

            <Link
              href="/pengajuan-izin"
              className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
              title={
                pendingLeaveCount > 0
                  ? `${pendingLeaveCount} pengajuan izin menunggu verifikasi`
                  : "Pengajuan Izin"
              }
              aria-label={
                pendingLeaveCount > 0
                  ? `${pendingLeaveCount} pengajuan izin menunggu verifikasi`
                  : "Pengajuan Izin"
              }
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {pendingLeaveCount > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="absolute -bottom-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                    {pendingLeaveCount > 99 ? "99+" : pendingLeaveCount}
                  </span>
                </>
              )}
            </Link>

            <Link
              href="/profil"
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition"
              title="Profil Pengguna"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-5 h-5 rounded-full object-cover border border-blue-500"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-semibold max-w-[110px] truncate hidden xl:inline">{user.name}</span>
            </Link>
          </div>
        </header>

        {/* Wrapper Halaman Konten */}
        <div className="p-4 md:p-6 lg:p-8 flex-1">{children}</div>
      </main>

      {/* Badge notifikasi pengajuan izin (mobile, kanan bawah) */}
      {pendingLeaveCount > 0 && !mobileMenuOpen && (
        <Link
          href="/pengajuan-izin"
          className="md:hidden fixed bottom-5 right-5 z-40 flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 active:scale-95 transition"
          aria-label={`${pendingLeaveCount} pengajuan izin menunggu verifikasi`}
        >
          <span className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-white/50" />
            <Bell className="relative w-5 h-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-semibold text-red-100">Pengajuan Izin</span>
            <span className="text-sm font-bold">
              {pendingLeaveCount > 99 ? "99+" : pendingLeaveCount} menunggu
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
