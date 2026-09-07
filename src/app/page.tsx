"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Badge } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, logout } = useAuth();
  const [network, setNetwork] = useState<{ primaryIp: string | null; urls: any[] } | null>(null);

  useEffect(() => {
    fetch("/api/network")
      .then((r) => r.json())
      .then(setNetwork)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user as any} onLogout={logout} />
      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[12px] font-semibold text-[#065f46]">
                <span className="h-2 w-2 rounded-full bg-[#059669] animate-pulse" />
                100% LOKAL • TANPA INTERNET
              </div>
              <h1 className="mt-5 text-[32px] sm:text-[42px] font-bold tracking-tight leading-[1.05] text-[var(--foreground)]">
                Kelas RPL
                <br />
                <span className="text-[var(--muted)] font-medium">tanpa ribet internet.</span>
              </h1>
              <p className="mt-4 text-[15px] leading-6 text-[var(--muted)] max-w-[560px]">
                Guru buat hotspot, server laptop jalan, murid buka browser — langsung screen sharing via WebRTC. Tidak perlu proyektor, tidak perlu Discord, tidak perlu internet.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg">Buka Dashboard →</Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/join">
                      <Button size="lg">Join Kelas →</Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="secondary" size="lg">
                        Login Guru
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-[12px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> Screen sharing asli
                </span>
                <span>•</span>
                <span>Chat realtime</span>
                <span>•</span>
                <span>Materi lokal</span>
                <span>•</span>
                <span>Angkat tangan</span>
              </div>
            </div>

            {/* Network card */}
            <Card className="p-0 overflow-hidden border-[var(--border)]">
              <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold tracking-widest text-[var(--muted)]">LOCAL SERVER STATUS</div>
                  <div className="text-[13px] font-medium">Jaringan kelas</div>
                </div>
                <Badge variant="success">● LOCAL ONLY</Badge>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] py-3">
                    <div className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">SERVER</div>
                    <div className="text-[13px] font-semibold text-[var(--success)]">● RUNNING</div>
                  </div>
                  <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] py-3">
                    <div className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">SIGNALING</div>
                    <div className="text-[13px] font-semibold text-[var(--success)]">● READY</div>
                  </div>
                  <div className="rounded-xl bg-white border border-[var(--border)] py-3">
                    <div className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">INTERNET</div>
                    <div className="text-[13px] font-semibold text-[var(--muted)]">○ TIDAK PERLU</div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <div className="text-[11px] font-semibold tracking-widest text-[var(--muted)]">CLASSROOM URL</div>
                  <div className="mt-1 font-mono text-[13px] font-semibold text-[var(--foreground)] break-all">
                    {network?.primaryIp ? `http://${network.primaryIp}:3000` : "http://192.168.x.x:3000"}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        const url = network?.primaryIp ? `http://${network.primaryIp}:3000` : window.location.origin;
                        navigator.clipboard.writeText(url);
                      }}
                    >
                      Copy URL
                    </Button>
                    <Link href="/join" className="flex-1">
                      <Button size="sm" className="w-full">
                        Join
                      </Button>
                    </Link>
                  </div>
                  {network?.urls?.length ? (
                    <div className="mt-3 space-y-1">
                      <div className="text-[11px] font-medium text-[var(--muted)]">Alamat tersedia:</div>
                      {network.urls.slice(0, 3).map((u: any) => (
                        <div key={u.ip} className="flex items-center justify-between text-[12px] font-mono bg-white border border-[var(--border)] rounded-lg px-2.5 py-1.5">
                          <span className="text-[var(--muted)]">{u.iface}</span>
                          <span className="font-semibold">{u.url}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <p className="text-[12px] leading-4 text-[var(--muted)]">
                  Murid cukup konek ke hotspot guru, lalu buka URL di browser. Tidak perlu install aplikasi.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-[1280px] mx-auto px-4 sm:px-6 pb-12">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "1", t: "Guru buat Hotspot", d: "Aktifkan hotspot HP tanpa internet. Semua perangkat konek ke Wi-Fi yang sama." },
              { n: "2", t: "Jalankan Server", d: "Di laptop server: npm run classroom — tampilkan URL lokal untuk dibagikan." },
              { n: "3", t: "Share Screen", d: "Guru mulai kelas, klik Share Screen, murid langsung melihat layar guru realtime." },
            ].map((s) => (
              <Card key={s.n} className="p-5">
                <div className="h-8 w-8 rounded-full bg-[var(--primary)] text-white grid place-items-center text-[13px] font-bold">{s.n}</div>
                <div className="mt-3 font-semibold text-[14px]">{s.t}</div>
                <div className="mt-1 text-[13px] leading-5 text-[var(--muted)]">{s.d}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-[var(--border)] bg-white">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10">
            <h2 className="text-[16px] font-semibold">Fitur kelas lokal</h2>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: "Screen Sharing WebRTC", desc: "Capture layar asli via getDisplayMedia, sinyal lokal tanpa STUN eksternal." },
                { title: "Chat & Pengumuman", desc: "Pesan realtime, pengumuman guru tampil menonjol, anti spam." },
                { title: "Materi Lokal", desc: "Upload PDF/DOCX/PPTX/ZIP langsung ke server, murid download via LAN." },
                { title: "Kehadiran & Angkat Tangan", desc: "Guru lihat siapa online, murid bisa raise hand, guru clear." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4">
                  <div className="text-[13px] font-semibold">{f.title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[var(--muted)]">
          <span>© 2026 AL-FATIH RPL CLASSROOM — Dibuat untuk jaringan lokal tanpa internet.</span>
          <span className="font-mono">npm run classroom</span>
        </div>
      </footer>
    </div>
  );
}
