#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "classroom.db");
const backupDir = path.join(root, "data", "backups");

if (!fs.existsSync(dbPath)) {
  console.error("Database belum ada di", dbPath);
  process.exit(1);
}
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.join(backupDir, `classroom-backup-${stamp}.db`);
fs.copyFileSync(dbPath, dest);
console.log(`Backup berhasil: ${dest}`);
