// Mengaktifkan mode act() React agar efek & state flush dengan benar
// saat menguji komponen/hook React di lingkungan jsdom.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
