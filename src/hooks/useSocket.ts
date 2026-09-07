"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(autoConnect = true) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;
    const url = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const s = io(url, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      timeout: 8000,
    });
    socketRef.current = s;
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => setConnected(false));
    return s;
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      // don't disconnect immediately to allow page transitions; but clean up on unmount
      // socketRef.current?.disconnect();
    };
  }, [autoConnect, connect]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    setConnected(false);
  }, []);

  return { socket, connected, connect, disconnect };
}
