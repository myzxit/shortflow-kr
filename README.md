# 숏플로우 (ShortFlow)

롱폼 영상 하나를 넣으면 AI가 하이라이트를 찾아 자막까지 넣은 **쇼츠**로 만들어 주는 한국어 SaaS입니다.
유튜브 링크나 영상 파일을 받아 음성을 인식하고, 점수가 높은 구간을 골라 세로 비율로 잘라 mp4로 내보냅니다.

모든 처리(음성 인식 포함)가 **내 서버 안에서** 돌아갑니다. 외부 AI API 키가 필요 없습니다.

```
유튜브 링크 / 파일 업로드
        ↓  yt-dlp
     원본 mp4
        ↓  ffmpeg (16kHz mono wav)
      오디오
        ↓  faster-whisper (단어 단위 타임스탬프)
   문장 + 단어 타임스탬프
        ↓  훅 표현 사전 기반 점수화 → 겹치지 않는 상위 구간 선정
    하이라이트 구간
        ↓  무음 제거 → 세로 크롭 → ASS 자막 번인 (ffmpeg 단일 filter_complex)
      쇼츠 mp4
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| AI 자동 자막 | faster-whisper 의 단어 타임스탬프로 자막을 짧게 끊어 붙입니다 |
| 하이라이트 자동 선정 | 질문형·수치·핵심 정리 표현 등에 가중치를 둬 점수화합니다 |
| 앞 3초 훅 | 가장 점수가 높은 문장이 결과물 앞 3초에 오도록 구간을 잡습니다 |
| 무음 제거 | 문장 사이 공백이 기준을 넘으면 잘라내고 자막 타이밍을 다시 계산합니다 |
| 템플릿 5종 | 샌드페이퍼 · 미니멀 · 바이브런트 · 그린라인 · 뉴스레터 |
| 비율 3종 | 9:16 · 1:1 · 16:9 |
| 편집 후 재생성 | 제목·구간·템플릿·비율을 바꿔 다시 렌더링 (크레딧 차감 없음) |
| 크레딧 과금 | 원본 영상 길이(초) 단위. 결과물 개수와 무관 |

## 필요한 것

| 도구 | 용도 | 없으면 |
|------|------|--------|
| Node.js 20+ | 웹 앱 | 필수 |
| `ffmpeg`, `ffprobe` | 영상 처리 | 필수 |
| Python 3.9+ · `faster-whisper` | 음성 인식 | 필수 |
| `yt-dlp` | 유튜브 다운로드 | 파일 업로드만 사용 가능 |
| 한글 폰트 | 자막 렌더링 | 자막이 □□□ 로 나옵니다 |

```bash
# Debian / Ubuntu
sudo apt-get install -y ffmpeg fonts-nanum
pip install -U yt-dlp faster-whisper

# macOS
brew install ffmpeg yt-dlp
pip install -U faster-whisper
```

한글 폰트 이름이 `NanumGothic` 이 아니라면 `.env` 에 `SUBTITLE_FONT` 를 지정하세요.

## 설치

```bash
git clone https://github.com/myzxit/shortflow-kr.git
cd shortflow-kr
npm install

cp .env.example .env
openssl rand -base64 32     # 출력값을 .env 의 AUTH_SECRET 에 넣습니다

npm run db:push             # SQLite 스키마 생성
```

터미널 두 개로 띄웁니다. **웹 서버만 띄우면 작업이 큐에 쌓인 채 처리되지 않습니다.**

```bash
npm run dev            # 1) 웹 (http://localhost:3000)
npm run worker         # 2) 렌더링 워커
```


## 폰에서 쓰기 (안드로이드)

PC나 서버 없이 **폰 하나로** 쓰려면 [`termux/`](termux/) 를 보세요.
Prisma·Next.js·faster-whisper 는 안드로이드에서 돌지 않아, 네이티브 빌드가 필요 없는
구성(Node 내장 SQLite + whisper.cpp + 순수 Node 서버)으로 따로 포팅해 두었습니다.

```bash
pkg install -y git
git clone https://github.com/myzxit/shortflow-kr.git
cd shortflow-kr/termux && bash setup.sh && bash start.sh
```

## 서버에 배포하기 (전체 동작)

Docker 한 방으로 웹 + 워커가 같이 뜹니다. ffmpeg·yt-dlp·faster-whisper·한글 폰트가
이미지 안에 들어 있고, 음성 인식 모델도 빌드할 때 미리 받아 둡니다.

```bash
git clone https://github.com/myzxit/shortflow-kr.git && cd shortflow-kr

cat > .env <<EOF
AUTH_SECRET=$(openssl rand -base64 32)
SITE_URL=https://내도메인.example.com
ADMIN_EMAIL=admin@내도메인.example.com
ADMIN_PASSWORD=충분히-긴-비밀번호
WHISPER_MODEL=small
EOF

docker compose up -d --build
```

`http://서버주소:3000` 으로 바로 열립니다. 도메인과 HTTPS를 붙이려면 앞단에
Caddy·nginx 같은 리버스 프록시를 두고 `SITE_URL` 을 그 주소로 맞추세요.

| 항목 | 값 |
|------|-----|
| 첫 빌드 시간 | 5~15분 (모델 다운로드 포함) |
| 이미지 크기 | 모델 `small` 기준 약 3GB |
| 최소 사양 | 2 vCPU / 4GB RAM. 음성 인식이 CPU를 오래 씁니다 |
| 데이터 | `data` 볼륨 하나에 DB와 영상이 모두 들어갑니다 |

웹과 워커는 같은 볼륨을 쓰므로 **같은 호스트**에 있어야 합니다. GPU가 있으면
`WHISPER_DEVICE=cuda`, `WHISPER_COMPUTE_TYPE=float16` 으로 훨씬 빨라집니다.

```bash
docker compose logs -f worker     # 처리 상황 보기
docker compose down               # 중지 (데이터는 볼륨에 남음)
docker compose down -v            # 데이터까지 삭제
```

### 관리자 계정

`role=admin` 계정은 **크레딧이 차감되지 않습니다**. 길이 제한 없이 몇 편이든 처리합니다.

```bash
# 컨테이너 밖에서 직접 만들기
npm run admin -- admin@example.com '비밀번호8자이상'

# 이미 떠 있는 컨테이너에서
docker compose exec web npx tsx scripts/create-admin.ts admin@example.com '비밀번호8자이상'
```

`.env` 에 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 를 넣어 두면 기동할 때마다 맞춰집니다.
이미 있는 이메일이면 비밀번호만 새로 설정하고 관리자로 올립니다. 작업실 화면에는
잔여 크레딧이 "무제한" 으로 표시됩니다.

## 동작 확인

음성 인식 없이 렌더링 경로만 빠르게 확인할 수 있습니다. 합성 영상을 만들어
하이라이트 선정 → 무음 제거 → 자막 번인 → mp4 출력까지 돌립니다.

```bash
npm run smoke          # 결과물: storage/smoke/short-1.mp4
```

## 환경변수

`.env.example` 참고. 자주 건드리는 값만 추리면:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `file:./dev.db` | Postgres 로 바꾸려면 `prisma/schema.prisma` 의 `provider` 도 함께 변경 |
| `AUTH_SECRET` | — | 필수. `openssl rand -base64 32` |
| `STORAGE_DIR` | `./storage` | 원본·결과물 저장 위치 |
| `WHISPER_MODEL` | `small` | `tiny`~`large-v3`. 클수록 정확하고 느립니다 |
| `WHISPER_DEVICE` | `cpu` | GPU 가 있으면 `cuda` + `WHISPER_COMPUTE_TYPE=float16` |
| `SUBTITLE_FONT` | `NanumGothic` | 시스템에 설치된 한글 폰트 이름 |
| `AUTH_GOOGLE_ID` / `_SECRET` | 빈 값 | 비우면 이메일 로그인만 활성화 |
| `STRIPE_SECRET_KEY` | 빈 값 | 비우면 결제가 **모의 결제**로 동작해 크레딧이 바로 지급됩니다 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 빈 값 | 설정하면 기동 시 무제한 관리자 계정을 만듭니다 |

## 구조

```
src/
  app/                 # 랜딩 · 요금제 · 가이드 · FAQ · 무료 도구 · 작업실 · 약관
    api/               # 인증 · 업로드 · 프로젝트 · 쇼츠 · 결제 · 미디어 서빙
  components/          # UI
  lib/
    hookPatterns.ts    # 훅 표현 사전 (워커와 무료 도구가 공유)
    pricing.ts         # 요금 정책
    templates.ts       # 자막 템플릿
worker/
  index.ts             # DB 폴링 큐 워커
  pipeline.ts          # 전체 파이프라인
  transcribe.py        # faster-whisper 호출
  highlights.ts        # 하이라이트 선정 · 무음 구간 계산
  subtitles.ts         # 자막 덩어리 분할 · ASS 생성
  render.ts            # ffmpeg filter_complex 렌더링
```

작업 큐는 별도 브로커 없이 `Job` 테이블을 워커가 폴링하는 방식입니다. 워커가 죽어도
`lockedAt` 이 오래된 작업은 다시 큐로 돌아갑니다.

## 과금 방식

크레딧 단위는 **원본 영상 길이(초)** 입니다.

- 가입 시 1800초(30분) 지급
- 영상 길이를 확인한 **뒤에** 차감합니다. 다운로드가 실패하면 차감되지 않습니다
- 처리 중 실패하면 차감분이 자동 환불됩니다 (`refundProject`)
- 재렌더링은 무료입니다

`STRIPE_SECRET_KEY` 가 설정된 경우 크레딧 지급은 **웹훅에서만** 일어납니다.
결제 성공 페이지로 돌아온 것만으로는 지급되지 않습니다.

## 알아두어야 할 점

- **유튜브 다운로드**: 본인이 권리를 가진 영상에만 쓰세요. 타인의 영상을 내려받는 것은
  유튜브 이용약관에 어긋날 수 있고, 그 책임은 이용자에게 있습니다.
- **FFmpeg 라이선스**: 빌드에 포함된 코덱 구성에 따라 적용 라이선스가 달라집니다.
  상업적으로 배포한다면 사용 중인 빌드 구성을 확인하세요.
- **하이라이트 점수 규칙은 한국어 기준**입니다. 다른 언어도 인식은 되지만
  (`WHISPER_LANGUAGE` 변경) 구간 선정 품질은 한국어에서 가장 좋습니다.
- **랜딩 페이지의 후기와 약관 문서는 예시**입니다. 실제 이용자의 발언이 아니며,
  상업적으로 운영하려면 법률 검토를 받은 문서로 교체해야 합니다.
- 저장소는 로컬 디스크를 씁니다. 여러 대로 늘리려면 `src/lib/paths.ts` 를
  오브젝트 스토리지로 바꾸는 편이 낫습니다.

## 라이선스

MIT. 자세한 오픈소스 고지는 앱의 `/legal/oss` 페이지에 있습니다.
