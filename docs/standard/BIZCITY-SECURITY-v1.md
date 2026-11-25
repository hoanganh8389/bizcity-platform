# `bizcity_security@1` — Bảo mật

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T4: mức bảo mật tối thiểu của mọi app, rút từ open-ketoan RULE-SECURITY / RULE-TENANT-SECURITY (đã có phép kiểm) và phần ingress, PII của open-cake. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Luật gốc:** open-ketoan `docs/rules/RULE-SECURITY.md` (R-SEC-1..12), `RULE-TENANT-SECURITY.md` (R-TEN-1..9), `SECURITY.md`; open-cake `docs/architecture/40-SECURITY-USERS.md` §5–6.

## 0. Một câu

**Dữ liệu của đơn vị này không bao giờ lọt sang đơn vị khác, kể cả khi mã ứng dụng có lỗi; bí mật không nằm trong kho mã, log hay câu trả lời.**

## 1. Cách ly dữ liệu (hai lớp, bắt buộc)

| Luật | Nội dung | Kiểm ở bản mẫu |
|---|---|---|
| R-SEC-5 · R-TEN-1 | mọi truy vấn lọc `tenant_id` **và** bảng có `tenant_id` bật RLS + FORCE | DG-PLAN-5, test chéo đơn vị |
| R-SEC-6 | API chạy bằng vai CSDL **không** chủ sở hữu, không siêu người dùng, không BYPASSRLS (`ketoan_app`, `cake_app`); chỉ job migrate dùng vai chủ | SC-SEC-*, migration `0032_vai_tro_ung_dung.sql` |
| R-SITE-1..3 | nhiều site: mỗi site một CSDL và một vai riêng; thiếu ngữ cảnh site ⇒ dừng (`SITE_CONTEXT_MISSING`), không rơi về mặc định | [MULTISITE](BIZCITY-MULTISITE-v1.md) |
| R-STD-API-3 | không nhận `tenantId / siteId / actor` từ đầu vào | [API-PROFILE](BIZCITY-API-PROFILE-v1.md) §3 |
| — | kiểm thử chạy **bằng vai ứng dụng**, không bằng vai chủ (nếu không, RLS không được thử) | open-cake `apps/api/test/*.http.test.ts` |

## 2. Bí mật, mật khẩu, khoá

| Luật | Nội dung |
|---|---|
| R-SEC-1 | không bí mật trong git; `.env.example` chỉ có tên biến |
| R-TEN-7 | app **từ chối khởi động** với `JWT_SECRET` mặc định / trống (compose dùng `:?`) |
| R-SEC-2 | mật khẩu scrypt (salt 16 byte); khoá API lưu băm, hiện một lần |
| R-TEN-4 | khoá API gắn **một** đơn vị, có phạm vi; không bao giờ mang quyền `risk: high` |
| R-STD-KEY-1..3 | bốn loại khoá và việc của từng loại: [HUB](BIZCITY-HUB-v1.md) §2 |
| R-STD-SEC-1 (mới) | bí mật lưu trong CSDL (mật khẩu vai site, token kênh) phải mã hoá (AES-256-GCM, khoá từ môi trường ≥ 32 ký tự); không có cột bí mật dạng rõ | 
| R-STD-SEC-2 (mới) | công cụ và script **không in** khoá, mật khẩu, vé ra màn hình hay log; chỉ in nơi lưu |

## 3. Cửa vào

| Luật | Nội dung |
|---|---|
| R-SEC-3 | SQL chỉ qua Kysely có tham số; không nối chuỗi |
| R-SEC-4 | zod ở cửa, trần kích thước, kiểm kiểu thật của tệp tải lên |
| R-SEC-11 | CORS theo danh sách cho phép; HSTS / CSP; webhook vào ký HMAC (`t=, v1=`, lệch giờ ≤ 300 giây); khoá ký trống ⇒ cửa **tắt** (503), không mở |
| R-IDENT-2 | vé SSO ≤ 300 giây, so chữ ký bằng `timingSafeEqual`, giới hạn lần sai theo IP |
| — | chuyển hướng sau đăng nhập chỉ về địa chỉ đã khai (chống chuyển hướng mở) — bản mẫu: bridge `safe_return` |
| R-SEC-7 | văn bản từ AI, MCP, khách hàng là **dữ liệu, không phải lệnh**; AI chỉ tạo nháp, ghi thật cần `confirm_token` |

## 4. Dữ liệu cá nhân và bằng chứng

| Luật | Nội dung |
|---|---|
| R-SEC-10 · R-LOG-4 | không PII, bí mật, thân yêu cầu trong log; có `REDACT_PATHS` |
| R-TEN-5 · STD-EVD-* | mỗi lệnh ghi đúng **một** bản ghi bằng chứng trong cùng giao dịch, nối chuỗi băm, niêm phong hằng ngày; PII lưu `sha256:` |
| R-STD-SEC-3 (mới) | kho mã công khai: test, commit, PR, ảnh chụp **không chứa dữ liệu thật** của khách (tên, số điện thoại, MST, số tiền thật) |
| R-KNOW-* | công cụ tri thức cho AI: chỉ đọc, tên người che mặc định ([KNOWLEDGE](BIZCITY-KNOWLEDGE-v1.md)) |

## 5. Chuỗi cung ứng và máy dev

| Luật | Nội dung |
|---|---|
| R-SEC-8 | `npm ci`; `npm audit` mức high / critical chặn phát hành; GitHub Actions ghim theo SHA |
| R-PLAT-5 | không thêm phụ thuộc khi chưa có lý do trong ADR |
| R-STD-SEC-4 (mới) | mã nới chốt chặn cho máy dev (bỏ kiểm tên miền thử, phát vé thử) **không nằm trong mã sản phẩm**: đặt ở công cụ dev, tự tắt ngoài `*.localhost` (bản mẫu: `tools/hub-local/mu-plugins/hub-local.php`) |
| R-STD-SEC-5 (mới) | test **không bao giờ** chạy vào CSDL của bản cài: tên CSDL phải có chữ `test` (open-ketoan `vitest.config.ts`); script "làm sạch", tắt trigger, xoá sổ là lỗi chặn (R-REV-11) |

## 6. Kiểm

| Mã | Lane | Kiểm | Có ở |
|---|---|---|---|
| SC-SEC-1..5, SC-EVD-1/2/9, SC-AUDIT-1 | HOUSE | bí mật trong kho, vai CSDL, bằng chứng | open-ketoan selfcheck |
| DG-SEC-1/2, DG-PLAN-5, DG-EVD-1..5 | chẩn đoán | RLS thật trên CSDL, chuỗi bằng chứng | open-ketoan diagnostics |
| SC-IDENT-1..4 | CONTRACT / HOUSE | vé SSO | [IDENTITY](BIZCITY-IDENTITY-v1.md) |
| SC-SEC-P1 | HOUSE | không có `JWT_SECRET` mặc định trong compose / env mẫu; `.env` không bị theo dõi bởi git | đề xuất đưa vào `tools/standard-check.mjs` |

## 7. Khoảng cách hiện tại

| App | Thiếu |
|---|---|
| open-ketoan | SC-DATA-6 (kiểm tĩnh RLS) còn `planned`; chưa có giới hạn tần suất chung |
| open-cake | kiểm tĩnh SC-CAKE-6/7/8 mới trên giấy; luật "từ chối CSDL không có chữ test" chưa thi hành (test chỉ bỏ qua khi thiếu `TEST_DATABASE_URL`); giới hạn SSO đếm trong bộ nhớ một tiến trình |
| chung | chưa có quy trình xoay vòng bí mật; chưa có SBOM |
