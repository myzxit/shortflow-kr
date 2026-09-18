/**
 * Node 내장 SQLite (node:sqlite).
 *
 * 안드로이드에서 Prisma 를 못 쓰는 이유가 네이티브 엔진 바이너리라서,
 * 여기서는 컴파일이 필요 없는 내장 모듈만 쓴다. 의존성이 아예 없다.
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { DATA_DIR } from "./paths.mjs";

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "shortflow.db"));

// 폰에서 쓰기가 잦진 않지만, 갑자기 앱이 죽어도 DB 가 깨지지 않도록.
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  pw_hash       TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  credit_seconds INTEGER NOT NULL DEFAULT 1800,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  source_type    TEXT NOT NULL,
  source_url     TEXT,
  source_path    TEXT,
  duration_sec   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'queued',
  progress       INTEGER NOT NULL DEFAULT 0,
  stage          TEXT,
  error          TEXT,
  template_id    TEXT NOT NULL DEFAULT 'sandpaper',
  aspect_ratio   TEXT NOT NULL DEFAULT '9:16',
  target_count   INTEGER NOT NULL DEFAULT 0,
  min_short_sec  INTEGER NOT NULL DEFAULT 20,
  max_short_sec  INTEGER NOT NULL DEFAULT 60,
  remove_silence INTEGER NOT NULL DEFAULT 1,
  auto_subtitle  INTEGER NOT NULL DEFAULT 1,
  transcript_json TEXT,
  -- 실제로 차감된 초. 실패 시 이만큼만 되돌린다(관리자는 0).
  charged_seconds INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shorts (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  title        TEXT NOT NULL,
  start_sec    REAL NOT NULL,
  end_sec      REAL NOT NULL,
  score        REAL NOT NULL DEFAULT 0,
  reason       TEXT,
  template_id  TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  file_path    TEXT,
  thumb_path   TEXT,
  error        TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    TEXT,
  status     TEXT NOT NULL DEFAULT 'queued',
  error      TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shorts_project ON shorts(project_id, idx);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, created_at);
`);

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();

// ─── 비밀번호 ──────────────────────────────────────────────────────────────
// scrypt 는 node:crypto 내장이라 bcrypt 처럼 네이티브 모듈을 깔 필요가 없다.

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// ─── 사용자 ────────────────────────────────────────────────────────────────

export function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
}

export function findUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

export function isUnlimited(user) {
  return user?.role === "admin";
}

/** 관리자 계정을 만들거나, 이미 있으면 비밀번호만 새로 설정한다. */
export function upsertAdmin(email, password) {
  const normalized = String(email).toLowerCase();
  const existing = findUserByEmail(normalized);
  const hash = hashPassword(password);

  if (existing) {
    db.prepare("UPDATE users SET pw_hash = ?, role = 'admin' WHERE id = ?").run(hash, existing.id);
    return { ...existing, role: "admin" };
  }

  const id = newId();
  db.prepare(
    "INSERT INTO users (id, email, pw_hash, role, credit_seconds, created_at) VALUES (?, ?, ?, 'admin', 0, ?)"
  ).run(id, normalized, hash, nowIso());
  return findUserById(id);
}

// ─── 세션 ──────────────────────────────────────────────────────────────────

const SESSION_DAYS = 30;

export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expires
  );
  return token;
}

export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return findUserById(row.user_id);
}

export function destroySession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ─── 프로젝트 · 쇼츠 · 작업 ────────────────────────────────────────────────

export function createProject(fields) {
  const id = newId();
  db.prepare(
    `INSERT INTO projects
      (id, user_id, title, source_type, source_url, source_path,
       template_id, aspect_ratio, target_count, min_short_sec, max_short_sec,
       remove_silence, auto_subtitle, status, stage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', '대기열에 올렸습니다', ?)`
  ).run(
    id,
    fields.userId,
    fields.title,
    fields.sourceType,
    fields.sourceUrl ?? null,
    fields.sourcePath ?? null,
    fields.templateId,
    fields.aspectRatio,
    fields.targetCount ?? 0,
    fields.minShortSec ?? 20,
    fields.maxShortSec ?? 60,
    fields.removeSilence ? 1 : 0,
    fields.autoSubtitle ? 1 : 0,
    nowIso()
  );
  return getProject(id);
}

export const getProject = (id) => db.prepare("SELECT * FROM projects WHERE id = ?").get(id);

export const listProjects = (userId) =>
  db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(userId);

export function updateProject(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sql = `UPDATE projects SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...keys.map((k) => fields[k]), id);
}

export function deleteProject(id) {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export const listShorts = (projectId) =>
  db.prepare("SELECT * FROM shorts WHERE project_id = ? ORDER BY idx").all(projectId);

export const getShort = (id) => db.prepare("SELECT * FROM shorts WHERE id = ?").get(id);

export function replaceShorts(projectId, rows) {
  db.prepare("DELETE FROM shorts WHERE project_id = ?").run(projectId);
  const stmt = db.prepare(
    `INSERT INTO shorts (id, project_id, idx, title, start_sec, end_sec, score, reason,
                         template_id, aspect_ratio, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  );
  for (const r of rows) {
    stmt.run(
      newId(),
      projectId,
      r.index,
      r.title,
      r.startSec,
      r.endSec,
      r.score,
      r.reason ?? null,
      r.templateId,
      r.aspectRatio
    );
  }
}

export function updateShort(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sql = `UPDATE shorts SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...keys.map((k) => fields[k]), id);
}

export function enqueue(projectId, type, payload) {
  const id = newId();
  db.prepare(
    "INSERT INTO jobs (id, project_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, projectId, type, payload ? JSON.stringify(payload) : null, nowIso());
  return id;
}

export const claimJob = () => {
  const job = db
    .prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1")
    .get();
  if (!job) return null;
  db.prepare("UPDATE jobs SET status = 'running' WHERE id = ?").run(job.id);
  return job;
};

export function finishJob(id, error) {
  db.prepare("UPDATE jobs SET status = ?, error = ? WHERE id = ?").run(
    error ? "failed" : "done",
    error ?? null,
    id
  );
}

/** 앱이 중간에 꺼졌으면 running 으로 남은 작업이 영영 멈춘다. 시작할 때 되돌린다. */
export function recoverJobs() {
  const n = db.prepare("UPDATE jobs SET status = 'queued' WHERE status = 'running'").run().changes;
  if (n > 0) console.log(`[db] 중단된 작업 ${n}건을 큐로 되돌렸습니다.`);
}

// ─── 크레딧 ────────────────────────────────────────────────────────────────

/** @returns 실제 차감된 초. 관리자는 0. 부족하면 null. */
export function chargeSeconds(userId, seconds) {
  const user = findUserById(userId);
  if (!user) return null;
  if (isUnlimited(user)) return 0;
  if (user.credit_seconds < seconds) return null;

  db.prepare("UPDATE users SET credit_seconds = credit_seconds - ? WHERE id = ?").run(
    seconds,
    userId
  );
  return seconds;
}

export function grantSeconds(userId, seconds) {
  if (seconds > 0) {
    db.prepare("UPDATE users SET credit_seconds = credit_seconds + ? WHERE id = ?").run(
      seconds,
      userId
    );
  }
}
