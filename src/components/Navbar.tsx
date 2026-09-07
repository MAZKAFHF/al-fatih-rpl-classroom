"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./ui";

type User = { id: string; name: string; role: string; username: string } | null;

export function Navbar({ user, onLogout }: { user: User; onLogout: () => void }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = !user
    ? [
        { href: "/", label: "Beranda" },
        { href: "/join", label: "Join Kelas" },
        { href: "/login", label: "Login" },
      ]
    : user.role === "ADMIN"
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/admin/users", label: "Pengguna" },
        { href: "/dashboard?tab=classrooms", label: "Kelas" },
        { href: "/admin/settings", label: "Pengaturan" },
      ]
    : user.role === "TEACHER"
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/dashboard?tab=classrooms", label: "Kelas Saya" },
        { href: "/dashboard?tab=materials", label: "Materi" },
      ]
    : [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/join", label: "Join Kelas" },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white font-bold text-[13px] tracking-tight">
            RPL
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="font-semibold text-[14px] tracking-tight text-[var(--foreground)]">AL-FATIH RPL</div>
            <div className="text-[11px] tracking-widest font-semibold text-[var(--muted)] -mt-0.5">CLASSROOM</div>
          </div>
          <div className="sm:hidden font-semibold text-[14px]">AL-FATIH</div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href.split("?")[0]));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition ${
                  active ? "bg-[var(--primary)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <div className="hidden sm:flex flex-col items-end leading-none mr-1">
                <span className="text-[13px] font-semibold text-[var(--foreground)]">{user.name}</span>
                <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wide">{user.role}</span>
              </div>
              <div className="hidden sm:block h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[12px] font-semibold text-[var(--muted)]">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={onLogout}>
                Keluar
              </Button>
            </>
          ) : (
            <Link href="/login" className="hidden sm:inline-flex">
              <Button size="sm">Masuk</Button>
            </Link>
          )}

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden h-9 w-9 grid place-items-center rounded-xl border border-[var(--border)] bg-white"
            aria-label="Menu"
          >
            <span className="flex flex-col gap-1">
              <span className={`block h-0.5 w-4 bg-[var(--foreground)] transition ${mobileOpen ? "rotate-45 translate-y-1" : ""}`} />
              <span className={`block h-0.5 w-4 bg-[var(--foreground)] transition ${mobileOpen ? "-rotate-45 -translate-y-1" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-white px-4 py-4 space-y-3">
          <nav className="grid gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`px-3 py-2.5 rounded-xl text-[14px] font-medium ${pathname === l.href ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-2)] text-[var(--foreground)]"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold">{user.name}</div>
                <div className="text-[12px] text-[var(--muted)]">{user.role}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Keluar
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
