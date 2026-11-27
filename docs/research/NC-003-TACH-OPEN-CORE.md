# NC-003 — Ba vai nền và tách open-core khỏi open-ketoan (một nguồn mã lõi, phiên bản liền mạch)
<!-- [2026-11-27 11:08 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ (2026-11-27): "1 repo là open-cake (frontend + backend quản lý), open-core là lõi nhân hệ thống, đủ chuẩn universal settings, upload, cache, api, documents… để sau + pos / + hrm / + mrp, open-ketoan cũng khớp open-core; versioning liền mạch, khớp chuẩn open-platform và registry provision DB của open-setup". Chủ đồng ý ba vai, ba repo và chốt Q-CORE-1…4. -->

> **Loại:** nghiên cứu + kế hoạch xuyên repo · **Trạng thái:** **chủ chốt Q-CORE-1…7 ngày 2026-11-27** (§10) <!-- [2026-11-27 11:19 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ đồng ý Q-CORE-5…7 theo đề xuất -->
> **Thay:** NC-002 Q-OC-1 ("giữ repo bizcity-platform làm open-core") và NC-002 §13 (hai bản mã nền) — xem §10.
> **Luật cấp hệ:** canon open-hub **R-CANON-17** ([§2.2](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md)) · kế hoạch gói chung [KE-HOACH-GOI-CHUNG §6](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md)
> **Đọc mã:** open-ketoan main `8f480aa` · bizcity-platform `21cc3f8` (subtree từ open-ketoan `6ad77b6`) · open-cake `1271cb7` · bizcity-open-setup main `0f6628c`

## 0. Một câu

**Luật ở open-platform, mã lõi ở open-core, cấp instance ở open-setup; mỗi app = open-core + module nghiệp vụ.** open-ketoan hiện là nơi phát triển mã nền và cũng là nơi lẫn nghiệp vụ kế toán vào lõi nhiều nhất — tài liệu này tách hai việc đó ra, theo thứ tự không làm gãy app nào.

## 1. Ba vai, ba repo

| Vai | Repo | Giữ | Không giữ | Phiên bản |
|---|---|---|---|---|
| **open-platform** (luật) | `bizcity-platform` | `docs/standard/BIZCITY-*`, `standards.json`, schema hợp đồng nền máy đọc (`schema/spine`, users, order, failure-map…), bộ kiểm (`standard-check`, `spine-check`, `spine-contract`, `users-check`, `failure-check`, conformance), `docs/research/NC-*`, skills, templates | mã chạy (sau C2) | từng chuẩn một số |
| **open-core** (lõi) | `open-core` (mới) | `@bizcity/platform` (kernel), `@bizcity/contracts` (phần nền), `@bizcity/server`, `@bizcity/web-shell`, `@bizcity/ui-kit`, `@bizcity/action-client`, `@bizcity/module-sdk`, `@bizcity/cli`; migration lõi + control-migrations; release | nghiệp vụ của bất kỳ app nào | **SemVer một số chung** (Q-CORE-4) |
| **open-setup** (cấp instance) | `bizcity-open-setup` | registry Workspace × app = instance, gọi `/_sites/v1` của app, ghi `product` · `core_version` · `app_version` | dữ liệu nghiệp vụ, kết nối PG | theo hợp đồng |

**Một chiều phụ thuộc:** canon open-hub → open-platform quy định → open-core hiện thực và **phải qua bộ kiểm** của open-platform → app ghim `^MAJOR.MINOR` của open-core → open-setup dựng instance theo App Registry. Không chiều ngược: open-core không đọc gì của app; open-platform không chứa mã chạy.

**Vì sao tách luật khỏi mã** (sửa Q-OC-1): chuẩn và mã lên phiên bản theo nhịp khác nhau (chuẩn `v1 → 1.1`, mã `0.2 → 0.3`); một PR sửa chữ trong chuẩn không nên kéo theo phát hành mã; app viết bằng PHP (open-kiot) hay là Cell (zalo-hub) theo chuẩn mà không cần đụng mã TypeScript.

## 2. Lõi gồm những gì (chuẩn Universal)

| Năng lực | Chuẩn (open-platform) | Mã hôm nay | Đích ở open-core |
|---|---|---|---|
| Site / Workspace / Instance / Tenant | MULTISITE | `db/site-*.ts`, `db/site.ts` (từ PHASE-039 open-ketoan) | kernel; tên DB / vai PG / tiền tố qua `PlatformConfig` |
| Identity + Authz | IDENTITY, USERS-ROLES | `core/auth.ts`, `core/authz/*`, `core/roles.ts`, `security/*` | kernel + `IdentityProvider` (`hub-ticket` · `oidc`, NC-002 Q-OC-4) |
| **API** (action ⇒ REST + MCP + React) | API-PROFILE | `core/actions.ts`, `core/http.ts` + open-cake `server.ts`, `runtime.ts` | kernel + `@bizcity/server` |
| **Settings** | `bizcity_settings@1` | `core/settings.ts` (có scope `accounting_unit` lẫn vào) | kernel; scope do app khai qua `registerSettingScopes` |
| Meta + Records (lớp mềm) | CHUAN-DU-LIEU-TRUC-VA-LOP-MEM | open-cake `records.ts`, `0103_flex.sql` | kernel (P7 cũ) |
| **Upload / Storage** | `bizcity_storage@1` (open-cake doc 26) | open-cake `apps/api/src/storage/*`, `0109_files.sql` | kernel |
| **Cache** | CACHE | **chưa có module chung** (mỗi chỗ tự đệm) | kernel mới: đệm trong tiến trình + Redis tuỳ chọn, chạy khi vắng Redis (Q-OC-5) |
| **Documents** (khung chứng từ) | SPINE §document, DELIVERY | `core/documents.ts` (đánh số, phiên bản, liên kết, đính kèm), `registerDocumentType/Numberer` | kernel = khung; loại chứng từ cụ thể ở module (Q-CORE-2) |
| Secrets | SECURITY | **chỉ ở open-ketoan** `core/secrets.ts`, `ctx.secrets`, migration `0184_tenant_secrets` | kernel (C3) |
| Event / Outbox · Audit / Evidence | SPINE, OBSERVABILITY | `core/events.ts`, `core/audit.ts`, `evidence-export.ts` | kernel |
| Migration | RELEASE | `db/migrate.ts` (sources + hooks, P2b-1), `0001_platform_nen_tang.sql` (26 bảng) | kernel; theo dõi có cột `source` |
| Log · metric · trace · chẩn đoán | OBSERVABILITY | `core/{logger,metrics,tracing}.ts`, `system/diagnostics.ts` | kernel |
| Web shell, ui-kit, action-client | WEB | open-cake `apps/web/src/app`, `packages/{ui-kit,action-client}`; open-ketoan `@bizcity/ui-kit` 0.1.0 | `@bizcity/web-shell`, `ui-kit`, `action-client` |
| Module | APP-SKELETON | open-ketoan `@bizcity/module-sdk` 1.0.0 (gắn `ctx.ledger`), `core/module-registry.ts` | `@bizcity/module-sdk` không biết sổ; phần sổ do open-ketoan mở rộng (Q-CORE-6) |

## 3. Hiện trạng: lõi đang lẫn kế toán ở đâu

### 3.1 Hai bản mã nền

- open-ketoan `packages/platform` (`@bizcity/platform` 0.1.0) vẫn là nơi đang sửa; bizcity-platform giữ bản subtree 0.2.0 + phần P2b. "61 tệp khác" phần lớn là khác **ký tự xuống dòng** (bizcity-platform không có `.gitattributes`, open-ketoan `eol=lf`); khác thật **29 tệp**.
- **Mới hơn ở open-ketoan:** `config/env.ts`, `core/apps.ts`, `core/ports.ts`, `core/security/tool-password.ts` (HT13 / HT20), `core/secrets.ts` (chỉ có ở open-ketoan); contracts `errors.ts` có `KHO_STOCK_SHORT`, `SECRETS_*`.
- **Sửa cả hai phía (sẽ đụng nhau):** `core/actions.ts` (ketoan thêm `ctx.secrets`; nền đổi import contracts) · `core/auth.ts` (ketoan thêm quyền secrets; nền dời `ADMIN_ROLES` sang `roles.ts`) · `db/types.ts` (ketoan thêm `UsersTable.external_sub`; nền thêm `AppDatabase`).
- **Mới hơn ở bizcity-platform:** ~15 tệp chỉ đổi import `@ketoan/contracts` → `@bizcity/contracts`; `db/migrate.ts`, `db/paths.ts`, `authz/{catalog,legacy}.ts`, `system/diagnostics.ts`; tệp mới `core/roles.ts`, `core/authz-manifest.ts`, `core/authz-ketoan-legacy.ts`, `db/migrate-ketoan-legacy.ts`. Tag `v0.2.0` có **trước** `authz-manifest.ts` ⇒ HEAD đang mang thay đổi chưa phát hành mà vẫn ghi 0.2.0.

### 3.2 Phân loại phần kế toán trong lõi

| Loại | `@bizcity/platform` | `@bizcity/contracts` |
|---|---|---|
| **Chỉ kế toán** — dời về open-ketoan | `masterdata/{partner.repository,catalog-ensure,default-warehouse}.ts`, `core/catalog-warn.ts`, `core/authz-ketoan-legacy.ts`, `db/migrate-ketoan-legacy.ts`, có lẽ `core/quy-tac.ts` (dùng `SCREENS`, `STOP_THE_LINE_STEP`) | `catalog-hint`, `costing-formula`, `dvt`, `entity-codes`, `intake-findings`, `invoices`, `item-master`, `ledger-query`, `legal-basis`, `lineage`, `vouchers`, `print-profile`, `print-templates` |
| **Trộn** — tách phần nền / đưa tên kế toán ra cấu hình | `db/types.ts` (~2 144 dòng, toàn bộ lược đồ kế toán), `core/actions.ts` (`ctx.ledger`, `LedgerQuery`), `core/errors.ts` (`POSTING_FAILED`, `LedgerTriggerError`), `core/http.ts`, `core/settings.ts` (`accounting_unit`), `system/diagnostics.ts`, `core/authz/scope.ts` (phạm vi chi nhánh / kho), `core/apps.ts`, `config/env.ts` + `db/module-db.ts` (`ketoan`, `ketoan_app`), `db/site-provisioner.ts` (`kt_<slug>`), `db/site-backup.ts` | `errors`, `enums` (`Role`, `SCREENS`), `documents`, `library-bindings` |
| **Nền** — ở lại lõi | còn lại | `api`, `doc-refs`, `findings`, `library-findings`, `module`, `remedy`, `money` (`ban-dieu-tra`, `connections`, `ket-noi`, `loi-trinh-duyet`, `ma-tra-cuu`: phân loại ở C4) |

**Cổng đã có (R-PLAT-2)** để app gắn nghiệp vụ: `registerLedgerSubmitter/Reader/CancelGate`, `registerRoles`, `registerApiScopes`, `registerModulePermissions`, `registerDocumentType/Permission/Numberer`, `registerErrorHandler`, `registerDiagnostics`, `registerCloseConditions`, `registerHooks`, `registerSubscribers`, `registerModuleSettings`, `registerAppManifests`, `registerPolicyVersion`, `runMigrations({ sources, hooks })`, `AppDatabase` (declaration merging).
**Cổng còn thiếu** (đề xuất từ P0 §2.2 của open-ketoan): `registerPort` / `ctx.ports`, `registerErrorReasons`, `registerSettingScopes`, và **`PlatformConfig`** (`dbPrefix`, `appRole`, `sitePrefix`, `dbDir`) thay chuỗi cứng `ketoan`.

### 3.3 Cách open-ketoan dùng nền hôm nay

- npm workspaces; import theo đường con `@bizcity/platform/<path>` qua điều kiện `development` → `src/*.ts`.
- `apps/api/src` 133 tệp, `apps/api/test` 123 tệp, `packages/kernel/src` 100 tệp import nền; `modules/*` chỉ import `@bizcity/module-sdk` (231) và `@bizcity/ui-kit` (53) — **ranh giới module đã sạch**; 25 tệp chuyển tiếp `export * from '@bizcity/platform/…'`.
- Đường con dùng nhiều nhất: `db/client` 94 · `core/actions` 85 · `core/auth` 64 · `core/errors` 60 · `db/module-db` 52 ⇒ đây là **API công khai thật** của lõi; đổi đường của chúng là phá.
- Tên gói đụng nhau với open-core dự định: `@bizcity/kernel` (thực chất là **kernel kế toán**), `@bizcity/module-sdk` 1.0.0 (gắn sổ), `@bizcity/cli`, `@bizcity/ui-kit` 0.1.0.

### 3.4 Migration và nhiều site

- open-ketoan: 183 tệp `0001…0186` (0001–0009 là gốc gộp `_goc_`), bảng theo dõi `schema_migrations(name)` **không có** cột nguồn; `db/control-migrations/0001…0007` (site_registry, provisioning, upgrade, backups, lifecycle, owner_reset).
- Nền mang `0001_platform_nen_tang`, `0002_platform_vai_theo_app` và giả định "lõi 00xx, app 01xx" ⇒ **trùng dãy** với 0001–0186 của open-ketoan; chạy thẳng sẽ tạo lại bảng đã có ⇒ C6 phải **baseline** (hook `isApplied`).
- `CONTROL_MIGRATIONS_DIR` trỏ `DB_DIR/control-migrations` của **app**; `db/paths.ts` tính `DB_DIR` lùi 4 cấp từ gói ⇒ **sai khi gói nằm trong `node_modules`**. open-core phải mang control-migrations của mình và nhận `dbDir` từ `PlatformConfig`.
- HTTP `/_sites/v1` (`apps/api/src/modules/sites/provisioning.{routes,service}.ts`, gồm gieo chủ và nạp công ty mẫu kế toán) đang ở app. open-setup `provisioning.py` gọi: `Bearer prov_…` + `X-Contract` + `Idempotency-Key`; `GET /health`, `/sites?updatedAfter`, `/sites/{id}`, `/jobs/{id}`; `POST /sites {slug, domain, displayName, owner, sample, externalRef}`, suspend / resume / backups / DELETE / owner reset-password / PUT license; ghi trả `202 + jobId`, bước validate → create_database → seed_owner → load_sample → activate.

### 3.5 Phát hành

Tag `v*` ⇒ `release.yml` (test Postgres 16) ⇒ `tools/dong-goi.mjs` ⇒ `gh release create` hai tệp tgz (`private: true`, không lên registry; `files` gồm `dist`, `src`, `db`). open-cake ghim URL tgz v0.2.0. **CI ma trận** open-ketoan + open-cake (D-PLAT-6) **chưa có**.

## 4. Đích

```text
open-core/                         (pnpm workspace · .gitattributes eol=lf · GPL-2.0-or-later)
├── packages/platform      @bizcity/platform     kernel (§2), PlatformConfig, không chuỗi nghiệp vụ
├── packages/contracts     @bizcity/contracts    phần nền (§3.2 "nền") + schema sinh OpenAPI
├── packages/server        @bizcity/server       Fastify: site theo Host, ctx, nạp module, action → REST + MCP, /_sites/v1 khung
├── packages/web-shell     @bizcity/web-shell    đăng nhập, người dùng & vai, cài đặt, tệp, Workspace, nhật ký
├── packages/{ui-kit, action-client, module-sdk, cli}
├── migrations/core/       NNNN_*.sql  (source = core)     control-migrations/   (registry site)
└── tools/release          một tag vX.Y.Z ⇒ mọi gói cùng số ⇒ GitHub Release (sau: registry)

open-ketoan/  = open-core + module kế toán
├── packages/{ketoan-contracts @open-ketoan/contracts, ketoan-kernel @open-ketoan/kernel, ketoan-module-sdk?, vn-rulepacks}
├── modules/*              chỉ import @bizcity/module-sdk (+ phần mở rộng sổ của open-ketoan)
└── db/migrations/         source = app (dãy cũ giữ nguyên, baseline phần lõi)
```

## 5. Phiên bản liền mạch

1. **Một số chung** cho mọi gói `@bizcity/*` (Q-CORE-4): `open-core 0.3.0` = `@bizcity/platform@0.3.0` = `@bizcity/contracts@0.3.0`… Nối tiếp dòng 0.2.0 đang có; **1.0** khi `server` + `module-sdk` + `web-shell` ổn định (C8).
2. **0.x vẫn giữ hứa tương thích theo minor:** `0.3 → 0.4` được phá có ghi CHANGELOG + hướng dẫn; từ 1.0: phá ⇒ major + ADR + hai bản song song ≥ 2 lần phát hành (D-PLAT-6).
3. **App ghim** `^0.3` (sau 1.0: `^1.2`); **module khai** `requires: { "open-core": "^1.0" }`; `cli module check` từ chối module không khớp.
4. **Mỗi PR vào open-core** chạy: test của open-core + bộ kiểm open-platform (`standard-check`, `spine-check`) + **ma trận app** (open-cake, open-ketoan — khi đã dùng gói). Không xanh ⇒ không gộp.
5. **Instance biết mình chạy bản nào:** `/_sites/v1/health` trả `coreVersion`, `appVersion`, `schemaVersion` từng nguồn; open-setup ghi vào registry (C7). Nâng cấp = app chạy migration **lõi trước, module / app sau**; cổng `schema_version` ⇒ 503 khi lệch (R-SITE).

## 6. Migration theo chủ

- Bảng theo dõi thêm cột **`source`** (`core` · `app` · `mod_<key>`), khoá `(source, name)` — D-PLAT-5 vốn đã định, chưa làm.
- open-core: `migrations/core/NNNN_*.sql` đánh số riêng; app giữ dãy của mình. **Không** còn giả định "lõi 00xx, app 01xx".
- DB đang chạy của open-ketoan: **baseline** — đánh dấu migration lõi đã áp (vì bảng đã có từ dãy cũ), không chạy lại; diễn tập trên bản sao ẩn danh dữ liệu thật (R-KER-6, `kiem-nang-cap.sh`).
- open-cake: dời `0103_flex.sql`, `0109_files.sql` (và phần lõi của `0101`) sang `source = core` bằng cùng cơ chế baseline.

## 7. Các bước (mỗi bước một PR, có đường lùi, không dừng tính năng)

| Bước | Repo | Việc | Xong khi |
|---|---|---|---|
| **C0** | open-hub · bizcity-platform · app | canon 1.4 R-CANON-17, NC-003 này, AGENTS / README các repo hiểu ba vai | các PR tài liệu gộp |
| **C1** | open-core (mới) | tạo repo công khai GPL; pnpm workspace, `.gitattributes eol=lf`, CI (test + bộ kiểm open-platform), release theo một số; AGENTS chép R-PLAT-1…5 | CI xanh trên khung rỗng |
| **C2** | open-core ← bizcity-platform | dời `packages/*` bằng `git filter-repo` / `subtree split` (giữ lịch sử); bizcity-platform xoá `packages/`, giữ `tools/` + `schema/` chuẩn; phát hành **0.3.0 = nội dung HEAD hiện tại** (không đổi hành vi); open-cake đổi URL tgz | open-cake 199 test xanh trên 0.3.0 |
| **C3** | open-core ← open-ketoan | **gom bản mới của open-ketoan** (§3.1: secrets, `external_sub`, tool-password, env, apps, ports, mã lỗi) — giải ba tệp đụng nhau; từ đây **đóng băng** `open-ketoan/packages/platform`: sửa nền chỉ ở open-core (Q-CORE-3) | open-core có mọi thay đổi nền; open-ketoan ghi luật đóng băng (PR theo R-FLOW) |
| **C4** | open-core + open-ketoan | **rút kế toán khỏi lõi** (§3.2): thêm `PlatformConfig` + cổng thiếu; dời "chỉ kế toán" sang `@open-ketoan/*`; tách `db/types.ts` (lõi giữ bảng nền, app khai qua `AppDatabase`); contracts nền / kế toán, `@open-ketoan/contracts` re-export phần nền (P1 cũ) | `grep -i ketoan` trong `open-core/packages` = 0 (trừ chú thích lịch sử); 0.4.0 |
| **C5** | open-core ← open-cake | đưa phần chung của cake lên lõi: Storage, Records / Meta, **Cache mới**, `server` + `runtime`, `web-shell`, `action-client`, `module-sdk` không biết sổ (= PHASE-019 S019-3…6) | cake chạy như module `cake.crm` trên 0.5.x |
| **C6** | open-ketoan (K3, ADR-0040) | **open-ketoan dùng open-core**: bỏ `packages/platform`; đổi tên `@bizcity/kernel` → `@open-ketoan/kernel` (và `module-sdk` theo Q-CORE-6); baseline migration (§6); sửa 27 phép kiểm / `layers.mjs` / `baseline.json` / `kiem-chuan.sh` đang trỏ `packages/platform`; `DB_DIR` đặt rõ; Docker không chép `packages/platform` | test + `selfcheck --strict` + `kiem-nang-cap.sh` xanh trên bản sao; CI ma trận bật |
| **C7** | open-setup + open-core | `Bizcity Ketoan Site` → `Bizcity App Instance` (`product`, `core_version`, `app_version`, `root_domains`); `/_sites/v1` khung ở `@bizcity/server`, phần riêng (công ty mẫu…) qua hook của app; registry ghi bản từng instance | open-setup tạo được instance cake và ketoan bằng một luồng |
| **C8** | open-core | phát hành **1.0**; `@bizcity/cli create-app` dựng app mới (pos / hrm / mrp) = open-core + module rỗng + `bizcity.app.json` | app mẫu qua bộ kiểm S2 |

**Đường găng:** C3 (chặn S019-3 của cake và mọi sửa nền) → C4 → C6. C5 chạy song song với C4 sau C3.
**pnpm ở open-ketoan** (Q-OC-6) làm **sau** C6, PR riêng — pnpm chặt sẽ lộ phụ thuộc chưa khai; không gộp vào bước tách.

## 8. Quy trình ở open-ketoan (R-FLOW)

- PHASE-041 hiện **chỉ ở PR nháp** (#616 giữ chỗ, #617 P0 kiểm kê) ⇒ chưa có hiệu lực (R-FLOW-7). Trước C3: đưa PHASE-041 lên main, đổi đích "repo gói chung" thành open-core, thêm C3 / C4 / C6.
- R-FLOW-2: đụng `core/actions.ts`, `packages/module-sdk`, `packages/contracts/src`, migration, `layers.mjs` ⇒ PR tài liệu thiết kế lên main trước.
- Claim đang chồng tệp nền: **NT-HT-003** (`core/auth.ts`, `core/actions.ts`, `core/authz/{store,scope}.ts`, `security/role-assignments.ts`, `packages/module-sdk/**`, `contracts/enums.ts`), **HT20** (`security/tool-password.ts`), **NT-MH-011** (`core/http.ts`) ⇒ C3 chờ các claim này trả, hoặc gom sau khi chúng gộp.
- Mức **K3** (C4, C6): một người duyệt (chủ, R-KER-2), diễn tập trên bản sao ẩn danh (R-KER-6); CODEOWNERS `/packages/`, `/db/` → chủ.
- Agent **không** ký phiếu NT-* thay bộ phận; chỉ mở PR và ghi bằng chứng.

## 9. Rủi ro

| Rủi ro | Giảm |
|---|---|
| Tạo open-core mà open-ketoan chưa đóng băng ⇒ **ba** bản mã nền | C3 ngay sau C2; luật đóng băng gộp vào open-ketoan cùng lúc; tới đó mọi sửa nền làm ở open-core rồi chép ngược một chiều |
| Hai gói contracts cùng ký hiệu (`ErrorCode`, `Role` lệch) | C4: `@open-ketoan/contracts` re-export phần nền, không định nghĩa lại |
| `db/paths.ts` sai trong `node_modules` | `PlatformConfig.dbDir` bắt buộc khi chạy từ gói (C4) |
| Đổi đường con công khai làm gãy 100+ tệp | giữ nguyên đường con (`db/client`, `core/actions`…) ít nhất tới 1.0; đổi ⇒ tệp chuyển tiếp một bản |
| Test open-ketoan dựa nội bộ nền (123 tệp) | C6 chỉ đổi nguồn gói, không đổi đường import; dọn dần sau 1.0 |
| Ký tự xuống dòng làm diff giả | `.gitattributes eol=lf` ở open-core và bizcity-platform ngay C1 |
| Trùng số migration | cột `source` + baseline (§6) |

## 10. Quyết định

<!-- [2026-11-27 11:08 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4 ngày 2026-11-27 -->

| Mã | Câu hỏi | Chốt / đề xuất |
|---|---|---|
| **Q-CORE-1** | open-core là repo riêng? | **Chốt:** repo mới `open-core` chỉ chứa mã; `bizcity-platform` = open-platform (luật + bộ kiểm). **Thay NC-002 Q-OC-1.** Tên gói `@bizcity/*` giữ nguyên |
| **Q-CORE-2** | "Documents" trong lõi là gì | **Chốt:** khung chứng từ chung (đánh số, phiên bản, liên kết, đính kèm, in, ký); loại chứng từ cụ thể ở module. Tri thức / tài liệu là chuẩn KNOWLEDGE, module khác |
| **Q-CORE-3** | Sửa nền ở đâu | **Chốt:** chỉ ở open-core; open-ketoan nhận qua bản phát hành (đóng băng từ C3, qua R-FLOW). **Giải NC-002 §13** |
| **Q-CORE-4** | Phiên bản | **Chốt:** mọi gói `@bizcity/*` chung một số (lockstep); "open-core X.Y" là mốc duy nhất open-setup ghi vào registry |
| **Q-CORE-5** | Văn bản hợp đồng `bizcity_site_provisioning@1` ở đâu khi mã đã ở open-core | **Chốt (2026-11-27):** chuyển sang open-platform (`docs/standard/`, cạnh MULTISITE), open-ketoan giữ liên kết; tới khi chốt, vẫn ở open-ketoan `docs/contracts/` |
| **Q-CORE-6** | Tên gói đụng nhau ở open-ketoan | **Chốt (2026-11-27):** `@bizcity/kernel` → `@open-ketoan/kernel`; `@bizcity/module-sdk` của open-core **không biết sổ**, phần `ctx.ledger` thành `@open-ketoan/module-sdk` mở rộng (declaration merging); `@bizcity/ui-kit` / `cli` gộp về bản open-core |
| **Q-CORE-7** | Phát hành ở đâu | **Chốt (2026-11-27):** giữ GitHub Release tgz (như 0.2.0) tới 1.0; sau đó npm công khai `@bizcity` |

## 11. Repo phải sửa gì (C0)

| Repo | Sửa |
|---|---|
| open-hub | canon 1.4.0-draft §2.2 R-CANON-17, §7 khuôn app; KE-HOACH-GOI-CHUNG §6; canon README; AGENTS |
| bizcity-platform | AGENTS (vai open-platform, đóng băng `packages/*`), README, ARCHITECTURE, bản đồ chuẩn (tầng 2b), NC-002 §12 / §13, NC-003 này, CHANGELOG |
| bizcity-open-setup | AGENTS (cấp instance cho mọi app trên open-core; `core_version`), `docs/canon/README` |
| open-cake | AGENTS, ADR-0002 (repo gói chung = open-core), PHASE-019 (S019-3…6 đích open-core) |
| open-ketoan | AGENTS: ba vai, `packages/platform` sẽ đóng băng ở C3 (PR theo R-FLOW, chủ duyệt) |
| open-kiot · zalo-hub | AGENTS / CLAUDE: theo chuẩn open-platform, không dùng mã open-core |

## Nhật ký

- 2026-11-27: mở NC-003 (C0); chủ chốt Q-CORE-1…4.
- 2026-11-27: <!-- [2026-11-27 11:19 PM Johnny Chu - Chu Hoàng Anh] NC-003 --> chủ đồng ý Q-CORE-5…7 theo đề xuất (hợp đồng provisioning về open-platform; `@open-ketoan/kernel`, `@open-ketoan/module-sdk`; phát hành tgz GitHub Release tới 1.0); bắt đầu C1 — tạo repo open-core.
- 2026-11-27: <!-- [2026-11-27 11:20 PM Johnny Chu - Chu Hoàng Anh] NC-003 C1 --> **C1 ☑** — repo công khai [open-core](https://github.com/hoanganh8389/open-core) (`bf2e323`): pnpm workspace, `.gitattributes eol=lf`, `tools/kiem-khung.mjs` (R-CORE-1 một số phiên bản chặn; R-PLAT-1 cảnh báo tới C4, `--strict` từ C4), CI = kiểm khung + `standard-check` của open-platform (ĐẠT mức S1), `bizcity.app.json` qua `spine-check`. Chưa có gói — C2 dời `packages/*`.
- 2026-11-27: <!-- [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] NC-003 C2 --> **C2** — open-core PR #1: `packages/platform` (219 commit), `packages/contracts` (138 commit) dời bằng `git subtree`, 0.3.0; test gói 11/11, open-cake 199/199 trên tgz 0.3.0 cục bộ. Repo này: schema → `schema/`, gỡ `packages/` (PR riêng, gộp **sau** khi có Release v0.3.0 của open-core). Ghi chú cho C4: đường dẫn tính lùi từ gói (`db/paths.ts`, `core/{settings,version}.ts`, `core/libraries/*`) sai khi gói nằm trong `node_modules` — giữ nguyên ở C2 (không đổi hành vi).
