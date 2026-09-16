/** 화면. 빌드 도구 없이 문자열 템플릿으로 그린다(폰에서 빌드가 안 되니까). */

import { TEMPLATES, ASPECT_RATIOS } from "./templates.mjs";

export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const STATUS_LABEL = {
  queued: "대기 중", downloading: "영상 가져오는 중", transcribing: "음성 인식 중",
  analyzing: "하이라이트 분석 중", rendering: "렌더링 중", done: "완료",
  failed: "실패", pending: "대기 중",
};

export function formatDuration(total) {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s % 60}초`;
  return `${s}초`;
}

export const clock = (t) => {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0b0d12;--soft:#131722;--line:#232838;--cream:#f5f1e8;--brand:#ff5a1f;--mint:#2fd3a5}
body{background:var(--ink);color:var(--cream);font-family:-apple-system,"Noto Sans KR",Roboto,sans-serif;
  word-break:keep-all;-webkit-text-size-adjust:100%;padding-bottom:40px}
a{color:inherit}
header{position:sticky;top:0;z-index:9;display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:14px 16px;background:rgba(11,13,18,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header .logo{display:flex;align-items:center;gap:8px;font-weight:700;text-decoration:none}
header .mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--brand);color:#fff}
main{max-width:640px;margin:0 auto;padding:20px 16px}
h1{font-size:24px;line-height:1.3;margin-bottom:6px}
h2{font-size:17px;margin:28px 0 12px}
p.sub{color:#ffffff8c;font-size:14px;line-height:1.6}
.card{background:var(--soft);border:1px solid var(--line);border-radius:16px;padding:16px;margin-top:14px}
label{display:block;font-size:13px;color:#ffffffb0;margin:12px 0 6px}
input,select,textarea,button{font:inherit}
input[type=text],input[type=url],input[type=email],input[type=password],input[type=number],select{
  width:100%;padding:13px 14px;border-radius:12px;border:1px solid var(--line);
  background:var(--ink);color:var(--cream);outline:none}
input:focus,select:focus{border-color:var(--brand)}
.btn{display:block;width:100%;padding:14px;border:0;border-radius:12px;background:var(--brand);
  color:#fff;font-weight:700;text-align:center;text-decoration:none;cursor:pointer;margin-top:16px}
.btn[disabled]{opacity:.5}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--cream)}
.row{display:flex;gap:8px}
.row>*{flex:1}
.tabs{display:flex;gap:6px;padding:4px;border:1px solid var(--line);border-radius:12px;margin-bottom:14px}
.tabs button{flex:1;padding:10px;border:0;border-radius:9px;background:transparent;color:#ffffff99;font-weight:600}
.tabs button.on{background:var(--brand);color:#fff}
.drop{width:100%;padding:26px 14px;border:1px dashed var(--line);border-radius:12px;background:transparent;
  color:#ffffff99;text-align:center}
.bar{height:8px;border-radius:99px;background:#ffffff1a;overflow:hidden;margin-top:10px}
.bar>i{display:block;height:100%;background:var(--brand);transition:width .4s}
.chip{display:inline-block;padding:4px 10px;border-radius:99px;font-size:12px;background:#ffffff14;color:#ffffffa8}
.chip.ok{background:rgba(47,211,165,.15);color:var(--mint)}
.chip.bad{background:rgba(255,80,80,.15);color:#ff9d9d}
.err{background:rgba(255,80,80,.12);color:#ffb4b4;padding:12px 14px;border-radius:12px;margin-top:14px;font-size:14px}
.note{background:rgba(47,211,165,.1);color:var(--mint);padding:12px 14px;border-radius:12px;margin-top:14px;font-size:14px}
.list{margin-top:12px;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.list a{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;
  background:var(--soft);text-decoration:none;border-bottom:1px solid var(--line)}
.list a:last-child{border-bottom:0}
.list .t{font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.list .m{font-size:12px;color:#ffffff70;margin-top:3px}
video{width:100%;border-radius:12px;background:#000;display:block}
.small{font-size:12px;color:#ffffff66;margin-top:8px}
details summary{cursor:pointer;color:#ffffff99;font-size:14px;padding:6px 0}
`;

export function layout({ title, user, body }) {
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} · 숏플로우</title>
<style>${CSS}</style>
</head><body>
<header>
  <a class="logo" href="/"><span class="mark">▶</span><span>숏플로우</span></a>
  ${user ? `<form method="post" action="/logout"><button class="chip" style="border:0">로그아웃</button></form>` : ""}
</header>
<main>${body}</main>
</body></html>`;
}

export function loginPage({ error, hasUser }) {
  return layout({
    title: "로그인",
    user: null,
    body: `
<h1>${hasUser ? "로그인" : "첫 설정"}</h1>
<p class="sub">${
      hasUser
        ? "계정 정보를 입력하세요."
        : "처음 실행입니다. 여기서 만든 계정이 관리자 계정이 되고, 크레딧 제한 없이 사용합니다."
    }</p>
<form method="post" action="/login" class="card">
  <label for="email">이메일</label>
  <input id="email" name="email" type="email" required autocomplete="username" placeholder="you@example.com">
  <label for="password">비밀번호</label>
  <input id="password" name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="8자 이상">
  ${error ? `<div class="err">${esc(error)}</div>` : ""}
  <button class="btn" type="submit">${hasUser ? "로그인" : "계정 만들고 시작"}</button>
</form>`,
  });
}

export function homePage({ user, projects }) {
  const unlimited = user.role === "admin";

  const rows = projects
    .map(
      (p) => `<a href="/p/${p.id}">
  <span style="min-width:0">
    <span class="t">${esc(p.title)}</span>
    <span class="m">${
      p.duration_sec > 0 ? `원본 ${formatDuration(p.duration_sec)}` : new Date(p.created_at).toLocaleDateString("ko-KR")
    }</span>
  </span>
  <span class="chip ${p.status === "done" ? "ok" : p.status === "failed" ? "bad" : ""}">${
        STATUS_LABEL[p.status] ?? p.status
      }${p.status !== "done" && p.status !== "failed" ? " " + p.progress + "%" : ""}</span>
</a>`
    )
    .join("");

  return layout({
    title: "작업실",
    user,
    body: `
<h1>${esc(user.email.split("@")[0])}님</h1>
<p class="sub">남은 크레딧 · <b>${unlimited ? "무제한" : formatDuration(user.credit_seconds)}</b></p>
${unlimited ? `<div class="note">관리자 계정입니다. 차감 없이 무제한으로 사용합니다.</div>` : ""}

<h2>새 영상</h2>
<div class="card">
  <div class="tabs">
    <button type="button" id="tab-yt" class="on">유튜브 링크</button>
    <button type="button" id="tab-up">파일 선택</button>
  </div>

  <div id="pane-yt">
    <input id="url" type="url" placeholder="https://www.youtube.com/watch?v=...">
  </div>
  <div id="pane-up" hidden>
    <input id="file" type="file" accept="video/*" hidden>
    <button type="button" class="drop" id="pick">갤러리에서 영상 선택</button>
  </div>

  <details style="margin-top:12px">
    <summary>만들기 옵션</summary>
    <label for="tpl">템플릿</label>
    <select id="tpl">${TEMPLATES.map((t) => `<option value="${t.id}">${t.name}</option>`).join("")}</select>
    <label for="ar">화면 비율</label>
    <select id="ar">${ASPECT_RATIOS.map((a) => `<option value="${a.id}">${a.label}</option>`).join("")}</select>
    <label for="maxlen">쇼츠 최대 길이 (초)</label>
    <input id="maxlen" type="number" min="20" max="90" step="5" value="60">
    <label><input type="checkbox" id="sub" checked style="width:auto"> 자동 자막</label>
    <label><input type="checkbox" id="sil" checked style="width:auto"> 무음 제거</label>
  </details>

  <div class="bar" id="upbar" hidden><i style="width:0"></i></div>
  <div class="err" id="err" hidden></div>
  <button class="btn" id="go">쇼츠로 만들기</button>
  <p class="small">처리 중에 화면을 꺼도 계속 진행됩니다. 단, Termux 앱은 켜져 있어야 합니다.</p>
</div>

<h2>지난 작업</h2>
${projects.length ? `<div class="list">${rows}</div>` : `<p class="sub" style="margin-top:12px">아직 만든 작업이 없습니다.</p>`}

<script>
const $ = (id) => document.getElementById(id);
let mode = "youtube";
$("tab-yt").onclick = () => { mode="youtube"; $("tab-yt").classList.add("on"); $("tab-up").classList.remove("on"); $("pane-yt").hidden=false; $("pane-up").hidden=true; };
$("tab-up").onclick = () => { mode="upload"; $("tab-up").classList.add("on"); $("tab-yt").classList.remove("on"); $("pane-up").hidden=false; $("pane-yt").hidden=true; };
$("pick").onclick = () => $("file").click();
$("file").onchange = () => { const f=$("file").files[0]; if(f) $("pick").textContent = f.name + " (" + Math.round(f.size/1048576) + "MB)"; };

function fail(msg){ const e=$("err"); e.textContent=msg; e.hidden=false; $("go").disabled=false; $("go").textContent="쇼츠로 만들기"; }

function upload(file){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();
    x.open("PUT","/api/upload?name="+encodeURIComponent(file.name));
    x.upload.onprogress=(e)=>{ if(e.lengthComputable){ $("upbar").hidden=false; $("upbar").firstElementChild.style.width=Math.round(e.loaded/e.total*100)+"%"; } };
    x.onload=()=>{ try{ const d=JSON.parse(x.responseText); x.status<300?resolve(d.path):reject(new Error(d.error||"업로드 실패")); }catch(_){ reject(new Error("업로드 응답 오류")); } };
    x.onerror=()=>reject(new Error("업로드 중 네트워크 오류"));
    x.send(file);
  });
}

$("go").onclick = async () => {
  $("err").hidden=true;
  const file=$("file").files[0];
  if(mode==="youtube" && !$("url").value.trim()) return fail("유튜브 주소를 입력하세요.");
  if(mode==="upload" && !file) return fail("영상 파일을 선택하세요.");

  $("go").disabled=true; $("go").textContent="시작하는 중…";
  try{
    let path;
    if(mode==="upload") path=await upload(file);
    const r=await fetch("/api/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      sourceType:mode, url:$("url").value.trim(), path, title:file?file.name:undefined,
      templateId:$("tpl").value, aspectRatio:$("ar").value,
      maxShortSec:Number($("maxlen").value), autoSubtitle:$("sub").checked, removeSilence:$("sil").checked
    })});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"시작하지 못했습니다.");
    location.href="/p/"+d.id;
  }catch(e){ fail(e.message); }
};
</script>`,
  });
}

export function projectPage({ user, project, shorts }) {
  const tplOptions = (sel) =>
    TEMPLATES.map((t) => `<option value="${t.id}"${t.id === sel ? " selected" : ""}>${t.name}</option>`).join("");
  const arOptions = (sel) =>
    ASPECT_RATIOS.map((a) => `<option value="${a.id}"${a.id === sel ? " selected" : ""}>${a.label}</option>`).join("");

  const cards = shorts
    .map(
      (s) => `<div class="card" data-short="${s.id}">
  ${
    s.status === "done" && s.file_path
      ? `<video controls preload="metadata" ${s.thumb_path ? `poster="/media/${esc(s.thumb_path)}"` : ""} src="/media/${esc(s.file_path)}"></video>`
      : `<div class="drop">${s.status === "failed" ? esc(s.error || "렌더링 실패") : (STATUS_LABEL[s.status] ?? s.status) + "…"}</div>`
  }
  <div style="margin-top:12px;display:flex;justify-content:space-between;gap:8px">
    <b style="font-size:15px">#${s.idx} ${esc(s.title)}</b>
    <span class="chip">${clock(s.start_sec)}–${clock(s.end_sec)}</span>
  </div>
  ${s.reason ? `<p class="small">${esc(s.reason)}</p>` : ""}
  <div class="row" style="margin-top:12px">
    <button class="btn ghost" style="margin:0" onclick="toggle('${s.id}')">편집</button>
    ${s.status === "done" && s.file_path ? `<a class="btn" style="margin:0" href="/media/${esc(s.file_path)}" download="${esc(s.title || "short")}.mp4">저장</a>` : ""}
  </div>
  <div id="edit-${s.id}" hidden>
    <label>제목</label><input type="text" id="t-${s.id}" value="${esc(s.title)}">
    <div class="row">
      <div><label>시작(초)</label><input type="number" step="0.5" id="s-${s.id}" value="${s.start_sec}"></div>
      <div><label>끝(초)</label><input type="number" step="0.5" id="e-${s.id}" value="${s.end_sec}"></div>
    </div>
    <label>템플릿</label><select id="tp-${s.id}">${tplOptions(s.template_id)}</select>
    <label>비율</label><select id="ar-${s.id}">${arOptions(s.aspect_ratio)}</select>
    <button class="btn" onclick="save('${s.id}')">다시 만들기</button>
    <p class="small">다시 만들기는 크레딧이 들지 않습니다.</p>
  </div>
</div>`
    )
    .join("");

  const active = ["queued", "downloading", "transcribing", "analyzing", "rendering"].includes(project.status);

  return layout({
    title: project.title,
    user,
    body: `
<a href="/" class="small" style="text-decoration:none">← 작업실</a>
<h1 style="margin-top:8px">${esc(project.title)}</h1>
<p class="sub">${project.duration_sec > 0 ? `원본 ${formatDuration(project.duration_sec)} · ` : ""}쇼츠 ${
      shorts.filter((s) => s.status === "done").length
    }개 완성</p>

${
  active
    ? `<div class="card" id="prog">
  <div style="display:flex;justify-content:space-between;font-size:14px">
    <span id="stage">${esc(project.stage || STATUS_LABEL[project.status] || "처리 중")}</span>
    <span id="pct">${project.progress}%</span>
  </div>
  <div class="bar"><i id="pbar" style="width:${Math.max(3, project.progress)}%"></i></div>
  <p class="small">음성 인식이 가장 오래 걸립니다. 폰에서는 원본 길이의 1~3배까지 걸릴 수 있습니다.</p>
</div>`
    : ""
}
${project.status === "failed" ? `<div class="err"><b>처리 실패</b><br>${esc(project.error || "")}<br><span class="small">차감된 크레딧은 복구되었습니다.</span></div>` : ""}

${cards}

${shorts.length === 0 && !active ? `<p class="sub" style="margin-top:20px">만들어진 쇼츠가 없습니다.</p>` : ""}

<form method="post" action="/p/${project.id}/delete" onsubmit="return confirm('이 프로젝트와 결과물을 모두 삭제합니다.')">
  <button class="btn ghost" style="color:#ff9d9d">프로젝트 삭제</button>
</form>

<script>
function toggle(id){ const el=document.getElementById("edit-"+id); el.hidden=!el.hidden; }
async function save(id){
  const body={ title:document.getElementById("t-"+id).value,
    startSec:Number(document.getElementById("s-"+id).value),
    endSec:Number(document.getElementById("e-"+id).value),
    templateId:document.getElementById("tp-"+id).value,
    aspectRatio:document.getElementById("ar-"+id).value, rerender:true };
  const r=await fetch("/api/shorts/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();
  if(!r.ok){ alert(d.error||"저장 실패"); return; }
  location.reload();
}
${
  active
    ? `setInterval(async()=>{
  const r=await fetch("/api/projects/${project.id}",{cache:"no-store"});
  if(!r.ok) return;
  const p=(await r.json()).project;
  document.getElementById("stage").textContent=p.stage||"처리 중";
  document.getElementById("pct").textContent=p.progress+"%";
  document.getElementById("pbar").style.width=Math.max(3,p.progress)+"%";
  if(["done","failed"].includes(p.status)) location.reload();
},3000);`
    : ""
}
</script>`,
  });
}
