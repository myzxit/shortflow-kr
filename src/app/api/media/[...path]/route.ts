import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSafe } from "@/lib/paths";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * 렌더링 결과물을 내보낸다.
 * storage 는 public 이 아니라서, 여기서 소유자 확인을 거쳐야만 파일에 닿을 수 있다.
 * Range 요청을 지원해야 브라우저에서 영상 탐색(seek)이 된다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { path: segments } = await params;
  const relative = segments.join("/");

  // 이 경로가 정말 이 사용자의 쇼츠인지 DB로 확인한다.
  const owned = await prisma.short.findFirst({
    where: {
      project: { userId: session.user.id },
      OR: [{ filePath: relative }, { thumbPath: relative }],
    },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const abs = resolveSafe(relative);
  if (!abs || !fs.existsSync(abs)) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const stat = fs.statSync(abs);
  const contentType = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = request.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match?.[2] ? Number.parseInt(match[2], 10) : stat.size - 1;

    if (Number.isNaN(start) || start >= stat.size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const safeEnd = Math.min(end, stat.size - 1);
    const stream = fs.createReadStream(abs, { start, end: safeEnd });

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(safeEnd - start + 1),
        "Content-Range": `bytes ${start}-${safeEnd}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const stream = fs.createReadStream(abs);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
