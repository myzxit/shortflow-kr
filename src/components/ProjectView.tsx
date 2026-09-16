"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEMPLATES, ASPECT_RATIOS } from "@/lib/templates";
import { formatDuration, formatClock, STATUS_LABEL } from "@/lib/format";

type Short = {
  id: string;
  index: number;
  title: string;
  startSec: number;
  endSec: number;
  score: number;
  reason: string | null;
  templateId: string;
  aspectRatio: string;
  status: string;
  filePath: string | null;
  thumbPath: string | null;
  error: string | null;
};

type Project = {
  id: string;
  title: string;
  status: string;
  progress: number;
  stage: string | null;
  error: string | null;
  durationSec: number;
  sourceUrl: string | null;
  shorts: Short[];
};

const ACTIVE = ["queued", "downloading", "transcribing", "analyzing", "rendering"];

export default function ProjectView({ initial }: { initial: Project }) {
  const router = useRouter();
  const [project, setProject] = useState<Project>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/projects/${initial.id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setProject(data.project);
  }, [initial.id]);

  // 처리 중일 때만 폴링한다. 끝나면 타이머를 건다는 것 자체를 멈춘다.
  useEffect(() => {
    if (!ACTIVE.includes(project.status)) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [project.status, refresh]);

  const isActive = ACTIVE.includes(project.status);
  const done = project.shorts.filter((s) => s.status === "done");

  async function deleteProject() {
    if (!confirm("이 프로젝트와 만들어진 쇼츠를 모두 삭제합니다. 계속할까요?")) return;
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
  }

  return (
    <div className="section">
      <Link href="/dashboard" className="text-sm text-white/45 hover:text-white">
        ← 작업실로
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">{project.title}</h1>
          <p className="mt-2 text-sm text-white/45">
            {project.durationSec > 0 && `원본 ${formatDuration(project.durationSec)} · `}
            쇼츠 {done.length}개 완성
            {project.sourceUrl && (
              <>
                {" · "}
                <a
                  href={project.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline"
                >
                  원본 보기
                </a>
              </>
            )}
          </p>
        </div>
        <button onClick={deleteProject} className="btn-ghost text-red-300 hover:border-red-400">
          프로젝트 삭제
        </button>
      </div>

      {/* 진행 상태 */}
      {isActive && (
        <div className="card mt-8">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {project.stage || STATUS_LABEL[project.status] || "처리 중"}
            </span>
            <span className="text-white/50">{project.progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[color:var(--color-brand)] transition-all duration-500"
              style={{ width: `${Math.max(3, project.progress)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-white/40">
            창을 닫아도 처리는 계속됩니다. 나중에 작업실에서 다시 확인하세요.
          </p>
        </div>
      )}

      {project.status === "failed" && (
        <div className="mt-8 rounded-xl bg-red-500/10 px-5 py-4 text-sm text-red-200">
          <p className="font-semibold">처리에 실패했습니다.</p>
          <p className="mt-1 text-red-200/80">{project.error}</p>
          <p className="mt-2 text-xs text-red-200/60">
            차감된 크레딧은 자동으로 복구되었습니다.
          </p>
        </div>
      )}

      {/* 쇼츠 목록 */}
      {project.shorts.length > 0 && (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {project.shorts.map((short) => (
            <ShortCard
              key={short.id}
              short={short}
              projectDuration={project.durationSec}
              editing={editingId === short.id}
              onToggleEdit={() => setEditingId(editingId === short.id ? null : short.id)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {!isActive && project.shorts.length === 0 && project.status !== "failed" && (
        <p className="mt-12 rounded-xl border border-dashed border-[color:var(--color-ink-line)] px-6 py-12 text-center text-sm text-white/40">
          아직 만들어진 쇼츠가 없습니다.
        </p>
      )}
    </div>
  );
}

function ShortCard({
  short,
  projectDuration,
  editing,
  onToggleEdit,
  onChanged,
}: {
  short: Short;
  projectDuration: number;
  editing: boolean;
  onToggleEdit: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(short.title);
  const [startSec, setStartSec] = useState(short.startSec);
  const [endSec, setEndSec] = useState(short.endSec);
  const [templateId, setTemplateId] = useState(short.templateId);
  const [aspectRatio, setAspectRatio] = useState(short.aspectRatio);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(rerender: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shorts/${short.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startSec, endSec, templateId, aspectRatio, rerender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장하지 못했습니다.");
      onChanged();
      if (rerender) onToggleEdit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)]">
      <div className="relative aspect-[9/16] bg-black">
        {short.status === "done" && short.filePath ? (
          <video
            controls
            preload="metadata"
            poster={short.thumbPath ? `/api/media/${short.thumbPath}` : undefined}
            src={`/api/media/${short.filePath}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-white/40">
            {short.status === "failed" ? (
              <span className="text-red-300">{short.error || "렌더링 실패"}</span>
            ) : (
              <span>{STATUS_LABEL[short.status] ?? short.status}…</span>
            )}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">
            #{short.index} {short.title}
          </h3>
          <span className="shrink-0 text-xs text-white/35">
            {formatClock(short.startSec)}–{formatClock(short.endSec)}
          </span>
        </div>

        {short.reason && <p className="mt-2 text-xs text-white/40">{short.reason}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onToggleEdit} className="btn-ghost px-3 py-2 text-xs">
            {editing ? "편집 닫기" : "편집"}
          </button>
          {short.status === "done" && short.filePath && (
            <a
              href={`/api/media/${short.filePath}`}
              download={`${short.title || `short-${short.index}`}.mp4`}
              className="btn-primary px-3 py-2 text-xs"
            >
              내려받기
            </a>
          )}
        </div>

        {editing && (
          <div className="mt-5 space-y-4 border-t border-[color:var(--color-ink-line)] pt-5">
            <div>
              <label className="label text-xs">제목</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">시작 (초)</label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={projectDuration || undefined}
                  className="input"
                  value={startSec}
                  onChange={(e) => setStartSec(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label text-xs">끝 (초)</label>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  max={projectDuration || undefined}
                  className="input"
                  value={endSec}
                  onChange={(e) => setEndSec(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-white/35">
              길이 {Math.max(0, Math.round(endSec - startSec))}초
            </p>

            <div>
              <label className="label text-xs">템플릿</label>
              <select
                className="input"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs">화면 비율</label>
              <select
                className="input"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                {ASPECT_RATIOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => save(false)}
                disabled={busy}
                className="btn-ghost flex-1 px-3 py-2 text-xs"
              >
                저장만
              </button>
              <button
                onClick={() => save(true)}
                disabled={busy}
                className="btn-primary flex-1 px-3 py-2 text-xs"
              >
                {busy ? "처리 중…" : "다시 만들기"}
              </button>
            </div>
            <p className="text-xs text-white/30">다시 만들기에는 크레딧이 들지 않습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
