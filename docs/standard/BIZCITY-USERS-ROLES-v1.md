# `bizcity_users@1` — Người dùng, user meta, vai, phân quyền, cài đặt

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T3. Chủ chỉ đạo 2026-11-24: "tuân thủ SSO, nhưng open-cake, open-ketoan… tương lai vẫn chủ động tạo user, có chuẩn user-role, matrix setting". Rút từ open-ketoan PHASE-028 (bizcity_authorization@1, core/authz) và open-cake PHASE-004 S004-7 (ba lớp phân quyền). -->
<!-- [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 — 1.1.0: chủ chỉ đạo 2026-11-25 "SSO để sau; open-ketoan, open-cake và các app tương lai cần một khuôn chung về user, user meta, user role, phân quyền theo thiết kế và kiểm chuẩn của bizcity-platform; sau này nối được". Viết lại thành khuôn dữ liệu + khai báo máy đọc (bizcity.authz.json) + bộ kiểm tools/users-check.mjs; SSO chuyển xuống §8 "nối sau". -->

> **Phiên bản:** 1.1.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Bản mẫu:** `@bizcity/platform` (`db/migrations/0001_platform_nen_tang.sql`, `core/auth.ts`, `core/roles.ts`, `core/authz/`, `core/authz-manifest.ts`); open-cake `apps/api/src/auth/` + `db/migrations/0103_flex.sql` (user meta).
> **Máy đọc:** `schema/users/authz-manifest.schema.json` · **Kiểm:** `node tools/users-check.mjs`.
> **Đi cùng:** `bizcity_authorization@1` (open-ketoan `docs/contracts/BIZCITY-AUTHORIZATION-v1.md`, bộ tính quyền) · canon §9.

## 0. Một câu

**App nào cũng tự quản người dùng của mình theo cùng một khuôn — cùng bảng, cùng cách đặt tên quyền, cùng ba lớp vai, cùng màn hình — và khai khuôn đó ra một tệp để bộ kiểm chung đọc được; nối SSO với Hub là việc thêm vào sau, không phải dựng lại.**

## 1. Khuôn dữ liệu (bảng)

Mọi bảng dưới đây **thuộc `@bizcity/platform`**; app không tạo bảng người dùng, vai, quyền của riêng mình (R-USER-2). Mọi bảng có `tenant_id` + RLS FORCE.

| Bảng | Giữ | Luật chính |
|---|---|---|
| `users` | `id, tenant_id, email, full_name, password_hash, role, is_active, session_version, last_login_at, created_at` (+ `external_sub` khi nối SSO, §8) | không xoá, chỉ `is_active = false` (R-USER-4); `role` = vai chính |
| `user_meta` | `tenant_id, user_id, key, value jsonb, updated_at, updated_by`; khoá chính `(tenant_id, user_id, key)` | ≈ `wp_usermeta`: **tuỳ chọn cá nhân** (bộ lọc đã lưu, cột đang hiện, ngôn ngữ). Khoá phải khai (§3). Không chứa quyền, vai, tiền, trạng thái, bí mật (R-USER-16) |
| `user_role_assignments` | người × vai (hệ thống **hoặc** vai riêng) × phạm vi (`tenant · branch · warehouse · org_unit`) × mục đích (`operate · approve · report · export`) × thời hạn; lý do, người cấp, người thu hồi | chỉ thêm và thu hồi, không sửa lịch sử |
| `tenant_roles` | vai riêng của đơn vị: `code, label, kind (job · privilege · restriction), base_role, is_active, version` | không bao giờ là `owner`; không xoá, chỉ ngừng dùng |
| `tenant_role_rules` | luật của vai riêng: `permission, effect (allow · deny)`; gỡ luật ghi người gỡ và lý do | `allow` phải đúng tên quyền (không `*`); `deny` được dùng `*` |
| `api_keys` | khoá máy ↔ app: băm, tiền tố, phạm vi, một đơn vị | không bao giờ mang quyền rủi ro cao |
| `setting_values` | giá trị cài đặt theo khoá `bizcity.<…>`, phạm vi (`tenant · accounting_unit · branch · user`), phiên bản, lý do | khoá phải khai (§3) |
| `tenants.authz_version` | phiên bản phân quyền của đơn vị | tăng mỗi lần đổi vai riêng / luật ⇒ đệm quyền mất hiệu lực |

`user_meta` hiện ở open-cake (`0103_flex.sql`); gói nền nhận cùng lớp mềm ở bước P7 (`@bizcity/flex`), **giữ nguyên hình bảng** trên. App mới cần user meta trước P7 thì chép đúng hình này.

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-USER-1 | App **tự đứng được không cần Hub**: có đăng nhập cục bộ và màn quản lý người dùng | chủ chỉ đạo 2026-11-24 |
| R-USER-2 | Người dùng / vai / quyền / khoá API dùng bảng của nền; app không tạo bảng trùng vai trò | mới — kiểm SC-USER-5 |
| R-USER-3 | Mỗi đơn vị một tập người dùng (`tenant_id`); một người làm ở hai đơn vị = hai dòng, nối bằng email (sau này bằng `sub`) | nền |
| R-USER-4 | Không xoá người dùng; chủ cuối cùng không gỡ được; không tự sửa vai mình; không cấp quyền mình không có | canon §9, R-CAKE-AUTHZ-5, ECP-13 |
| R-USER-5 | Khoá người dùng / đổi vai chính ⇒ `session_version++` (phiên cũ hết ngay); đổi vai riêng / luật ⇒ `authz_version++` | canon §9 |
| R-USER-6 | Phiên là của app: JWT `{sub, tid, sid?, role, name, sv, perms?}`; `sid` bắt buộc khi `SITE_MODE=multi` | canon §9, R-SITE-4 |

## 2. Ba lớp phân quyền

```text
Lớp 1  Sổ quyền trong mã      <module>:<chức-năng>-<động-từ>  + rủi ro (low · high)
        └ sinh từ khai báo action (permission + risk); đăng ký lúc khởi động: registerModulePermissions
Lớp 2  Vai hệ thống            owner (nền, mọi quyền) + vai của app: registerRoles('<app>', [...])
        └ đổi chỉ bằng PR; phạm vi khoá API: registerApiScopes
Lớp 3  Vai riêng của đơn vị    tenant_roles (kế thừa một vai gốc) + tenant_role_rules (allow / deny)
        └ quản trị đơn vị sửa trên màn "Vai & quyền"
```

**Quyền hiệu lực** = quyền của vai chính ∪ vai phụ ∪ (vai riêng: gốc + allow) − deny. **Từ chối luôn thắng**; `*` không bao giờ phủ quyền `risk: high`; khoá API và AI không bao giờ nhận quyền `risk: high`; vai quản trị (`owner`) không bị `deny` khoá khỏi quản trị.

| Luật | Nội dung | Kiểm |
|---|---|---|
| R-USER-7 | Tên quyền `<module>:<chức-năng>-<động-từ>`, chữ thường, **tiếng Việt không dấu**. Động từ của thao tác màn: `xem, lap, sua, xoa, huy, duyet, bo-duyet, xuat, nhap, in, khoa, mo, gop, gia`; động từ nghiệp vụ khác được (`luu, tinh, ghi-so`…). Không trộn tiếng Anh (`sell, cancel, use`). Quyền nền giữ tên riêng (`users:write`, `settings:write`, `reports:read`) | SC-USER-4 |
| R-USER-8 | Mỗi action đúng **một** quyền + một mức rủi ro; route nào cũng khai `requirePermission` hoặc `config.public` | STD-ACT-2, SC-API-3 |
| R-USER-9 | Gán vai theo phạm vi; quyền không cộng chéo phạm vi | `bizcity_authorization@1` |
| R-USER-10 | Mọi thay đổi vai, gán vai, khoá người dùng ghi một bản ghi bằng chứng | R-TEN-5 |
| R-USER-11 | Giao diện tắt nút kèm **lý do**; máy chủ kiểm lại; từ chối trả mã lý do (`AUTHZ-DENIED-BY-RULE`…) | R-WEB-7, R-BLOCK |
| R-USER-15 | Vai hệ thống của app chỉ trỏ quyền **có thật** (của app hoặc của nền); không khai lại `owner`; chỉ `owner` mang cờ quản trị | SC-USER-4 |

## 3. Khai báo máy đọc: `bizcity.authz.json`

Mỗi app đặt ở gốc repo một tệp `bizcity.authz.json` (`bizcity_authz_manifest@1`) mô tả lớp 1–2 và các khoá mềm. Bộ kiểm chung đọc tệp này, **không** phải chạy app.

```json
{
  "schema": "bizcity_authz_manifest@1",
  "app": "open-cake",
  "core_permissions": ["reports:read", "settings:write", "users:write", "…"],
  "permissions": [ { "key": "cake:contacts-gop", "label": "Gộp khách", "risk": "high", "module": "cake" } ],
  "roles":       [ { "key": "manager", "label": "Quản lý", "admin": false, "permissions": ["cake:contacts-gop", "users:write"] } ],
  "api_scopes":  { "cake:read": ["cake:contacts-xem"] },
  "user_meta":   [ { "key": "cake.inbox.filters", "label": "Bộ lọc đã lưu", "type": "json" } ],
  "settings":    [ { "key": "bizcity.cake.inbox.auto_assign", "label": "Tự chia hội thoại", "scopes": ["tenant"], "permission": "settings:write" } ]
}
```

| Luật | Nội dung |
|---|---|
| R-USER-13 | App Node **sinh** tệp này bằng `authzManifest('<id app>', { userMeta, settings })` của `@bizcity/platform` (`core/authz-manifest.ts`) sau khi đăng ký xong, ghi ra gốc repo, commit; selfcheck của app so tệp với sổ đang chạy (lệch ⇒ chặn). Plugin WordPress viết tay theo schema |
| R-USER-14 | `app` trong tệp = `id` trong `bizcity.app.json` |
| R-USER-16 | Khoá user meta và khoá cài đặt **phải khai**; khoá user meta không chứa các từ `price, amount, qty, tax, status, role, perm, permission, token, cookie, password, secret` |
| R-USER-17 | Khoá cài đặt dạng `bizcity.<app>.<…>`; mỗi khoá khai phạm vi được đặt và **quyền gác** (phải là quyền có thật); thứ tự ghi đè: hệ thống → site → đơn vị → chi nhánh → người dùng |

Bản đầy đủ của registry cài đặt (lớp, chủ, kiểu, mặc định, ảnh hưởng ghi sổ): mẫu open-ketoan `docs/contracts/bizcity-settings.registry.json` (R-MATRIX); `settings[]` ở đây là phần mọi app phải có.

## 4. Màn chuẩn (mọi app cùng bố cục)

| Màn | Có gì | Bản mẫu |
|---|---|---|
| Đăng nhập | email + mật khẩu; nút "Đăng nhập bằng tài khoản Bizcity" khi đã nối SSO (§8) | open-ketoan |
| Cài đặt › Nhân viên | danh sách, mời / tạo, khoá / mở, vai chính, vai phụ có phạm vi (chi nhánh, kho, tài khoản kênh) | open-cake PHASE-004 mockup "Nhân viên" |
| Cài đặt › Vai & quyền | **ma trận** vai × quyền nhóm theo module, cột rủi ro; vai riêng (kế thừa vai gốc, cho / cấm); "vì sao được / không được" | open-cake mockup "Vai & quyền"; open-ketoan PHASE-028 |
| Cài đặt › Khoá API | tạo (hiện một lần), phạm vi, thu hồi | open-ketoan |
| Hồ sơ cá nhân | đổi mật khẩu, tuỳ chọn cá nhân (user meta) | — |

Màn dựng theo [WEB](BIZCITY-WEB-v1.md) (model · view · controller); quyền đọc bằng `useCan`.

## 5. Mời và tạo người dùng tại app

1. Quản trị đơn vị (quyền `users:write`) tạo người dùng: email, tên, vai chính, phạm vi.
2. App sinh mật khẩu tạm **hoặc** gửi liên kết đặt mật khẩu; không đặt mật khẩu mặc định chung (R-CAKE-SSO-7, R-SEC-2).
3. Người dùng đăng nhập lần đầu ⇒ đổi mật khẩu; `last_login_at` ghi lại.
4. Mỗi bước ghi bằng chứng (R-USER-10).

Người dùng tạo tại app **không mang `sub`** cho tới lần SSO đầu có email khớp (Q-USER-2).

## 6. Kiểm

| Mã | Lane | Kiểm | Công cụ |
|---|---|---|---|
| SC-USER-4 | HOUSE | `bizcity.authz.json` đúng schema; quyền đúng tiền tố module, không trùng quyền nền; vai trỏ quyền có thật, không khai lại `owner`; phạm vi khoá API không mang quyền rủi ro cao; khoá user meta không chứa từ cấm; cài đặt gác bằng quyền có thật; động từ tiếng Anh ⇒ cảnh báo | `tools/users-check.mjs --manifest` |
| SC-USER-5 | HOUSE | repo không tạo bảng `users`, `user_role_assignments`, `tenant_roles`, `tenant_role_rules`, `roles`, `permissions`, `api_keys` riêng (app Node: chặn; plugin: cảnh báo); có `bizcity.authz.json` | `tools/users-check.mjs --repo` |
| SC-USER-6 | — | vector schema + luật chéo (thử ngược: tắt luật ⇒ vector đỏ) | `tools/users-check.mjs` |
| SC-USER-7 | CONTRACT | `GET /api/v1/auth/me` trả `{user, permissions}` khớp ma trận; người dùng `is_active = false` bị 401 | đề xuất — thêm vào `spine-contract` |
| SC-USER-1..3 | CONTRACT | SSO (§8) | để sau |

## 7. Hiện trạng (đo 2026-11-25)

Tệp khai báo sinh từ sổ đăng ký thật của hai app (trên CSDL test mới, không sửa repo của app), rồi chạy `users-check`:

| App | Quyền module | Vai | User meta | Cài đặt | Kết quả SC-USER-4 |
|---|---|---|---|---|---|
| open-cake | 28 | 6 (manager, agent, marketer, viewer, auditor, developer) | 2 | 0 | **ĐẠT**, 0 cảnh báo |
| open-ketoan | 237 | 6 (chief_accountant, accountant, viewer, developer, auditor, staff) | 0 | 25 | **ĐẠT**, 5 cảnh báo: quyền tiếng Anh `pos:sell`, `pos:cancel`, `pos:return`, `pos:report`, `voucher:use` |

`--repo` trên 10 repo: 0 chặn. open-ketoan tạo bảng nền trong migration của mình vì nó là **nguồn gốc** của bảng nền — được miễn SC-USER-5 tới khi chuyển sang gói nền (P6). Chưa repo nào có `bizcity.authz.json` (11 cảnh báo).

| Việc | Repo | Ghi chú |
|---|---|---|
| sinh `bizcity.authz.json` + so trong selfcheck | open-ketoan, open-cake | cần đợt việc có giữ chỗ ở từng repo |
| đổi 5 quyền tiếng Anh sang khuôn R-USER-7 (giữ tên cũ làm `aliases` để không gãy vai đã gán) | open-ketoan (phần POS, voucher) | đợt việc riêng |
| đăng nhập mật khẩu cục bộ (R-USER-1) | open-cake | hiện chỉ SSO + `dev-login` |
| viết tay `bizcity.authz.json` | plugin WordPress (open-pos, open-crm…) | quyền của plugin = capability WordPress; khai để bộ kiểm thấy |

## 8. Nối SSO với Hub (để sau)

Khi bật: [`bizcity_identity@1`](BIZCITY-IDENTITY-v1.md). Khuôn ở trên **không đổi**; nối SSO chỉ thêm:

- cột `users.external_sub` (`wp:<id>`), khớp `sub` trước email, email đã gắn `sub` khác ⇒ từ chối (R-IDENT-1, open-ketoan migration 0183);
- route `GET / POST /api/v1/auth/wp-sso`;
- **R-USER-12 (Q-USER-1):** quyền của phiên SSO = ma trận cục bộ ∩ `perms` trong vé; vé không bao giờ nới quyền hay vượt `deny` (R-IDENT-4 1.1.0).

Đang có: open-ketoan (#626) và bridge phát vé (#35); open-cake có SSO nhưng `aud = cake` (phải là `open-cake`), chưa có `external_sub`, quyền trong vé thay ma trận — sửa khi bật lại việc SSO. Thử trên máy: [`tools/hub-local`](../../tools/hub-local/README.md).

| Mã | Lane | Kiểm (để sau) |
|---|---|---|
| SC-USER-1 | CONTRACT | vé có `aud` = id app ⇒ 200; `aud` lạ ⇒ 401 |
| SC-USER-2 | CONTRACT | sau SSO, người dùng mang `external_sub` đúng |
| SC-USER-3 | CONTRACT | luật `deny` của đơn vị vẫn chặn khi vào bằng vé có `perms` |

## 9. Lịch sử

- **1.1.0 (2026-11-25):** chủ chỉ đạo "SSO để sau, một khuôn chung cho user · user meta · vai · phân quyền". Thêm khuôn bảng (§1, gồm `user_meta`), khai báo máy đọc `bizcity.authz.json` (§3) + `authzManifest()` ở nền, bộ kiểm `tools/users-check.mjs` (SC-USER-4..6), quy trình tạo người dùng tại app (§5), đo hiện trạng hai app (§7); SSO chuyển xuống §8. R-USER-7 nới: động từ nghiệp vụ tiếng Việt được, chỉ chặn trộn tiếng Anh. <!-- [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 -->
- **1.0.0 (2026-11-25):** chủ duyệt; R-USER-12 theo Q-USER-1.
