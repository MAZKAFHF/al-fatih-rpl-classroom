"use client";
import { useEffect, useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export default function AdminSettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [network, setNetwork] = useState<any>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) router.push(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  useEffect(() => {
    fetch("/api/system")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}));
    fetch("/api/network")
      .then((r) => r.json())
      .then(setNetwork);
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) toast("Pengaturan disimpan", "success");
    else toast("Gagal menyimpan", "error");
    setSaving(false);
  };

  const backup = async () => {
    const res = await fetch("/api/system").then((r) => r.json());
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settings-${Date.now()}.json`;
    a.click();
    toast("Backup diunduh", "success");
  };

  if (loading) return <div className="min-h-screen grid place-items-center">Memuat...</div>;
  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <Navbar user={user as any} onLogout={logout} />
      <main className="max-w-[800px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-[18px] font-bold">Pengaturan Sistem</h1>
          <p className="text-[13px] text-[var(--muted)]">Konfigurasi lokal — tidak memerlukan internet.</p>
        </div>

        <Card className="space-y-4">
          <h3 className="font-semibold text-[14px]">Umum</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nama Sekolah</Label>
              <Input value={settings.school_name || ""} onChange={(e) => setSettings({ ...settings, school_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Maksimal Murid</Label>
              <Input value={settings.max_students || ""} onChange={(e) => setSettings({ ...settings, max_students: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Maks Upload (MB)</Label>
              <Input value={settings.max_file_size_mb || ""} onChange={(e) => setSettings({ ...settings, max_file_size_mb: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Session Timeout (jam)</Label>
              <Input value={settings.session_timeout_hours || ""} onChange={(e) => setSettings({ ...settings, session_timeout_hours: e.target.value })} />
            </div>
          </div>
          <Button onClick={save} loading={saving}>
            Simpan Pengaturan
          </Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold text-[14px]">Server Lokal</h3>
          {network ? (
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Primary IP</span>
                <span className="font-mono font-semibold">{network.primaryIp || "localhost"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Port</span>
                <span className="font-mono">{network.port}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 font-mono text-[12px] break-all">
                {network.host}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(network.host);
                  toast("URL disalin", "success");
                }}
              >
                Copy URL
              </Button>
            </div>
          ) : (
            <div className="text-[13px] text-[var(--muted)]">Memuat...</div>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-[14px]">Backup</h3>
          <p className="text-[13px] text-[var(--muted)]">Backup database lokal — jalankan juga via terminal: npm run backup</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={backup}>
              Download Settings JSON
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await fetch("/api/system");
                toast("Gunakan terminal: npm run backup untuk backup DB file", "info");
              }}
            >
              Info Backup
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
