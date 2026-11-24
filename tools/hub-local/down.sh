#!/usr/bin/env bash
# [2026-11-24 11:55 PM Johnny Chu - Chu Hoàng Anh] SPINE-7 — dừng hub-local. --xoa: xoá luôn CSDL (WordPress + open-ketoan), giữ .env và mã nguồn.
set -euo pipefail
export MSYS_NO_PATHCONV=1
KIT="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
HUB_DIR="${HUB_DIR:-D:/projects/hub-local}"
V=""; [ "${1:-}" = "--xoa" ] && V="-v"
set -a; . "$HUB_DIR/.env"; set +a
export HUB_DIR HUB_KETOAN_API_URL= HUB_KETOAN_WEB_URL= HUB_KETOAN_API_KEY=
docker compose -f "$KIT/docker-compose.yml" down $V
docker compose -p hub-ketoan --env-file "$HUB_DIR/ketoan.env" -f "$HUB_DIR/src/open-ketoan/docker-compose.yml" down $V
echo "hub-local đã dừng${V:+ và xoá dữ liệu}."
