# NC-002 — open-core: Workspace, App Registry và các chuẩn Universal (bản kiến trúc để chuẩn hoá mọi app TypeScript)
<!-- [2026-11-27 09:48 AM Johnny Chu - Chu Hoàng Anh] NC-002 — chủ (2026-11-27): dựa trên open-setup đang có, chuẩn hoá Universal Options / Metadata / Cache / Records & Hooks / Document / Post / Media R2 / App Registry; khách là thành viên WP multisite bizcity.vn; plugin WP ghi chép + help desk, open-setup tạo ứng dụng; đặt tên open-core; tách open-cake thành open-core + module CRM; tuân stack chung và các contract bizcity_workspace@1, bizcity_app_registry@1… -->

> **Loại:** nghiên cứu + đề xuất kiến trúc (không phải chuẩn) · **Trạng thái:** **chủ chốt Q-OC-1…9 ngày 2026-11-27** (§12) <!-- [2026-11-27 10:15 AM Johnny Chu - Chu Hoàng Anh] NC-002 — chủ chốt Q-OC-1…9 --> · **Nối tiếp:** [NC-001](NC-001-KERNEL-TU-WORDPRESS.md) (bảy lớp học từ WordPress) · open-cake [26-NOI-LUU-TEP](https://github.com/hoanganh8389/open-cake/blob/main/docs/architecture/26-NOI-LUU-TEP.md) (lưu tệp / R2).
> **Áp đầu tiên:** open-cake ([PHASE-019](https://github.com/hoanganh8389/open-cake/blob/main/docs/phases/PHASE-019-TACH-OPEN-CORE/README.md)). Sau đó: open-ketoan, open-kiot (TS), open-hrm, open-mrp, open-base, open-requests…
> **Repo liên quan:** bizcity-platform (nền, chuẩn) · bizcity-open-setup (Site Manager) · bizcity-web (WP multisite bizcity.vn, trang dùng thử) · bizcity-llm-router (Hub: danh tính, khoá) · từng app.

## 0. Một câu

**open-core là "WordPress core" của hệ Bizcity Open viết bằng TypeScript: một bản lõi phát hành có phiên bản (kernel + máy chủ khung + giao diện khung + các chuẩn Universal), mỗi app nghiệp vụ là một bộ module cắm vào; open-setup tạo và quản trị mỗi app cho từng Workspace của khách; plugin WordPress trên bizcity.vn là nơi khách và đội hỗ trợ nhìn thấy, ghi chép, thao tác help desk.**

## 1. Mô hình Workspace

```text
bizcity.vn (WordPress multisite)  ── thành viên wp:<id> ── plugin "Bizcity Workspace" (xem · ghi chép · help desk)
        │ gọi
BIZCITY OPEN SETUP — Workspace Management & Application Registry (Site Manager, Frappe)
        │ /_sites/v1 của từng app (bizcity_site_provisioning@1)
Workspace "Doanh nghiệp ABC"  workspace_id 01J…  slug abc
  ├─ Open Kế Toán   kt_abc    abc.openketoan.com
  ├─ Open Cake      cake_abc  abc.opencake.net
  ├─ Open Kiot      kiot_abc  ·  Open HRM hrm_abc  ·  Open MRP mrp_abc  ·  Community App custom_abc
  └─ cấp Workspace: Identity · Members · Settings · Metadata · Connections
Bizcity Platform & Business Contracts — chuẩn backend và dữ liệu xuyên suốt (open-core)
```

### 1.1 Từ vựng — ghép với chuẩn đã duyệt

Chuẩn MULTISITE (Q-STD-1, duyệt 2026-11-25) gọi "doanh nghiệp thuê hệ thống" là **site**, nhưng trong mã, bảng `sites` ở control DB của mỗi app thực chất là **một app của một doanh nghiệp** — một từ đang mang hai nghĩa. **Chốt (Q-OC-2):** ba từ — **Workspace** (doanh nghiệp, `workspace_id` + slug) · **Instance** (một app × một Workspace; trong mã **vẫn là bảng `sites`, không đổi tên bảng**, thêm cột `workspace_id`) · **Tenant** (đơn vị bên trong instance). MULTISITE lên 1.1 sửa §1 từ vựng (PR riêng, R-PLAT-7).

| Từ | Nghĩa | Định danh | Ai làm chủ | Ánh xạ hiện tại |
|---|---|---|---|---|
| **Workspace** | một doanh nghiệp khách (pháp nhân / chuỗi) — đơn vị bán, tính tiền, quản trị | `workspace_id` (ULID trần, như mọi khoá trục — NC-001 K-DB-3), `slug` (khuôn `^[a-z][a-z0-9-]{2,29}$`) | open-setup | `Bizcity Site Customer` + slug; MULTISITE gọi là "site" |
| **App Instance** | một app chạy cho một Workspace: một CSDL `<tiền tố app>_<slug>` + tên miền | `instance_id` (ULID) | open-setup ghi sổ, app làm chủ dữ liệu | `Bizcity Ketoan Site` (chỉ Kế Toán); dòng `sites` trong control DB của app |
| **Tenant** (đơn vị) | pháp nhân / sổ / cửa hàng **bên trong** một App Instance | `tenant_id` | app | như MULTISITE |
| **Member** | một người (thành viên WP) trong một Workspace | `sub = wp:<id>` | Hub (danh tính) + open-setup (thành viên) | user meta + `external_ref` |

Luật giữ nguyên: một `slug` cho mọi app của một Workspace (R-STD-SITE-3); bật thêm app = thêm một CSDL, không thêm khoá (R-CANON-13); open-setup không chạm PostgreSQL của app (R-STD-SITE-2).

## 2. Hiện trạng đã có (đọc mã 2026-11-27)

| # | Ở đâu | Đã có |
|---|---|---|
| H-1 | bizcity-web `include/trial/`, `include/ketoan-trial/` (`class-ketoan-driver-open-setup.php`) | trang dùng thử trên bizcity.vn kiểm tên trống ở `<tên>.bizcity.vn` **và** `<tên>.openketoan.com`, rồi gọi Site Manager |
| H-2 | open-setup `bizcity_site_manager/api.py` | `create_site`, `slug_available`, `sites_of(external_ref)`, `reset_owner_password(site, external_ref)`, `job_status(job, external_ref)` |
| H-3 | open-setup DocType | `Bizcity Site Customer`, `Bizcity Ketoan Site` (`slug, root_domain, domain, customer, sample, status, license_status, site_id, schema_version, app_version, last_backup_at, last_synced_at, last_error`), `Bizcity Provision Job`, `Bizcity Site Root Domain`, `Bizcity Site Manager Settings` |
| H-4 | `@bizcity/platform` 0.2.0 | registry site + cấp site `/_sites/v1` (khoá `prov_…`, `Idempotency-Key`, các bước có hoàn tác), `withSite` / `forEachSite`, migration theo site có sao lưu trước, settings registry, roles registry, `defineAction`, outbox, bằng chứng |
| H-5 | Hub (llm-router) | danh tính `sub = wp:<id>`, vé SSO HMAC, khoá `biz-…` |

**Khoảng trống:** DocType đang **gắn riêng Kế Toán** (không có `product`); không có thực thể Workspace độc lập với "Customer"; không có sổ ứng dụng (app nào tồn tại, phiên bản nào, cấp được ở tên miền nào); bizcity.vn chưa có trang "Workspace của tôi"; thao tác help desk mới có "đặt lại mật khẩu chủ".

## 3. Luồng của khách

```text
① Đăng ký thành viên bizcity.vn (WP multisite)          → sub = wp:<id>
② Tạo Workspace (tên doanh nghiệp, slug)                → plugin gọi open-setup  create_workspace          → workspace_id
③ Thêm app (Open Cake, gói, tên miền abc.opencake.net)  → plugin gọi open-setup  create_instance(ws, product) → job
      open-setup → POST {app}/_sites/v1/sites (prov_…)  → app: registry → vai → CSDL từ mẫu → chủ đầu → bật
④ Theo dõi                                              → plugin hỏi job_status / instance_status; open-setup đồng bộ định kỳ
      (status, schema_version, app_version, last_backup_at, health, dung lượng)
⑤ Dùng app: bấm "Mở" trên bizcity.vn                    → Hub phát vé SSO cho đúng tên miền → app đổi vé lấy phiên có sid
⑥ Help desk (khách hoặc đội hỗ trợ)                     → plugin → open-setup → /_sites/v1 thao tác (bảng 3.2)
```

### 3.1 Phân vai

| Bên | Làm | Không làm |
|---|---|---|
| **Plugin "Bizcity Workspace"** (bizcity.vn) | trang "Workspace của tôi": danh sách Workspace, app, trạng thái, lịch sử thao tác; form tạo / thêm app; nút help desk; ghi **nhật ký thao tác** (ai, lúc nào, kết quả) | không tạo CSDL, không giữ mật khẩu / khoá của app, không gọi thẳng app |
| **open-setup** (Site Manager) | sổ Workspace + App Instance + Job; gọi `/_sites/v1` của app; đồng bộ trạng thái; luật giới hạn (số Workspace / thành viên, tên dành riêng, tên miền gốc cho phép) | không chạm PostgreSQL / tệp của app (R-STD-SITE-2) |
| **App** (open-core + module) | làm chủ dữ liệu; thực hiện cấp / khoá / nâng / sao lưu / thao tác help desk qua `/_sites/v1`; báo sức khoẻ | không biết bizcity.vn tồn tại (chỉ biết vé SSO và khoá `prov_…`) |
| **Hub** | danh tính, SSO, khoá `biz-…`, gói | không giữ dữ liệu app |

### 3.2 Thao tác help desk

| Thao tác | Đường đi | Ghi chú an toàn |
|---|---|---|
| Xem trạng thái | `GET /_sites/v1/sites/:id` (status, schema, app version, backup cuối, health) | đã có phần lớn |
| **Khởi động lại** | `POST …/sites/:id/reset` — xoá đệm, đóng pool, chạy lại kiểm sức khoẻ **của một instance** | ở chế độ nhiều site **không** khởi động lại tiến trình (sẽ ảnh hưởng mọi khách); khởi động lại container chỉ cho bản cài riêng, qua `ops/` |
| Tạo người dùng | `POST …/sites/:id/users` `{email, name, role}` ⇒ thư mời / liên kết đặt mật khẩu một lần | không truyền mật khẩu qua plugin; vai phải có thật (R-USER) |
| **Đặt lại mật khẩu** | `POST …/sites/:id/users/:uid/reset-password` ⇒ liên kết một lần, hạn 30 phút | mở rộng `reset_owner_password` đang có cho mọi người dùng; ghi bằng chứng ở app |
| Khoá / mở | `POST …/sites/:id/suspend` · `resume` | khoá = chỉ đọc (Q039-1, R-SITE-13 — không khoá dữ liệu) |
| Sao lưu ngay | `POST …/sites/:id/backups` | đã có ở nền (`site-backup`) |
| Tên miền riêng | `POST …/sites/:id/domains` | xác minh DNS trước khi bật |

Mọi thao tác: `Idempotency-Key`, người gọi là `actor = support:<wp id>` hoặc `owner:<wp id>`, bằng chứng ghi **ở app** (nguồn sự thật) và nhật ký ở plugin (để hiển thị).

### 3.3 Tên miền

| Kiểu | Ví dụ | Ai cấp |
|---|---|---|
| tên miền sản phẩm | `abc.opencake.net`, `abc.openketoan.com`, `abc.openkiot.com` | open-setup theo `Bizcity Site Root Domain` (đã có), mỗi app khai tên miền gốc trong App Registry |
| tên miền riêng | `crm.abc.vn` | khách trỏ DNS, open-setup xác minh rồi gọi app thêm `site_domains` |
| bizcity.vn | `abc.bizcity.vn` | blog WP của khách — **không** phải App Instance |

## 4. open-core là gì

### 4.1 So với WordPress

| WordPress | open-core |
|---|---|
| `wp-includes` + `wp-admin` phát hành có phiên bản | `@bizcity/*` phát hành có phiên bản dưới tên sản phẩm **open-core** (semver), mọi app ghim một dải |
| plugin (`wp-content/plugins/x`) | **module** (`modules/<key>` hoặc gói `@open-cake/crm`) có manifest |
| `register_post_type`, `register_meta`, `register_setting`, `add_action`… | registry có kiểu của open-core (NC-001 §8) |
| WP multisite một CSDL | một Workspace × một app = một CSDL; một tiến trình phục vụ nhiều instance |
| `wp-admin` chung | **web shell** chung: đăng nhập, người dùng & vai, cài đặt, tệp / media, Workspace, nhật ký — app chỉ thêm màn nghiệp vụ |

### 4.2 open-core và bizcity-platform

> <!-- [2026-11-27 11:08 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4 --> **Đã sửa:** đoạn dưới là bản trước khi chốt NC-003. Nay `@bizcity/*` dời sang repo **open-core** (NC-003 C2); repo này chỉ còn chuẩn + bộ kiểm.

`@bizcity/platform` **đã là** phần kernel của open-core (registry site, auth, actions, events, settings, migration…). Không dựng repo thứ hai chép lại (một nguồn, R-PLAT-3). **Chốt (Q-OC-1):** giữ repo `bizcity-platform` và **tên gói `@bizcity/*`**; "open-core" là **tên sản phẩm phát hành** (bản lõi có phiên bản). Gói mới cùng tên miền: `@bizcity/server`, `@bizcity/web-shell`, `@bizcity/module-sdk`… — không app nào phải đổi import.

### 4.3 Gói (pnpm workspace)

| Gói | Chứa | Nguồn hiện tại |
|---|---|---|
| `@bizcity/platform` (kernel, giữ tên) | Site · Identity · Settings · Meta · Object · Cache · Storage · Event · Workflow · Audit · Migration · Database Router (NC-001) | `@bizcity/platform` |
| `@bizcity/contracts` | schema dùng chung, hợp đồng `bizcity_*@1`, sinh OpenAPI | `@bizcity/contracts` (có sẵn) + phần nền của `@open-cake/contracts` |
| `@bizcity/server` | khởi động Fastify: nhận site theo `Host`, xác thực, dựng `ctx`, nạp module, gắn action → REST + MCP, `/_sites/v1`, sức khoẻ, số đo | `apps/api/src/{server,runtime,auth,observability,stream,migrate}.ts` của open-cake |
| `@bizcity/web-shell` | React shell: điều hướng theo registry menu, đăng nhập, người dùng & vai, cài đặt, media, bản ghi mềm | `apps/web/src/app`, `screens/{staff,Settings,RecordTypeScreen}` của open-cake |
| `@bizcity/ui-kit` | token, thành phần chung | `@open-cake/ui-kit` |
| `@bizcity/action-client` | `useAction` / `useQueryAction`, bộ giả lập | `@open-cake/action-client` |
| `@bizcity/module-sdk` | `defineModule`, manifest, kiểu cho action / entity / setting / meta / hook / menu | mới (dựa `module-registry` của nền) |
| `@bizcity/cli` · `@bizcity/conformance` | `bizcity site …`, tạo module mẫu, bộ kiểm chuẩn | `tools/` của nền |

### 4.4 Module

```jsonc
// modules/crm/bizcity.module.json
{
  "id": "cake.crm", "version": "0.3.0", "requires": { "open-core": "^1.0" },
  "migrations": "db/migrations",            // schema riêng của module, chạy theo từng instance
  "actions": "src/actions.ts", "entities": ["contact", "conversation", "channel_account"],
  "settings": ["bizcity.cake.*"], "meta": ["cake.contact.*", "cake.item.*"],
  "hooks": { "provides": ["cake.touch.after_submit"], "handles": ["masterdata.referenceCheck"] },
  "menu": "src/menu.ts", "permissions": "bizcity.authz.json"
}
```

Bật / tắt theo instance (và theo tenant) qua `tenant_modules`; quyết định lúc gọi, không lúc nạp (NC-001 R-CTX-5).

## 5. Các chuẩn Universal

| # | Universal | Hợp đồng | Học từ WP | Luật cốt lõi | Đang có | open-cake làm |
|---|---|---|---|---|---|---|
| 01 | **Cache** | `bizcity_cache@1` (giữ, bổ sung mã) | object cache, nhóm, `alloptions`, `last_changed` | ba tầng; khoá tự mang instance + tenant + phiên bản; không đệm sổ / số dư (R-CACHE-1) | chuẩn, chưa mã | dùng đầu tiên khi có `ctx.cache` |
| 02 | **Settings** | `bizcity_settings@1` (**giữ tên** như open-ketoan, mở rộng — chủ chốt 2026-11-27) | `wp_options`, `autoload`, `notoptions`, `wp_sitemeta` | phạm vi hệ thống → Workspace → instance → tenant → đơn vị → chi nhánh → người dùng; có phiên bản; nạp trước khoá `boot`; đọc có kiểu | `setting_values` + registry | chuyển khoá `bizcity.cake.*` sang registry chung |
| 03 | **Metadata** | `bizcity_meta@1` | `wp_postmeta`, `register_meta`, `update_meta_cache` | chỉ gắn vào thực thể đã khai; khoá khai kiểu + quyền; không tiền / số lượng / trạng thái / danh tính (R-DATA-2); nạp lô | `entity_meta`, `user_meta` (open-cake) | nâng lên lõi (`@bizcity/flex` → kernel) |
| 04 | **Records & Hooks** | `bizcity_records@1` · `bizcity_hooks@1` | custom post type, `add_action` / `add_filter` | bản ghi mềm có schema + phiên bản loại, ngưỡng nâng thành bảng (bài học HPOS); hook guard / filter / action có kiểu | `record_types` / `records` (open-cake), hook đóng ở nền | `RecordTypeScreen` thành màn của web shell |
| 05 | **App Registry** | `bizcity_app_registry@1` | `active_plugins`, plugin header | sổ app (id, tên, tiền tố CSDL, tên miền gốc, phiên bản đang phát hành, `/_sites/v1`, module mặc định) | `bizcity.app.json` từng repo, `registerAppManifests` | khai đủ trường cho open-setup đọc |
| 06 | **Document** | `bizcity_document@1` (đã có ở open-ketoan — dùng lại) | — (WP không có) | `doc_ref`, số chứng từ, phiên bản, liên kết, chữ ký, đính kèm | document kernel trong nền | đơn hàng CRM đi qua document kernel thay bảng riêng |
| 07 | **Post / Content** | **không** hợp đồng riêng — là một loại của Records (có `content`, bản sửa, trạng thái nháp / đăng) | `wp_posts` + revision | nội dung dài (ghi chú, mẫu tin, bài hướng dẫn) là record type có phiên bản | — | mẫu tin nhắn / ghi chú khách dùng records |
| 08 | **Media / Upload (R2)** | `bizcity_storage@1` (26) + **thư viện media** là record type `core.media` | thư viện media + `uploads/sites/{id}` + bizcity-r2 | một cổng lưu, khoá `<app>/sites/<slug>/…`, riêng tư mặc định, URL ký; R2 không đặt hạn giữ | đề xuất ở open-cake 26 | đính kèm chat (PHASE-018) là người dùng đầu tiên |

Thêm vào danh sách hợp đồng: `bizcity_records@1`, `bizcity_hooks@1`, `bizcity_storage@1` (ba cái này các app cần ngay khi tách module).

## 6. Hợp đồng

| Hợp đồng | Nội dung | Chủ | Quan hệ với cái đang có |
|---|---|---|---|
| `bizcity_workspace@1` | danh tính + vòng đời Workspace (`workspace_id`, slug, chủ, thành viên, trạng thái `active · suspended · closing · closed`, giới hạn gói) | open-setup | mới; tách khỏi `Bizcity Site Customer` |
| `bizcity_app_registry@1` | sổ app: id, tên, nhóm, tiền tố CSDL, tên miền gốc, URL cấp site, phiên bản phát hành, yêu cầu (`open-core` dải), module mặc định, giá / gói (tham chiếu Hub) | bizcity-platform (khuôn) + open-setup (dữ liệu) | `bizcity.app.json` + `registerAppManifests` |
| `bizcity_app_instance@1` | một app × một Workspace: `instance_id`, `workspace_id`, `product`, tên miền, trạng thái, `schema_version`, `app_version`, sao lưu cuối, sức khoẻ; thao tác help desk (§3.2) | app (thực hiện) + open-setup (sổ) | **mở rộng** `bizcity_site_provisioning@1` (giữ đường `/_sites/v1`) và tổng quát hoá `Bizcity Ketoan Site` |
| `bizcity_app_connection@1` | nối hai instance cùng Workspace (Cake ↔ Kế Toán ↔ POS): khoá máy-với-máy, phạm vi, trạng thái, lần kiểm cuối | open-setup cấp, app giữ | thay các cặp nối làm tay hiện nay (`pos_links`, `tenant_links`, khoá `kt_…` dán tay) |
| `bizcity_settings@1` | §5 #02 | bizcity-platform | giữ tên; thêm phạm vi Workspace / instance, khoá `boot`, đệm phủ định |
| `bizcity_meta@1` | §5 #03 | bizcity-platform | nâng từ canon lớp mềm |
| `bizcity_cache@1` | giữ, bổ sung mã | bizcity-platform | có |
| `bizcity_multisite@1` | giữ cơ chế site kỹ thuật (registry, định tuyến, cấp site); thêm ánh xạ `instance ↔ workspace` (`sites.external_ref = instance_id`, `workspace_id`) | bizcity-platform | có — bản 1.1 |
| `bizcity_records@1` · `bizcity_hooks@1` · `bizcity_storage@1` | §5 #04, #08 | bizcity-platform | mới |

## 7. Stack chung

| Thành phần | Chốt | Hiện trạng | Việc |
|---|---|---|---|
| Language / Runtime | TypeScript / Node.js | ✓ | — |
| HTTP Framework | Fastify | ✓ (5) | — |
| Database / Query builder | PostgreSQL / Kysely | ✓ | — |
| Migration | SQL migrations | ✓ (theo site, sao lưu trước) | — |
| Validation | Zod | ✓ | — |
| Request Context | AsyncLocalStorage | ✓ (`core/request-context.ts`) | bọc thành `ctx` (NC-001 P-K1) |
| Cache | Redis | adapter tuỳ chọn trong chuẩn (R-CACHE-6) | **chốt Q-OC-5**: bật trong cấu hình triển khai của mạng, **mã vẫn chạy khi Redis vắng**; Redis **riêng** cho open-core (instance hoặc giới hạn bộ nhớ riêng), **không dùng chung Redis của WP** (Object Cache Pro đang để Redis tự xoá khoá khi đầy) |
| Event Bus | NATS JetStream | outbox PostgreSQL là chuẩn (R-OUTBOX-1) | **chốt Q-OC-3**: **outbox giữ nguyên là nguồn sự kiện**; JetStream chỉ có thể thêm làm đường chuyển sau outbox khi có ≥ 2 dấu hiệu: > ~100 instance / máy, > 3 bên nhận một loại sự kiện, cần phát lại; bản tự cài không có NATS |
| Identity Provider | Keycloak | Hub (WP) là nguồn `sub`, vé HMAC | **chốt Q-OC-4**: làm A ngay, sẵn sàng B (§7.1) |
| Object Storage | S3 / MinIO | đề xuất 26 (R2 = S3, MinIO cho test) | `bizcity_storage@1` |
| API Contract | OpenAPI | `defineAction` có zod, chưa sinh OpenAPI | sinh OpenAPI 3.1 từ registry action (một nguồn) |
| AI Integration | MCP | ✓ (`expose.mcp`) | — |
| Observability | OpenTelemetry | ✓ | — |
| Monorepo | pnpm workspace | open-cake dùng **npm workspaces** | **chốt Q-OC-6**: pnpm (chặn import gói không khai báo ⇒ giữ ranh giới "module không chạm nội bộ lõi"); thứ tự open-cake (PR riêng, 170 test xanh) → bizcity-platform → open-ketoan; ghi vào APP-SKELETON |
| Testing | Vitest | ✓ | — |

### 7.1 Keycloak và Hub

**Chốt (Q-OC-4, 2026-11-27): làm A ngay, sẵn sàng cho B.** open-core đặt đăng nhập sau giao diện `IdentityProvider` có hai bộ: `hub-ticket` (vé HMAC của Hub, đang chạy) và `oidc` (để sẵn). Bật Keycloak (B) khi có một trong: app bên thứ ba / cộng đồng cần OIDC chuẩn; khách đòi MFA hoặc SSO với AD / Google Workspace; tách VPS riêng cho dịch vụ danh tính (Keycloak cần ~0,5–1 GB RAM, VPS hiện chạy chung WP + zalo-hub). Ba cách đã cân:

| Cách | Làm | Được | Mất |
|---|---|---|---|
| A — giữ Hub | Hub (WP) tiếp tục cấp `sub` + vé HMAC; open-core chỉ đổi vé lấy phiên | không di cư, đang chạy | không có OIDC chuẩn cho bên thứ ba |
| **B — Keycloak đứng sau Hub (đề xuất)** | Keycloak là OIDC Provider của open-core; **liên kết người dùng WP** (WP vẫn là nơi đăng ký thành viên, `sub` giữ dạng `wp:<id>` trong thuộc tính); app nói OIDC chuẩn | OIDC chuẩn, SSO nhiều tên miền, MFA, tài khoản dịch vụ | thêm một dịch vụ phải vận hành; di cư vé HMAC của các app (có giai đoạn chạy song song) |
| C — Keycloak thay Hub | thành viên đăng ký thẳng ở Keycloak | một nguồn mới | phá luồng thành viên bizcity.vn đang chạy |

## 8. Tách open-cake: open-core + module CRM

| Phần hiện tại | Về đâu |
|---|---|
| `apps/api/src/server.ts`, `runtime.ts`, `auth/`, `observability.ts`, `stream.ts`, `migrate.ts`, `client-errors.ts` | `@bizcity/server` |
| `apps/api/src/records.ts`, `db/migrations/0103_flex.sql` | kernel (Records + Meta) |
| `apps/api/src/connector-link.ts`, `care/channel-link.ts` (phần cấu hình) | module CRM (kênh), phần lưu tệp → kernel Storage |
| `apps/api/src/care/` (kernel chạm khách, hộp thư, kênh, gửi tin), `orders/`, `catalog.ts` | **module `cake.crm`** (catalog: module riêng `cake.catalog` — app khác có thể dùng lại) |
| `packages/care-kernel` | module CRM |
| `packages/contracts` | tách: phần nền (lỗi, action, phân trang, vai) → `@bizcity/contracts`; `cake/*` → module |
| `packages/ui-kit`, `packages/action-client` | `@bizcity/ui-kit`, `@bizcity/action-client` |
| `apps/web/src/app/*`, `screens/{staff,Settings,RecordTypeScreen}`, `channel-setup/LinkSettings` (khung) | `@bizcity/web-shell` |
| `apps/web/src/screens/{Inbox*,Contacts,Contact360,Channels,channel-setup,orders,catalog,Dashboard}` | module CRM (giao diện) |
| `apps/web/src/i18n/vi/{app,staff}.ts` / `{inbox,catalog,setup,orders}.ts` | shell / module |

**Không đổi hành vi** trong khi tách: mỗi bước một PR, bộ test hiện có (170 test) phải xanh nguyên trước và sau.

## 9. Lộ trình

| Bước | Nội dung | Repo |
|---|---|---|
| OC-0 | tài liệu này + NC-001 được duyệt; chốt §12 | bizcity-platform |
| OC-1 | open-cake: chuyển pnpm, vẽ ranh giới gói (core / module) **trong cùng repo**, thêm kiểm "module không import nội bộ core" | open-cake |
| OC-2 | `SiteContext` (NC-001 P-K1) ở nền; open-cake dùng | bizcity-platform → open-cake |
| OC-3 | Universal Cache · Settings · Meta · Records ở kernel (P-K2…P-K4), Storage (P-K7) | bizcity-platform → open-cake |
| OC-4 | `@bizcity/module-sdk` + manifest + nạp module; CRM chạy như module | bizcity-platform + open-cake |
| OC-5 | rút `@bizcity/server` + `@bizcity/web-shell` ra nền; phát hành open-core 1.0 | bizcity-platform |
| OC-6 | open-setup: `bizcity_workspace@1`, `bizcity_app_registry@1`, `bizcity_app_instance@1` (tổng quát hoá DocType, thêm `product`), API help desk; bizcity-web: plugin "Bizcity Workspace" | open-setup + bizcity-web |
| OC-7 | open-ketoan nhận open-core qua R-FLOW; open-kiot / hrm / mrp / base / requests khởi tạo từ `@bizcity/cli create-app` | các app |

## 10. Vì sao tiết kiệm công (và token) về sau

- **Một bộ luật đọc một lần:** người / agent sửa module chỉ cần biết manifest + registry của open-core, không đọc lại máy chủ, xác thực, migration, đệm của từng app.
- **Phần chung sửa một chỗ:** lỗi đệm, đăng nhập, lưu tệp, nhiều site sửa ở open-core, mọi app nhận qua nâng phiên bản — hôm nay đang phải sửa ở open-ketoan rồi chép sang (ví dụ F-4 của tài liệu 26).
- **Bề mặt module nhỏ:** một module CRM là action + entity + màn + migration riêng — ngữ cảnh đọc ít hơn hẳn cả app.
- **Bộ kiểm tự động** (`@bizcity/conformance`) chặn lệch chuẩn trước khi review.

## 11. Rủi ro

| Rủi ro | Giảm |
|---|---|
| Tách gói giữa lúc open-cake đang chạy tính năng | tách theo ranh giới trong cùng repo trước (OC-1), test giữ nguyên |
| Keycloak / NATS thêm hạ tầng phải vận hành | chỉ bật ở mạng bizcity; bản tự cài chạy không cần (giữ R-STD-HUB-1, R-CACHE-6) |
| Hai tên một thứ (site / workspace) gây lẫn | bảng từ vựng §1.1 + một nguồn |
| Plugin WP thành nơi "tự làm" thay open-setup | luật §3.1: plugin chỉ gọi open-setup, không gọi app |

## 12. Quyết định của chủ (2026-11-27)
<!-- [2026-11-27 10:15 AM Johnny Chu - Chu Hoàng Anh] NC-002 — chủ chốt Q-OC-1…9 (đổi đề xuất ở Q-OC-1: giữ tên gói @bizcity/*; Q-OC-4: A ngay, sẵn sàng B) -->

| Mã | Câu hỏi | Chốt |
|---|---|---|
| Q-OC-1 | open-core là repo mới hay `bizcity-platform` | ~~giữ repo và tên gói `@bizcity/*`; "open-core" là tên sản phẩm phát hành~~ ⇒ **thay bởi [NC-003](NC-003-TACH-OPEN-CORE.md) Q-CORE-1 (2026-11-27): repo mới `open-core` chỉ chứa mã; `bizcity-platform` = open-platform (luật + bộ kiểm); tên gói `@bizcity/*` giữ nguyên** <!-- [2026-11-27 11:08 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4 --> |
| Q-OC-2 | từ vựng | **Workspace** (doanh nghiệp, `workspace_id` + slug) · **Instance** (app × Workspace; bảng `sites` giữ tên) · **Tenant** (đơn vị trong instance) (§1.1) |
| Q-OC-3 | NATS JetStream | **outbox giữ nguyên là nguồn sự kiện**; JetStream chỉ là đường chuyển sau outbox, khi có dấu hiệu (§7) |
| Q-OC-4 | Keycloak | **A ngay, sẵn sàng B** qua `IdentityProvider` (`hub-ticket` · `oidc`) (§7.1) |
| Q-OC-5 | Redis | mã vẫn chạy khi Redis vắng; Redis **riêng** cho open-core (instance / giới hạn bộ nhớ riêng), **không dùng chung Redis của WP** (§7) |
| Q-OC-6 | pnpm | có — giữ ranh giới "module không chạm nội bộ lõi"; open-cake trước (PR riêng, 170 test xanh) → bizcity-platform → open-ketoan |
| Q-OC-7 | plugin Workspace | **module trong bizcity-web** `include/workspace/`, ranh giới riêng, REST `bizcity-web/v1/workspaces`; tổng quát hoá trình gọi open-setup đang riêng cho Kế Toán |
| Q-OC-8 | tên miền gốc | đã sở hữu **`opencake.net`, `openkiot.com`, `openketoan.com`**; DNS + TLS wildcard (`*.opencake.net`…) trên **Cloudflare**. Khai `root_domains[]` trong App Registry; instance **không** nằm dưới `*.bizcity.vn` (đã trỏ blog WP); một slug giữ chung trên mọi tên miền gốc và tên blog WP |
| Q-OC-9 | `bizcity_settings@1` hay đổi sang "options" | **giữ `bizcity_settings@1`**, không đổi tên (chủ chốt lại 2026-11-27: open-ketoan đã là settings) <!-- [2026-11-27 10:43 AM Johnny Chu - Chu Hoàng Anh] NC-002 — giữ tên settings --> |

**Việc kéo theo:** MULTISITE 1.1 (từ vựng, `sites.workspace_id`) · APP-SKELETON thêm pnpm · App Registry có `root_domains[]` · open-core có `IdentityProvider` từ P-K1.

## 13. Điều kiện chặn: hai bản mã nền

> <!-- [2026-11-27 11:08 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4 --> **Đã giải bằng NC-003 Q-CORE-3:** nền chỉ sửa ở open-core; open-ketoan đóng băng `packages/platform` từ bước C3 và nhận lõi qua bản phát hành ở C6. Lệch thật giữa hai bản: 29 tệp (không phải 61 — phần còn lại là ký tự xuống dòng), kê ở NC-003 §3.1.
<!-- [2026-11-27 10:43 AM Johnny Chu - Chu Hoàng Anh] NC-002 — gap lớn nhất khi rà lại -->

`packages/platform/src` đang có ở **cả** open-ketoan (nơi phát triển, đổi gần nhất) **và** bizcity-platform (bản gom để phát hành, bước P2b). open-ketoan chuyển sang dùng gói nền ở P6. Q-OC-1 chốt bizcity-platform là nguồn của open-core, nên **trước S019-3** phải chốt một cách sửa nền:

| Cách | Làm |
|---|---|
| **Đề xuất** | từ nay sửa nền **chỉ** ở bizcity-platform; open-ketoan nhận lại qua bản phát hành — đẩy sớm P6 (cần chủ open-ketoan đồng ý qua R-FLOW) |
| Tạm thời | mỗi thay đổi nền làm hai PR cùng mã (bizcity-platform + open-ketoan) — tốn, chỉ dùng tới khi xong P6 |

## Nhật ký

- 2026-11-27: bản đầu.
- 2026-11-27: chủ chốt Q-OC-1…9; §4.2–§4.3 đổi sang tên gói `@bizcity/*`; §7, §7.1 ghi quyết định Redis / NATS / Keycloak / pnpm; §12 thành bảng quyết định.
- 2026-11-27: rà lại theo hướng gọn — giữ tên settings, `workspace_id` là ULID trần, thêm §13 điều kiện chặn "hai bản mã nền".
