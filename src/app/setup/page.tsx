"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [step, setStep] = useState<"admin" | "teacher">("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adminForm, setAdminForm] = useState({ name: "", username: "", password: "" });
  const [teacherForm, setTeacherForm] = useState({ name: "", username: "", password: "" });

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(d.needsSetup))
      .catch(() => setNeedsSetup(true));
  }, []);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...adminForm, role: "ADMIN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Admin berhasil dibuat", "success");
      setStep("teacher");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...teacherForm, role: "TEACHER" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Guru berhasil dibuat — sistem siap!", "success");
      router.push("/login");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (needsSetup === null) {
    return <div className="min-h-screen grid place-items-center text-[13px] text-[var(--muted)]">Memeriksa setup...</div>;
  }

  if (needsSetup === false) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <Card className="max-w-md text-center">
          <h1 className="font-semibold">Setup sudah selesai</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Sistem sudah memiliki admin. Silakan login.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <Button onClick={() => router.push("/login")}>Ke Login</Button>
            <Button variant="secondary" onClick={() => router.push("/")}>
              Beranda
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] grid place-items-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="text-center mb-6">
          <div className="inline-flex h-10 w-10 rounded-xl bg-[var(--primary)] text-white place-items-center justify-center font-bold">RPL</div>
          <h1 className="mt-3 text-[22px] font-bold tracking-tight">Selamat datang di AL-FATIH RPL</h1>
          <p className="text-[13px] text-[var(--muted)]">Setup awal — buat akun admin & guru dalam 2 langkah.</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className={`flex-1 h-1.5 rounded-full ${step === "admin" ? "bg-[var(--primary)]" : "bg-[var(--success)]"}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step === "teacher" ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
        </div>

        {step === "admin" ? (
          <Card>
            <div className="mb-1 text-[11px] font-semibold tracking-widest text-[var(--muted)]">LANGKAH 1 / 2</div>
            <h2 className="text-[16px] font-semibold">Buat akun Administrator</h2>
            <p className="text-[13px] text-[var(--muted)]">Admin mengelola guru dan pengaturan sistem.</p>
            <form onSubmit={createAdmin} className="mt-5 space-y-4">
              {error && <div className="px-3 py-2 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[13px] text-[#991b1b]">{error}</div>}
              <div className="space-y-1.5">
                <Label>Nama lengkap</Label>
                <Input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Admin RPL" required />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} placeholder="admin" required />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="minimal 6 karakter" required />
              </div>
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Buat Admin →
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <div className="mb-1 text-[11px] font-semibold tracking-widest text-[var(--muted)]">LANGKAH 2 / 2</div>
            <h2 className="text-[16px] font-semibold">Buat akun Guru</h2>
            <p className="text-[13px] text-[var(--muted)]">Guru dapat membuat kelas dan share screen.</p>
            <form onSubmit={createTeacher} className="mt-5 space-y-4">
              {error && <div className="px-3 py-2 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[13px] text-[#991b1b]">{error}</div>}
              <div className="space-y-1.5">
                <Label>Nama guru</Label>
                <Input value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} placeholder="Pak Ahmad" required />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={teacherForm.username} onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })} placeholder="pak_ahmad" required />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="minimal 6 karakter" required />
              </div>
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Buat Guru & Selesai
              </Button>
              <button type="button" onClick={() => (window.location.href = "/login")} className="w-full text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]">
                Lewati — ke Login
              </button>
            </form>
          </Card>
        )}

        <p className="mt-4 text-center text-[12px] text-[var(--muted)]">
          URL lokal akan tampil di terminal saat menjalankan <span className="font-mono font-medium">npm run classroom</span>
        </p>
      </div>
    </div>
  );
}
