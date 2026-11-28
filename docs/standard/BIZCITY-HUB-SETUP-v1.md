# `bizcity_hub_setup@1` — Bốn bước kết nối open-hub cho mọi app trên open-core

<!-- [2026-11-28 02:55 PM Johnny Chu - Chu Hoàng Anh] D1 — chuẩn mới (NC-004 §5, T-3; chủ chốt Q-PIL-8, Q-PIL-9 ngày 2026-11-28): khái quát R-SETUP-4 v1.4 của bizcity-twin-ai (PHP) cho app TypeScript trên open-core. -->

> **Phiên bản:** 0.1.0-draft · 2026-11-28 · **Trạng thái:** Đề xuất · **Thuộc:** trụ T11 ([HUB](BIZCITY-HUB-v1.md)) · **Hiện thực đích:** open-core `@bizcity/server` (`/api/v1/setup/*`) + `@bizcity/web-shell` (màn bốn bước)
> **Gốc:** bizcity-twin-ai `docs/rules/PHASE-0-RULE-FOUR-STEP-SETUP-AXIS.md` (R-S4-1…24), `core/channel-gateway/docs/PHASE-0.83-FOUR-STEP-SETUP/`

## 0. Một câu

**Kế toán, HRM, cake, POS… nối open-hub bằng cùng bốn bước, cùng một màn của open-core;** app chỉ khai phần riêng của bước ② ③ ④. Sẵn sàng = **cả bốn bước Đạt**.

## 1. Bốn bước

| Bước | id | Nhãn (giống nhau mọi màn, R-S4-1) | Ai | Đạt khi |
|---|---|---|---|---|
| ① | `account` | Kết nối tài khoản BizCity | quản trị | khoá `biz-…` thử `GET {hub}/wp-json/bizcity/v1/llm/models` ⇒ 200 |
| ② | `transport` | Kết nối máy chủ kênh | quản trị | Hub hoặc máy kết nối tự cài (`mode: hub|self`) gọi được hai chiều |
| ③ | `identity` | Đăng nhập tài khoản kênh | người dùng | tài khoản kênh `connected`, chủ = người đang đăng nhập |
| ④ | `agent` | Chọn Agent Guru + phạm vi | người dùng | Guru đã chọn (máy chủ tự tạo mặc định nếu thiếu) **và** phạm vi đã khoanh |

**Bước ④ — Guru là lớp phân quyền ở giữa (Q-PIL-8).** Agent chỉ chạm đúng phạm vi đã chọn, giao với quyền của vai người dùng. App khai chiều phạm vi bằng `registerAgentScope`:

| App | Chiều phạm vi |
|---|---|
| twin-brain (PHP) | `vault` |
| open-ketoan | `module[]` + vai (phạm vi dữ liệu: đơn vị / chi nhánh / kho) |
| open-cake | tài khoản kênh / hộp thư |
| POS | cửa hàng / quầy |

Lõi lưu `agent_scopes(tenant, user, guru, scope_kind, scope_ref)`; MCP chỉ mở tool trong phạm vi.

## 2. Luật

| Mã | Luật |
|---|---|
| R-S4-1…24 | giữ mã gốc của bizcity-twin-ai (nhãn, thứ tự, "Đạt" chỉ do máy chủ R-S4-2, bước sau mở khi bước trước Đạt R-S4-3, sửa tại chỗ hỏng R-S4-12/13, quyền ① ② quản trị R-S4-19…22, không app nào vẽ lại R-S4-11, SetupGate R-S4-24) |
| R-STD-S4-1 | Trạng thái mỗi bước: `locked · checking · ok · fail · forbidden` + `{code, message, hint, help_code, checkedAt, scope: admin|member}`; `hint` bắt đầu bằng động từ ("Cách sửa: …") |
| R-STD-S4-2 | `ready` = **cả bốn bước** `ok` (mọi app) |
| R-STD-S4-3 | Khoá Hub lưu bằng `platform.secrets` (khoá `bizcity.hub.api_key`, phạm vi tenant); **không bao giờ** trả lại khoá, chỉ bản che `biz-1a2b…9z8y` |
| R-STD-S4-4 | **Khoá mềm** (B2B-KEY-3, R-SITE-13): hết hạn / thiếu ⇒ chỉ dải đỏ; sổ, báo cáo, API, sao lưu **không bao giờ dừng**; Hub không gọi được và lần trước `ok` ⇒ `unknown`, không hiện đỏ; đệm trạng thái 1 giờ |
| R-STD-S4-5 | Không trộn loại khoá (R-STD-KEY-2): `biz-…` app → Hub · khoá API của app · `prov_…` open-setup → `/_sites/v1` |

## 3. Đầu API (open-core `@bizcity/server`)

| Đầu | Ai | Làm |
|---|---|---|
| `GET /api/v1/setup/status` | đã đăng nhập | bốn bước + `license{status: ok|expiring|expired|missing|unknown, expiresAt, checkedAt}` + `ready`; `contract: "bizcity_hub_setup@1"` |
| `POST /api/v1/setup/hub-key` `{apiKey?, hubUrl?}` | quản trị | lưu (nếu có) rồi thử; trả trạng thái bước ① |
| `POST /api/v1/setup/hub-key/test` | quản trị | thử lại khoá đang lưu |
| `POST /api/v1/setup/recheck` | đã đăng nhập | kiểm lại mọi bước |
| `GET /api/v1/setup/connect` + callback + proof | quản trị | tuỳ chọn: kết nối một chạm PKCE (cần Hub nhận `proof_path`) |

**Khoá cài đặt:** `bizcity.hub.url` (mặc định `https://bizcity.vn`) · `bizcity.hub.api_key` (bí mật) · `bizcity.hub.last_check` · `bizcity.hub.license_cache` · `bizcity.channel.mode`.
**Gọi Hub:** `Authorization: Bearer biz-…` · `X-BizCity-Client-Site` · `X-BizCity-Caller: <app>/<version>`.

## 4. Câu hỏi mở

| Mã | Câu hỏi | Ghi |
|---|---|---|
| Q-S4-1 | Hub chưa có đầu máy-gọi-máy trạng thái khoá / hạn | tạm dùng `/account/entitlement`; đích `open-hub-core/v1/keys/self` |
| Q-S4-2 | Hub chưa có hợp đồng QR / đăng nhập kênh cho app không phải WordPress | chặn bước ③ của open-cake qua Hub (K3) |
| Q-S4-3 | Chuỗi nhiều tenant (Q-PIL-2): dùng chung khoá của site (R-CANON-13 "một site một khoá") hay mỗi tenant / blog một khoá? | **chờ chủ** |

## Lịch sử

- **0.1.0-draft (2026-11-28):** bản đầu.
