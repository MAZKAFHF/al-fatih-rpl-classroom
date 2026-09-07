"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Badge, EmptyState } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

export default function AdminUsersPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "TEACHER" });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users || []);
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) router.push(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === "ADMIN") fetchUsers();
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Pengguna dibuat", "success");
      setForm({ name: "", username: "", password: "", role: "TEACHER" });
      setShowForm(false);
      fetchUsers();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Hapus pengguna?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast(data.error, "error");
    toast("Pengguna dihapus", "success");
    fetchUsers();
  };

  if (loading) return <div className="min-h-screen grid place-items-center">Memuat...</div>;
  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <Navbar user={user as any} onLogout={logout} />
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-bold">Manajemen Pengguna</h1>
            <p className="text-[13px] text-[var(--muted)]">Buat akun guru, siswa, atau admin tambahan.</p>
          </div>
          <Button onClick={() => setShowForm(true)}>+ Tambah Pengguna</Button>
        </div>

        <Card className="mt-6 p-0 overflow-hidden">
          {loadingUsers ? (
            <div className="p-8 text-center text-[13px] text-[var(--muted)]">Memuat...</div>
          ) : users.length === 0 ? (
            <EmptyState title="Belum ada pengguna" description="Tambah pengguna pertama." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b border-[var(--border)] bg-[var(--surface-2)]/50">
                    <th className="px-4 py-3 font-semibold text-[var(--muted)]">Nama</th>
                    <th className="px-4 py-3 font-semibold text-[var(--muted)]">Username</th>
                    <th className="px-4 py-3 font-semibold text-[var(--muted)]">Role</th>
                    <th className="px-4 py-3 font-semibold text-[var(--muted)]">Dibuat</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]/30">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">{u.username}</td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === "ADMIN" ? "warning" : u.role === "TEACHER" ? "success" : "default"}>{u.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => del(u.id)} disabled={u.id === user.id}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {showForm && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
            <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">Tambah Pengguna</h3>
              <form onSubmit={create} className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nama</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-white text-[13px]"
                  >
                    <option value="TEACHER">TEACHER</option>
                    <option value="STUDENT">STUDENT</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={submitting}>
                    Simpan
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
