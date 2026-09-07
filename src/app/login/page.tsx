"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      toast("Login berhasil", "success");
      router.push("/dashboard");
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
          <div className="px-6 pt-7 pb-2">
            <h1 className="text-[18px] font-bold tracking-tight">Masuk ke Classroom</h1>
            <p className="mt-1 text-[13px] text-[var(--muted)]">Gunakan akun guru atau admin yang sudah dibuat.</p>
          </div>
          <form onSubmit={submit} className="px-6 pb-6 pt-4 space-y-4">
            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[13px] text-[#991b1b]">{error}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="mis. pak_ahmad" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" loading={loading} size="lg">
              Masuk
            </Button>
            <div className="flex items-center justify-between text-[13px]">
              <Link href="/join" className="text-[var(--accent)] hover:underline font-medium">
                Murid? Join dengan kode kelas →
              </Link>
            </div>
            <div className="pt-3 border-t border-[var(--border)] text-[12px] text-[var(--muted)] text-center">
              Belum ada akun? Jalankan setup pertama di <Link href="/setup" className="font-medium text-[var(--foreground)] underline">/setup</Link>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
