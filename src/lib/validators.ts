export function validateUsername(username: string): string | null {
  if (!username || typeof username !== "string") return "Username wajib diisi";
  const u = username.trim();
  if (u.length < 3) return "Username minimal 3 karakter";
  if (u.length > 32) return "Username maksimal 32 karakter";
  if (!/^[a-zA-Z0-9._-]+$/.test(u)) return "Username hanya boleh huruf, angka, titik, underscore, dash";
  return null;
}
export function validatePassword(password: string): string | null {
  if (!password || typeof password !== "string") return "Password wajib diisi";
  if (password.length < 6) return "Password minimal 6 karakter";
  if (password.length > 128) return "Password terlalu panjang";
  return null;
}
export function validateName(name: string): string | null {
  if (!name || typeof name !== "string") return "Nama wajib diisi";
  const n = name.trim();
  if (n.length < 2) return "Nama minimal 2 karakter";
  if (n.length > 50) return "Nama maksimal 50 karakter";
  return null;
}
export function validateClassName(name: string): string | null {
  if (!name || typeof name !== "string") return "Nama kelas wajib diisi";
  if (name.trim().length < 2) return "Nama kelas minimal 2 karakter";
  if (name.trim().length > 60) return "Nama kelas maksimal 60 karakter";
  return null;
}
export function validateSubject(subject: string): string | null {
  if (!subject || typeof subject !== "string") return "Mata pelajaran wajib diisi";
  if (subject.trim().length < 2) return "Mata pelajaran minimal 2 karakter";
  if (subject.trim().length > 60) return "Mata pelajaran maksimal 60 karakter";
  return null;
}
export function validateMessage(content: string): string | null {
  if (!content || typeof content !== "string") return "Pesan tidak boleh kosong";
  const c = content.trim();
  if (c.length === 0) return "Pesan tidak boleh kosong";
  if (c.length > 1000) return "Pesan maksimal 1000 karakter";
  return null;
}
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/msword",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".ppt", ".doc", ".zip", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".gif"];
