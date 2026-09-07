"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

export default function JoinPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/classrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase(), displayName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal join");
      toast("Berhasil bergabung!", "success");
      router.push(`/classroom/${data.classroom.code}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <Navbar user={user as any} onLogout={logout} />
      <main className="flex-1 grid place-items-center px-4 py-10">
        <Card className="w-full max-w-[420px] p-0 overflow-hidden">
          <div className="h-1 bg-[var(--primary)]" />
          <div className="px-6 pt-6">
            <div className="h-10 w-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[16px]">🎓</div>
            <h1 className="mt-3 text-[18px] font-bold tracking-tight">Join Kelas</h1>
            <p className="text-[13px] text-[var(--muted)]">Masukkan kode kelas dari guru dan nama kamu.</p>
          </div>
          <form onSubmit={submit} className="px-6 py-5 space-y-4">
            {error && <div className="px-3 py-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[13px] text-[#991b1b]">{error}</div>}
            <div className="space-y-1.5">
              <Label>Kode Kelas</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="RPL-A3F9"
                className="font-mono tracking-widest uppercase"
                required
              />
              <div className="text-[11px] text-[var(--muted)]">Contoh: RPL-A3F9 • tanya guru jika belum ada</div>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Kamu</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Azka" required />
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Join Kelas →
            </Button>
            <div className="text-center text-[12px] text-[var(--muted)]">
              Sudah punya akun guru? <a href="/login" className="font-medium text-[var(--foreground)] underline">Login</a>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
