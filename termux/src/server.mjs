import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pipeline as streamPipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import * as db from "./db.mjs";
import { DATA_DIR, ensureDir, uploadDir, projectDir, resolveSafe, toAbsolute, toRelative } from "./paths.mjs";
import { isYoutubeUrl } from "./media.mjs";
import { startWorker } from "./pipeline.mjs";
import { TEMPLATES, ASPECT_RATIOS } from "./templates.mjs";
import { homePage, loginPage, projectPage } from "./views.mjs";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
// 폰 안에서만 쓰는 게 기본. 같은 와이파이의 PC 에서도 열려면 0.0.0.0 으로.
const HOST = process.env.HOST || "127.0.0.1";

const MAX_UPLOAD = 4 * 1024 * 1024 * 1024;
const ALLOWED_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".3gp", ".mpg", ".mpeg"]);

// ─── 작은 도우미들 ─────────────────────────────────────────────────────────

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
  res.end(body);
};
const json = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
const redirect = (res, location, headers = {}) => {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
};

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > limit) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const readJson = async (req) => {
  try {
    return JSON.parse(await readBody(req));
  } catch {
    return null;
  }
};

const readForm = async (req) => Object.fromEntries(new URLSearchParams(await readBody(req)));

const MIME = { ".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

/** Range 지원. 이게 없으면 영상 탐색(seek)이 안 된다. */
function serveFile(req, res, abs) {
  const stat = fs.statSync(abs);
  const type = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.range;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number.parseInt(m[1], 10) : 0;
    const end = Math.min(m?.[2] ? Number.parseInt(m[2], 10) : stat.size - 1, stat.size - 1);

    if (Number.isNaN(start) || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, {
      "Content-Type": type,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
    });
    return fs.createReadStream(abs, { start, end }).pipe(res);
  }

  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes" });
  fs.createReadStream(abs).pipe(res);
}

// ─── 라우팅 ────────────────────────────────────────────────────────────────

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;
  const cookies = parseCookies(req);
  const user = db.userForSession(cookies.sf_session);
  const hasAnyUser = db.db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0;

  // 로그인 ───────────────────────────────────────────────────────────────
  if (p === "/login" && req.method === "GET") {
    if (user) return redirect(res, "/");
    return send(res, 200, loginPage({ hasUser: hasAnyUser }));
  }

  if (p === "/login" && req.method === "POST") {
    const form = await readForm(req);
    const email = String(form.email || "").trim().toLowerCase();
    const password = String(form.password || "");

    if (!email || password.length < 8) {
      return send(res, 400, loginPage({ hasUser: hasAnyUser, error: "이메일과 8자 이상 비밀번호를 입력하세요." }));
    }

    let account = db.findUserByEmail(email);
    if (!account) {
      // 첫 사용자는 관리자로 만든다. 이후엔 아무나 가입되지 않는다.
      if (hasAnyUser) {
        return send(res, 401, loginPage({ hasUser: true, error: "이메일 또는 비밀번호가 올바르지 않습니다." }));
      }
      account = db.upsertAdmin(email, password);
      console.log(`[auth] 관리자 계정을 만들었습니다: ${email}`);
    } else if (!db.verifyPassword(password, account.pw_hash)) {
      return send(res, 401, loginPage({ hasUser: true, error: "이메일 또는 비밀번호가 올바르지 않습니다." }));
    }

    const token = db.createSession(account.id);
    return redirect(res, "/", {
      "Set-Cookie": `sf_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    });
  }

  if (p === "/logout" && req.method === "POST") {
    db.destroySession(cookies.sf_session);
    return redirect(res, "/login", { "Set-Cookie": "sf_session=; Path=/; Max-Age=0" });
  }

  // 여기부터는 로그인 필요 ────────────────────────────────────────────────
  if (!user) {
    if (p.startsWith("/api/") || p.startsWith("/media/")) return json(res, 401, { error: "로그인이 필요합니다." });
    return redirect(res, "/login");
  }

  if (p === "/" && req.method === "GET") {
    return send(res, 200, homePage({ user, projects: db.listProjects(user.id) }));
  }

  // 업로드: 파일을 본문 그대로 받는다(멀티파트 파서가 필요 없다)
  if (p === "/api/upload" && req.method === "PUT") {
    const name = url.searchParams.get("name") || "video.mp4";
    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return json(res, 415, { error: `지원하지 않는 형식입니다: ${ext || "확장자 없음"}` });

    const size = Number.parseInt(req.headers["content-length"] || "0", 10);
    if (size > MAX_UPLOAD) return json(res, 413, { error: "파일이 너무 큽니다." });

    const dir = ensureDir(uploadDir(user.id));
    const target = path.join(dir, `${randomUUID()}${ext}`);
    try {
      await streamPipeline(req, fs.createWriteStream(target));
    } catch (err) {
      fs.rmSync(target, { force: true });
      return json(res, 500, { error: `업로드 실패: ${err.message}` });
    }
    return json(res, 200, { path: toRelative(target) });
  }

  if (p === "/api/projects" && req.method === "POST") {
    const input = await readJson(req);
    if (!input) return json(res, 400, { error: "요청 형식이 올바르지 않습니다." });

    if (!db.isUnlimited(user) && user.credit_seconds <= 0) {
      return json(res, 402, { error: "남은 크레딧이 없습니다." });
    }

    let title, sourceUrl = null, sourcePath = null;

    if (input.sourceType === "youtube") {
      if (!input.url || !isYoutubeUrl(input.url)) return json(res, 400, { error: "유튜브 주소만 넣을 수 있습니다." });
      sourceUrl = input.url;
      title = `유튜브 영상 ${new Date().toLocaleDateString("ko-KR")}`;
    } else if (input.sourceType === "upload") {
      const prefix = `uploads/${user.id}/`;
      if (!input.path?.startsWith(prefix) || !resolveSafe(input.path)) {
        return json(res, 400, { error: "잘못된 파일 경로입니다." });
      }
      if (!fs.existsSync(toAbsolute(input.path))) return json(res, 400, { error: "업로드한 파일이 없습니다." });
      sourcePath = input.path;
      title = String(input.title || "업로드한 영상").slice(0, 120);
    } else {
      return json(res, 400, { error: "sourceType 이 올바르지 않습니다." });
    }

    const minShortSec = 20;
    const maxShortSec = Math.max(25, Math.min(180, Number(input.maxShortSec) || 60));

    const project = db.createProject({
      userId: user.id,
      title,
      sourceType: input.sourceType,
      sourceUrl,
      sourcePath,
      templateId: TEMPLATES.some((t) => t.id === input.templateId) ? input.templateId : "sandpaper",
      aspectRatio: ASPECT_RATIOS.some((a) => a.id === input.aspectRatio) ? input.aspectRatio : "9:16",
      minShortSec,
      maxShortSec,
      removeSilence: input.removeSilence !== false,
      autoSubtitle: input.autoSubtitle !== false,
    });

    db.enqueue(project.id, "pipeline");
    return json(res, 200, { id: project.id });
  }

  let m;
  if ((m = /^\/api\/projects\/([\w-]+)$/.exec(p)) && req.method === "GET") {
    const project = db.getProject(m[1]);
    if (!project || project.user_id !== user.id) return json(res, 404, { error: "없는 프로젝트입니다." });
    const { transcript_json, ...rest } = project;
    return json(res, 200, { project: rest, shorts: db.listShorts(project.id) });
  }

  if ((m = /^\/p\/([\w-]+)$/.exec(p)) && req.method === "GET") {
    const project = db.getProject(m[1]);
    if (!project || project.user_id !== user.id) return send(res, 404, "없는 프로젝트입니다.");
    return send(res, 200, projectPage({ user, project, shorts: db.listShorts(project.id) }));
  }

  if ((m = /^\/p\/([\w-]+)\/delete$/.exec(p)) && req.method === "POST") {
    const project = db.getProject(m[1]);
    if (!project || project.user_id !== user.id) return send(res, 404, "없는 프로젝트입니다.");

    db.deleteProject(project.id);
    fs.rmSync(projectDir(project.id), { recursive: true, force: true });
    // 업로드 원본은 projects/ 밖에 있어 따로 지운다.
    if (project.source_type === "upload" && project.source_path) {
      const abs = resolveSafe(project.source_path);
      if (abs) fs.rmSync(abs, { force: true });
    }
    return redirect(res, "/");
  }

  if ((m = /^\/api\/shorts\/([\w-]+)$/.exec(p)) && req.method === "PATCH") {
    const short = db.getShort(m[1]);
    if (!short) return json(res, 404, { error: "없는 쇼츠입니다." });
    const project = db.getProject(short.project_id);
    if (!project || project.user_id !== user.id) return json(res, 404, { error: "없는 쇼츠입니다." });

    const input = (await readJson(req)) ?? {};
    const startSec = Number.isFinite(input.startSec) ? input.startSec : short.start_sec;
    const endSec = Number.isFinite(input.endSec) ? input.endSec : short.end_sec;

    if (endSec - startSec < 5) return json(res, 400, { error: "구간은 5초 이상이어야 합니다." });
    if (endSec - startSec > 180) return json(res, 400, { error: "구간은 3분을 넘을 수 없습니다." });
    if (project.duration_sec > 0 && endSec > project.duration_sec) {
      return json(res, 400, { error: "원본 영상 길이를 넘었습니다." });
    }

    db.updateShort(short.id, {
      title: String(input.title || short.title).slice(0, 80),
      start_sec: startSec,
      end_sec: endSec,
      template_id: TEMPLATES.some((t) => t.id === input.templateId) ? input.templateId : short.template_id,
      aspect_ratio: ASPECT_RATIOS.some((a) => a.id === input.aspectRatio) ? input.aspectRatio : short.aspect_ratio,
      ...(input.rerender ? { status: "pending", error: null } : {}),
    });

    if (input.rerender) {
      db.enqueue(project.id, "rerender", { shortId: short.id });
      db.updateProject(project.id, { status: "rendering", stage: `쇼츠 ${short.idx} 다시 만드는 중`, error: null });
    }
    return json(res, 200, { ok: true });
  }

  if (p.startsWith("/media/") && req.method === "GET") {
    const rel = decodeURIComponent(p.slice("/media/".length));
    // 경로를 넘겨받아 바로 열지 않고, 내 쇼츠인지 DB 로 확인한다.
    const owned = db.db
      .prepare(
        `SELECT s.id FROM shorts s JOIN projects pr ON pr.id = s.project_id
         WHERE pr.user_id = ? AND (s.file_path = ? OR s.thumb_path = ?)`
      )
      .get(user.id, rel, rel);
    if (!owned) return json(res, 404, { error: "파일을 찾을 수 없습니다." });

    const abs = resolveSafe(rel);
    if (!abs || !fs.existsSync(abs)) return json(res, 404, { error: "파일을 찾을 수 없습니다." });
    return serveFile(req, res, abs);
  }

  return send(res, 404, "찾을 수 없는 주소입니다.");
}

// ─── 기동 ──────────────────────────────────────────────────────────────────

ensureDir(DATA_DIR);
startWorker();

http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[server]", err);
      if (!res.headersSent) json(res, 500, { error: err.message });
      else res.end();
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`\n숏플로우가 시작됐습니다.\n\n  브라우저에서 열기 →  http://localhost:${PORT}\n`);
    console.log(`데이터 위치: ${DATA_DIR}`);
    console.log("종료하려면 Ctrl+C\n");
  });
