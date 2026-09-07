#!/usr/bin/env node
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import next from "next";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

const dev = process.argv.includes("--dev");
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  const result = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (info.address.startsWith("169.254.")) continue;
      result.push({ name, address: info.address });
    }
  }
  return result;
}
function getPrimaryIP() {
  const addrs = getLocalIPv4();
  if (!addrs.length) return "localhost";
  const wifi = addrs.find((a) => /wi-?fi|wlan|wireless/i.test(a.name));
  if (wifi) return wifi.address;
  const priv = addrs.find((a) => a.address.startsWith("192.168."));
  if (priv) return priv.address;
  return addrs[0].address;
}

function printBanner() {
  const primary = getPrimaryIP();
  const addrs = getLocalIPv4();
  const proto = httpsOptions ? "https" : "http";
  console.log("\n=====================================");
  console.log(" AL-FATIH RPL CLASSROOM");
  console.log("=====================================\n");
  console.log(` Local server: RUNNING (${httpsOptions ? "HTTPS" : "HTTP"})`);
  console.log(` Server di:    LAPTOP MURID (kamu) — bukan laptop guru`);
  console.log(` Mode:         ${dev ? "DEVELOPMENT" : "PRODUCTION"}`);
  console.log(` Port:         ${port}`);
  console.log(` Signaling:    RUNNING (Socket.IO)`);
  console.log(` Database:     READY (SQLite)`);
  console.log("");
  if (httpsOptions) {
    console.log(" GURU (kasih hotspot, BUKAN server) — AKSES VIA IP + HTTPS:");
    console.log(`   https://${primary}:${port}  ← GURU pakai ini untuk Share Screen (secure, NVENC)`);
    console.log(`   (Akan ada warning cert self-signed → klik Advanced → Proceed)`);
    console.log("");
    console.log(" MURID (termasuk laptop server kamu):");
    console.log(`   https://${primary}:${port}  ← murid juga bisa pakai https`);
    console.log(`   http://${primary}:${port}  ← fallback jika https warning mengganggu`);
  } else {
    console.log(" GURU (kasih hotspot, BUKAN server) — AKSES VIA IP (butuh flag):");
    console.log(`   http://${primary}:${port}  ← GURU pakai ini, TAPI harus aktifkan flag:`);
    console.log(`   chrome://flags/#unsafely-treat-insecure-origin-as-secure → isi http://${primary}:${port} → Enable → Restart`);
  }
  console.log("");
  if (addrs.length > 1) {
    console.log(" Alamat lain tersedia:");
    addrs.forEach((a) => {
      const p = httpsOptions ? "https" : "http";
      console.log(`   ${a.name.padEnd(14)} ${p}://${a.address}:${port}`);
    });
    console.log("");
  }
  console.log(" Internet required: NO");
  console.log(" Network:           LOCAL ONLY (hotspot guru)");
  console.log("");
  console.log(" Cara pakai (GURU BUKAN SERVER):");
  console.log("  1. Guru aktifkan Hotspot HP (tanpa internet) — HP guru jadi router");
  console.log("  2. Laptop KAMU (server) + HP murid lain konek ke hotspot guru");
  console.log(`  3. Guru buka ${proto}://${primary}:${port} → Login guru → Mulai Kelas → Share Screen`);
  console.log(`  4. Murid buka ${proto}://${primary}:${port}/join → Masuk kode kelas`);
  console.log("");
  if (!httpsOptions) {
    console.log(" Jika guru error 'getDisplayMedia' / 'NotAllowedError',");
    console.log(" → pakai https (restart server, cert akan auto-generate) atau flag di atas");
    console.log("");
  } else {
    console.log(" Tips: Jika browser blokir cert, klik Advanced → Proceed to 192.168... (unsafe)");
    console.log(" Atau guru buka chrome://flags → enable insecure origins sebagai fallback");
    console.log("");
  }
  console.log(` Setup awal: buka ${proto}://${primary}:${port}/setup  (atau http://localhost:${port}/setup di laptop server)`);
  console.log("");
  console.log(" Press Ctrl+C to stop (akan simpan guru, hapus kelas).");
  console.log("=====================================\n");
}

// ensure data dirs
const dataDir = path.join(rootDir, "data");
const storageDir = path.join(rootDir, "storage", "materials");
const certDir = path.join(rootDir, "data", "certs");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(storageDir, { recursive: true });
fs.mkdirSync(certDir, { recursive: true });

// Auto-generate self-signed cert untuk HTTPS (GURU BUKAN SERVER)
// Server = laptop murid (kamu), Guru hanya kasih hotspot → guru akses via 192.168.x.x (insecure tanpa HTTPS)
// Tanpa HTTPS, getDisplayMedia di guru akan blokir (NotAllowedError). Dengan HTTPS self-signed: https://192.168.x.x:3000 → secure → NVENC jalan
let httpsOptions = null;
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
try {
  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log("Generating self-signed cert untuk HTTPS (agar guru bisa share via IP)...");
    const mod = await import("selfsigned");
    const selfsignedLib = mod.default || mod;
    const primaryForCert = getPrimaryIP() || "localhost";
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(primaryForCert);
    const attrs = [{ name: "commonName", value: primaryForCert }];
    const altNames = [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }];
    if (isIp) {
      altNames.push({ type: 7, ip: primaryForCert });
    } else {
      altNames.push({ type: 2, value: primaryForCert });
    }
    // selfsigned v5 generate adalah async (Promise)
    const pems = await selfsignedLib.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [{ name: "subjectAltName", altNames }],
    });
    if (!pems || !pems.private || !pems.cert) throw new Error("selfsigned generate tidak mengembalikan private/cert");
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log(`Cert dibuat: ${certPath} untuk ${primaryForCert}`);
  }
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
    console.log("HTTPS self-signed siap (guru bisa pakai https:// untuk screen share)");
  }
} catch (e) {
  console.log("HTTPS cert gagal dibuat, fallback ke HTTP (guru harus pakai flag insecure):", e?.message || e);
  console.log("  Detail:", e?.stack?.split("\n")[0] || "");
  httpsOptions = null;
}

// Dynamically import db and auth helpers after ensuring file exists
// We'll need to handle socket logic inline without importing TS directly
// Instead we use better-sqlite3 via require-like dynamic import of compiled JS? 
// Simpler: implement minimal db access in this mjs using better-sqlite3 directly

import { DatabaseSync } from "node:sqlite";
import jwt from "jsonwebtoken";

const DB_PATH = process.env.DB_PATH || path.join(rootDir, "data", "classroom.db");
const JWT_SECRET = process.env.JWT_SECRET || "al-fatih-rpl-local-secret-change-in-production-32chars";

function createDbWrapper(native) {
  return {
    exec(sql) { return native.exec(sql); },
    prepare(sql) {
      const stmt = native.prepare(sql);
      return {
        get: (...p) => stmt.get(...p),
        all: (...p) => stmt.all(...p),
        run: (...p) => stmt.run(...p),
      };
    },
    close() { try { native.close(); } catch {} },
  };
}

function initDb() {
  const native = new DatabaseSync(DB_PATH);
  try { native.exec("PRAGMA journal_mode=WAL"); } catch {}
  try { native.exec("PRAGMA foreign_keys=ON"); } catch {}
  const db = createDbWrapper(native);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','TEACHER','STUDENT')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      is_locked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classroom_sessions (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('active','ended')),
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS classroom_members (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      user_id TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      left_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      sender_id TEXT,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
      uploaded_by TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS raised_hands (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      cleared_at TEXT
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const cnt = db.prepare("SELECT COUNT(*) as c FROM system_settings").get().c;
  if (cnt === 0) {
    const ins = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
    ins.run("school_name", "AL-FATIH RPL");
    ins.run("max_students", "40");
    ins.run("max_file_size_mb", "50");
    ins.run("session_timeout_hours", "24");
  }
  return db;
}

const db = initDb();

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((p) => {
    const [k, ...rest] = p.trim().split("=");
    out[k] = decodeURIComponent(rest.join("="));
  });
  return out;
}
function nowIso() {
  return new Date().toISOString();
}
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// in-memory state per classroom code
const rooms = new Map(); // code -> { members: Map<socketId, {name, role, joinedAt}>, isSharing: boolean, teacherSocketId: string | null, sessionId: string | null }

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { members: new Map(), isSharing: false, teacherSocketId: null, sessionId: null });
  return rooms.get(code);
}

const app = next({ dev, dir: rootDir, hostname, port });
const handler = app.getRequestHandler();

await app.prepare();

const requestHandler = (req, res) => handler(req, res);
const httpServer = httpsOptions
  ? createHttpsServer(httpsOptions, requestHandler)
  : createHttpServer(requestHandler);

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// auth middleware - optional
io.use((socket, nextFn) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie || "");
    const token = socket.handshake.auth?.token || cookies["rpl_session"];
    if (token) {
      const payload = verifyToken(token);
      if (payload) socket.data.user = payload;
    }
  } catch {}
  nextFn();
});

io.on("connection", (socket) => {
  const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

  socket.on("classroom:join", async (data) => {
    try {
      const { code, name, role } = data || {};
      if (!code) return;
      const upCode = String(code).toUpperCase().trim();
      const classroom = db.prepare("SELECT * FROM classrooms WHERE code=?").get(upCode);
      if (!classroom) {
        socket.emit("error", { message: "Kelas tidak ditemukan" });
        return;
      }
      const session = db.prepare("SELECT * FROM classroom_sessions WHERE classroom_id=? AND status='active' LIMIT 1").get(classroom.id);
      if (!session) {
        // allow teacher to join even if not active? For now require active for students, but teacher can join
        if (socket.data.user?.role !== "TEACHER" && socket.data.user?.role !== "ADMIN" && role !== "TEACHER") {
          socket.emit("error", { message: "Kelas belum dimulai" });
          return;
        }
      }
      const sessionId = session ? session.id : null;
      const room = getRoom(upCode);
      room.sessionId = sessionId;

      socket.join(upCode);
      socket.data.code = upCode;
      socket.data.displayName = name || socket.data.user?.name || "Guest";
      socket.data.role = socket.data.user?.role || role || "STUDENT";

      const memberInfo = {
        socketId: socket.id,
        name: socket.data.displayName,
        role: socket.data.role,
        joinedAt: nowIso(),
      };
      room.members.set(socket.id, memberInfo);

      if (socket.data.role === "TEACHER" || socket.data.role === "ADMIN") {
        room.teacherSocketId = socket.id;
      }

      // fetch recent messages / announcements / raised
      let messages = [];
      let announcements = [];
      let raised = [];
      if (sessionId) {
        messages = db.prepare("SELECT * FROM messages WHERE session_id=? ORDER BY created_at DESC LIMIT 50").all(sessionId).reverse();
        announcements = db.prepare("SELECT * FROM announcements WHERE session_id=? ORDER BY created_at DESC LIMIT 20").all(sessionId);
        raised = db.prepare("SELECT * FROM raised_hands WHERE session_id=? AND cleared_at IS NULL ORDER BY created_at ASC").all(sessionId);
        // normalize
        messages = messages.map((m) => ({ ...m, code: upCode }));
        announcements = announcements.map((a) => ({ ...a, code: upCode }));
      }

      const members = Array.from(room.members.values());

      // send to joiner
      socket.emit("classroom:joined", {
        code: upCode,
        members,
        messages,
        announcements,
        raised,
        isSharing: room.isSharing,
        classroom: { id: classroom.id, name: classroom.name, subject: classroom.subject, code: classroom.code },
      });

      // notify others
      socket.to(upCode).emit("classroom:members", { code: upCode, members });
      socket.to(upCode).emit("student:joined", { socketId: socket.id, name: memberInfo.name, code: upCode });

      log(`joined ${upCode} - ${memberInfo.name} (${memberInfo.role}) total:${members.length}`);

      // if teacher is sharing, notify new student
      if (room.isSharing && room.teacherSocketId) {
        // tell student teacher is sharing
        socket.emit("teacher:started-sharing", { code: upCode });
      }
    } catch (e) {
      console.error("join error", e);
    }
  });

  socket.on("classroom:leave", (data) => {
    const code = data?.code || socket.data.code;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.members.delete(socket.id);
    if (room.teacherSocketId === socket.id) {
      room.teacherSocketId = null;
      room.isSharing = false;
    }
    socket.leave(code);
    io.to(code).emit("classroom:members", { code, members: Array.from(room.members.values()) });
    log(`leave ${code} ${socket.id}`);
  });

  socket.on("chat:message", (data) => {
    try {
      const { code, content } = data || {};
      if (!code || !content) return;
      const upCode = String(code).toUpperCase();
      const text = String(content).trim();
      if (!text || text.length > 1000) return;
      // rate limit simple: max 10 per 10 sec per socket
      const room = rooms.get(upCode);
      if (!room) return;
      const sessionId = room.sessionId;
      if (!sessionId) return;

      const senderName = socket.data.displayName || socket.data.user?.name || "Anon";
      const senderRole = socket.data.role || socket.data.user?.role || "STUDENT";
      const senderId = socket.data.user?.id || socket.id;

      const id = genId();
      const now = nowIso();
      db.prepare("INSERT INTO messages (id, session_id, sender_id, sender_name, sender_role, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        id,
        sessionId,
        senderId,
        senderName,
        senderRole,
        text,
        now
      );
      const msg = { id, sender_name: senderName, sender_role: senderRole, content: text, created_at: now, code: upCode };
      io.to(upCode).emit("chat:message", msg);
    } catch (e) {
      console.error("chat error", e);
    }
  });

  socket.on("announcement:create", (data) => {
    try {
      const { code, content } = data || {};
      if (!code || !content) return;
      const upCode = String(code).toUpperCase();
      if (socket.data.role !== "TEACHER" && socket.data.role !== "ADMIN" && socket.data.user?.role !== "TEACHER" && socket.data.user?.role !== "ADMIN") return;
      const room = rooms.get(upCode);
      if (!room || !room.sessionId) return;
      const text = String(content).trim().slice(0, 1000);
      if (!text) return;
      const id = genId();
      const now = nowIso();
      const teacherName = socket.data.displayName || socket.data.user?.name || "Guru";
      const teacherId = socket.data.user?.id || socket.id;
      db.prepare("INSERT INTO announcements (id, session_id, teacher_id, teacher_name, content, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        id,
        room.sessionId,
        teacherId,
        teacherName,
        text,
        now
      );
      const ann = { id, content: text, teacher_name: teacherName, created_at: now, code: upCode };
      io.to(upCode).emit("announcement:new", ann);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("raised:toggle", (data) => {
    try {
      const { code } = data || {};
      if (!code) return;
      const upCode = String(code).toUpperCase();
      const room = rooms.get(upCode);
      if (!room || !room.sessionId) return;
      const name = socket.data.displayName || socket.data.user?.name || "Student";
      const sid = socket.data.user?.id || socket.id;
      // check existing
      const existing = db.prepare("SELECT * FROM raised_hands WHERE session_id=? AND student_id=? AND cleared_at IS NULL").get(room.sessionId, sid);
      if (existing) {
        const now = nowIso();
        db.prepare("UPDATE raised_hands SET cleared_at=? WHERE id=?").run(now, existing.id);
      } else {
        const id = genId();
        const now = nowIso();
        db.prepare("INSERT INTO raised_hands (id, session_id, student_id, student_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
          id,
          room.sessionId,
          sid,
          name,
          now
        );
      }
      const raised = db.prepare("SELECT * FROM raised_hands WHERE session_id=? AND cleared_at IS NULL ORDER BY created_at ASC").all(room.sessionId);
      io.to(upCode).emit("raised:update", { code: upCode, raised });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("raised:clear", (data) => {
    try {
      const { code, id } = data || {};
      if (!code) return;
      const upCode = String(code).toUpperCase();
      if (socket.data.role !== "TEACHER" && socket.data.user?.role !== "TEACHER" && socket.data.user?.role !== "ADMIN") return;
      const room = rooms.get(upCode);
      if (!room || !room.sessionId) return;
      if (id) {
        db.prepare("UPDATE raised_hands SET cleared_at=? WHERE id=? AND session_id=?").run(nowIso(), id, room.sessionId);
      } else {
        db.prepare("UPDATE raised_hands SET cleared_at=? WHERE session_id=? AND cleared_at IS NULL").run(nowIso(), room.sessionId);
      }
      const raised = db.prepare("SELECT * FROM raised_hands WHERE session_id=? AND cleared_at IS NULL ORDER BY created_at ASC").all(room.sessionId);
      io.to(upCode).emit("raised:update", { code: upCode, raised });
    } catch (e) {}
  });

  // WebRTC signaling - simple relay dengan log debug
  socket.on("webrtc:offer", (data) => {
    const { to, sdp, code } = data || {};
    if (!to || !sdp) {
      log(`webrtc:offer invalid dari ${socket.id} to=${to}`);
      return;
    }
    log(`webrtc:offer ${socket.id} -> ${to} code=${code} type=${sdp.type}`);
    io.to(to).emit("webrtc:offer", { from: socket.id, sdp, code });
  });
  socket.on("webrtc:answer", (data) => {
    const { to, sdp, code } = data || {};
    if (!to || !sdp) {
      log(`webrtc:answer invalid dari ${socket.id}`);
      return;
    }
    log(`webrtc:answer ${socket.id} -> ${to} code=${code}`);
    io.to(to).emit("webrtc:answer", { from: socket.id, sdp, code });
  });
  socket.on("webrtc:ice-candidate", (data) => {
    const { to, candidate } = data || {};
    if (!to || !candidate) return;
    // jangan log tiap candidate biar tidak spam, hanya debug
    // log(`ice-candidate ${socket.id} -> ${to}`);
    io.to(to).emit("webrtc:ice-candidate", { from: socket.id, candidate });
  });
  socket.on("student:request-offer", (data) => {
    const { code } = data || {};
    if (!code) return;
    const upCode = String(code).toUpperCase();
    const room = rooms.get(upCode);
    log(`student:request-offer dari ${socket.id} untuk ${upCode} teacher=${room?.teacherSocketId || "none"} members=${room?.members.size || 0}`);
    if (!room || !room.teacherSocketId) {
      log(`  -> tidak ada guru di ${upCode}, request diabaikan`);
      return;
    }
    io.to(room.teacherSocketId).emit("student:request-offer", { from: socket.id, code: upCode });
    log(`  -> diteruskan ke guru ${room.teacherSocketId}`);
  });
  socket.on("teacher:start-sharing", (data) => {
    const { code } = data || {};
    if (!code) return;
    const upCode = String(code).toUpperCase();
    const room = getRoom(upCode);
    room.isSharing = true;
    room.teacherSocketId = socket.id;
    socket.to(upCode).emit("teacher:started-sharing", { code: upCode });
    log(`teacher started sharing ${upCode}`);
  });
  socket.on("teacher:stop-sharing", (data) => {
    const { code } = data || {};
    if (!code) return;
    const upCode = String(code).toUpperCase();
    const room = rooms.get(upCode);
    if (room) room.isSharing = false;
    io.to(upCode).emit("teacher:stopped-sharing", { code: upCode });
    log(`teacher stopped sharing ${upCode}`);
  });

  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.members.delete(socket.id);
    if (room.teacherSocketId === socket.id) {
      room.teacherSocketId = null;
      room.isSharing = false;
      io.to(code).emit("teacher:stopped-sharing", { code });
    }
    io.to(code).emit("classroom:members", { code, members: Array.from(room.members.values()) });
    log(`disconnect ${code} ${socket.data.displayName || socket.id} remaining:${room.members.size}`);
    if (room.members.size === 0) {
      // optionally keep room but clear sharing
      room.isSharing = false;
    }
  });
});

httpServer.listen(port, hostname, () => {
  printBanner();
});

function cleanupDatabaseKeepTeachers() {
  try {
    console.log("Membersihkan database (simpan akun guru)...");
    // Hapus anak dulu karena FK
    try { db.exec("DELETE FROM raised_hands"); } catch {}
    try { db.exec("DELETE FROM messages"); } catch {}
    try { db.exec("DELETE FROM announcements"); } catch {}
    try { db.exec("DELETE FROM classroom_members"); } catch {}
    try { db.exec("DELETE FROM classroom_sessions"); } catch {}
    try { db.exec("DELETE FROM materials"); } catch {}
    try { db.exec("DELETE FROM classrooms"); } catch {}
    // Hapus user kecuali TEACHER (simpan guru). ADMIN juga dihapus agar setup tidak bingung? Simpan TEACHER saja sesuai request.
    // Jika ingin simpan ADMIN juga, ganti ke: WHERE role NOT IN ('TEACHER','ADMIN')
    try { db.exec("DELETE FROM users WHERE role != 'TEACHER'"); } catch {}
    // Opsional: reset sqlite_sequence jika ada autoincrement (tidak dipakai karena TEXT PK)
    // Hapus file materi di storage/materials
    try {
      if (fs.existsSync(storageDir)) {
        fs.rmSync(storageDir, { recursive: true, force: true });
        fs.mkdirSync(storageDir, { recursive: true });
        console.log("  - storage/materials dibersihkan");
      }
    } catch (e) {
      console.log("  - gagal bersihkan storage:", e.message);
    }
    // Hitung sisa guru
    try {
      const row = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='TEACHER'").get();
      console.log(`  - akun guru dipertahankan: ${row?.c ?? 0}`);
    } catch {}
    console.log("  - kelas, sesi, chat, materi, absensi sudah dihapus");
  } catch (e) {
    console.error("  ! cleanup gagal:", e.message);
  }
}

process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  cleanupDatabaseKeepTeachers();
  try { db.close(); } catch {}
  httpServer.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  console.log("\nShutting down gracefully...");
  cleanupDatabaseKeepTeachers();
  try { db.close(); } catch {}
  httpServer.close(() => process.exit(0));
});
