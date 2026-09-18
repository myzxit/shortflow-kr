# 숏플로우 · 안드로이드(Termux) 판

폰 하나로 롱폼 영상을 쇼츠로 만듭니다. PC도 서버도 필요 없습니다.

웹 버전과 같은 파이프라인을 쓰지만, 안드로이드에서 돌지 않는 부품 두 개를 갈아끼웠습니다.

| | 웹 버전 | 안드로이드 판 |
|---|---|---|
| 데이터베이스 | Prisma + SQLite | **Node 내장 SQLite** (`node:sqlite`) |
| 음성 인식 | faster-whisper (Python) | **whisper.cpp** (C++, ARM) |
| 웹 프레임워크 | Next.js + Tailwind | **순수 Node** (빌드 단계 없음) |
| 외부 의존성 | npm 패키지 393개 | **0개** |

Prisma는 안드로이드용 엔진 바이너리를 배포하지 않고, faster-whisper도 안드로이드 빌드가 없습니다.
Next.js와 Tailwind는 네이티브 바이너리(SWC·oxide)를 쓰는데 Termux의 libc와 맞지 않습니다.
그래서 **네이티브 빌드가 전혀 필요 없는 구성**으로 다시 만들었습니다.

## 설치

### 1. Termux 설치

**[F-Droid에서 받으세요](https://f-droid.org/packages/com.termux/)** — 구글 플레이 버전은 오래돼서 동작하지 않습니다.

### 2. 명령 3줄

Termux를 열고 그대로 붙여넣으세요.

```bash
pkg install -y git
git clone -b claude/magical-babbage-hn3jeh https://github.com/myzxit/shortflow-kr.git
cd shortflow-kr/termux && bash setup.sh
```

`-b claude/magical-babbage-hn3jeh` 를 빼면 안 됩니다. 이 안드로이드 판은 아직 그 브랜치에만
있어서, 빼고 받으면 `cd: termux: No such file or directory` 가 납니다.
(이미 그렇게 받았다면 `cd ~/shortflow-kr && git fetch origin claude/magical-babbage-hn3jeh
&& git checkout claude/magical-babbage-hn3jeh` 로 옮겨 오면 됩니다.)

`setup.sh`가 하는 일: 패키지 설치 → yt-dlp 설치 → whisper.cpp 빌드 → 음성 인식 모델 다운로드 → 한글 글꼴 다운로드.
**10~30분** 걸립니다(whisper.cpp 빌드가 대부분). 여러 번 실행해도 끝난 단계는 건너뜁니다.

### 3. 실행

```bash
bash start.sh
```

그 상태로 두고 **브라우저에서 `http://localhost:3000`** 을 여세요.

첫 화면에서 입력한 이메일·비밀번호가 **관리자 계정**이 됩니다. 크레딧 제한 없이 씁니다.

## 쓰는 법

1. **유튜브 링크** 붙여넣기 또는 **파일 선택**으로 갤러리 영상 고르기
2. 필요하면 *만들기 옵션*에서 템플릿·비율·길이 조정
3. **쇼츠로 만들기**
4. 끝나면 각 쇼츠를 재생해 보고 **저장**
5. 마음에 안 들면 **편집** → 구간·제목·템플릿 바꿔서 **다시 만들기** (크레딧 안 듦)

원본 2분당 쇼츠 1개, 최대 10개가 기본입니다.

## 폰에서 쓸 때 알아둘 것

- **Termux를 끄면 처리도 멈춥니다.** 긴 영상을 돌릴 땐 `termux-wake-lock` 을 먼저 실행해
  안드로이드가 앱을 재우지 않게 하세요. (끝나면 `termux-wake-unlock`)
- **느립니다.** 음성 인식이 폰 CPU로 돌아갑니다. 10분 영상에 10~30분 잡으세요.
  급하면 모델을 작게: `SHORTFLOW_MODEL=tiny bash setup.sh` 후 같은 변수로 `start.sh` 실행.
- **발열·배터리**를 많이 씁니다. 충전기를 꽂아 두는 편이 낫습니다.
- 결과물 해상도는 **720×1280**이 기본입니다. 업로드용으로 충분하고, 폰에서 1080은 많이 느립니다.
  올리려면 `SHORTFLOW_HQ=1 bash start.sh`.
- 영상은 폰 밖으로 나가지 않습니다. 전부 기기 안에서 처리됩니다.

## 설정

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `SHORTFLOW_DATA` | `~/shortflow-data` | DB·원본·결과물 위치 |
| `SHORTFLOW_MODEL` | `base` | `tiny`(빠름) · `base` · `small`(정확) |
| `SHORTFLOW_HQ` | 꺼짐 | `1` 이면 1080 해상도로 출력 |
| `PORT` | `3000` | 포트 |
| `HOST` | `127.0.0.1` | `0.0.0.0` 이면 같은 와이파이의 PC에서도 접속 가능 |
| `FFMPEG_PRESET` | `veryfast` | `ultrafast` 로 바꾸면 더 빠르고 용량이 큽니다 |

예) 빠르게 돌리기:

```bash
SHORTFLOW_MODEL=tiny FFMPEG_PRESET=ultrafast bash start.sh
```

## 문제가 생기면

| 증상 | 해결 |
|---|---|
| `whisper.cpp 가 없습니다` | `bash setup.sh` 를 다시 실행 |
| 자막이 □□□ 로 나옴 | 글꼴 다운로드 실패. `bash setup.sh` 재실행 후 `~/shortflow-data/fonts` 확인 |
| `Node 22 이상이 필요합니다` | `pkg upgrade nodejs` |
| 빌드 중 `libomp` 오류 | `rm -rf ~/shortflow-data/whisper.cpp` 후 `bash setup.sh` 재실행 |
| 인식 결과가 엉망 | 모델을 키우세요: `SHORTFLOW_MODEL=small bash setup.sh` |
| 처리 중 멈춤 | Termux가 재워진 것. `termux-wake-lock` 후 다시 시도 |

## 확인된 동작

이 포팅은 아래를 실제로 돌려 확인했습니다 (리눅스에서 같은 코드·같은 whisper.cpp 바이너리 기준).

- 첫 로그인 → 관리자 계정 생성, 크레딧 "무제한" 표시
- 영상 업로드 → 음성 인식 → 하이라이트 선정 → 렌더링 → 다운로드까지 완주
- 한글 자막 번인 (시스템 글꼴 없이 `fontsdir` 로 해결)
- 편집 후 재생성, 크레딧 차감 없음
- 구간 5초 미만 거부, 비로그인 401, 경로 탈출(`../`) 404
- 프로젝트 삭제 시 결과물 파일까지 정리

단, **안드로이드 실기기에서의 whisper.cpp 빌드는 직접 확인하지 못했습니다.**
빌드에서 막히면 그 오류 메시지를 알려주세요.
