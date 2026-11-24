#!/usr/bin/env bash
# [2026-11-24 11:55 PM Johnny Chu - Chu Hoàng Anh] SPINE-7 — dựng hub-local: WordPress Hub + máy chủ SSO + open-ketoan (main) trên máy dev.
# Chạy lại bao nhiêu lần cũng được (khoá sinh một lần, cài WordPress một lần, mã cập nhật theo main nếu thư mục sạch).
#
#   bash tools/hub-local/up.sh [--khong-cap-nhat]
#
# Biến (tuỳ chọn): HUB_DIR (mặc định d:/projects/hub-local), HUB_LLM_ROUTER_DIR (thư mục plugin bizcity-llm-router đang code),
#                 HUB_PORT=8095, KT_PORT=8094, KT_DB_PORT=5446, HUB_SSO_APPS="open-cake=http://cake.localhost:8110,…"
# In ra địa chỉ, KHÔNG in mật khẩu / khoá (nằm trong $HUB_DIR/.env).
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash trên Windows tự đổi "/var/www" thành "C:/Program Files/Git/var/www" khi gọi docker exec

# Docker Desktop cần đường dẫn kiểu D:/… — pwd -W (Git Bash) cho dạng đó; Linux / macOS không có -W thì dùng pwd.
winpwd() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }
KIT="$(winpwd "$(dirname "$0")")"
HUB_DIR="${HUB_DIR:-D:/projects/hub-local}"
UPDATE=1; [ "${1:-}" = "--khong-cap-nhat" ] && UPDATE=0
mkdir -p "$HUB_DIR/src" "$HUB_DIR/logs" "$HUB_DIR/backups"
ENVF="$HUB_DIR/.env"
rnd() { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"; }

# ── 1. Khoá: sinh một lần, giữ lại giữa các lần chạy ────────────────────────────────────────────────
if [ ! -f "$ENVF" ]; then
  umask 077
  cat > "$ENVF" <<EOF
# hub-local — CHỈ máy dev. Sinh bởi bizcity-platform/tools/hub-local/up.sh. Không commit, không dán ra chat.
HUB_PORT=8095
KT_PORT=8094
KT_DB_PORT=5446
HUB_LLM_ROUTER_DIR=D:/OneDrive/Code/huongnguyen.vibeyeu.com.vn/wp-content/plugins/bizcity-llm-router
HUB_SSO_APPS=open-ketoan=http://ketoan.localhost:8094,open-cake=http://cake.localhost:8110
HUB_SSO_TENANT=hub
HUB_DB_PASS=$(rnd 16)
HUB_DB_ROOT=$(rnd 16)
HUB_SSO_SECRET=$(rnd 24)
HUB_ADMIN_PASS=Hub$(rnd 6)A1
KT_JWT=$(rnd 32)
KT_DB_PASS=$(rnd 16)
KT_DB_APP_PASS=$(rnd 16)
KT_ADMIN_PASS=Kt$(rnd 6)A1
KT_API_KEY=$(rnd 24)
EOF
  echo "· đã sinh khoá: $ENVF"
fi
set -a; . "$ENVF"; set +a
# Biến môi trường lúc gọi được ưu tiên hơn .env
HUB_PORT="${HUB_PORT:-8095}"; KT_PORT="${KT_PORT:-8094}"

# ── 2. Mã nguồn: open-ketoan (main) + open-ketoan-bridge (main) ───────────────────────────────────
pull() { # $1 tên repo
  local d="$HUB_DIR/src/$1"
  if [ ! -d "$d/.git" ]; then
    git clone -q --depth 1 "https://github.com/hoanganh8389/$1.git" "$d"
  elif [ "$UPDATE" = 1 ]; then
    if [ -z "$(git -C "$d" status --porcelain)" ]; then
      git -C "$d" fetch -q --depth 1 origin main && git -C "$d" checkout -q -B main FETCH_HEAD
    else
      echo "· $1 có sửa dở, giữ nguyên (không cập nhật)"
    fi
  fi
  echo "· $1 @ $(git -C "$d" rev-parse --short HEAD)"
}
pull open-ketoan
pull open-ketoan-bridge
[ -d "$HUB_LLM_ROUTER_DIR" ] || { echo "Không thấy HUB_LLM_ROUTER_DIR=$HUB_LLM_ROUTER_DIR"; exit 1; }

docker network inspect bizcity-hub >/dev/null 2>&1 || docker network create bizcity-hub >/dev/null

# ── 3. open-ketoan (project hub-ketoan, CSDL riêng) ───────────────────────────────────────────────
KENV="$HUB_DIR/ketoan.env"
cat > "$KENV" <<EOF
JWT_SECRET=$KT_JWT
DB_PASSWORD=$KT_DB_PASS
DB_APP_PASSWORD=$KT_DB_APP_PASS
DB_PORT=$KT_DB_PORT
WEB_BIND=127.0.0.1
WEB_PORT=$KT_PORT
CORS_ORIGINS=http://ketoan.localhost:$KT_PORT
ENV_LABEL=HUB-LOCAL
SEED_TENANT_CODE=$HUB_SSO_TENANT
SEED_TENANT_NAME=Đơn vị thử (hub-local)
SEED_ADMIN_EMAIL=admin@hub.local
SEED_ADMIN_PASSWORD=$KT_ADMIN_PASS
SEED_API_KEY=$KT_API_KEY
WP_SSO_SECRET=$HUB_SSO_SECRET
WP_SSO_TENANT=$HUB_SSO_TENANT
WP_SSO_LOGIN_URL=http://hub.localhost:$HUB_PORT/wp-admin/admin-post.php?action=tgs_acc_sso_go
WP_SSO_AUD=open-ketoan
LOG_HOST_DIR=$HUB_DIR/logs
BACKUP_HOST_DIR=$HUB_DIR/backups
EOF
chmod 600 "$KENV" 2>/dev/null || true
echo "· dựng open-ketoan (lần đầu vài phút)…"
docker compose -p hub-ketoan --env-file "$KENV" -f "$HUB_DIR/src/open-ketoan/docker-compose.yml" up -d --build >"$HUB_DIR/logs/up-ketoan.log" 2>&1 \
  || { tail -20 "$HUB_DIR/logs/up-ketoan.log"; exit 1; }
docker network connect --alias ketoan.localhost bizcity-hub hub-ketoan-web-1 2>/dev/null || true

# ── 4. WordPress Hub ───────────────────────────────────────────────────────────────────────────────
export HUB_DIR HUB_PORT HUB_LLM_ROUTER_DIR HUB_DB_PASS HUB_DB_ROOT HUB_SSO_SECRET HUB_SSO_TENANT HUB_SSO_APPS
export HUB_KETOAN_API_URL=http://hub-ketoan-web-1 HUB_KETOAN_WEB_URL="http://ketoan.localhost:$KT_PORT" HUB_KETOAN_API_KEY="$KT_API_KEY"
docker compose -f "$KIT/docker-compose.yml" up -d >"$HUB_DIR/logs/up-hub.log" 2>&1 || { tail -20 "$HUB_DIR/logs/up-hub.log"; exit 1; }

W=hub-local-wp-1
for i in $(seq 1 60); do docker exec $W test -f /var/www/html/wp-config.php 2>/dev/null && break; sleep 2; done
# WP-CLI mất mỗi lần tạo lại container (không nằm trong volume) → cài lại khi thiếu.
docker exec $W sh -c '[ -x /usr/local/bin/wp ] || (curl -fsSL -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x /usr/local/bin/wp)'
wpx() { docker exec -u www-data -w /var/www/html $W wp "$@"; }
for i in $(seq 1 30); do wpx db check >/dev/null 2>&1 && break; sleep 2; done

if ! wpx core is-installed 2>/dev/null; then
  wpx core install --url="http://hub.localhost:$HUB_PORT" --title="BizCity Hub (local)" --admin_user=admin \
    --admin_password="$HUB_ADMIN_PASS" --admin_email=admin@hub.local --skip-email >/dev/null
  wpx rewrite structure '/%postname%/' >/dev/null
  wpx user create nv1 nv1@hub.local --role=editor --display_name="Nhân viên thử" --user_pass="$HUB_ADMIN_PASS" >/dev/null
  echo "· đã cài WordPress (admin, nv1)"
fi
# Plugin in cảnh báo PHP lúc bật thì `activate` trả mã lỗi dù đã bật → hỏi lại bằng is-active.
for p in open-ketoan-bridge bizcity-llm-router; do
  wpx plugin activate "$p" >/dev/null 2>&1 || true
  wpx plugin is-active "$p" 2>/dev/null && echo "· $p: bật" || echo "· $p: KHÔNG bật được — xem: docker exec -u www-data $W wp plugin activate $p"
done

cat <<EOF

hub-local sẵn sàng (mật khẩu, khoá: $ENVF)
  Hub (WordPress)   http://hub.localhost:$HUB_PORT/wp-admin        admin / HUB_ADMIN_PASS   ·   nv1 / HUB_ADMIN_PASS
  open-ketoan       http://ketoan.localhost:$KT_PORT               admin@hub.local / KT_ADMIN_PASS · nút "Đăng nhập bằng WordPress"
  SSO cho app khác  http://hub.localhost:$HUB_PORT/wp-admin/admin-post.php?action=bizcity_hub_sso&aud=<app>&return=<địa chỉ app>
  Vé cho test       docker exec -u www-data $W wp hub-sso ticket --login=nv1 --aud=<app>
  Kiểm đầu cuối     bash $KIT/check.sh
EOF
