import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { auth } from "@/lib/auth";
import { ensureDir, storageRoot, toRelative } from "@/lib/paths";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4GB
const ALLOWED_EXT = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mpg", ".mpeg"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "4GB 이하 파일만 올릴 수 있습니다." }, { status: 413 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `지원하지 않는 형식입니다: ${ext || "확장자 없음"}` },
      { status: 415 }
    );
  }

  // 사용자 폴더 아래에 난수 이름으로 저장한다. 원래 파일명은 프로젝트 제목으로만 쓴다.
  const dir = ensureDir(path.join(storageRoot(), "uploads", session.user.id));
  const target = path.join(dir, `${crypto.randomUUID()}${ext}`);

  // 메모리에 전부 올리지 않도록 스트림으로 흘려 쓴다.
  await pipeline(Readable.fromWeb(file.stream() as never), fs.createWriteStream(target));

  return NextResponse.json({
    path: toRelative(target),
    name: file.name,
    size: file.size,
  });
}
