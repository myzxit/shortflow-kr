"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { TEMPLATES, ASPECT_RATIOS } from "@/lib/templates";

type Mode = "youtube" | "upload";

export default function ConvertForm() {
  const router = useRouter();
  const { status } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIOS[0].id);
  const [maxShortSec, setMaxShortSec] = useState(60);
  const [removeSilence, setRemoveSilence] = useState(true);
  const [autoSubtitle, setAutoSubtitle] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /** XHR 을 쓰는 이유: fetch 로는 업로드 진행률을 못 읽는다. */
  function uploadFile(target: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = new FormData();
      body.append("file", target);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data.path);
          else reject(new Error(data.error || "업로드에 실패했습니다."));
        } catch {
          reject(new Error("업로드 응답을 읽지 못했습니다."));
        }
      };
      xhr.onerror = () => reject(new Error("업로드 중 네트워크 오류가 발생했습니다."));
      xhr.send(body);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (status !== "authenticated") {
      router.push("/login?mode=signup&next=/dashboard");
      return;
    }

    if (mode === "youtube" && !url.trim()) {
      setError("유튜브 주소를 입력해 주세요.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("영상 파일을 선택해 주세요.");
      return;
    }

    setBusy(true);
    try {
      let uploadedPath: string | undefined;
      if (mode === "upload" && file) uploadedPath = await uploadFile(file);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: mode,
          url: mode === "youtube" ? url.trim() : undefined,
          path: uploadedPath,
          title: mode === "upload" ? file?.name : undefined,
          templateId,
          aspectRatio,
          maxShortSec,
          removeSilence,
          autoSubtitle,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "작업을 시작하지 못했습니다.");

      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      setUploadPct(0);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-[color:var(--color-ink-line)] bg-[color:var(--color-ink-soft)] p-5 shadow-2xl sm:p-7"
    >
      <div className="mb-5 inline-flex rounded-xl border border-[color:var(--color-ink-line)] p-1">
        {(
          [
            ["youtube", "유튜브 링크"],
            ["upload", "파일 업로드"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === value ? "bg-[color:var(--color-brand)] text-white" : "text-white/60 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "youtube" ? (
        <input
          type="url"
          className="input"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      ) : (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border border-dashed border-[color:var(--color-ink-line)] px-4 py-8 text-sm text-white/60 transition hover:border-[color:var(--color-brand)]"
          >
            {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(0)}MB)` : "영상 파일을 선택하세요 (mp4, mov, mkv…)"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        className="mt-4 text-sm text-white/50 underline-offset-4 hover:text-white hover:underline"
      >
        {showOptions ? "옵션 접기" : "만들기 옵션 열기"}
      </button>

      {showOptions && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="template">
              템플릿
            </label>
            <select
              id="template"
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
            <label className="label" htmlFor="aspect">
              화면 비율
            </label>
            <select
              id="aspect"
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

          <div>
            <label className="label" htmlFor="len">
              쇼츠 최대 길이: {maxShortSec}초
            </label>
            <input
              id="len"
              type="range"
              min={20}
              max={90}
              step={5}
              value={maxShortSec}
              onChange={(e) => setMaxShortSec(Number(e.target.value))}
              className="w-full accent-[color:var(--color-brand)]"
            />
          </div>

          <div className="flex flex-col justify-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoSubtitle}
                onChange={(e) => setAutoSubtitle(e.target.checked)}
                className="accent-[color:var(--color-brand)]"
              />
              자동 자막 넣기
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeSilence}
                onChange={(e) => setRemoveSilence(e.target.checked)}
                className="accent-[color:var(--color-brand)]"
              />
              무음 구간 잘라내기
            </label>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {busy && uploadPct > 0 && uploadPct < 100 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[color:var(--color-brand)] transition-all"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-5 w-full py-4 text-base">
        {busy ? "작업을 시작하는 중…" : "쇼츠로 만들기"}
      </button>

      <p className="mt-3 text-center text-xs text-white/40">
        가입하면 30분 무료. 카드 등록 없이 바로 써볼 수 있습니다.
      </p>
    </form>
  );
}
