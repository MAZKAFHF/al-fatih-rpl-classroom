"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

// Preset UI tetap ada, tapi nilai RTX-optimized adalah 720p30 1Mbps (lihat OPTIMASI 1 & 3)
export type QualityPreset = "hemat" | "seimbang" | "tajam";
export const QUALITY_CONFIG: Record<QualityPreset, { label: string; width: number; height: number; fps: number; maxFps: number; bitrate: number; desc: string }> = {
  hemat: { label: "Hemat (480p)", width: 854, height: 480, fps: 8, maxFps: 10, bitrate: 350_000, desc: "Paling lancar 40 siswa" },
  seimbang: { label: "Seimbang (720p)", width: 1280, height: 720, fps: 30, maxFps: 30, bitrate: 1_000_000, desc: "RTX 5050 NVENC H.264 1 Mbps — default" },
  tajam: { label: "Tajam (1080p)", width: 1920, height: 1080, fps: 30, maxFps: 30, bitrate: 1_000_000, desc: "1080p tetap 1 Mbps agar hotspot stabil" },
};

type Props = {
  socket: Socket | null;
  role: "TEACHER" | "STUDENT";
  classroomCode: string;
  isSharing?: boolean;
  quality?: QualityPreset;
};

export function useWebRTC({ socket, role, classroomCode, quality = "seimbang" }: Props) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>("idle");
  const [stats, setStats] = useState<{ bitrateKbps: number; fps: number; packetLoss: number } | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const qualityRef = useRef<QualityPreset>(quality);
  qualityRef.current = quality;

  const rtcConfig: RTCConfiguration = {
    iceServers: [], // LAN-only, host candidates cukup
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };

  // ============================================================
  // OPTIMASI 3: Limit Bandwidth 1 Mbps per murid via setParameters
  // Preview guru lancar karena lokal (tidak di-encode), tapi murid lag karena 40×1 Mbps = 40 Mbps via hotspot
  // Untuk 40 murid, hotspot HP/laptop 2.4GHz cuma 20-30 Mbps real → paket loss
  // Fix: jika murid >20, otomatis turun ke 600 kbps; >30 turun ke 350 kbps (hemat) + maintain-framerate agar lancar
  // ============================================================
  const applySenderParams = useCallback(async (pc: RTCPeerConnection) => {
    const peerCount = peersRef.current.size || 1;
    // adaptive bitrate: 1 Mbps untuk ≤20 murid, 600 kbps untuk 21-30, 350 kbps untuk >30
    let adaptiveBitrate = 1_000_000;
    let adaptiveFps = 30;
    let degradation: RTCDegradationPreference = "maintain-resolution";
    if (peerCount > 30) {
      adaptiveBitrate = 350_000;
      adaptiveFps = 15;
      degradation = "maintain-framerate"; // hemat: jaga kelancaran, bukan tajam
    } else if (peerCount > 20) {
      adaptiveBitrate = 600_000;
      adaptiveFps = 20;
      degradation = "maintain-framerate";
    } else if (peerCount > 10) {
      adaptiveBitrate = 800_000;
      adaptiveFps = 25;
    }
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind === "video") {
        try {
          const params: any = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = adaptiveBitrate;
          params.encodings[0].maxFramerate = adaptiveFps;
          params.degradationPreference = degradation;
          await sender.setParameters(params);
          console.log(`[WebRTC] setParameters ${adaptiveBitrate/1000}kbps/${adaptiveFps}fps untuk ${peerCount} peer (${pc.connectionState})`);
        } catch (e) {
          console.warn("[WebRTC] setParameters gagal", e);
        }
      }
    }
    // update stats biar guru lihat bitrate adaptif
    setStats({ bitrateKbps: Math.round(adaptiveBitrate/1000), fps: adaptiveFps, packetLoss: 0 });
  }, []);

  const createPeer = useCallback(
    (targetId: string, stream?: MediaStream | null) => {
      const pc = new RTCPeerConnection(rtcConfig);
      peersRef.current.set(targetId, pc);
      console.log(`[WebRTC] createPeer ${targetId} role=${role} hasStream=${!!stream}`);

      pc.onicecandidate = (e) => {
        if (e.candidate && socket) {
          socket.emit("webrtc:ice-candidate", { to: targetId, candidate: e.candidate, code: classroomCode });
        }
      };
      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] connectionState ${targetId}: ${pc.connectionState}`);
        setConnectionState(pc.connectionState);
      };
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] iceConnectionState ${targetId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          setConnectionState(pc.iceConnectionState);
        }
      };
      pc.onsignalingstatechange = () => {
        console.log(`[WebRTC] signalingState ${targetId}: ${pc.signalingState}`);
      };

      if (role === "TEACHER" && stream) {
        stream.getTracks().forEach((track) => {
          // OPTIMASI 1b: detail untuk teks coding tetap tajam
          if ("contentHint" in track) {
            try {
              (track as any).contentHint = "detail";
              console.log("[WebRTC] contentHint=detail set");
            } catch {}
          }
          // ============================================================
          // OPTIMASI 2: Paksa H.264 untuk NVENC RTX 5050
          // Gunakan addTrack dulu, lalu cari transceiver-nya
          // ============================================================
          let sender: RTCRtpSender | null = null;
          try {
            sender = pc.addTrack(track, stream);
            console.log(`[WebRTC] addTrack ${track.kind} id=${track.id}`);
          } catch (e) {
            console.warn("[WebRTC] addTrack gagal", e);
          }
          try {
            const caps = (RTCRtpSender as any).getCapabilities?.("video");
            const h264Codecs = caps?.codecs?.filter((c: any) => c.mimeType?.toLowerCase() === "video/h264") || [];
            console.log(`[WebRTC] H264 codecs ditemukan: ${h264Codecs.length}`, h264Codecs.map((c:any)=>c.sdpFmtpLine || c.mimeType));
            if (h264Codecs.length > 0 && sender) {
              const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
              if (transceiver && typeof (transceiver as any).setCodecPreferences === "function") {
                (transceiver as any).setCodecPreferences(h264Codecs);
                console.log("[WebRTC] H.264 dipaksa untuk NVENC");
              } else {
                console.warn("[WebRTC] setCodecPreferences tidak support, fallback VP8");
              }
            }
          } catch (e) {
            console.warn("[WebRTC] H.264 set gagal", e);
          }
        });
        setTimeout(() => applySenderParams(pc), 100);
      }

      if (role === "STUDENT") {
        pc.ontrack = (e) => {
          console.log(`[WebRTC] ontrack dari ${targetId}, streams=${e.streams.length}, track=${e.track.kind}`);
          const ms = e.streams[0];
          setRemoteStream(ms);
          setConnectionState("connected");
        };
      }
      return pc;
    },
    [socket, classroomCode, role, applySenderParams]
  );

  const stopSharing = useCallback(() => {
    console.log("[WebRTC] stopSharing");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    setConnectionState("idle");
    setStats(null);
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    socket?.emit("teacher:stop-sharing", { code: classroomCode });
  }, [socket, classroomCode]);

  const startSharing = useCallback(async () => {
    if (role !== "TEACHER") return null;
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw new Error(
        "Screen sharing butuh secure context. Di laptop guru buka via http://localhost:3000 (bukan 192.168.x.x). Atau aktifkan chrome://flags → 'Insecure origins treated as secure' → isi http://192.168.x.x:3000 → Enable → Restart."
      );
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
      throw new Error(
        "Browser tidak mendukung screen sharing (getDisplayMedia tidak tersedia). Gunakan Chrome/Edge terbaru dan buka via http://localhost:3000 di laptop guru."
      );
    }
    try {
      // ============================================================
      // OPTIMASI 1: getDisplayMedia 1280×720@30, audio:false, detail
      // ============================================================
      console.log("[WebRTC] getDisplayMedia 1280x720@30 audio:false");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          displaySurface: "monitor",
        } as any,
        audio: false as any,
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
      } as any);

      const vTrack = stream.getVideoTracks()[0];
      console.log(`[WebRTC] got stream tracks: ${stream.getTracks().map(t=>`${t.kind}:${t.label}`).join(", ")}`);
      if (vTrack && "contentHint" in vTrack) {
        try {
          (vTrack as any).contentHint = "detail";
          console.log("[WebRTC] contentHint detail set on capture");
        } catch {}
      }
      try {
        await vTrack?.applyConstraints({
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        } as any);
      } catch (e) {
        console.warn("[WebRTC] applyConstraints gagal", e);
      }

      streamRef.current = stream;
      setLocalStream(stream);
      setConnectionState("sharing");
      socket?.emit("teacher:start-sharing", { code: classroomCode });
      console.log("[WebRTC] teacher:start-sharing emitted");
      vTrack?.addEventListener("ended", () => {
        console.log("[WebRTC] track ended");
        stopSharing();
      });
      return stream;
    } catch (e: any) {
      console.error("[WebRTC] startSharing error", e);
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        throw new Error("Izin screen sharing ditolak. Klik Allow saat popup muncul, lalu coba lagi.");
      }
      if (e?.name === "NotFoundError") throw new Error("Tidak ada layar/window yang tersedia untuk dishare.");
      if (e?.name === "AbortError") throw new Error("Screen sharing dibatalkan.");
      if (e?.message && e.message.includes("secure context")) throw e;
      if (e?.message && e.message.includes("getDisplayMedia")) throw e;
      throw new Error(e?.message || "Gagal memulai screen sharing. Coba muat ulang dan pastikan via localhost.");
    }
  }, [role, socket, classroomCode, stopSharing]);

  const sendOfferTo = useCallback(
    async (studentSocketId: string) => {
      if (role !== "TEACHER" || !streamRef.current) {
        console.warn(`[WebRTC] sendOfferTo skip, role=${role} no stream`);
        return;
      }
      let pc = peersRef.current.get(studentSocketId);
      if (!pc) {
        console.log(`[WebRTC] sendOfferTo create new peer untuk ${studentSocketId}`);
        pc = createPeer(studentSocketId, streamRef.current);
      }
      if (pc.getSenders().length === 0 && streamRef.current) {
        console.log(`[WebRTC] peer existed but no sender, adding track untuk ${studentSocketId}`);
        streamRef.current.getTracks().forEach((track) => {
          if ("contentHint" in track) try { (track as any).contentHint = "detail"; } catch {}
          try {
            const sender = pc!.addTrack(track, streamRef.current!);
            const caps = (RTCRtpSender as any).getCapabilities?.("video");
            const h264 = caps?.codecs?.filter((c: any) => c.mimeType?.toLowerCase() === "video/h264") || [];
            if (h264.length && sender) {
              const t = pc!.getTransceivers().find((tr) => tr.sender === sender);
              if (t && typeof (t as any).setCodecPreferences === "function") (t as any).setCodecPreferences(h264);
            }
          } catch {
            try { pc!.addTrack(track, streamRef.current!); } catch {}
          }
        });
        setTimeout(() => applySenderParams(pc!), 50);
      } else {
        applySenderParams(pc);
      }
      await new Promise((r) => setTimeout(r, Math.random() * 80));
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false } as any);
        await pc.setLocalDescription(offer);
        console.log(`[WebRTC] offer sent to ${studentSocketId} sdpType=${offer.type}`);
        socket?.emit("webrtc:offer", { to: studentSocketId, sdp: offer, code: classroomCode });
      } catch (e) {
        console.error(`[WebRTC] createOffer gagal untuk ${studentSocketId}`, e);
      }
    },
    [role, createPeer, socket, classroomCode, applySenderParams]
  );

  const sendOffersBatched = useCallback(
    async (ids: string[]) => {
      console.log(`[WebRTC] sendOffersBatched ${ids.length} murid`);
      for (let i = 0; i < ids.length; i++) {
        sendOfferTo(ids[i]);
        if (i % 8 === 7) await new Promise((r) => setTimeout(r, 120));
      }
    },
    [sendOfferTo]
  );

  useEffect(() => {
    if (!socket) return;
    const onOffer = async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (role !== "STUDENT") return;
      console.log(`[WebRTC] onOffer dari ${data.from}`);
      let pc = peersRef.current.get(data.from);
      if (!pc) pc = createPeer(data.from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`[WebRTC] answer sent ke ${data.from}`);
        socket.emit("webrtc:answer", { to: data.from, sdp: answer, code: classroomCode });
      } catch (e) {
        console.error("[WebRTC] onOffer gagal", e);
      }
    };
    const onAnswer = async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (role !== "TEACHER") return;
      console.log(`[WebRTC] onAnswer dari ${data.from}`);
      const pc = peersRef.current.get(data.from);
      if (pc && data.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log(`[WebRTC] remoteDescription answer set untuk ${data.from}`);
        } catch (e) {
          console.error("[WebRTC] setRemoteDescription answer gagal", e);
        }
      }
    };
    const onIce = async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peersRef.current.get(data.from);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn("[WebRTC] addIceCandidate gagal", e);
        }
      }
    };
    const onStudentJoined = (data: { socketId: string }) => {
      console.log(`[WebRTC] student:joined ${data.socketId}`);
      if (role === "TEACHER" && streamRef.current) sendOfferTo(data.socketId);
    };
    const onTeacherStart = () => {
      console.log("[WebRTC] teacher:started-sharing received");
      if (role === "STUDENT") setConnectionState("connecting");
    };
    const onTeacherStop = () => {
      console.log("[WebRTC] teacher:stopped-sharing received");
      if (role === "STUDENT") {
        peersRef.current.forEach((pc) => pc.close());
        peersRef.current.clear();
        setRemoteStream(null);
        setConnectionState("idle");
        setStats(null);
      }
    };
    const onRequestOffer = (data: { from: string }) => {
      console.log(`[WebRTC] student:request-offer dari ${data.from}`);
      if (role === "TEACHER" && streamRef.current) sendOfferTo(data.from);
    };
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIce);
    socket.on("student:joined", onStudentJoined);
    socket.on("teacher:started-sharing", onTeacherStart);
    socket.on("teacher:stopped-sharing", onTeacherStop);
    socket.on("student:request-offer", onRequestOffer);
    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIce);
      socket.off("student:joined", onStudentJoined);
      socket.off("teacher:started-sharing", onTeacherStart);
      socket.off("teacher:stopped-sharing", onTeacherStop);
      socket.off("student:request-offer", onRequestOffer);
    };
  }, [socket, role, createPeer, sendOfferTo, classroomCode]);

  useEffect(() => {
    if (role !== "TEACHER" || !localStream) return;
    const iv = setInterval(async () => {
      const pcs = Array.from(peersRef.current.values());
      if (pcs.length === 0) return;
      try {
        const pc = pcs[0];
        const report = await pc.getStats();
        let packetsLost = 0;
        let packetsSent = 0;
        let framesPerSecond = 0;
        report.forEach((v: any) => {
          if (v.type === "outbound-rtp" && v.kind === "video") {
            packetsLost = v.packetsLost || 0;
            packetsSent = v.packetsSent || 0;
            framesPerSecond = v.framesPerSecond || 0;
          }
        });
        setStats({
          bitrateKbps: 1000,
          fps: Math.round(framesPerSecond) || 30,
          packetLoss: packetsSent ? Math.round((packetsLost / packetsSent) * 100) : 0,
        });
      } catch {}
    }, 2000);
    return () => clearInterval(iv);
  }, [role, localStream]);

  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ============================================================
  // OPTIMASI 4: Stagger di sisi MURID 1000-4000ms (anti spike CPU guru)
  // ============================================================
  const requestOffer = useCallback(() => {
    if (role !== "STUDENT" || !socket) return;
    const delay = Math.floor(Math.random() * 3000) + 1000; // 1000-4000ms
    console.log(`[WebRTC] requestOffer akan dikirim dalam ${delay}ms (stagger)`);
    setTimeout(() => {
      console.log("[WebRTC] requestOffer emit");
      socket.emit("student:request-offer", { code: classroomCode });
    }, delay);
  }, [role, socket, classroomCode]);

  return {
    localStream,
    remoteStream,
    connectionState,
    stats,
    startSharing,
    stopSharing,
    sendOfferTo,
    sendOffersBatched,
    requestOffer,
  };
}
