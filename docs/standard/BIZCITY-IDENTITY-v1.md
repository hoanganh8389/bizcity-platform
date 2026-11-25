# `bizcity_identity@1` — Người dùng và đăng nhập một lần từ WordPress bizcity

<!-- [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — hợp đồng thứ nhất trong ba hợp đồng còn lại của bộ kiểm tương thích. Viết từ cái ĐANG CHẠY: open-ketoan apps/api/src/modules/auth/wp-sso.ts (vé HMAC-SHA256 ≤ 5 phút, đổi vé lấy phiên), canon §4 "người dùng chung", R-TEN-9; thêm sub = wp:<id> theo chuẩn spine §2 (chủ duyệt Q-SPINE-1). -->

> **Phiên bản:** 1.0.1 · 2026-11-24 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-24 (Q-IDENT-1, 2) <!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 --> · **Thuộc:** `@bizcity/contracts`
> **Máy đọc:** `packages/contracts/schema/spine/identity.schema.json` (vé và phiên).

## 0. Một câu

**WordPress của bizcity nói *người này là ai và được làm gì*; mỗi app nhận bằng một vé ký HMAC sống ≤ 5 phút, chỉ nhận quyền mình đã khai, và vẫn có quyền khoá người đó ở phía mình.**

**Làm rõ (1.0.1, chủ chỉ đạo 2026-11-24):** hợp đồng này chỉ nói về **cửa SSO**. App vẫn tự tạo và quản lý người dùng, vai, ma trận quyền của mình và tự đứng được khi không có Hub — khuôn chung ở [`bizcity_users@1`](BIZCITY-USERS-ROLES-v1.md). "WordPress nói được làm gì" nghĩa là vé mang `perms`; cách `perms` kết hợp với ma trận cục bộ là câu hỏi Q-USER-1 ở chuẩn đó. <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 -->

## 1. Vai

| Bên | Làm | Không làm |
|---|---|---|
| **WordPress bizcity** (gốc danh tính) | giữ tài khoản, mật khẩu, vai; phát **vé** khi người dùng mở một app; thu hồi bằng cách ngừng phát vé | không biết bảng của app, không ghi vào app |
| **App** (open-ketoan, open-cake, POS…) | kiểm chữ ký + hạn vé; tìm / tạo người dùng cục bộ theo `sub`; cấp **phiên** của riêng mình (JWT / cookie); lọc quyền về danh sách đã khai (R-TEN-9); có thể `is_active = false` để chặn | không nhận mật khẩu WordPress, không tự nâng quyền ngoài vé |
| **Zalo Hub (1API)** | cấp khoá máy `biz-…` cho app ↔ app, **không** thay vé người dùng | — |

## 2. Vé (`ticket`)

Hình giữ nguyên bản đang chạy: `base64url(JSON) + "." + base64url(HMAC-SHA256(JSON, WP_SSO_SECRET))`.

```json
{
  "sub": "wp:1203",                 // MỚI, bắt buộc từ @1: WordPress user ID (chuẩn spine §2)
  "email": "nv@congty.vn",          // vẫn gửi: app cũ khớp theo email (open-ketoan hiện tại)
  "name": "Nguyễn Văn A",
  "login": "nva",
  "tenant": "abc-shop",             // slug site (trục tenant); trống = app tự suy khi chỉ có một đơn vị
  "perms": ["catalog:read", "pos:sell"],   // quyền WordPress cấp; app chỉ nhận quyền đã khai
  "aud": "open-ketoan",             // MỚI: app đích, chống dùng vé của app này cho app khác
  "iat": 1764000000, "exp": 1764000300      // giây; exp − iat ≤ 300
}
```

| Luật | Nội dung |
|---|---|
| **R-IDENT-1** | `sub` là khoá danh tính xuyên app (`wp:<id>`, hoặc `biz:<id>` cho tài khoản máy); email / tên có thể đổi, `sub` không đổi. App lưu `sub` trên người dùng cục bộ. |
| **R-IDENT-2** | Vé sống ≤ 300 giây, `iat` không ở tương lai quá 60 giây, chữ ký so bằng `timingSafeEqual`; vé sai ⇒ `UNAUTHORIZED`, có giới hạn tần suất theo IP (hiện 30 / 15 phút). |
| **R-IDENT-3** | `aud` phải bằng `id` của app trong `bizcity.app.json`; vé **thiếu** `aud` hoặc `sub` được chấp nhận trong giai đoạn chuyển (Q-IDENT-2: 90 ngày kể từ khi plugin phát vé của WordPress cập nhật). Hết hạn đó quản trị app bật `WP_SSO_REQUIRE_SUB=1` (open-ketoan) ⇒ vé thiếu `sub` bị từ chối; vé có `aud` sai luôn bị từ chối, không có giai đoạn chuyển. |
| **R-IDENT-4** | App **chỉ nhận quyền đã khai** (`isKnownPermission`, manifest `permissions[]` của module); quyền lạ bị bỏ, không lỗi (R-TEN-9). Người lạ (chưa có cục bộ) được tạo với vai thấp nhất và quyền trong vé. |
| **R-IDENT-5** | App vẫn là người gác cuối: `is_active = false` cục bộ chặn dù vé hợp lệ; kỳ khoá, quyền ghi sổ, phê duyệt vẫn theo luật của app (`bizcity_authorization@1`). |
| **R-IDENT-6** | Phiên app ghi `actor = user:<sub>`; bằng chứng (`audit_logs`) mang `sub`, không mang email thô (che `sha256:` khi xuất). |
| **R-IDENT-7** | Thu hồi: WordPress ngừng phát vé ⇒ phiên app hết theo TTL của app (mặc định 12 giờ); cần cắt ngay thì gọi `POST /api/v1/auth/revoke` của app với `sub` (đề xuất, chưa có trong mã). |

## 3. Đổi vé lấy phiên (đang có ở open-ketoan)

| Route | Việc |
|---|---|
| `GET /api/v1/auth/wp-sso` | công khai: địa chỉ phát vé của WordPress (`loginUrl`), trống = tắt |
| `POST /api/v1/auth/wp-sso` `{ ticket }` | công khai: kiểm vé → tìm / tạo người dùng → trả `{ token, user }` (phiên của app) |

App khác (cake, POS WordPress) làm cùng khuôn: cùng tên route, cùng hình vé, cùng mã lỗi. POS / tsm chạy **trong** WordPress thì không cần vé: người dùng đã là người dùng WordPress; `sub` lấy thẳng từ `get_current_user_id()`.

## 4. Khoảng cách với bản đang chạy (để lên @1)

| App | Đang | Cần |
|---|---|---|
| open-ketoan | **đã xong (#626, 2026-11-24)** | — (trước đây: cột `users.external_sub`, ưu tiên `sub` rồi mới email (gặp email đã gắn `sub` khác ⇒ từ chối, không chiếm tài khoản); kiểm `aud`; `WP_SSO_AUD`, `WP_SSO_REQUIRE_SUB`) <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 --> |
| open-cake | **có SSO** (PHASE-004 S004-7, 2026-11-24) nhưng chỉ nhận `aud = cake` trong khi `id` trong `bizcity.app.json` là `open-cake`; khớp theo email, chưa lưu `sub` | sửa `aud` = `open-cake` (R-IDENT-3); cột `external_sub`, khớp `sub` trước (R-IDENT-1) <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 --> |
| WordPress (plugin phát vé: open-ketoan-bridge) | **đã phát `sub`, `aud`** (bridge #35, 2026-11-24) | sau 90 ngày bật `WP_SSO_REQUIRE_SUB=1` bên app <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 --> |

## 5. Kiểm (mức C3)

| Mã | Lane | Kiểm |
|---|---|---|
| SC-IDENT-1 | CONTRACT | vé hết hạn / sai chữ ký / `iat` tương lai ⇒ 401; vé đúng ⇒ 200 có `token` |
| SC-IDENT-2 | CONTRACT | vé mang quyền lạ ⇒ phiên không có quyền đó (đọc `GET /api/v1/auth/me`) |
| SC-IDENT-3 | CONTRACT | người dùng cục bộ `is_active = false` ⇒ vé đúng vẫn 401 |
| SC-IDENT-4 | HOUSE | không chỗ nào so chữ ký bằng `===` (phải `timingSafeEqual`); không lưu vé |

## 6. Không nằm trong hợp đồng

Mật khẩu, 2FA, phiên WordPress — việc của WordPress. Khoá API máy ↔ máy — `bizcity_api@1` (`X-Api-Key`) và chính sách 1API ở open-hub.

## 7. Quyết định của chủ (2026-11-24)

<!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 — chủ duyệt bốn gợi ý. -->

| Mã | Câu hỏi | Quyết định |
|---|---|---|
| Q-IDENT-1 | Quyền do WordPress cấp trong vé, hay app tự giữ vai? | **Giữ như đang chạy:** WordPress cấp `perms`, app lọc về quyền đã khai (R-IDENT-4) và vẫn chặn được cục bộ (R-IDENT-5) |
| Q-IDENT-2 | Hạn chuyển tiếp cho vé thiếu `sub` / `aud` | **90 ngày** sau khi plugin phát vé cập nhật; open-ketoan có công tắc `WP_SSO_REQUIRE_SUB` (mặc định tắt) để chuyển sang bắt buộc |

## 8. Lịch sử

- **1.0.1 (2026-11-24):** làm rõ phạm vi (chỉ cửa SSO; app tự làm chủ người dùng cục bộ — `bizcity_users@1`); cập nhật §4 theo thực tế (open-ketoan #626, bridge #35, open-cake S004-7). Không đổi luật. <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 -->
- **1.0.0 (2026-11-24):** chủ duyệt Q-IDENT-1, 2; bỏ hậu tố -draft; R-IDENT-3 ghi công tắc `WP_SSO_REQUIRE_SUB`. <!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 -->
- **1.0.0-draft (2026-11-24):** bản đầu, SPINE-4.
