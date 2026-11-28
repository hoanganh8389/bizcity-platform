# NC-004 — Trụ cột xuyên doanh nghiệp trên open-core: một chuẩn với open-ketoan cho POS, HRM, MRP, mua, kho, CRM
<!-- [2026-11-28 12:24 AM Johnny Chu - Chu Hoàng Anh] NC-004 — chủ (2026-11-28): "đảm bảo bộ trụ cột của open-ketoan có tính chất xuyên suốt toàn bộ doanh nghiệp như item id, tenant = blog_id (1 chuỗi nhiều cửa hàng = nhiều tenant id), contact id (open-cake) = partner (open-ketoan), business document, yaml của document, user role permission, universal về meta, settings, posts, quy tắc đơn vị tính (quy về nhỏ nhất)… cùng tiêu chuẩn kỹ thuật universal, cache, test, bàn điều tra, trace… open-core đảm bảo xuyên suốt để hrm, pos, mrp, mua, kho, crm liền mạch một chuẩn với open-ketoan, dữ liệu chuyển tiếp được, trace được nguồn gốc chứng từ, versioning chứng từ; open-core đảm bảo chuẩn chung api, mcp, có sẵn four-step setting api để 4 bước kết nối open-hub". -->

> **Loại:** nghiên cứu + đề xuất chuẩn · **Trạng thái:** chủ chốt Q-PIL-1…3, 5, 9, 10 (§9); Q-PIL-4, 6, 7, 8 phân tích ở §9.1, chờ chủ <!-- [2026-11-28 02:15 PM Johnny Chu - Chu Hoàng Anh] NC-004 — chủ chốt Q-PIL-5, Q-PIL-9, Q-PIL-10 (2026-11-28) -->
> **Đứng trên:** canon R-CANON-17 (ba vai), **R-CANON-18** (trụ cột do open-core bảo đảm — thêm cùng đợt) · [NC-003](NC-003-TACH-OPEN-CORE.md) (tách open-core, bước C0–C8)
> **Đọc:** open-ketoan `dev` `4e5cbc8` (`docs/contracts`, `docs/rules`, `packages/contracts/src`, `db/migrations`) · bizcity-platform `docs/standard` + `schema/` · open-hub canon · open-cake `docs/architecture` · bizcity-twin-ai `docs/rules/PHASE-0-RULE-FOUR-STEP-SETUP-AXIS.md`, `core/channel-gateway/docs/PHASE-0.83-FOUR-STEP-SETUP/`

## 0. Một câu

**Mọi app trên open-core nói cùng một thứ tiếng với open-ketoan:** cùng `item_id`, cùng đơn vị tính quy về nhỏ nhất, cùng `tenant`, cùng khách (`contact_id` ↔ `partner`), cùng chứng từ (`doc_ref` + phiên bản + chuỗi liên kết), cùng người dùng – vai – quyền, cùng lớp cài đặt / meta / bản ghi mềm; và cùng khung kỹ thuật (API, MCP, four-step setup, đệm, kiểm, bàn điều tra, trace). **open-core hiện thực một lần; app chỉ khai loại của mình vào registry.**

## 1. Nguyên tắc

| Mã | Nguyên tắc |
|---|---|
| R-PIL-1 | **Một trụ, một chuẩn, một bản hiện thực.** Chuẩn ở open-platform (`docs/standard`, `schema/`); bảng, kiểu, action, migration của trụ ở open-core; app không định nghĩa lại (không bảng `items` riêng, không `doc_ref` riêng) |
| R-PIL-2 | **open-ketoan là bản mẫu nghiệp vụ** của trụ master data, chứng từ, sổ (canon §3.1, §3.3); chỗ open-ketoan và chuẩn lệch nhau ⇒ chốt một lần ở NC này, sửa chuẩn (spine 1.2), không để mỗi app tự chọn |
| R-PIL-3 | **App khai, lõi chạy.** Loại chứng từ, workflow YAML, quyền, màn, khoá cài đặt, loại bản ghi mềm, bí mật, bước setup: app khai trong manifest / registry (`register*`); lõi kiểm, lưu, phân quyền, ghi bằng chứng |
| R-PIL-4 | **Chạy một mình, sẵn ánh xạ** (R-CANON-16): app có danh mục cục bộ vẫn dùng đúng hình của trụ, để ráp với open-ketoan sau không phải đổi dữ liệu |
| R-PIL-5 | **Truy được nguồn gốc:** mọi dòng dữ liệu chuyển tiếp mang `doc_ref` + `version` của chứng từ nguồn, mọi lời gọi mang `traceparent`; bàn điều tra tra ngược được từ một mã bất kỳ |

## 2. Trụ dữ liệu

| # | Trụ | Định danh trên dây | open-ketoan có | Chuẩn hiện có | open-core phải giao | Gap |
|---|---|---|---|---|---|---|
| P-1 | **Hàng hoá** | `item_id` ULID bất biến; mã theo thời gian `item_codes(kind sku/barcode/alias/external:<src>)` | `BIZCITY-ITEM-MASTER-v1` 0.5.0-draft, `RULE-ITEM` R-ITEM-0..10, migration 0065–0070, 0092 | SPINE §2 item | bảng + action item master khung (định danh, mã, phân loại theo ngày) **hoặc** cổng ánh xạ chuẩn cho app có danh mục cục bộ (`catalog_source local|ketoan`) | biến thể hai cơ chế (`parent_item_id` / `variant_code`); thiếu chuẩn nhóm / thuộc tính / lô / vị trí (MRP, kho); H-1…H-18 đang chép ở open-cake |
| P-2 | **Đơn vị tính** | `uom` (tên Việt có dấu) · **`qty` quy về đơn vị nhỏ nhất** | `dvt.ts`, `product_units.ratio` — đúng **một** đơn vị tỷ lệ 1 = đơn vị kho; intake nhận `qty` đã quy đổi, `unit` / `unitQty` / `unitRatio` chỉ để hiện | SPINE §2 + `refs.schema`: gửi `uom + qty`, **không** gửi ratio, chủ quy đổi | kiểu `QtyLine` + hàm quy đổi / làm tròn dùng chung; độ chính xác: số lượng `numeric(18,4)`, tỷ lệ `(18,6)`, tiền `(18,2)` | **xung đột ngữ nghĩa `qty`** (chốt Q-PIL-1); thiếu luật đơn vị không chia hết (kg/g, m/cm cho MRP), số chữ số thập phân theo đơn vị |
| P-3 | **Tenant** | `tenant` (mã đơn vị) · `site` (slug) | site = một CSDL `kt_<slug>`; tenant = một sổ / pháp nhân; `branches` cây đơn vị (công ty → vùng → chi nhánh → cửa hàng); `pos_installation_blogs(blog_id → tenant_id)` (ADR-0037, 0180), R-OKT-CONN **một blog = một shop = một tenant** | SPINE §2: `tenant` = slug site (chưa tách); MULTISITE §1: phải tách site / tenant (ADR treo) | `tenants.external_ref` = `wp-blog:<blog_id>`; ánh xạ blog ↔ tenant một-một; tách `site` / `tenant` trên dây | spine chưa tách; regex slug lệch (`{1,30}` / `{2,29}`); chưa có luật "cửa hàng là tenant hay chi nhánh" (chốt Q-PIL-2) |
| P-4 | **Khách / đối tượng** | `contact_id` (open-cake, ULID) ↔ `partner.code` (open-ketoan) | `partners` + `entity_codes` (0085) + `entity_attributes` theo ngày (0087, 0168), đa vai, cha–con, changefeed `/api/v1/sync/partners` | SPINE §3–§4: `ContactRef`, `PartnerRef`, `partner.code` = SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE` | **kiểu TS** `ContactRef` / `PartnerRef` / `resolveEntity` trong `@bizcity/contracts`; bảng `contact_links(app, kind, ref_code, ref_id)` khung | chỉ có JSON schema; canon §3.4 còn ghi quy tắc mã cũ; **chưa có trục nhân viên** (HRM: employee là user? contact? — Q-PIL-7) |
| P-5 | **Chứng từ** | `doc_ref` = `<module>.<type>:<id>` · `version` + `content_hash` · `document_links(role)` | `BIZCITY-DOCUMENT-v1`, R-DOC-CONT-0..9 (đúng **bốn bảng**: `business_documents`, `document_versions`, `document_links`, `document_attachments`), đánh số `document_sequences` theo đơn vị × năm, `DOC_LINK_ROLES` (source, reverses, replaces, settles, attachesTo, ledger, applies, uses, adjusts), sáu nhóm trạng thái, huỷ sau ghi sổ = bút toán đảo, ký theo phiên bản | SPINE §2 document, §4 outbox `Idempotency-Key = <doc_ref>@<version>`; ORDER-FLOW §1 | **bốn bảng ở migration lõi**, `ctx.documents.*` (đánh số, phiên bản, liên kết, đính kèm, in, ký) — `core/documents.ts` đã có, thiếu bảng; registry loại chứng từ xuyên app | **regex `doc_ref` lệch** (spine: id ≤ 64 ký tự an toàn; open-ketoan: bắt buộc dấu chấm, id ≤ 200) — Q-PIL-4; `docKey` canon §3.3 khác DOCUMENT; chưa có chuẩn chứng từ / in ở open-platform |
| P-6 | **Workflow YAML của chứng từ** | `<module>.<type>.workflow.yaml` | `core/workflow.ts` (thư viện `yaml` + zod chặt): `type`, `label`, `states{group,label}`, `transitions{verb:{from[],to,permission|{state:perm},levels[],sod,owner,requires[reason],ledger,blocked,denied}}`; mẫu: `purchase-document.workflow.yaml`, `payment-request.workflow.yaml` | không có | `core/workflow.ts` đã ở open-core; cần **chuẩn `bizcity_workflow@1`** + schema máy đọc ở open-platform + `cli workflow check` | DOCUMENT §5 có `by: event, on:` nhưng schema chặt không nhận (tài liệu ≠ mã) |
| P-7 | **Người dùng – vai – quyền** | `sub = wp:<id>` · quyền `<module>:<chức-năng>-<động-từ>` · `bizcity.authz.json` | 18 quyền lõi + 242 quyền module, sáu vai hệ thống, gán vai theo phạm vi tenant / branch / warehouse / org_unit + mục đích (operate / approve / report / export), `tenant_roles`, `authz_version`, màn × thao tác (`extensions.screens[]`, NT-HT-003) | USERS-ROLES R-USER-1..17, `schema/users/authz-manifest.schema.json` | đã ở open-core (`core/auth`, `authz/*`, `roles.ts`, `authz-manifest.ts`); cần **danh mục mã màn** xuyên app và phạm vi theo P-3 | USERS-ROLES §7 còn ghi "chưa repo nào có `bizcity.authz.json`" (cũ); 5 quyền tên tiếng Anh |
| P-8 | **Cài đặt** | `bizcity_settings@1` khoá `bizcity.<app>.<…>` | `setting_values` chỉ thêm, có phiên bản / hiệu lực / căn cứ pháp lý; registry 30 khoá lớp A / B / C; thang phạm vi `install → tenant → accounting_unit → branch → period → doc_type → record → user` | platform: `system → site → tenant → branch → user` | `core/settings.ts` đã ở open-core; **một thang phạm vi chung** (Q-PIL-6), phạm vi do app khai (`registerSettingScopes`, NC-003 C4) | hai thang lệch; scope `accounting_unit` cứng trong lõi |
| P-9 | **Meta · bản ghi mềm ("posts") · tệp** | `entity_meta`, `user_meta`, `record_types` / `records`; tệp `bizcity_storage@1` | `entity_attributes` (thuộc tính theo ngày), `document_attachments`, `notifications`; **không** có lớp mềm | canon CHUAN-DU-LIEU-TRUC-VA-LOP-MEM R-DATA-1..9 (không đưa số lượng / tiền / thuế vào meta); open-cake `@bizcity/flex`, Storage S018 | lớp mềm + Storage lên lõi (NC-003 C5); chuẩn **ghi chú / bình luận / dòng hoạt động** gắn `doc_ref` | đường tệp open-ketoan thiếu đoạn `sites/<site>`; chưa có chuẩn bình luận |

## 3. Chuỗi chứng từ xuyên app (ví dụ chuẩn)

```text
cake.order_request:01J…@1 ──source──► pos.sale:01J…@2 ──source──► inventory.issue:01J…@1 ──ledger──► ledger.event:<docKey>@1
   (open-cake, contact_id)        (POS, item_id, qty nhỏ nhất)      (kho, warehouse_uid)            (open-ketoan, partner.code)
mỗi mũi tên = một dòng document_links ở app NHẬN · mỗi lần gửi: Idempotency-Key = <doc_ref>@<version>, traceparent đi theo
sửa trước ghi sổ = phiên bản mới (version + 1, content_hash mới) · sau ghi sổ = chứng từ điều chỉnh (role adjusts) / đảo (reverses)
```

Bàn điều tra nhập một mã bất kỳ (`doc_ref`, `traceId`, `requestId`, `partner.code`, `item_id`) ⇒ ra cả chuỗi, mọi phiên bản, mọi lần gửi.

## 4. Trụ kỹ thuật

| # | Trụ | open-ketoan / app có | Chuẩn | open-core phải giao | Gap |
|---|---|---|---|---|---|
| T-1 | **API** | phong bì `{ok,data,meta}` / `{ok:false,error{code,message,details,requestId,traceId}}`, `Idempotency-Key` 7 ngày, 409 `IDEMPOTENCY_CONFLICT` | API-PROFILE R-API-1..12 | `defineAction` ⇒ REST (`@bizcity/server`, C5) | — |
| T-2 | **MCP** | `POST /mcp`, STD-MCP-1..10, `confirm_token` (`mcp_confirm_tokens`, 0037), ghi chỉ tạo nháp | canon R-CANON-2, R-CANON-12 | action `expose.mcp` ⇒ tool, bảng `mcp_confirm_tokens` ở migration lõi | bảng chưa ở lõi; chưa có chuẩn MCP ở open-platform (đang ở open-ketoan `docs/contracts`) |
| T-3 | **Four-step setup (kết nối open-hub)** | bizcity-twin-ai R-SETUP-4 v1.4 (PHP, đủ); open-cake một phần (đường tự cài `cake-connector`); open-ketoan có thiết kế, chưa mã | BIZCITY-HUB-v1 (loại khoá R-STD-KEY-2) | **`bizcity_hub_setup@1`** (§5) + màn chung ở `@bizcity/web-shell` (chốt Q-PIL-9) | Hub chưa có đầu máy-gọi-máy trạng thái khoá (`/keys/self` mới ở thiết kế); chưa có hợp đồng QR cho app không phải WP |
| T-4 | **Đệm** | R-CACHE-1..6 | CACHE (khoá có `site`, R-SITE-6) | module Cache chung, chạy khi vắng Redis (NC-003 C5) | chưa có mã chung |
| T-5 | **Kiểm** | `tests/conformance/selfcheck.mjs` (block / ratchet / info / planned) | TESTING bốn làn, R-STD-TEST-1 | `@bizcity/conformance` (khung selfcheck + phép kiểm trụ: `doc_ref`, `qty`, quyền, migration) | chưa rút ra |
| T-6 | **Bàn điều tra** | `ban-dieu-tra.ts`: màn `/dev/{tong-quan,tra-ma,nhat-ky,ghi-so,su-kien,toan-ven,kich-ban,van-hanh}`, kịch bản TH-xx, tóm tắt cho AI; `loi-trinh-duyet.ts` (lỗi trình duyệt có che PII); phát hiện `bizcity_findings@1` + cách sửa `bizcity_remedy@1` | FAILURE-MAP, FEEDBACK-LOOP | **màn bàn điều tra chung** ở web-shell + action `core.trace.lookup`; app khai thêm màn / kịch bản | đang là màn của open-ketoan; màn `ghi-so` là nghiệp vụ sổ ⇒ để module |
| T-7 | **Trace · bằng chứng** | OpenTelemetry (ADR-0010), `traceparent`, `audit_logs` chuỗi băm, STD-EVD-1..10, `evidence-export`, niêm phong (ADR-0030) | OBSERVABILITY R-OBS-1..7 | đã ở lõi (`core/tracing`, `audit`, `evidence-export`) | — |
| T-8 | **Outbox · sự kiện** | R-OUTBOX-1..7, người nhận idempotent theo `event_id` | SPINE §4 | đã ở lõi (`core/events`) | NATS chỉ sau outbox (NC-002 Q-OC-3) |
| T-9 | **Bí mật** | `platform.secrets` AES-256-GCM theo đơn vị (`BIZCITY-SECRETS-v1`) | — | **đã vào lõi 0.3.1** (C3); khoá Hub `biz-…` lưu ở đây | chuẩn SECRETS nằm ở open-ketoan, cần lên open-platform |

## 5. `bizcity_hub_setup@1` — bốn bước kết nối open-hub (đề xuất)

Theo R-SETUP-4 của bizcity-twin-ai (nhãn và thứ tự giống nhau ở mọi màn, R-S4-1; "Đạt" chỉ do máy chủ, R-S4-2; bước sau mở khi bước trước Đạt, R-S4-3; lỗi theo R-ERROR-UX `{code, message, hint, help_code}`).

| Bước | id | Nhãn | Ai | Đạt khi |
|---|---|---|---|---|
| ① | `account` | Kết nối tài khoản BizCity | quản trị | khoá `biz-…` thử `GET {hub}/wp-json/bizcity/v1/llm/models` ⇒ 200 |
| ② | `transport` | Kết nối máy chủ kênh (Hub hoặc tự cài, `mode: hub|self`) | quản trị | máy kết nối / Hub gọi được hai chiều |
| ③ | `identity` | Đăng nhập tài khoản kênh (số Zalo…) | người dùng | tài khoản kênh `connected`, chủ = người đang đăng nhập |
| ④ | `agent` | Chọn Agent Guru | người dùng | agent mặc định có (máy chủ tự tạo nếu thiếu) — **tuỳ chọn** với app không dùng agent (Q-PIL-8) |

- **Trạng thái mỗi bước:** `locked · checking · ok · fail · forbidden` + `code, message, hint, help_code, checkedAt, scope (admin|member)`.
- **Đầu (open-core `@bizcity/server`, khung chung; app chỉ khai bước ② ③ ④ của mình):**
  `GET /api/v1/setup/status` (bước + `license{status: ok|expiring|expired|missing|unknown, expiresAt, checkedAt}` + `ready`) · `POST /api/v1/setup/hub-key` `{apiKey?, hubUrl?}` (lưu rồi thử; không bao giờ trả lại khoá) · `POST /api/v1/setup/hub-key/test` · `POST /api/v1/setup/recheck` · tuỳ chọn: kết nối một chạm PKCE (`/api/v1/setup/connect` + callback + proof).
- **Khoá cài đặt:** `bizcity.hub.url` · `bizcity.hub.api_key` (**bí mật**, `platform.secrets`, phạm vi tenant) · `bizcity.hub.last_check` · `bizcity.hub.license_cache` (TTL 1 giờ) · `bizcity.channel.mode`.
- **Gọi Hub:** `Authorization: Bearer biz-…` · `X-BizCity-Client-Site` · `X-BizCity-Caller: <app>/<version>`.
- **Khoá mềm** (B2B-KEY-3, R-SITE-13): hết hạn / thiếu ⇒ chỉ dải đỏ; sổ, báo cáo, API, sao lưu **không bao giờ dừng**; chỉ AI / dịch vụ đám mây dừng; Hub không gọi được và lần trước `ok` ⇒ ghi `unknown`, không hiện đỏ.
- **Không trộn loại khoá** (R-STD-KEY-2): `biz-…` app → Hub · khoá API của app · `prov_…` open-setup → `/_sites/v1`.
- **Giao diện:** một thành phần bốn bước ở `@bizcity/web-shell` (R-S4-11: không app nào vẽ lại) — Q-PIL-9.

## 6. Gap theo thứ tự ưu tiên

| # | Gap | Làm ở | Bước |
|---|---|---|---|
| G-1 | `qty` quy về nhỏ nhất (chốt Q-PIL-1) chưa vào chuẩn: spine §2 + `refs.schema` còn "gửi `uom + qty`, chủ quy đổi" | open-platform: **spine 1.2** (cùng PR: schema, vector, `spine-check` — R-PLAT-6); open-core: `QtyLine` + quy đổi + làm tròn | S-PIL-1 |
| G-2 | Tách `site` / `tenant` trên dây; `tenant ↔ blog_id` một-một (chốt Q-PIL-2); regex slug một bản | spine 1.2 + MULTISITE 1.1 (ADR treo → ADR mới); open-core: `tenants.external_ref = wp-blog:<id>` | S-PIL-1 |
| G-3 | Một regex `doc_ref`, một quy ước `docKey` | spine 1.2 + canon §3.3 | S-PIL-1 |
| G-4 | Bốn bảng chứng từ + `document_sequences` + `mcp_confirm_tokens` chưa ở migration lõi | open-core `migrations` (C4 / C5) | S-PIL-3 |
| G-5 | Chưa có chuẩn chứng từ, workflow YAML, in, MCP, bí mật ở open-platform (đang ở open-ketoan `docs/contracts`) | open-platform: **BIZCITY-DOCUMENT-v1**, **BIZCITY-WORKFLOW-v1** (`bizcity_workflow@1` + schema), MCP, SECRETS — dời văn bản như Q-CORE-5 | S-PIL-2 |
| G-6 | Registry loại chứng từ xuyên app (mua, kho, bán, HRM, MRP…) ↔ nhóm trạng thái ↔ điểm ghi sổ | open-platform `schema/document-types` + open-core `registerDocumentType` | S-PIL-2 |
| G-7 | `bizcity_hub_setup@1` chưa có (chuẩn + mã + màn) | open-platform HUB 1.1 + open-core server / web-shell | S-PIL-4 |
| G-8 | Kiểu TS `ContactRef` / `PartnerRef` / `ItemRef` / `DocRef` chưa có ở `@bizcity/contracts` | open-core | S-PIL-3 |
| G-9 | Một thang phạm vi cài đặt | open-platform SETTINGS + open-core `registerSettingScopes` | S-PIL-3 |
| G-10 | Item master mở rộng cho MRP / kho: biến thể một cơ chế, nhóm, thuộc tính, lô, vị trí, đơn vị thập phân; H-1…H-18 thành hợp đồng chung | open-platform ITEM-MASTER (dời từ open-ketoan) | S-PIL-5 |
| G-11 | Trục nhân viên (HRM) | NC riêng sau Q-PIL-7 | — |
| G-12 | Bàn điều tra chung + `@bizcity/conformance` | open-core web-shell + gói conformance | C5 / C8 |
| G-13 | Chữ cũ: canon §3.4 (quy tắc mã khách), USERS-ROLES §7, DOCUMENT §5 `by: event`; open-cake SSO `aud=cake` ≠ id `open-cake`; open-ketoan còn tên `@ketoan/contracts` | từng repo | S-PIL-1 / C6 |

## 7. Lộ trình (ghép với NC-003)

| Bước | Repo | Việc |
|---|---|---|
| **S-PIL-1** | open-platform | spine **1.2**: `qty` nhỏ nhất + `unit/unitQty/unitRatio` để hiện; tách `site` / `tenant`, `tenant ↔ blog_id`; một regex `doc_ref` / `docKey`; regex slug; schema + vector + `spine-check` cùng PR; MULTISITE 1.1 |
| **S-PIL-2** | open-platform | chuẩn DOCUMENT, WORKFLOW (`bizcity_workflow@1` + schema), MCP, SECRETS (dời văn bản từ open-ketoan, giữ mã luật gốc); registry loại chứng từ |
| **S-PIL-3** | open-core (C4) | bốn bảng chứng từ, `document_sequences`, `mcp_confirm_tokens` vào migration lõi; kiểu `*Ref`; `QtyLine`; thang phạm vi cài đặt |
| **S-PIL-4** | open-platform + open-core (C5) | `bizcity_hub_setup@1`; đầu `/api/v1/setup/*` ở `@bizcity/server`; màn bốn bước ở `@bizcity/web-shell`; open-cake dùng trước, open-ketoan theo ở C6 |
| **S-PIL-5** | open-platform | ITEM-MASTER chung (dời từ open-ketoan) + H-1…H-18 + phần MRP / kho |
| C6 | open-ketoan | nhận lõi; baseline bảng chứng từ đã có |

## 8. Ví dụ app mới trên open-core (đích)

```text
open-hrm = open-core + module hrm
  - không tạo bảng users / roles / settings / documents / files riêng — dùng của lõi
  - khai: loại chứng từ hrm.payroll, hrm.leave (registerDocumentType + workflow YAML), quyền hrm:*, màn, khoá bizcity.hrm.*
  - chứng từ lương ──ledger──► open-ketoan bằng doc_ref + version (không ghép theo tên)
  - bốn bước kết nối open-hub: có sẵn từ @bizcity/server + web-shell
```

## 9. Quyết định

| Mã | Câu hỏi | Chốt / đề xuất |
|---|---|---|
| **Q-PIL-1** | Số lượng trên dòng | **Chốt (chủ, 2026-11-28):** quy về **đơn vị nhỏ nhất** — `qty` luôn theo đơn vị có tỷ lệ 1; `unit`, `unitQty`, `unitRatio` chỉ để hiện / in (theo open-ketoan). Spine 1.2 đổi theo |
| **Q-PIL-2** | Tenant | **Chốt (chủ):** `tenant ↔ blog_id` (WordPress) một-một; **một chuỗi nhiều cửa hàng = nhiều tenant** (R-OKT-CONN: một blog = một shop = một tenant). Chi nhánh / kho / phòng ban vẫn là cây `branches` **bên trong** một tenant |
| **Q-PIL-3** | Khách | **Chốt (chủ):** `contact_id` (open-cake) ↔ `partner` (open-ketoan) qua `partner.code` theo SPINE §4 (SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE`); không ghép theo tên |
| Q-PIL-4 | Regex `doc_ref` | *Đề xuất:* `^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[A-Za-z0-9_.:-]{1,200}$` — bắt buộc `<module>.<type>` (như open-ketoan), id ký tự an toàn (như spine), dài tới 200 |
| **Q-PIL-5** | Workspace với blog / trạng thái | **Chốt (chủ, 2026-11-28):** Workspace ở open-setup / open-core **chỉ ghi chép trạng thái** (bản phản chiếu); **trạng thái hoạt động gốc nằm ở phía WordPress bizcity hub** (bizcity.vn: thành viên, blog, gói, khoá). open-setup đọc / nhận thông báo từ hub rồi ghi lại, không tự quyết bật / tắt |
| Q-PIL-6 | Thang phạm vi cài đặt | *Đề xuất:* `install → site → tenant → branch → (phạm vi app khai: accounting_unit, period, doc_type, record…) → user` |
| Q-PIL-7 | Nhân viên (HRM) | *Đề xuất:* nhân viên = `user` khi có đăng nhập + hồ sơ `hrm.employee` (chứng từ / bản ghi của module), ánh xạ `contact` khi cần chăm sóc — NC riêng |
| Q-PIL-8 | Bước ④ Agent Guru | *Đề xuất:* tuỳ chọn — app không dùng agent khai `steps: [account, transport, identity]` |
| **Q-PIL-9** | Màn bốn bước | **Chốt (chủ):** màn bốn bước đặt ở **open-core** (`@bizcity/web-shell` + đầu `/api/v1/setup/*` ở `@bizcity/server`) — kế toán, HRM, cake, POS dùng cùng một bản; không app nào vẽ lại (R-S4-11) |
| **Q-PIL-10** | Văn bản chuẩn đang ở open-ketoan | **Chốt (chủ):** **dời sang open-platform** (`docs/standard/`, giữ mã luật gốc R-PLAT-7); open-ketoan giữ liên kết. Danh sách dời: §10 |

### 9.1 Phân tích các câu còn mở
<!-- [2026-11-28 02:15 PM Johnny Chu - Chu Hoàng Anh] NC-004 — chủ chốt Q-PIL-5, Q-PIL-9, Q-PIL-10 (2026-11-28) -->

**Q-PIL-4 · Regex `doc_ref`.**
| Phương án | Hình | Được | Mất |
|---|---|---|---|
| A — spine hiện tại | `^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*:[A-Za-z0-9_.-]{1,64}$` | id an toàn cho URL / khoá đệm | **không bắt buộc** `<module>.<type>` ⇒ `order:1` lọt; id ≤ 64 hụt với `docKey` dài của sổ |
| B — open-ketoan hiện tại | `^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:\S{1,200}$` | bắt buộc `<module>.<type>` | id nhận mọi ký tự không trắng (`/`, `#`, `?`, chữ có dấu) ⇒ vỡ URL, khoá đệm, tên tệp |
| **C — đề xuất** | `^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*:[A-Za-z0-9_.:-]{1,200}$` | giữ `<module>.<type>` của B + bộ ký tự an toàn của A; `:` trong id cho `docKey` dạng `<source>:<branch>:<type>:<id>` | dữ liệu open-ketoan có id ngoài bộ ký tự (nếu có) phải chuẩn hoá — **kiểm trước** bằng truy vấn trên bản sao trước khi chốt |
Kéo theo: canon §3.3 `docKey` = `doc_ref` của chứng từ nguồn (bỏ quy ước riêng); vector + `spine-check` đổi cùng PR (S-PIL-1).

**Q-PIL-6 · Thang phạm vi cài đặt.** Hai thang đang lệch: open-platform `system → site → tenant → branch → user`, open-ketoan `install → tenant → accounting_unit → branch → period → doc_type → record → user`.
*Đề xuất:* **thang lõi cố định** `install → site → tenant → branch → user` (đủ cho mọi app, khớp Q-PIL-2: chuỗi = nhiều tenant, chi nhánh trong tenant) + **bậc app khai** chèn vào chỗ đã định: `accounting_unit` (sau tenant, trước branch), `period`, `doc_type`, `record` (sau branch, trước user) qua `registerSettingScopes` (NC-003 C4). open-ketoan giữ nguyên hành vi (thang của nó là thang lõi + bậc khai); `site` là bậc mới cho cài đặt dùng chung mọi tenant của một chuỗi. Rủi ro: `install` ≡ `system` — chọn một tên (`install`, theo dữ liệu đang có).

**Q-PIL-7 · Nhân viên (HRM).** Ba vai một người: `user` (đăng nhập, `sub = wp:<id>`), `contact` (khách / người liên hệ của cake), `partner` (đối tượng công nợ: tạm ứng, lương phải trả). *Đề xuất:* thêm trục **`employee`** do module HRM làm chủ — `employee_id` ULID, `user_id` tuỳ chọn (nhân viên không đăng nhập vẫn có hồ sơ), `partner_ref` khi phát sinh công nợ với kế toán (như cake R-SPINE), **không** gộp vào `users`; chứng từ lương / chấm công dùng `doc_ref` `hrm.*`. Cần NC riêng (NC-005) trước khi có open-hrm; tới đó không app nào tự tạo bảng nhân viên.

**Q-PIL-8 · Bước ④ Agent Guru.** R-SETUP-4 coi ④ là bước bắt buộc của bizcity-twin-ai (app có agent). App như kế toán, kho có thể chưa dùng agent. *Đề xuất:* `bizcity_hub_setup@1` khai `steps` theo app: ① ② bắt buộc với mọi app nối Hub, ③ khi app có kênh, ④ khi app có agent — bước không khai **không hiện** (không phải "Khoá"); `ready` = mọi bước đã khai đều Đạt. Giữ nhãn và thứ tự R-S4-1 cho các bước có hiện.

## 10. Văn bản chuẩn dời từ open-ketoan sang open-platform (Q-PIL-10)
<!-- [2026-11-28 02:15 PM Johnny Chu - Chu Hoàng Anh] NC-004 — chủ chốt Q-PIL-5, Q-PIL-9, Q-PIL-10 (2026-11-28) -->

Cách dời: chép nguyên văn vào `docs/standard/` (giữ mã luật, lịch sử phiên bản, ghi "dời từ open-ketoan `docs/contracts` @ `4e5cbc8`"), thêm vào `standards.json` + bản đồ chuẩn (R-PLAT-7), `standard-check` ĐẠT; bên open-ketoan thay nội dung bằng liên kết **qua R-FLOW** (claim + PR vào `dev`).

| Đợt | Văn bản (open-ketoan `docs/contracts/`) | Lý do |
|---|---|---|
| **D1 — trụ lõi cần ngay** | `BIZCITY-DOCUMENT-v1`, `BIZCITY-LINEAGE-v1`, `BIZCITY-MCP-v1`, `BIZCITY-SECRETS-v1`, `BIZCITY-SITE-PROVISIONING-v1` (Q-CORE-5), `BIZCITY-ACTION-v1`, `BIZCITY-API-v1`, `BIZCITY-ERRORS-v1`, `BIZCITY-EVENT-v1`, `BIZCITY-EVIDENCE-v1`, `BIZCITY-AUTHORIZATION-v1`, `BIZCITY-SETTINGS-MATRIX-v1` + `bizcity-settings.registry.json` (phần lõi) | open-core đã mang mã của các trụ này |
| **D2 — trụ dữ liệu / module** | `BIZCITY-MASTER-DATA-v1`, `BIZCITY-ITEM-MASTER-v1`, `BIZCITY-MODULE-v1` (+ schema), `BIZCITY-EXTENSION-v1`, `BIZCITY-FINDINGS-v1`, `BIZCITY-REMEDY-v1`, `BIZCITY-POLICY-v1`, `BIZCITY-DATA-v1` | trụ P-1, P-4, module-sdk (C5), bàn điều tra |
| **Mới** | **`BIZCITY-WORKFLOW-v1`** (`bizcity_workflow@1`, từ `core/workflow.ts`), **`BIZCITY-HUB-SETUP-v1`** (`bizcity_hub_setup@1`, §5) | chưa có văn bản ở đâu |
| **Ở lại open-ketoan** (nghiệp vụ kế toán) | `LEDGER-INTAKE`, `POSTING-RULE`, `POSTING-TEMPLATE`, `PRESET`, `INVENTORY`, `INTAKE-FINDINGS`, `COMPLIANCE`, `COMBO` | thuộc module kế toán / kho của open-ketoan |
| Xét sau | `LIBRARY`, `CONNECTOR`, `DOMAIN`, `MODULES` | còn trộn nghiệp vụ kế toán — phân loại ở C4 |


## Nhật ký

- 2026-11-28: mở NC-004; chủ chốt Q-PIL-1…3 trong lời giao việc.

- 2026-11-28: <!-- [2026-11-28 02:15 PM Johnny Chu - Chu Hoàng Anh] NC-004 — chủ chốt Q-PIL-5, Q-PIL-9, Q-PIL-10 (2026-11-28) --> chủ chốt Q-PIL-5 (Workspace chỉ ghi trạng thái; trạng thái gốc ở WP bizcity hub), Q-PIL-9 (màn bốn bước ở open-core), Q-PIL-10 (dời văn bản chuẩn sang open-platform, §10); phân tích Q-PIL-4, 6, 7, 8 (§9.1).