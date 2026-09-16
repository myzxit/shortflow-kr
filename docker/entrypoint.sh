#!/bin/sh
# 역할별 기동. web 은 스키마를 맞춘 뒤 서버를, worker 는 큐 처리를 시작한다.
set -e

DB_FILE=$(printf '%s' "$DATABASE_URL" | sed 's|^file:||')

mkdir -p /data "$STORAGE_DIR"

case "$1" in
  web)
    echo "[entrypoint] 스키마 동기화: $DB_FILE"
    npx prisma db push --skip-generate
    # ADMIN_EMAIL / ADMIN_PASSWORD 가 주어지면 무제한 관리자 계정을 맞춘다.
    # 이미 있으면 비밀번호만 다시 설정하므로 재기동해도 안전하다.
    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
      echo "[entrypoint] 관리자 계정 설정: $ADMIN_EMAIL"
      npx tsx scripts/create-admin.ts || echo "[entrypoint] 관리자 계정 설정 실패 (계속 진행)" >&2
    fi

    echo "[entrypoint] 웹 서버 시작 (포트 ${PORT})"
    exec npm run start -- --port "${PORT}" --hostname 0.0.0.0
    ;;

  worker)
    # web 이 DB를 만들 때까지 기다린다. 먼저 뜨면 테이블이 없어 바로 죽는다.
    echo "[entrypoint] DB 생성 대기: $DB_FILE"
    i=0
    while [ ! -f "$DB_FILE" ]; do
      i=$((i + 1))
      if [ "$i" -gt 120 ]; then
        echo "[entrypoint] DB가 준비되지 않았습니다. web 컨테이너 로그를 확인하세요." >&2
        exit 1
      fi
      sleep 1
    done
    echo "[entrypoint] 워커 시작"
    exec npm run worker:start
    ;;

  *)
    exec "$@"
    ;;
esac
