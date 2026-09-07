"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Badge, Input, Label, Textarea, EmptyState } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

type Classroom = {
  id: string;
  name: string;
  subject: string;
  description: string;
  code: string;
  is_locked: number;
  created_at: string;
  activeSession: any;
};

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";
  const { toast } = useToast();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [network, setNetwork] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", description: "" });
  const [creating, setCreating] = useState(false);

  const [materials, setMaterials] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const fetchClassrooms = async () => {
    setLoadingClasses(true);
    try {
      const res = await fetch("/api/classrooms");
      const data = await res.json();
      if (res.ok) setClassrooms(data.classrooms || []);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchClassrooms();
      fetch("/api/network")
        .then((r) => r.json())
        .then(setNetwork)
        .catch(() => {});
      if (user.role === "ADMIN") {
        fetch("/api/users")
          .then((r) => r.json())
          .then((d) => setUsers(d.users || []));
      }
    }
  }, [user]);

  const createClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Kelas berhasil dibuat", "success");
      setForm({ name: "", subject: "", description: "" });
      setShowCreate(false);
      fetchClassrooms();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const startClass = async (id: string) => {
    const res = await fetch(`/api/classrooms/${id}/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast("Kelas dimulai", "success");
    fetchClassrooms();
  };
  const endClass = async (id: string) => {
    if (!confirm("Akhiri kelas? Semua murid akan disconnect.")) return;
    const res = await fetch(`/api/classrooms/${id}/end`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast("Kelas diakhiri", "success");
    fetchClassrooms();
  };
  const regenCode = async (id: string) => {
    const res = await fetch(`/api/classrooms/${id}/regenerate-code`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast(`Kode baru: ${data.code}`, "success");
    fetchClassrooms();
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-[13px] text-[var(--muted)]">Memuat...</div>;
  if (!user) return null;

  const activeClass = classrooms.find((c) => c.activeSession);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar user={user as any} onLogout={logout} />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">
              {user.role === "TEACHER" ? `Selamat datang, ${user.name}` : user.role === "ADMIN" ? "Admin Dashboard" : `Halo, ${user.name}`}
            </h1>
            <p className="text-[13px] text-[var(--muted)]">
              {user.role === "TEACHER" ? "Kelola kelas dan share screen ke murid." : user.role === "ADMIN" ? "Kelola pengguna & sistem." : "Join kelas dengan kode dari guru."}
            </p>
          </div>
          {user.role !== "STUDENT" && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/join")}>
                Join Preview
              </Button>
              {(user.role === "TEACHER" || user.role === "ADMIN") && (
                <Button onClick={() => setShowCreate(true)}>+ Buat Kelas</Button>
              )}
            </div>
          )}
        </div>

        {/* System status */}
        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Status Sistem</h3>
              <Badge variant="success">● LOCAL ONLY</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-3">
                <div className="text-[11px] font-semibold text-[var(--muted)]">SERVER</div>
                <div className="text-[13px] font-semibold text-[var(--success)]">● RUNNING</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-3">
                <div className="text-[11px] font-semibold text-[var(--muted)]">JARINGAN</div>
                <div className="text-[13px] font-semibold text-[var(--success)]">● TERHUBUNG</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white py-3">
                <div className="text-[11px] font-semibold text-[var(--muted)]">INTERNET</div>
                <div className="text-[13px] font-semibold">○ TIDAK PERLU</div>
              </div>
            </div>
            {network && (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-white p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold tracking-widest text-[var(--muted)]">CLASSROOM URL</div>
                  <div className="font-mono text-[13px] font-semibold">{`http://${network.primaryIp}:3000`}</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(`http://${network.primaryIp}:3000`);
                    toast("URL disalin", "success");
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
            {activeClass && (
              <div className="mt-3 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] p-3 flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-semibold text-[#065f46]">Kelas Aktif: {activeClass.name}</div>
                  <div className="text-[12px] text-[#047857] font-mono">{activeClass.code}</div>
                </div>
                <Link href={`/classroom/${activeClass.code}`}>
                  <Button size="sm">Buka Kelas →</Button>
                </Link>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-[13px] font-semibold">Ringkasan</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--muted)]">Total kelas</span>
                <span className="text-[14px] font-semibold">{classrooms.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--muted)]">Kelas aktif</span>
                <span className="text-[14px] font-semibold text-[var(--success)]">{classrooms.filter((c) => c.activeSession).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[var(--muted)]">Peran</span>
                <Badge>{user.role}</Badge>
              </div>
              {user.role === "STUDENT" && (
                <Link href="/join" className="block">
                  <Button className="w-full" size="lg">
                    Join Kelas
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 p-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-full w-fit">
          {[
            { id: "overview", label: "Kelas" },
            ...(user.role === "ADMIN" ? [{ id: "users", label: "Pengguna" }] : []),
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/dashboard?tab=${t.id}`)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${tab === t.id ? "bg-white shadow-sm border border-[var(--border)]" : "text-[var(--muted)]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Classrooms list */}
        {tab === "overview" && (
          <div className="mt-4">
            {loadingClasses ? (
              <div className="text-[13px] text-[var(--muted)] py-8 text-center">Memuat kelas...</div>
            ) : classrooms.length === 0 ? (
              <Card>
                <EmptyState
                  title="Belum ada kelas"
                  description="Buat kelas pertama untuk memulai screen sharing."
                  action={
                    (user.role === "TEACHER" || user.role === "ADMIN") && (
                      <Button onClick={() => setShowCreate(true)}>+ Buat Kelas</Button>
                    )
                  }
                />
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {classrooms.map((c) => (
                  <Card key={c.id} className="p-0 overflow-hidden flex flex-col">
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[14px] font-semibold leading-tight">{c.name}</div>
                          <div className="text-[12px] text-[var(--muted)]">{c.subject}</div>
                        </div>
                        {c.activeSession ? <Badge variant="live">● LIVE</Badge> : <Badge>Draft</Badge>}
                      </div>
                      {c.description && <div className="mt-2 text-[12px] leading-4 text-[var(--muted)] line-clamp-2">{c.description}</div>}
                      <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] font-mono text-[12px] font-semibold tracking-widest">
                        {c.code}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.code);
                            toast("Kode disalin", "success");
                          }}
                          className="text-[11px] text-[var(--accent)] hover:underline font-sans"
                        >
                          copy
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-[var(--muted)]">{new Date(c.created_at).toLocaleDateString("id-ID")}</div>
                    </div>
                    <div className="px-5 py-3 bg-[var(--surface-2)]/60 border-t border-[var(--border)] flex flex-wrap gap-2">
                      {c.activeSession ? (
                        <>
                          <Link href={`/classroom/${c.code}`} className="flex-1">
                            <Button size="sm" className="w-full">
                              Masuk Kelas →
                            </Button>
                          </Link>
                          {(user.role === "TEACHER" || user.role === "ADMIN") && (
                            <Button size="sm" variant="secondary" onClick={() => endClass(c.id)}>
                              Akhiri
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Link href={`/classroom/${c.code}`} className="flex-1">
                            <Button size="sm" variant="secondary" className="w-full">
                              Lihat
                            </Button>
                          </Link>
                          {(user.role === "TEACHER" || user.role === "ADMIN") && (
                            <Button size="sm" onClick={() => startClass(c.id)}>
                              Mulai
                            </Button>
                          )}
                        </>
                      )}
                      {(user.role === "TEACHER" || user.role === "ADMIN") && (
                        <Button size="sm" variant="ghost" onClick={() => regenCode(c.id)} title="Regenerate code">
                          ↻
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && user.role === "ADMIN" && (
          <Card className="mt-4">
            <h3 className="font-semibold text-[14px]">Daftar Pengguna</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2 font-medium">Nama</th>
                    <th className="py-2 font-medium">Username</th>
                    <th className="py-2 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 font-medium">{u.name}</td>
                      <td className="py-2.5 font-mono text-[12px]">{u.username}</td>
                      <td className="py-2.5">
                        <Badge variant={u.role === "ADMIN" ? "warning" : u.role === "TEACHER" ? "success" : "default"}>{u.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[12px] text-[var(--muted)]">Kelola pengguna lengkap di Admin → Pengguna</div>
          </Card>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <Card className="w-full max-w-[480px]" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[16px] font-semibold">Buat Kelas Baru</h3>
              <p className="text-[13px] text-[var(--muted)]">Kode kelas akan dibuat otomatis.</p>
              <form onSubmit={createClassroom} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nama Kelas</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="RPL XI" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Mata Pelajaran</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Pemrograman Web" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Deskripsi (opsional)</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Materi hari ini..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={creating}>
                    Buat Kelas
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm">Memuat...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
