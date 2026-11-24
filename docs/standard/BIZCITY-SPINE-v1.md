# `bizcity_spine@1` — Xương sống xuyên app: định danh, danh mục chuẩn, tự đứng và đồng bộ

<!-- [2026-11-24 05:43 PM Johnny Chu - Chu Hoàng Anh] SPINE-1.1 — chủ duyệt 2026-11-24 (open-cake Q-017-1/2): uom = tên ĐVT của chủ (Unicode có dấu như open-ketoan product_units.unit và 40 tên chuẩn open-pos H-9), không còn ASCII; partner.code từ open-cake = SĐT đã xác minh trước (khớp open-pos), không có mới CAKE-<contact_id>. -->
<!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 — chuẩn xuyên app bản đầu: tám trục định danh, bốn hình thức tham chiếu, bốn kiểu bảng (chủ · bản sao · gửi sau · đối chiếu), luật R-SPINE, kiểm SC-SPINE. Chủ chỉ đạo 2026-11-24: "mã lập trình có thể khác nhau, nhưng api contracts phải xuyên suốt". -->

> **Phiên bản:** 1.1.0 · 2026-11-24 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-24 (Q-SPINE-1..4, §9; 1.1: open-cake Q-017-1/2) <!-- [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 --> · **Thuộc:** `@bizcity/contracts` (gói nền chung)
> **Đứng dưới:** [BIZCITY OPEN CANON](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md) §3 (bốn trục dữ liệu), [chuẩn dữ liệu trục cứng + lớp mềm](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/CHUAN-DU-LIEU-TRUC-VA-LOP-MEM.md), luật tối thượng P-0 của chương trình open-pos ⇄ open-ketoan ([ADR-OKT-1](https://github.com/hoanganh8389/bizcity-open-setup/blob/main/docs/chuong-trinh/OKT/00-ADR-OKT-1.md)).
> **Máy đọc:** `packages/contracts/schema/spine/*.schema.json` · vector kiểm `schema/spine/vectors/` · lệnh `node tools/spine-check.mjs`.

## 0. Một câu

**Mỗi trục có một chủ; app khác giữ bản sao và tham chiếu bằng ID của chủ; app nào cũng tự đứng được khi mất kết nối; lệch thì đối chiếu, không ghi đè.**

Mã nguồn mỗi app viết bằng gì cũng được (TypeScript, PHP, Python). Thứ **phải giống nhau** là: tên và dạng của ID, hình thức tham chiếu trên dây (REST, sự kiện), cách giữ bản sao, cách gửi sau, cách đối chiếu.

## 1. Vì sao cần

Doanh nghiệp dùng nhiều app (POS, CRM, kế toán, kho, nhân sự) và muốn **không nhập lại, không đối soát tay**. Điều đó chỉ xảy ra khi:

1. một mặt hàng, một khách, một chứng từ có **một định danh** ở mọi app;
2. app vẫn chạy khi app kia tắt (quầy vẫn bán khi kế toán dừng — luật P-0 ý 4);
3. khi nối lại, dữ liệu **tự về đúng chỗ**, chỗ lệch được **chỉ ra**, không âm thầm ghi đè.

Hệ đã có từng mảnh: `item_id` bất biến (open-ketoan ADR-0017), `doc_ref` + `document_links`, `contact_id` (open-cake), tsm làm lớp đệm (POS). Chuẩn này **gọi tên chung** cho các mảnh đó và quy định phần còn thiếu (bản sao, gửi sau, đối chiếu, manifest khai trục), để bộ kiểm chạy được trên mọi repo.

## 2. Tám trục định danh

| Trục | Khoá trên dây | Dạng | Chủ (mint ID) | App khác giữ | Nguồn chuẩn gốc |
|---|---|---|---|---|---|
| **tenant** (đơn vị / site) | `tenant` | slug `^[a-z][a-z0-9-]{1,30}$` = `tenants.code` của open-ketoan = slug site trong registry open-setup | **open-setup** (registry); open-ketoan cấp `tenant_id` bigint **nội bộ**, không lộ ra dây | slug trong mọi payload, sự kiện; khoá `X-Api-Key` gắn một tenant | R-CANON-13, R-TEN-* |
| **user** (người dùng) | `sub` | `^wp:[0-9]+$` (WordPress user ID của bizcity, chủ chốt 2026-11-24); dự phòng `^biz:[A-Za-z0-9_-]{1,64}$` cho tài khoản không qua WordPress | **WordPress (bizcity)** qua SSO | bảng người dùng cục bộ: `sub` → vai; **quyền vẫn ở từng app** | canon §4 người dùng chung, `bizcity_authorization@1` |
| **item** (mặt hàng) | `item_id` | ULID Crockford 26 ký tự `^[0-9A-HJKMNP-TV-Z]{26}$` | **open-ketoan** (`items`, `item_codes` có hiệu lực) | bản sao + ảnh chụp mã tại ngày (`item_code_at`); **không tự tạo mặt hàng từ chứng từ** | `bizcity_item_master@1`, R-ITEM-0..9, IN-ITEM-* |
| **uom** (đơn vị tính) | `uom` + `ratio` | `uom` = **tên ĐVT đúng như chủ lưu** (`product_units.unit`), Unicode có dấu, 1–20 ký tự, không khoảng trắng, phân biệt hoa thường (`Cái`, `Thùng`, `Lốc_6`; 40 tên chuẩn ở open-pos H-9) — `^[^\s]{1,20}$`; `ratio` số > 0 so với **đơn vị gốc của item** (`product_units.unit`, `ratio`, `is_default`) | **open-ketoan**, thuộc item master | sao chép cùng item; dòng chứng từ gửi `uom` + `qty`, **không gửi ratio** (chủ giữ); ĐVT không khai cho item ⇒ `IN-ITEM-003` | `bizcity_item_master@1` |
| **branch** (chi nhánh / kho) | `branch_code` | `^[A-Z0-9_.-]{1,20}$`; `branch_id` bigint nội bộ không lộ | **open-ketoan** (`branches`, `accounting_unit_id`) | POS: mỗi blog khai một `branch_code` (OKT S002-5); chuyển kho dùng `fromBranchCode` / `toBranchCode` | `bizcity_master_data@1` |
| **partner** (đối tượng công nợ) | `partner.code` | `^[A-Za-z0-9_.-]{1,40}$`; `partner_id` bigint nội bộ không lộ | **open-ketoan**; ngoài gửi **mã**, một chiều | gửi `code`; open-cake gửi **số điện thoại đã xác minh** (cùng quy ước open-pos, để một người mua ở quầy và nhắn Fanpage là **một** đối tượng), không có số thì `CAKE-<contact_id>`, khách vãng lai `KHACH-LE`; lưu `partner_ref {code}` | R-MD-1, R-MD-2 |
| **contact** (người / tổ chức tiếp xúc) | `contact_id` | ULID | **open-cake** | app khác mang **danh tính có bằng chứng** (`phone`, `email`, `tax_code`, `zalo_uid`, `fb_psid`), **không** mang `contact_id` tự đặt | R-CANON-1, R-CANON-3 |
| **document** (chứng từ) | `doc_ref` | `^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*:[A-Za-z0-9_.-]{1,64}$` = `<module>.<loại>:<id>`, bất biến (ví dụ vàng của canon: `cake.order_request:01J…`, `pos.order:8812`, `bizcity.ledger.event:<docKey>`) | **app phát hành** chứng từ đó | liên kết chéo ghi `doc_ref` **của app kia** vào `document_links (from, to, role)`; không có `root_document_id` tự đặt | `bizcity_document@1`, R-DOC-CONT-1, R-CANON-11 |

Ngoài tám trục còn **sổ riêng của từng app** (bút toán, `txn_id` giao dịch ba chân, sổ chạm khách): mỗi app **một** trục sổ riêng và không giữ trục sổ của app khác (R-CANON-1). Trục sổ riêng khai trong manifest `axes.owns`.

**Quyết định (Q-SPINE-2, chủ duyệt 2026-11-24):** vị trí trong kho (`location_code` dưới `branch_code`) và lô (`lot`) **để ở lớp mềm** (`entity_meta`) cho tới khi app thứ hai cần; khi đó mới có chủ và thành trục (theo §7).

## 3. Bốn hình thức tham chiếu trên dây

Mọi chỗ một app nhắc tới thực thể của trục là một **`*Ref`** (JSON object), không phải chuỗi rời:

```json
{ "id": "01JD8K2Q4F3M9R7X5T1V0W6Y8Z" }                      // 1. ID của chủ — khi đã biết (từ bản sao, hoặc chủ đã trả về)
{ "code": "SP-0042", "as_of": "2026-11-24" }                 // 2. Mã có hiệu lực tại ngày — chủ tra ra id
{ "identity": { "kind": "phone", "value": "sha256:…", "proof": "otp" } }   // 3. Danh tính có bằng chứng — chỉ trục contact
{ "local": "pos:item:8812", "code": "SP-0042" }              // 4. Khoá cục bộ chưa ràng buộc + mã — app tự đứng, chủ sẽ ràng buộc
```

| Luật | Nội dung |
|---|---|
| **R-SPINE-1** | Người gửi **không bịa `id`** cho trục mình không làm chủ. Chỉ gửi `id` khi lấy từ chủ (bản sao, kết quả trả về). Gửi `id` lạ ⇒ chủ từ chối (`IN-ITEM-008` kiểu). |
| **R-SPINE-2** | **Chủ tra, người gửi không suy.** `code` → `id`, `identity` → `contact_id` do chủ làm, có bằng chứng, có ngày hiệu lực. Không khớp ⇒ **giữ lại và báo** (`IN-*` mức block / warn), không tự tạo. |
| **R-SPINE-3** | Tham chiếu đã tra được thì **lưu `id`** vào bảng của mình (I-4 "định danh lưu, không suy"), kèm ảnh chụp mã tại ngày để in / tra cứu. |
| **R-SPINE-4** | Mã (`code`, `uom`, `branch_code`) có **phiên bản và ngày hiệu lực**; đổi mã không đổi `id`; `as_of` mặc định = ngày chứng từ. |

## 4. Tự đứng và đồng bộ — bốn kiểu bảng

Một app có thể có cả bốn kiểu; manifest khai kiểu nào cho trục nào.

```text
            CHỦ (owner)                        APP KHÁC (non-owner)
   ┌────────────────────┐   changefeed    ┌─────────────────────┐
   │ bảng chủ: mint id, │ ──────────────▶ │ BẢN SAO (replica)   │  đọc offline; không sửa cột của chủ
   │ mã có hiệu lực     │   digest        │ + cột cục bộ ở      │  cột thêm ở entity_meta "<app>.*"
   └────────────────────┘ ◀────────────── │   lớp mềm           │
             ▲                             └─────────────────────┘
             │ Idempotency-Key = doc_ref   ┌─────────────────────┐
             └──────────────────────────── │ GỬI SAU (outbox)    │  chứng từ của mình: doc_ref có ngay, xếp hàng, gửi khi nối lại
                                           └─────────────────────┘
                                           ┌─────────────────────┐
             digest ◀───────────────────── │ ĐỐI CHIẾU (reconcile)│ so băm theo id; lệch ⇒ finding RC-SPINE-*, không ghi đè
                                           └─────────────────────┘
```

| Kiểu | Bảng ở app | Cột tối thiểu | Luật |
|---|---|---|---|
| **Chủ** | bảng thật của trục | `id` (ULID / bigint nội bộ), mã có `valid_from`/`valid_to`, `tenant_id`, `updated_at`, `version` | mint id **offline được** nếu id là ULID; mã **chỉ thêm** (đóng `valid_to`, không sửa); tombstone khi ngừng |
| **Bản sao** | `remote_<trục>` (tên gợi ý) hoặc bảng đệm hiện có (POS: bảng tsm `tgs_catalog_table()`) | `tenant`, `id` của chủ, `code_at`, `payload jsonb`, `source` (`open-ketoan`), `source_version`, `synced_at` | **R-SPINE-5** chỉ đọc cột của chủ; cột cục bộ ở lớp mềm; app đọc offline thoải mái; **R-SPINE-6** không có bản sao mà cần dữ liệu ⇒ lỗi có đường lùi, không đoán |
| **Gửi sau** | outbox của app (`event_outbox` ở TS; bảng hàng đợi của bridge ở POS) | `doc_ref`, `tenant`, `seq`, `payload`, `attempts`, `next_at`, `delivered_at` | **R-SPINE-7** chứng từ của mình có `doc_ref` ngay lúc ghi, không chờ mạng; gửi với `Idempotency-Key = <doc_ref>@<version>`; nhận lặp không nhân đôi (AP-6) |
| **Đối chiếu** | không cần bảng; kết quả là finding | — | **R-SPINE-8** mỗi cặp (app, chủ, trục) có một phép đối chiếu có mã (`RC-SPINE-<trục>`), chạy được bằng tay và theo lịch; lệch ⇒ finding + remedy, **không** tự ghi đè bên nào |

**R-SPINE-9 · Bản sao có thể ràng buộc muộn.** App tự đứng được phép có **danh mục cục bộ** với khoá cục bộ (hình thức 4) khi chưa nối chủ (POS nguồn `local`). Khi nối: khớp theo mã / mã vạch → ghi `id` của chủ vào cột ràng buộc; không khớp ⇒ gửi lên chủ như mã mới và **chờ duyệt**. Dòng chưa ràng buộc **không được** sang sổ kế toán (bị giữ ở cửa nạp).

**R-SPINE-10 · Chủ thắng cột của chủ, app thắng cột của app.** Xung đột trên cột của chủ ⇒ bản của chủ; muốn đổi thì gọi action của chủ (`core.item.upsert`…) để đi qua validation. Cột cục bộ (`entity_meta` namespace `<app>.`) chủ không chạm.

### 4.1 Chủ phải mở cho đồng bộ (`bizcity_sync@1`)

| Mặt | Hình | Bắt buộc từ mức |
|---|---|---|
| Changefeed | `GET /api/v1/<trục>?since=<cursor>&limit=<n>` → `{ data: [...], meta: { cursor, as_of } }`, thứ tự `(updated_at, id)` ổn định, có cả dòng **ngừng** (tombstone) | C2 |
| Digest | `GET /api/v1/<trục>/digest?since=<cursor>` → `[{ id, version }]` để đối chiếu không kéo cả bảng | C2 |
| Tra mã | `GET /api/v1/<trục>/resolve?code=…&as_of=…` (hoặc hàm resolve trong cửa nạp) → `{ id, code_at, status }` | C1 |
| Nhận gửi sau | mọi route ghi nhận `Idempotency-Key`, trả cùng kết quả cho cùng khoá | C1 |

Hiện trạng open-ketoan: tra mã + Idempotency đã có; **changefeed + digest đã có** (`GET /api/v1/sync/:axis`, `/digest` — open-ketoan #621, #623; migration 0182) <!-- [2026-11-24 08:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 -->. **Q-SPINE-3 (chủ duyệt 2026-11-24):** open-ketoan mở changefeed + digest cho `items`, `partners`, `branches`; việc đi theo R-FLOW của open-ketoan (giữ chỗ ở CLAIMS.md, PR tài liệu chốt thiết kế rồi PR mã).

### 4.2 Ánh xạ vào mô hình POS đã chốt (P-0 ý 4)

| Luật P-0 / OKT | Trong chuẩn này |
|---|---|
| open-pos tự đứng, tsm là dữ liệu đệm | tsm = **bản sao** (item, uom, branch, giá, thuế) + **danh mục cục bộ** khi nguồn `local` (R-SPINE-9) |
| bridge kéo từ open-ketoan về bảng tsm | bridge = **changefeed → bản sao**; chứng từ bán = **gửi sau** với `doc_ref` của POS |
| I-4 định danh lưu, không suy | R-SPINE-3 |
| I-2 mỗi loại dữ liệu một nơi ghi | R-SPINE-5, R-SPINE-10 |
| I-8 tự kiểm luôn xanh theo cặp blog → tenant | R-SPINE-8 (đối chiếu có mã) |
| Pháp nhân thuộc sổ, không theo tenant | ngoài phạm vi chuẩn này; chuẩn chỉ nói `tenant` là slug, không gắn pháp nhân |

Không có khái niệm mới cho đội POS; chỉ đặt tên chung để bộ kiểm chạy được.

## 5. Manifest `bizcity.app.json` (`bizcity_app@1`)

Mỗi repo app đặt ở gốc — **kể cả plugin WordPress** (Q-SPINE-4, chủ duyệt 2026-11-24). Bộ kiểm đọc tệp này trước (lane MANIFEST). Giá trị `bizcity_app@1-draft` còn được nhận một thời gian, kèm cảnh báo.

```json
{
  "schema": "bizcity_app@1",
  "id": "open-pos",
  "name": "Open POS",
  "repo": "hoanganh8389/open-pos",
  "runtime": "wordpress-php",
  "license": "GPL-2.0-or-later",
  "paid": false,
  "axes": {
    "owns": ["retail_txn"],
    "uses": ["tenant", "user", "item", "uom", "branch", "partner"],
    "replica": ["item", "uom", "branch"],
    "local": ["item"]
  },
  "sync": { "pull_via": "open-ketoan-bridge", "outbox": ["retail_txn"], "reconcile": ["RC-SPINE-item", "RC-SPINE-retail_txn"] },
  "contracts": ["bizcity_spine@1", "bizcity_ledger_intake@1"],
  "docs": { "canon": "docs/canon/README.md", "public": "docs/public/" }
}
```

Luật manifest (kiểm bằng `spine-check --manifest`): `owns` ∩ `uses` = ∅ · trục chuẩn (§2) chỉ được `owns` bởi đúng chủ · `replica` ⊆ `uses` · `local` ⊆ `uses` và phải có `sync.reconcile` tương ứng · `paid: false` khi `license` là GPL và app thuộc bộ Bizcity Open (mọi ứng dụng 0đ, chủ chốt 2026-11-24).

## 6. Kiểm (`SC-SPINE-*`, chạy ở bizcity-platform, mọi repo)

| Mã | Lane | Kiểm | Trạng thái |
|---|---|---|---|
| SC-SPINE-1 | MANIFEST | `bizcity.app.json` đúng schema + luật §5 | **có** (`tools/spine-check.mjs`) |
| SC-SPINE-2 | MANIFEST | vector `schema/spine/vectors/*` đạt (ID đúng dạng, `*Ref` đúng hình, `doc_ref` đúng khuôn) | **có** |
| SC-SPINE-3 | HOUSE | không cột `sku` / `code` làm khoá ngoại ở bảng sổ; không `UPDATE` cột `id` trục; bản sao không có cột ghi đè cột chủ | chưa (TS: SC-ITEM-* một phần) |
| SC-SPINE-4 | CONTRACT | gửi `code` lạ ⇒ bị giữ, không tạo; gửi `id` lạ ⇒ từ chối; gửi lặp cùng `Idempotency-Key` ⇒ một kết quả | **có** (`tools/spine-contract.mjs`, profile `ledger`; phần ghi cần `--allow-write`, chỉ bản thử) |
| SC-SPINE-5 | CONTRACT | changefeed có `cursor`, thứ tự ổn định, có tombstone; digest khớp | **có** — lần chạy đầu bắt lỗi con trỏ rỗng ở open-ketoan, sửa ở open-ketoan #623 <!-- [2026-11-24 08:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 --> |
| SC-SPINE-6 | CONTRACT | chuỗi vàng: một `contact_id` → `partner.code` → `item_id` → `doc_ref` POS → `doc_ref` kế toán, `document_links` liền (DOD-SYS-2) | chưa |

Ba lane và bốn mức C0–C3: [open-hub · DE-XUAT-BO-KIEM-TUONG-THICH](https://github.com/hoanganh8389/open-hub/blob/main/docs/DE-XUAT-BO-KIEM-TUONG-THICH.md). Mức **C1** = đạt SC-SPINE-1, 2, 4; **C2** = thêm 3, 5; **C3** = thêm 6 + MCP + tri thức.

## 7. Thêm trục mới / đổi chuẩn

1. ≥ 2 app cần (R-PLAT-3) → issue ở bizcity-platform nêu: chủ là ai, dạng id, mã có phiên bản thế nào, app khác giữ gì.
2. ADR ở `docs/adr/` + bump phiên bản tệp này + schema + vector.
3. Ghi vào canon open-hub (bảng chủ hợp đồng). Repo sản phẩm **không** tự thêm trục.

## 8. Những gì chuẩn này **không** làm

- Không quy định schema CSDL của app (tên bảng, kiểu cột) — chỉ quy định **cột tối thiểu** và **hình trên dây**.
- Không thay cửa nạp (`bizcity_ledger_intake@1`), không thay luật sổ; chuẩn này nằm **trước** cửa nạp.
- Không bàn pháp nhân, thuế, giá — việc của sổ (book) và chính sách hạch toán.

## 9. Quyết định của chủ (2026-11-24)

<!-- [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 — chủ dự án trả lời "duyệt" cho cả bốn câu; ghi lại để bộ kiểm và repo khác bám theo. -->

| Mã | Câu hỏi | Quyết định |
|---|---|---|
| Q-SPINE-1 | Tám trục và dạng `sub = wp:<id>` | **Duyệt.** `biz:` chỉ cho tài khoản máy |
| Q-SPINE-2 | Vị trí kho, lô | **Lớp mềm** cho tới khi app thứ hai cần (§2) |
| Q-SPINE-3 | open-ketoan mở changefeed `since` + digest cho `items`, `partners`, `branches` | **Duyệt.** Theo R-FLOW của open-ketoan; bridge C8 và cake chuyển sang kéo theo cursor sau khi có |
| Q-SPINE-4 | `bizcity.app.json` ở gốc mọi repo, kể cả plugin WordPress | **Duyệt.** Repo chưa có thì thêm bằng PR chỉ tài liệu |

## 10. Lịch sử

- **1.1.0 (2026-11-24):** `uom` nhận tên ĐVT có dấu của chủ (bản 1.0 bắt ASCII — lệch dữ liệu thật của open-ketoan / open-pos); `partner.code` từ open-cake: SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE`. Nguồn: open-cake PHASE-017 `20-DOI-CHIEU-SPINE-VA-LEAN.md` S5, S6.

- **1.0.0 (2026-11-24):** chủ duyệt Q-SPINE-1..4; bỏ hậu tố `-draft` ở `bizcity_spine@1`, `bizcity_app@1`, `bizcity_sync@1`. <!-- [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 -->
- **1.0.0-draft (2026-11-24):** bản đầu. Tám trục, bốn hình thức tham chiếu, bốn kiểu bảng, R-SPINE-1..10, SC-SPINE-1..6, manifest `bizcity_app@1-draft`, ánh xạ P-0 ý 4.
