# `bizcity_users@1` — Người dùng, vai, ma trận quyền, ma trận cài đặt

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T3. Chủ chỉ đạo 2026-11-24: "tuân thủ SSO, nhưng open-cake, open-ketoan… tương lai vẫn chủ động tạo user, có chuẩn user-role, matrix setting". Rút từ open-ketoan PHASE-028 (bizcity_authorization@1, core/authz) và open-cake PHASE-004 S004-7 (ba lớp phân quyền). -->

> **Phiên bản:** 1.0.0-draft · 2026-11-24 · **Trạng thái:** chờ duyệt (Q-USER-1, 2)
> **Đi cùng:** [`bizcity_identity@1`](BIZCITY-IDENTITY-v1.md) (vé SSO) · `bizcity_authorization@1` (open-ketoan `docs/contracts/BIZCITY-AUTHORIZATION-v1.md`, bộ tính quyền) · canon §9.

## 0. Một câu

**Hub nói "người này là ai"; app quyết "người này được làm gì ở đây". App nào cũng tự tạo được người dùng, và mọi app dùng cùng một khuôn người dùng · vai · quyền · cài đặt.**

## 1. Hai cửa vào, một bảng người dùng

| Cửa | Ai tạo người dùng | Mật khẩu | `external_sub` |
|---|---|---|---|
| **SSO từ Hub** (WordPress bizcity) | Hub; app tạo bản ghi cục bộ ở lần vào đầu, vai thấp nhất | ở Hub | `wp:<id>` |
| **Tại app** (mời nhân viên, tự cài không có Hub) | quản trị của app | ở app (scrypt), hoặc chưa đặt nếu chỉ vào bằng SSO | trống, tới khi nối |

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-USER-1 | App **luôn tự đứng được không cần Hub**: có đăng nhập cục bộ (email + mật khẩu) và màn quản lý người dùng. SSO là cửa thêm, không phải cửa duy nhất | chủ chỉ đạo 2026-11-24; open-ketoan đang có. open-cake hiện **chưa có** đăng nhập mật khẩu (khoảng cách §7) |
| R-USER-2 | Một bảng `users` cho cả hai cửa: `tenant_id, email, full_name, role, password_hash, is_active, session_version, last_login_at, external_sub` | nền `@bizcity/platform` migration 0001; `external_sub` open-ketoan 0183 |
| R-USER-3 | Nối danh tính: khớp `external_sub` trước, email sau; người dùng cục bộ chưa có `sub` được gắn ở lần SSO đầu có email khớp; email đã gắn `sub` khác ⇒ từ chối | R-IDENT-1, open-ketoan `wp-sso.ts` |
| R-USER-4 | Người dùng không xoá, chỉ `is_active = false`; chủ cuối cùng không gỡ được; không tự sửa vai mình; không cấp quyền mình không có | canon §9, R-CAKE-AUTHZ-5, ECP-13 |
| R-USER-5 | Đổi vai chính / khoá người dùng ⇒ `session_version++` (phiên cũ hết hiệu lực ngay); đổi vai riêng của đơn vị ⇒ `authz_version++` | canon §9, open-cake S004-7 |
| R-USER-6 | Phiên là của app: JWT `{sub, tid, sid?, role, name, sv, perms?}`; `sid` bắt buộc khi `SITE_MODE=multi` | canon §9, R-SITE-4 |

## 2. Ba lớp phân quyền

```text
Lớp 1  Sổ quyền trong mã      <module>:<chức-năng>-<xem|lap|sua|xoa|huy|duyet|bo-duyet|xuat>  + risk
        └ sinh từ khai báo action (permission + risk); đăng ký lúc khởi động (registerModulePermissions)
Lớp 2  Vai hệ thống            owner (nền) + vai của app (registerRoles): manager, accountant, agent, viewer…
        └ đổi chỉ bằng PR
Lớp 3  Vai riêng của đơn vị    tenant_roles (kế thừa một vai gốc, không bao giờ là owner) + luật allow / deny
        └ quản trị đơn vị sửa trên màn "Vai & quyền"; không xoá, chỉ ngừng dùng
```

Quyền hiệu lực = vai chính ∪ vai phụ ∪ (vai riêng: gốc + allow − deny); **từ chối luôn thắng**; `*` không bao giờ phủ quyền `risk: high`; khoá API và AI không bao giờ nhận quyền `risk: high`.

| Luật | Nội dung | Nguồn · kiểm |
|---|---|---|
| R-USER-7 | Tên quyền theo khuôn trên; quyền nền giữ tên riêng (`users:write`, `settings:write`, `reports:read`) | `bizcity_authorization@1`, R-CAKE-AUTHZ-1 |
| R-USER-8 | Mỗi action đúng **một** quyền + một mức rủi ro; route nào cũng khai `requirePermission` hoặc `config.public` | STD-ACT-2, R-API-6 · SC-API-3, SC-AUTH-11 |
| R-USER-9 | Gán vai = người × vai × phạm vi (`all / org_unit / branch / warehouse`) × mục đích × thời hạn; quyền không cộng chéo phạm vi | `bizcity_authorization@1` (open-ketoan `core/authz/engine.ts`: `authorize / explain / batchAuthorize / scopeOf`) |
| R-USER-10 | Mọi thay đổi vai, gán vai, khoá người dùng ghi một bản ghi bằng chứng | R-TEN-5, R-CAKE-AUTHZ-6 |
| R-USER-11 | Giao diện tắt nút kèm **lý do**; máy chủ kiểm lại. Câu trả lời từ chối mang mã lý do (`AUTHZ-DENIED-BY-RULE`…) | R-WEB-7, R-BLOCK |

## 3. Màn chuẩn (mọi app cùng bố cục)

| Màn | Có gì | Bản mẫu |
|---|---|---|
| Cài đặt › Nhân viên | danh sách, mời, khoá / mở, vai chính, phạm vi (chi nhánh, tài khoản kênh) | open-cake PHASE-004 mockup "Nhân viên" |
| Cài đặt › Vai & quyền | **ma trận** vai × quyền (nhóm theo module), vai riêng, giải thích "vì sao được / không được" | open-cake PHASE-004 mockup "Vai & quyền"; open-ketoan PHASE-028 role editor |
| Cài đặt › Khoá API | tạo (hiện một lần), phạm vi, thu hồi | open-ketoan |

## 4. SSO và ma trận cục bộ (đề xuất Q-USER-1)

Hiện có hai cách chạy khác nhau: open-ketoan lọc `perms` trong vé về quyền đã khai (Q-IDENT-1, đã duyệt); open-cake để `perms` trong vé **thay** ma trận vai, nên vượt được luật từ chối của đơn vị (ghi nhận ở PHASE-028 F8).

**Đề xuất R-USER-12:** quyền hiệu lực của phiên SSO = **ma trận cục bộ ∩ `perms` trong vé** (vé không có `perms` ⇒ dùng ma trận cục bộ). Vé chỉ là **trần**, không bao giờ nới quyền cục bộ và không vượt `deny`. Người lạ vào lần đầu nhận vai thấp nhất; muốn nhiều quyền hơn thì quản trị app gán vai. Luật này thay cách hiểu "WordPress cấp quyền" ở Q-IDENT-1 nên **chỉ có hiệu lực khi chủ duyệt**; tới lúc đó mỗi app giữ cách đang chạy.

## 5. Ma trận cài đặt

Cài đặt cũng theo một khuôn, để màn Cài đặt của mọi app đọc được cùng cách (bản mẫu: open-ketoan `docs/contracts/bizcity-settings.registry.json`, 29 khoá, luật R-MATRIX).

| Luật | Nội dung |
|---|---|
| R-USER-13 | Mọi khoá cài đặt có trong **registry**: `{key, class, owner, scopes, storage, schema, default, permission, audit, affectsPosting}`. Không JSON tự do |
| R-USER-14 | Phạm vi theo thứ tự ghi đè: hệ thống → site → đơn vị → chi nhánh → người dùng; khoá khai phạm vi nào mới được đặt ở phạm vi đó |
| R-USER-15 | Biến môi trường mới phải có trong `.env.example` hoặc registry | 

Kiểm: SC-CON-7 (open-ketoan).

## 6. Kiểm

| Mã | Lane | Kiểm |
|---|---|---|
| SC-IDENT-1..4 | CONTRACT / HOUSE | xem [IDENTITY](BIZCITY-IDENTITY-v1.md) §5 |
| SC-USER-1 | CONTRACT | vé có `aud` = `id` trong `bizcity.app.json` ⇒ 200; `aud` lạ ⇒ 401 (chạy bằng [`tools/hub-local`](../../tools/hub-local/README.md): `wp hub-sso ticket`) — **đề xuất, chưa có mã** |
| SC-USER-2 | CONTRACT | sau SSO, người dùng cục bộ mang `external_sub` đúng — đề xuất |
| SC-USER-3 | HOUSE | người dùng bị từ chối bởi luật `deny` của đơn vị vẫn bị từ chối khi vào bằng vé có `perms` — đề xuất (phụ thuộc Q-USER-1) |

## 7. Khoảng cách hiện tại

| App | Đang | Cần |
|---|---|---|
| open-ketoan | đủ hai cửa; `external_sub` + `aud` (#626); role editor PHASE-028 còn phần W6 | áp R-USER-12 nếu được duyệt |
| open-cake | chỉ SSO + `dev-login`; `aud` chấp nhận là `cake` trong khi `id` là `open-cake`; khớp theo email, chưa có `external_sub`; `perms` trong vé thay ma trận | đăng nhập cục bộ (R-USER-1), sửa `aud`, thêm `external_sub`, áp R-USER-12 |
| plugin WordPress (POS, CRM bản WP) | người dùng là người dùng WordPress, `sub` lấy từ `get_current_user_id()` | khai quyền theo khuôn R-USER-7 khi nối sang app web |
