"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Badge, Input, Textarea } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC, QUALITY_CONFIG, type QualityPreset } from "@/hooks/useWebRTC";
import { useToast } from "@/components/Toast";

type Message = { id: string; sender_name: string; sender_role: string; content: string; created_at: string };
type Student = { socketId: string; name: string; role: string; joinedAt: string };
type Raised = { id: string; student_name: string; created_at: string };
type Announcement = { id: string; content: string; teacher_name: string; created_at: string };

export default function ClassroomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code as string).toUpperCase();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { socket, connected } = useSocket(true);
  const { toast } = useToast();

  const [classroom, setClassroom] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [raised, setRaised] = useState<Raised[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementText, setAnnouncementText] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "students" | "materials" | "announcements">("chat");

  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSecure, setIsSecure] = useState(true);
  const [quality, setQuality] = useState<QualityPreset>("seimbang");
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const role: "TEACHER" | "STUDENT" = user?.role === "TEACHER" || user?.role === "ADMIN" ? "TEACHER" : "STUDENT";

  const { localStream, remoteStream, connectionState, stats, startSharing, stopSharing, sendOfferTo, sendOffersBatched, requestOffer } = useWebRTC({
    socket,
    role,
    classroomCode: code,
    isSharing,
    quality,
  });

  useEffect(() => {
    if (typeof window !== "undefined") setIsSecure(window.isSecureContext);
  }, []);

  // fetch classroom info
  useEffect(() => {
    if (!code) return;
    fetch(`/api/classrooms/by-code/${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setClassroom(d.classroom);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // also try to get full classroom details for session
    fetch(`/api/classrooms/by-code/${code}`)
      .then((r) => r.json())
      .catch(() => {});
  }, [code]);

  // fetch full classroom with session via id lookup after we know id? Instead fetch via /api/classrooms? then find
  useEffect(() => {
    if (!classroom?.id) return;
    fetch(`/api/classrooms/${classroom.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.activeSession) setSession(d.activeSession);
        if (d.materials) setMaterials(d.materials);
      });
    // poll session every 3s
    const iv = setInterval(() => {
      fetch(`/api/classrooms/${classroom.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.activeSession) setSession(d.activeSession);
          else setSession(null);
          if (d.materials) setMaterials(d.materials);
        });
    }, 3000);
    return () => clearInterval(iv);
  }, [classroom]);

  // socket join
  useEffect(() => {
    if (!socket || !code || authLoading) return;
    // wait for user to be known; for guest, user may be null but we have cookie guest token
    const join = () => {
      socket.emit("classroom:join", { code, name: user?.name || "Guest", role: role });
    };
    if (socket.connected) join();
    else socket.on("connect", join);

    const onJoined = (data: any) => {
      if (data.code === code) {
        setStudents(data.members || []);
        if (data.messages) setMessages(data.messages);
        if (data.raised) setRaised(data.raised);
        if (data.announcements) setAnnouncements(data.announcements);
        if (data.isSharing) {
          // teacher is sharing
          if (role === "STUDENT") {
            setTimeout(() => requestOffer(), 500);
          }
        }
      }
    };
    const onMembers = (data: any) => {
      if (data.code === code) setStudents(data.members);
    };
    const onChat = (msg: Message & { code: string }) => {
      if (msg.code === code || !msg.code) setMessages((m) => [...m.slice(-100), msg]);
    };
    const onAnn = (a: Announcement & { code: string }) => {
      if (a.code === code || !a.code) {
        setAnnouncements((prev) => [a, ...prev]);
        toast(`📢 ${a.content.slice(0, 60)}`, "info");
      }
    };
    const onRaised = (data: any) => {
      if (data.code === code) setRaised(data.raised);
    };
    const onSharingStarted = (data: any) => {
      if (data.code === code) {
        setIsSharing(true);
        if (role === "STUDENT") {
          setTimeout(() => requestOffer(), 300);
        }
      }
    };
    const onSharingStopped = (data: any) => {
      if (data.code === code) {
        setIsSharing(false);
      }
    };

    socket.on("classroom:joined", onJoined);
    socket.on("classroom:members", onMembers);
    socket.on("chat:message", onChat);
    socket.on("announcement:new", onAnn);
    socket.on("raised:update", onRaised);
    socket.on("teacher:started-sharing", onSharingStarted);
    socket.on("teacher:stopped-sharing", onSharingStopped);

    return () => {
      socket.off("connect", join);
      socket.off("classroom:joined", onJoined);
      socket.off("classroom:members", onMembers);
      socket.off("chat:message", onChat);
      socket.off("announcement:new", onAnn);
      socket.off("raised:update", onRaised);
      socket.off("teacher:started-sharing", onSharingStarted);
      socket.off("teacher:stopped-sharing", onSharingStopped);
      socket.emit("classroom:leave", { code });
    };
  }, [socket, code, user, role, authLoading, requestOffer, toast]);

  // Teacher: when sharing starts, send offers batched to avoid hotspot burst
  useEffect(() => {
    if (role === "TEACHER" && isSharing && localStream) {
      const ids = students.filter((s) => s.role === "STUDENT").map((s) => s.socketId);
      if (ids.length) sendOffersBatched(ids);
    }
  }, [isSharing, localStream]); // only on start, not on every students change (new join handled via socket)

  // Re-apply bitrate when quality changes mid-share (next offer will use new bitrate)
  useEffect(() => {
    if (role === "TEACHER" && isSharing && localStream) {
      // hint reload: next student join will use new quality; existing peers will adapt via sender params on next negotiation
    }
  }, [quality]);

  // attach streams to video elements - dengan play() agar autoplay tidak blokir
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.warn("[UI] local play gagal", e));
    }
  }, [localStream]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log("[UI] remoteStream diterima, attach ke video", remoteStream.getTracks().map(t=>`${t.kind}:${t.readyState}`));
      videoRef.current.srcObject = remoteStream;
      // penting: panggil play() agar murid langsung lihat, terutama setelah stagger 1-4s
      videoRef.current.play().catch((e) => {
        console.warn("[UI] remote play() gagal (autoplay block) - coba klik video", e);
        // fallback: tampilkan tombol play manual jika autoplay diblokir
      });
    } else if (!remoteStream) {
      console.log("[UI] remoteStream null, menunggu offer dari guru...");
    }
  }, [remoteStream]);

  const handleStartSharing = async () => {
    setShareError(null);
    try {
      const s = await startSharing();
      if (s) {
        setIsSharing(true);
        toast("Screen sharing dimulai", "success");
      }
    } catch (e: any) {
      const msg = e.message || "Gagal memulai screen sharing";
      setShareError(msg);
      toast(msg, "error");
    }
  };
  const handleStopSharing = () => {
    setShareError(null);
    stopSharing();
    setIsSharing(false);
    toast("Screen sharing dihentikan", "info");
  };

  const sendMessage = () => {
    const content = newMessage.trim();
    if (!content || !socket) return;
    if (content.length > 1000) return toast("Pesan terlalu panjang", "error");
    socket.emit("chat:message", { code, content });
    setNewMessage("");
  };

  const sendAnnouncement = () => {
    if (!announcementText.trim() || !socket) return;
    socket.emit("announcement:create", { code, content: announcementText.trim() });
    setAnnouncementText("");
    toast("Pengumuman dikirim", "success");
  };

  const raiseHand = () => {
    socket?.emit("raised:toggle", { code });
    toast("✋ Mengangkat tangan", "info");
  };

  const clearRaised = (id: string) => {
    socket?.emit("raised:clear", { code, id });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !classroom?.id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("classroomId", classroom.id);
      const res = await fetch("/api/materials/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Materi diupload", "success");
      setMaterials((m) => [data.material, ...m]);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadMaterial = (id: string) => {
    window.open(`/api/materials/${id}`, "_blank");
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-[13px] text-[var(--muted)]">Memuat kelas...</div>;
  if (error || !classroom) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md text-center">
          <h2 className="font-semibold">Kelas tidak ditemukan</h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">{error || "Kode salah atau kelas belum dibuat"}</p>
          <Button className="mt-4" onClick={() => router.push("/join")}>
            Join Kelas Lain
          </Button>
        </Card>
      </div>
    );
  }

  const isLive = !!session;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/dashboard")} className="h-8 w-8 grid place-items-center rounded-full border border-[var(--border)] bg-white text-[12px]">
              ←
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-[15px] truncate">{classroom.name}</h1>
                {isLive ? <Badge variant="live">● LIVE</Badge> : <Badge>Belum mulai</Badge>}
                <span className="hidden sm:inline font-mono text-[11px] px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] tracking-widest">{classroom.code}</span>
              </div>
              <div className="text-[12px] text-[var(--muted)] truncate">{classroom.subject} • {students.length} terhubung • {connected ? "● Terhubung" : "⚠ Reconnecting..."}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {role === "TEACHER" ? (
              <>
                {!isLive ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      const res = await fetch(`/api/classrooms/${classroom.id}/start`, { method: "POST" });
                      if (res.ok) {
                        toast("Kelas dimulai", "success");
                        const d = await fetch(`/api/classrooms/${classroom.id}`).then((r) => r.json());
                        setSession(d.activeSession);
                      }
                    }}
                  >
                    Mulai Kelas
                  </Button>
                ) : !isSharing ? (
                  <Button size="sm" onClick={handleStartSharing} className="bg-[#059669] hover:bg-[#047857]">
                    ⦿ Share Screen
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleStopSharing}>
                    ■ Stop Sharing
                  </Button>
                )}
                {isLive && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (!confirm("Akhiri kelas?")) return;
                      await fetch(`/api/classrooms/${classroom.id}/end`, { method: "POST" });
                      toast("Kelas diakhiri", "info");
                      setSession(null);
                      setIsSharing(false);
                    }}
                  >
                    Akhiri
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={raiseHand}>
                  ✋ Angkat Tangan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (videoRef.current) {
                      if (document.fullscreenElement) document.exitFullscreen();
                      else videoRef.current.requestFullscreen();
                    }
                  }}
                >
                  ⛶ Fullscreen
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Insecure context warning for teacher */}
      {role === "TEACHER" && !isSecure && (
        <div className="bg-[#fffbeb] border-b border-[#fde68a] px-4 sm:px-6 py-3">
          <div className="max-w-[1440px] mx-auto flex gap-3 items-start">
            <span className="text-[16px]">⚠️</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#92400e]">Screen sharing diblokir — koneksi tidak aman</div>
              <div className="text-[12px] leading-5 text-[#92400e]/80 mt-1">
                Kamu membuka via <span className="font-mono font-medium">http://192.168.x.x</span> (insecure). Untuk share screen, guru harus buka via{" "}
                <span className="font-mono font-semibold">http://localhost:3000/classroom/{code}</span> di laptop server (localhost dianggap secure), atau
                aktifkan <span className="font-mono">chrome://flags → #unsafely-treat-insecure-origin-as-secure</span> → isi{" "}
                <span className="font-mono">http://{typeof window !== "undefined" ? window.location.hostname : "192.168.x.x"}:3000</span> → Enable → Restart Chrome.
                Murid tetap pakai <span className="font-mono">http://192.168.x.x:3000</span>.
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    const url = `http://localhost:3000/classroom/${code}`;
                    navigator.clipboard?.writeText(url);
                    toast("localhost URL disalin", "success");
                  }}
                  className="text-[12px] font-medium text-[#92400e] underline"
                >
                  Copy localhost URL
                </button>
                <button onClick={() => window.location.reload()} className="text-[12px] font-medium text-[#92400e] underline">
                  Muat ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 grid lg:grid-cols-[1.7fr_0.9fr] gap-4 items-start">
        {/* Left: Video area */}
        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            {/* Screen area */}
            <div className="aspect-[16/9] bg-[#0f172a] relative overflow-hidden">
              {role === "TEACHER" ? (
                isSharing && localStream ? (
                  <>
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-contain bg-black" />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <Badge variant="success">● SHARING</Badge>
                      <span className="text-[11px] font-medium text-white/80 bg-black/40 px-2 py-1 rounded-full border border-white/10">
                        Pratinjau • {students.filter((s) => s.role === "STUDENT").length} murid melihat
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                      <span className="text-[11px] text-white/70">Koneksi: ● Excellent (LAN)</span>
                      <span className="text-[11px] font-mono text-white/70">{connectionState}</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full grid place-items-center p-8 text-center">
                    <div className="max-w-md">
                      <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-2xl">🖥️</div>
                      <h3 className="mt-4 text-white font-semibold">Belum sharing</h3>
                      <p className="mt-1 text-[13px] text-white/60">Klik “Share Screen” untuk menampilkan layar kamu ke semua murid. Pilih Entire Screen / Window / Tab.</p>
                      {!isLive && <p className="mt-2 text-[12px] text-[#fbbf24]">Kelas belum dimulai — mulai kelas dulu.</p>}
                      {shareError && (
                        <div className="mt-4 text-left bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3">
                          <div className="text-[12px] font-semibold text-[#991b1b]">Gagal memulai screen sharing</div>
                          <div className="text-[12px] leading-5 text-[#991b1b] mt-1 break-words">{shareError}</div>
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="secondary" onClick={handleStartSharing}>
                              Coba Lagi
                            </Button>
                            {!isSecure && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const url = `http://localhost:3000/classroom/${code}`;
                                  window.location.href = url;
                                }}
                              >
                                Buka localhost
                              </Button>
                            )}
                          </div>
                          {!isSecure && (
                            <div className="mt-2 text-[11px] leading-4 text-[#991b1b]/80">
                              Tips: Guru harus di <span className="font-mono">localhost:3000</span>. Murid tetap di{" "}
                              <span className="font-mono">192.168.x.x:3000</span>.
                            </div>
                          )}
                        </div>
                      )}
                      {!shareError && !isSecure && role === "TEACHER" && (
                        <div className="mt-3 text-[11px] leading-4 text-white/50">
                          Mode tidak aman terdeteksi. Untuk share, gunakan <span className="font-mono text-white/80">localhost</span>.
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : remoteStream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    controls={false}
                    className="w-full h-full object-contain bg-black"
                    onLoadedMetadata={() => console.log("[UI] remote video loadedmetadata")}
                    onPlay={() => console.log("[UI] remote video playing")}
                    onClick={() => videoRef.current?.play().catch(()=>{})}
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <Badge variant="live">● LIVE</Badge>
                    <span className="text-[11px] font-medium text-white bg-black/50 px-2 py-1 rounded-full">Guru sedang sharing • H.264 NVENC</span>
                  </div>
                  <div className="absolute bottom-3 left-3 text-[11px] text-white/70 bg-black/40 px-2 py-1 rounded-full">
                    Koneksi: ● {connected ? "Terhubung" : "Menyambungkan..."} • {connectionState} • klik video jika hitam
                  </div>
                </>
              ) : isSharing ? (
                <div className="w-full h-full grid place-items-center p-8 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 grid place-items-center text-2xl animate-pulse">📡</div>
                    <h3 className="mt-4 text-white font-semibold">Guru sedang sharing — menghubungkan...</h3>
                    <p className="mt-1 text-[13px] text-white/60">
                      Kamu sudah terhubung ke kelas. Video akan muncul dalam <span className="text-white font-medium">1-4 detik</span> (stagger anti-spike untuk 40 murid).
                      Jangan refresh, biarkan otomatis.
                    </p>
                    <div className="mt-3 flex gap-2 justify-center">
                      <Button size="sm" variant="secondary" onClick={() => {
                        console.log("[UI] manual requestOffer (stagger 1-4s)");
                        requestOffer();
                      }}>
                        Tunggu Giliran (1-4s)
                      </Button>
                      <Button size="sm" variant="ghost" className="bg-white text-black hover:bg-white/90" onClick={() => {
                        console.log("[UI] FORCE immediate request (tanpa stagger) untuk debug");
                        // @ts-ignore
                        socket?.emit("student:request-offer", { code });
                      }}>
                        Force Sambung Sekarang
                      </Button>
                    </div>
                    <div className="mt-3 text-[11px] text-white/50">Status: {connectionState} • Socket: {connected ? "connected" : "reconnecting"} • Jika 5 detik tidak muncul, klik Force</div>
                    <div className="mt-2 text-[11px] text-amber-200/70">Buka F12 → Console harus ada [WebRTC] onOffer → ontrack</div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full grid place-items-center p-8 text-center">
                  <div>
                    <div className="mx-auto h-16 w-16 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-2xl">👀</div>
                    <h3 className="mt-4 text-white font-semibold">Menunggu guru sharing...</h3>
                    <p className="mt-1 text-[13px] text-white/60">Guru belum memulai screen sharing. Tetap di halaman ini, video akan muncul otomatis.</p>
                    <Button size="sm" variant="secondary" className="mt-4" onClick={requestOffer}>
                      Coba sambungkan ulang
                    </Button>
                    <div className="mt-3 text-[11px] text-white/50">Status: {connectionState} • Socket: {connected ? "connected" : "reconnecting"}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Info bar */}
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 bg-white border-t border-[var(--border)]">
              <div className="text-[12px] text-[var(--muted)]">
                {role === "TEACHER" ? (
                  <>
                    <span className="font-medium text-[var(--foreground)]">{students.length} terhubung</span> •{" "}
                    {isSharing ? <span className="text-[var(--success)]">● Sharing aktif</span> : <span>○ Tidak sharing</span>} •{" "}
                    <span className={connected ? "text-[var(--success)]" : "text-[var(--danger)]"}>{connected ? "● Signaling OK" : "○ Reconnecting"}</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-[var(--foreground)]">{classroom.name}</span> • {classroom.subject} • Koneksi {connected ? "● Stabil" : "⚠ Terputus"}
                  </>
                )}
              </div>
              <div className="flex gap-1.5">
                <Badge variant={isLive ? "success" : "default"}>{isLive ? "Kelas Aktif" : "Kelas Nonaktif"}</Badge>
                <Badge variant={isSharing ? "live" : "default"}>{isSharing ? "Sharing" : "Idle"}</Badge>
              </div>
            </div>
          </Card>

          {/* Quality selector for teacher */}
          {role === "TEACHER" && (
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold">Kualitas Screen Sharing</div>
                  <div className="text-[11px] text-[var(--muted)]">Pilih sebelum klik Share. Hemat = paling lancar untuk 30-40 siswa.</div>
                </div>
                {isSharing && stats && (
                  <Badge variant={stats.packetLoss > 2 ? "warning" : "success"}>
                    {stats.fps}fps • {stats.bitrateKbps}kbps • loss {stats.packetLoss}%
                  </Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(["hemat", "seimbang", "tajam"] as QualityPreset[]).map((q) => {
                  const cfg = QUALITY_CONFIG[q];
                  const active = quality === q;
                  return (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      disabled={isSharing}
                      className={`text-left p-3 rounded-xl border text-[12px] leading-4 transition ${
                        active ? "bg-[var(--primary)] text-white border-[var(--primary)]" : "bg-white border-[var(--border)] hover:border-[var(--border-strong)]"
                      } ${isSharing ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div className="font-semibold text-[13px]">{cfg.label}</div>
                      <div className={`text-[11px] mt-0.5 ${active ? "text-white/80" : "text-[var(--muted)]"}`}>{cfg.desc}</div>
                      <div className={`text-[11px] font-mono mt-1 ${active ? "text-white/70" : "text-[var(--muted-2)]"}`}>{cfg.width}x{cfg.height} • {cfg.fps}fps • {Math.round(cfg.bitrate / 1000)}kbps</div>
                    </button>
                  );
                })}
              </div>
              {isSharing && (
                <div className="mt-2 text-[11px] text-[var(--muted)]">Ganti kualitas butuh Stop lalu Share ulang.</div>
              )}
              {!isSharing && !isSecure && (
                <div className="mt-2 text-[11px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2.5 py-1.5">
                  ⚠️ Kamu di 192.168.x.x (insecure). Pindah ke <span className="font-mono font-semibold">localhost:3000</span> agar Share lancar, lalu pilih Hemat/Seimbang.
                </div>
              )}
            </Card>
          )}

          {/* Announcements visible */}
          {announcements.length > 0 && (
            <Card className="border-[#fde68a] bg-[#fffbeb]">
              <div className="flex items-start gap-3">
                <span className="text-[18px]">📢</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold tracking-widest text-[#92400e]">PENGUMUMAN</div>
                  <div className="mt-1 text-[14px] font-medium text-[#78350f]">{announcements[0].content}</div>
                  <div className="text-[11px] text-[#92400e]/70 mt-1">
                    {announcements[0].teacher_name} • {new Date(announcements[0].created_at).toLocaleTimeString("id-ID")}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Raised hands for teacher */}
          {role === "TEACHER" && raised.length > 0 && (
            <Card className="border-[#fde68a] bg-[#fffbeb]">
              <div className="text-[13px] font-semibold">✋ Angkat Tangan ({raised.length})</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {raised.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#fde68a] text-[13px]">
                    {r.student_name}
                    <button onClick={() => clearRaised(r.id)} className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="space-y-4 lg:sticky lg:top-[78px]">
          <Card className="p-0 overflow-hidden">
            <div className="flex gap-1 p-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
              {[
                { id: "chat", label: "Chat" },
                { id: "students", label: `Murid (${students.length})` },
                { id: "materials", label: "Materi" },
                { id: "announcements", label: "Info" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex-1 py-1.5 rounded-full text-[12px] font-semibold transition ${activeTab === t.id ? "bg-white shadow-sm border border-[var(--border)] text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="h-[420px] flex flex-col">
              {activeTab === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {messages.length === 0 ? (
                      <div className="h-full grid place-items-center text-center p-6">
                        <div>
                          <div className="text-[12px] font-semibold text-[var(--muted)]">Belum ada pesan</div>
                          <div className="text-[12px] text-[var(--muted-2)]">Mulai percakapan kelas</div>
                        </div>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`flex flex-col ${m.sender_role === "TEACHER" ? "items-start" : "items-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.sender_role === "TEACHER" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface-2)] border border-[var(--border)]"}`}>
                            <div className="text-[11px] font-semibold opacity-80">
                              {m.sender_name} • {m.sender_role}
                            </div>
                            <div className="text-[13px] leading-4 mt-0.5 break-words">{m.content}</div>
                          </div>
                          <div className="text-[10px] text-[var(--muted-2)] mt-1 ml-1">{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-[var(--border)] bg-white flex gap-2">
                    <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Tulis pesan..." onKeyDown={(e) => e.key === "Enter" && sendMessage()} className="flex-1" />
                    <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                      Kirim
                    </Button>
                  </div>
                </>
              )}

              {activeTab === "students" && (
                <div className="flex-1 overflow-y-auto p-3">
                  {students.length === 0 ? (
                    <div className="text-center py-10 text-[13px] text-[var(--muted)]">Belum ada murid bergabung</div>
                  ) : (
                    <div className="space-y-2">
                      {students.map((s) => (
                        <div key={s.socketId} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-white">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] grid place-items-center text-[11px] font-bold">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-[13px] font-medium leading-none">{s.name}</div>
                              <div className="text-[11px] text-[var(--muted)]">{s.role}</div>
                            </div>
                          </div>
                          <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "materials" && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {role === "TEACHER" && (
                    <div className="p-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/50">
                      <div className="text-[12px] font-semibold">Upload materi</div>
                      <div className="text-[11px] text-[var(--muted)]">PDF, DOCX, PPTX, ZIP, gambar, TXT • max 50MB</div>
                      <label className="mt-2 inline-flex cursor-pointer">
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                        <span className={`inline-flex items-center justify-center gap-2 font-medium rounded-[10px] h-9 px-3.5 text-[13px] bg-white border border-[var(--border)] ${uploading ? "opacity-50" : ""}`}>
                          {uploading ? "Mengupload..." : "Pilih File"}
                        </span>
                      </label>
                    </div>
                  )}
                  {materials.length === 0 ? (
                    <div className="text-center py-8 text-[13px] text-[var(--muted)]">Belum ada materi</div>
                  ) : (
                    <div className="space-y-2">
                      {materials.map((m) => (
                        <div key={m.id} className="p-3 rounded-xl border border-[var(--border)] bg-white flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium truncate">{m.original_name}</div>
                            <div className="text-[11px] text-[var(--muted)]">
                              {(m.size / 1024).toFixed(1)} KB • {new Date(m.created_at).toLocaleDateString("id-ID")}
                            </div>
                          </div>
                          <Button size="sm" variant="secondary" onClick={() => downloadMaterial(m.id)}>
                            Unduh
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "announcements" && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {role === "TEACHER" && (
                    <div className="space-y-2">
                      <Textarea value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Tulis pengumuman penting..." />
                      <Button size="sm" onClick={sendAnnouncement} disabled={!announcementText.trim()} className="w-full">
                        Kirim Pengumuman 📢
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {announcements.length === 0 ? (
                      <div className="text-center py-8 text-[13px] text-[var(--muted)]">Belum ada pengumuman</div>
                    ) : (
                      announcements.map((a) => (
                        <div key={a.id} className="p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
                          <div className="text-[13px] font-medium text-[#78350f]">{a.content}</div>
                          <div className="text-[11px] text-[#92400e]/70 mt-1">
                            {a.teacher_name} • {new Date(a.created_at).toLocaleTimeString("id-ID")}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Quick info */}
          <Card className="p-4 bg-[#f0f9ff] border-[#bae6fd]">
            <div className="text-[12px] font-semibold text-[#0c4a6e]">Tips jaringan lokal</div>
            <div className="text-[12px] leading-5 text-[#0c4a6e]/80 mt-1">
              Jika video macet: pastikan semua perangkat di hotspot yang sama, dekatkan ke server laptop, dan hindari hotspot membatasi 10+ perangkat.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
