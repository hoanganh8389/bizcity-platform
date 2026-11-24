#!/usr/bin/env bash
# [2026-11-24 11:55 PM Johnny Chu - Chu Hoàng Anh] SPINE-7 — kiểm đầu cuối hub-local: Hub phát vé (bridge + máy chủ SSO thử) → open-ketoan nhận đúng sub / aud.
# Mã thoát 0 = đạt hết. Không in vé, không in khoá.
#
#   bash tools/hub-local/check.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1
HUB_DIR="${HUB_DIR:-D:/projects/hub-local}"
set -a; . "$HUB_DIR/.env"; set +a
W=hub-local-wp-1; KDB=hub-ketoan-db-1
HUB="http://127.0.0.1:$HUB_PORT"; KT="http://127.0.0.1:$KT_PORT"
fail=0
ok() { if [ "$1" = 0 ]; then echo "  ✔ $2"; else echo "  ✘ $2"; fail=$((fail + 1)); fi; }
wpx() { docker exec -u www-data -w /var/www/html $W wp "$@" 2>/dev/null; }
sso() { curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d "{\"ticket\":\"$1\"}" "$KT/api/v1/auth/wp-sso"; }
sub_of() { docker exec $KDB psql -U ketoan -d ketoan -Atc "select u.external_sub from users u join tenants t on t.id=u.tenant_id where t.code='$HUB_SSO_TENANT' and u.email='$1'"; }

echo "[1] dịch vụ"
c=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: hub.localhost:'"$HUB_PORT" "$HUB/wp-login.php"); [ "$c" = 200 ]; ok $? "Hub trả trang đăng nhập ($c)"
u=$(curl -s "$KT/api/v1/auth/wp-sso"); echo "$u" | grep -q "tgs_acc_sso_go"; ok $? "open-ketoan công bố địa chỉ phát vé của Hub"
wpx plugin is-active open-ketoan-bridge; ok $? "bridge đang bật"
wpx plugin is-active bizcity-llm-router; ok $? "llm-router đang bật"

echo "[2] vé của bridge (mã chạy trên site thật) → open-ketoan"
t=$(wpx eval 'wp_set_current_user(1); echo TGS_Acc_Embed::ticket();')
[ "$(sso "$t")" = 200 ]; ok $? "admin đăng nhập được bằng vé bridge"
[ "$(sub_of admin@hub.local)" = "wp:1" ]; ok $? "open-ketoan lưu external_sub = wp:1"

echo "[3] chuyển hướng trình duyệt: admin-post → app#sso="
ck=$(wpx eval '$e=time()+600;$tk=WP_Session_Tokens::get_instance(1)->create($e);echo LOGGED_IN_COOKIE."=".rawurlencode(wp_generate_auth_cookie(1,$e,"logged_in",$tk));')
loc=$(curl -s -o /dev/null -w '%{redirect_url}' -H "Host: hub.localhost:$HUB_PORT" -b "$ck" "$HUB/wp-admin/admin-post.php?action=tgs_acc_sso_go&return=http%3A%2F%2Fketoan.localhost%3A$KT_PORT%2F")
echo "$loc" | grep -q "^http://ketoan.localhost:$KT_PORT/.*#sso="; ok $? "bridge chuyển về open-ketoan kèm #sso="
loc=$(curl -s -o /dev/null -w '%{redirect_url}' -H "Host: hub.localhost:$HUB_PORT" -b "$ck" "$HUB/wp-admin/admin-post.php?action=tgs_acc_sso_go&return=https%3A%2F%2Fla.example%2F")
echo "$loc" | grep -q "^http://ketoan.localhost:$KT_PORT/"; ok $? "địa chỉ quay về lạ bị thay bằng địa chỉ open-ketoan"

echo "[4] máy chủ SSO thử cho app khác (wp hub-sso)"
t=$(wpx hub-sso ticket --login=nv1 --aud=open-ketoan)
[ "$(sso "$t")" = 200 ]; ok $? "nv1 vào open-ketoan bằng vé hub-sso (aud=open-ketoan)"
[ "$(sub_of nv1@hub.local)" = "wp:2" ]; ok $? "open-ketoan lưu external_sub = wp:2"
t=$(wpx hub-sso ticket --login=nv1 --aud=open-cake)
[ "$(sso "$t")" = 401 ]; ok $? "vé aud=open-cake bị open-ketoan từ chối (401)"

echo
if [ $fail = 0 ]; then echo "KẾT QUẢ: ĐẠT"; else echo "KẾT QUẢ: KHÔNG ĐẠT ($fail mục)"; fi
exit $((fail > 0))
