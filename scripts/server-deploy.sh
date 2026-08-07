#!/usr/bin/env bash
#
# 서버 배포 스크립트 — `oh4989` 계정 홈(`~/deploy.sh`)에 한 번 두고 계속 쓴다.
# (이 파일은 저장소 보관용 원본이다. 고칠 일이 생기면 여기서 고쳐 scp로 올린다)
#
# ⚠️ 이 파일은 반드시 **LF 줄바꿈**으로 저장한다. Windows CRLF로 올리면
#    리눅스 bash가 `\r`을 명령의 일부로 읽어 `$'\r': command not found`로 죽는다.
#
# 릴리스 폴더는 **a·b 둘뿐**이고 번갈아 쓴다. 새 배포는 지금 안 쓰는 쪽에 풀고
# 링크만 옮기므로 **항상 직전 버전 하나가 남는다**. 날짜를 손으로 칠 일이 없고
# 서버에 릴리스가 쌓이지도 않는다(SSD 40GB).
#
#   ~/releases/a  ┐
#   ~/releases/b  ┴─ ~/current 가 둘 중 하나를 가리킨다
#
# 사용:
#   ./deploy.sh            새 tar를 배포
#   ./deploy.sh rollback   직전 버전으로 되돌리기

set -euo pipefail

HOME_DIR="/home/oh4989"
TARBALL="$HOME_DIR/oh4989-release.tar.gz"
ENV_FILE="$HOME_DIR/shared/oh4989.env"
CURRENT_LINK="$HOME_DIR/current"
PM2_NAME="oh4989"
HEALTH_URL="http://127.0.0.1:3100/api/trpc/health.ping"

mkdir -p "$HOME_DIR/releases" "$HOME_DIR/shared/uploads" "$HOME_DIR/shared/logs"

# 지금 가리키는 쪽을 보고 반대쪽을 고른다
live_slot() {
  if [ -L "$CURRENT_LINK" ] && [ "$(readlink -f "$CURRENT_LINK")" = "$HOME_DIR/releases/a" ]; then
    echo a
  else
    echo b
  fi
}

activate() {
  local slot="$1"
  ln -sfn "$HOME_DIR/releases/$slot" "$CURRENT_LINK"

  # PM2에 등록된 실행 경로가 심볼릭 링크가 아니라 실제 폴더로 박제돼 있으면
  # 링크를 옮겨도 옛 코드가 그대로 뜬다. 그때는 재등록해야 한다.
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    if pm2 describe "$PM2_NAME" | grep -q "releases/"; then
      echo "  PM2에 실제 경로가 박제되어 있어 재등록합니다"
      pm2 delete "$PM2_NAME" >/dev/null
      pm2 start "$CURRENT_LINK/ecosystem.config.cjs" >/dev/null
    else
      pm2 reload "$PM2_NAME" >/dev/null
    fi
  else
    pm2 start "$CURRENT_LINK/ecosystem.config.cjs" >/dev/null
  fi
  pm2 save >/dev/null
}

# 정적 파일(robots.txt)이 아니라 tRPC 왕복으로 확인한다 —
# 정적 파일만 보면 "Next는 떴는데 서버 코드가 죽은" 상태를 놓친다.
verify() {
  local code=000
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    code="$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo 000)"
    if [ "$code" = "200" ]; then
      echo "  ✓ 정상 (health.ping HTTP 200, ${i}초)"
      return 0
    fi
  done
  echo "  ✗ 응답 없음 (마지막 HTTP $code) — pm2 logs $PM2_NAME 확인"
  return 1
}

if [ "${1:-}" = "rollback" ]; then
  LIVE="$(live_slot)"
  OTHER=$([ "$LIVE" = a ] && echo b || echo a)
  if [ ! -d "$HOME_DIR/releases/$OTHER" ]; then
    echo "✗ 되돌릴 이전 버전이 없습니다"
    exit 1
  fi
  echo "롤백: $LIVE → $OTHER"
  activate "$OTHER"
  verify
  exit 0
fi

[ -f "$TARBALL" ] || { echo "✗ $TARBALL 이 없습니다 (scp로 올렸는지 확인)"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "✗ $ENV_FILE 이 없습니다"; exit 1; }

# env 형식 사전검증 — 2026-08-06 장애 재발 방지: SESSION_SECRET 붙여넣기 때 DATABASE_URL
# 줄이 깨져 호스트가 'base'로 파싱됐다(getaddrinfo EAI_AGAIN base). 값은 출력하지 않는다.
grep -Eq '^DATABASE_URL=postgresql://[^@[:space:]]+@127\.0\.0\.1:5432/oh4989[[:space:]]*$' "$ENV_FILE" \
  || { echo "✗ $ENV_FILE 의 DATABASE_URL 형식이 다릅니다 — postgresql://oh4989_app:<비밀번호>@127.0.0.1:5432/oh4989 한 줄이어야 합니다"; exit 1; }
SECRET_LEN=$(grep -E '^SESSION_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '[:space:]' | wc -c)
[ "$SECRET_LEN" -ge 32 ] || { echo "✗ $ENV_FILE 의 SESSION_SECRET 이 없거나 32자 미만입니다"; exit 1; }

LIVE="$(live_slot)"
TARGET=$([ "$LIVE" = a ] && echo b || echo a)

echo "배포: 현재 $LIVE → 새 버전을 $TARGET 에 준비"

# 이전 버전 하나는 그대로 두고, 그 이전 것만 지운다
rm -rf "${HOME_DIR:?}/releases/$TARGET"
mkdir -p "$HOME_DIR/releases/$TARGET"
tar -xzf "$TARBALL" -C "$HOME_DIR/releases/$TARGET" --strip-components=1

# standalone은 실행 시 자기 폴더에서 env를 읽는다. 비밀값은 tar에 들어가지 않으므로
# 배포할 때마다 여기서 복사한다.
cp "$ENV_FILE" "$HOME_DIR/releases/$TARGET/.env.production"
chmod 600 "$HOME_DIR/releases/$TARGET/.env.production"

echo "  전환"
activate "$TARGET"

if ! verify; then
  echo
  echo "✗ 새 버전이 응답하지 않습니다. 되돌리려면:  ./deploy.sh rollback"
  exit 1
fi

echo
echo "완료. 문제가 있으면:  ./deploy.sh rollback"
