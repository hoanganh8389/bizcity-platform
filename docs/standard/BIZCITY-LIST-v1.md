# `bizcity_list@1` — Danh sách dữ liệu chung: lọc, tìm, sắp xếp, phân trang, xuất, bộ lọc đã lưu

<!-- [2026-11-28 06:32 PM Johnny Chu - Chu Hoàng Anh] STD-LIST-1 — chủ (2026-11-28): "universal user, user role, hook, menu register, chuẩn list table data và các công cụ filter, lọc, export… chuẩn hoá về open-core, đồng ý phase 003". Gom từ cái đang có: open-ketoan (DataGrid, FilterLayout, bộ tham số đã lưu, getPage có tổng, add-in excel-export) + open-cake (con trỏ keyset, useInfiniteQueryAction, bộ lọc trên URL). -->

> **Phiên bản:** 0.2.0-draft · 2026-11-28 (JSON chuẩn + schema + vector + bộ kiểm; luật React) · 0.1.0-draft · **Trạng thái:** Đề xuất · **Trụ:** T2 (API) + T9 (giao diện) · **Hiện thực đích:** open-core `@bizcity/server` (`defineListAction`) + `@bizcity/web-shell` (`ListScreen`) — [open-core PHASE-003](https://github.com/hoanganh8389/open-core/blob/main/docs/phases/PHASE-003-KHUNG-QUAN-TRI-CHUNG/README.md)
> **Đứng trên:** [API-PROFILE](BIZCITY-API-PROFILE-v1.md) (phong bì, con trỏ) · [WEB](BIZCITY-WEB-v1.md) R-WEB-2 (URL là nguồn vị trí), R-WEB-10 (ảo hoá + con trỏ) · [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) (quyền, phạm vi, `user_meta`) · [EVIDENCE](BIZCITY-EVIDENCE-v1.md)

## 0. Một câu

**Mỗi danh sách khai một lần (cột + quyền), lõi sinh ra API danh sách, bộ lọc, sắp xếp, phân trang, xuất tệp, tool MCP chỉ đọc và màn `ListScreen`** — mọi app (kế toán, POS, HRM, CRM…) lọc / xuất giống nhau, người dùng học một lần.

## 1. Khai báo (máy chủ)

```ts
defineListAction({
  id: 'pos.sale.list',                 // <module>.<thực thể>.list — cùng quy tắc action
  source: 'pos_sales',                 // bảng / khung nhìn đọc (tenant_id + RLS)
  permission: 'pos:ban-xem', exportPermission: 'pos:ban-xuat',
  columns: [
    { field: 'doc_no',    type: 'text',   label: 'Số phiếu', filter: ['eq', 'prefix'], sort: true, search: true },
    { field: 'branch',    type: 'branch', label: 'Chi nhánh', filter: ['in'], scope: 'branch' },
    { field: 'status',    type: 'status', label: 'Trạng thái', filter: ['in'] },
    { field: 'total',     type: 'money',  label: 'Tổng tiền', filter: ['gte', 'lte'], sort: true, sum: true },
    { field: 'issued_at', type: 'date',   label: 'Ngày',     filter: ['between'], sort: true },
  ],
  defaultSort: '-issued_at',
});
```

| Kiểu cột | Giá trị trên dây | Phép lọc được khai |
|---|---|---|
| `text` | chuỗi | `eq` `ne` `in` `prefix` `like` `null` |
| `number` · `money` · `qty` | chuỗi thập phân (tiền 2, số lượng 4 chữ số lẻ — spine 1.2) | `eq` `ne` `gt` `gte` `lt` `lte` `between` `null` |
| `date` · `datetime` | `YYYY-MM-DD` · ISO 8601 | `eq` `gte` `lte` `between` `null` |
| `enum` · `status` | khoá; `status` theo sáu nhóm trạng thái chứng từ | `eq` `in` `nin` |
| `bool` | `true` / `false` | `eq` |
| `item` · `partner` · `contact` · `branch` · `user` | mã / id theo spine (`*Ref`) | `eq` `in` |

## 2. Hợp đồng truy vấn

`GET /api/v1/<module>/<thực thể>?…` (sinh từ khai báo; MCP dùng cùng tham số)

| Tham số | Dạng | Luật |
|---|---|---|
| `q` | chuỗi ≤ 100 | tìm trên các cột `search: true`, không phân biệt hoa thường, **bỏ dấu tiếng Việt** |
| `f.<field>.<op>` | `f.total.gte=100000` · `f.branch.in=CN01,CN02` · `f.issued_at.between=2026-11-01..2026-11-30` · `f.note.null=true` | chỉ cột + phép đã khai; nhiều điều kiện = **VÀ**; giá trị danh sách cách `,` (thoát `\,`); tối đa 20 điều kiện |
| `sort` | `-issued_at,doc_no` | chỉ cột `sort: true`, tối đa 3 khoá; luôn thêm `id` làm khoá cuối để thứ tự ổn định |
| `cursor` · `limit` | con trỏ mờ do máy chủ phát · 1–200, mặc định 50 | con trỏ = base64url(giá trị khoá sắp xếp + `id`) — ổn định khi có bản ghi mới (API-PROFILE) |
| `count` | `none` (mặc định) · `exact` | `exact` trả `meta.total`; chỉ khi màn cần (đếm tốn) |
| `sums` | `1` | trả `meta.sums` cho cột `sum: true`, trên **toàn bộ kết quả lọc**, không chỉ trang |

**Trả:** `ListPage` — `{ ok: true, data: [...], meta: { nextCursor, total?, sums?, query } }` (`query` = truy vấn đã áp, dạng `ListQuery`).
**Lỗi:** sai cột / phép / giá trị ⇒ `400 VALIDATION_ERROR` với `details.field = "f.total.gte"` (để màn tô đúng ô — FAILURE-MAP).

## 2b. JSON chuẩn (máy đọc: [`schema/list/list.schema.json`](../../schema/list/list.schema.json), vector [`schema/list/vectors/list.vectors.json`](../../schema/list/vectors/list.vectors.json))
<!-- [2026-11-28 06:41 PM Johnny Chu - Chu Hoàng Anh] STD-LIST-2 — chủ (2026-11-28): "gọi list ra, phân trang, filter, export chuẩn json, chuẩn hoá UI, react, api rest hết; open-core là infra; open-ketoan, open-cake, open-kiot sau này cũng phải rule chuẩn về react api" -->

| Định nghĩa | Là gì | Dùng ở |
|---|---|---|
| `ListDef` (gồm `ListColumn`, `SortKey`) | khai báo danh sách: `contract: "bizcity_list@1"`, `id` `<module>.<thực thể>.list`, quyền xem / xuất, cột, `defaultSort`, `exportFormats` | `GET /api/v1/lists/<id>` — web-shell dựng bảng + thanh lọc từ đây; agent đọc để biết lọc được gì |
| `ListQuery` (gồm `Filter`) | dạng **JSON** của tham số URL: `{ q, filters: [{field, op, value}], sort: [{field, dir}], cursor, limit, count, sums }`, thứ tự khoá cố định | bộ lọc đã lưu (`user_meta`), `meta.query` của trang, đầu tệp xuất, băm bằng chứng xuất, MCP |
| `ListPage` | một trang kết quả | `GET` danh sách |
| `ListExport` | `export.json` (≤ 10 000 dòng): `{ contract: "bizcity_list_export@1", list, tenant, generatedAt, generatedBy, query, columns, total, masked, rows }` | tải xuống, chuyển cho app khác / agent |
| `ListExportHeader` | dòng đầu của `export.ndjson` (mỗi dòng sau = một hàng) — cho tệp lớn, đọc từng dòng | xuất nền (R-STD-LIST-8) |

URL ⇄ JSON là **hai chiều, một nghĩa**: `parseListQuery` / `formatListQuery` (bản tham chiếu `tools/lib/list-query.mjs`; open-core hiện thực theo cùng vector). Xuất: `…/export.csv` · `…/export.xlsx` · **`…/export.json`** · **`…/export.ndjson`**.

## 2c. React (mọi app — `@bizcity/web-shell`)

| Mã | Luật |
|---|---|
| R-STD-LIST-12 | Danh sách trong app dùng **`<ListScreen list="<id>">`** (hoặc hook `useListQuery(id, query)` khi cần bố cục riêng) của web-shell — **không** tự dựng bảng + bộ lọc + phân trang + nút xuất |
| R-STD-LIST-13 | Gọi máy chủ chỉ qua client chung (`@bizcity/action-client`: `useListQuery`, `useAction`); tệp view không có `fetch(`, `useQuery` (SC-WEB-P1) |
| R-STD-LIST-14 | Trạng thái lọc / sắp xếp / con trỏ đọc ghi đúng tham số §2 trên URL (R-WEB-2); bộ lọc đã lưu đọc ghi `ListQuery` ở `user_meta` |
| R-STD-LIST-15 | Ô lọc sinh từ `ListColumn.type` (khoảng ngày, chọn chi nhánh / mặt hàng / đối tượng theo spine, trạng thái theo nhóm) — app không tự viết ô lọc cho kiểu đã có |

## 3. Luật

| Mã | Luật |
|---|---|
| R-STD-LIST-1 | Danh sách **chỉ đọc** qua `defineListAction`; không route danh sách viết tay ngoài khung (trừ báo cáo có công thức riêng — khai `report` thay `list`) |
| R-STD-LIST-2 | Mọi điều kiện tham số hoá (Kysely), **không ghép chuỗi SQL**; cột / phép ngoài khai báo bị chặn ở cửa (zod sinh từ khai báo) |
| R-STD-LIST-3 | **Phạm vi**: cột có `scope` (`branch` · `warehouse` · `org_unit`) tự giao với phạm vi vai của người gọi (`user_role_assignments`); RLS theo tenant luôn bật |
| R-STD-LIST-4 | Phân trang **con trỏ** mặc định; `offset` không dùng cho bảng lớn; `limit` ≤ 200 |
| R-STD-LIST-5 | **Bộ lọc nằm trên URL** (R-WEB-2): `ListScreen` đọc / ghi đúng các tham số §2 ⇒ F5 về đúng chỗ, gửi link được |
| R-STD-LIST-6 | **Bộ lọc đã lưu, cột hiện, độ rộng** là tuỳ chọn cá nhân ở `user_meta` khoá `<app>.<listId>.views` (`[{ name, query, columns, default }]`) — không bảng riêng |
| R-STD-LIST-7 | **Xuất** dùng đúng tham số lọc của danh sách: `GET …/export.csv` · `…/export.xlsx`; cần `exportPermission` (khác quyền xem); ghi `audit_logs` (`<id>.export`, băm bộ lọc, số dòng); CSV UTF-8 có BOM, dòng đầu là nhãn cột; tiền / số lượng là số thuần (không định dạng) |
| R-STD-LIST-8 | Xuất > 10 000 dòng ⇒ chạy nền: `202 { jobId }`, xong thì tệp lưu Storage (`bizcity_storage@1`, vùng `exports`) và `GET /api/v1/exports/:jobId` trả đường dẫn ký; không giữ kết nối HTTP mở |
| R-STD-LIST-9 | Thao tác hàng loạt (chọn nhiều dòng) gọi **action ghi** có sẵn từng dòng, mỗi dòng một `Idempotency-Key`; không có "action ghi hàng loạt" vượt quyền từng dòng |
| R-STD-LIST-10 | Cùng danh sách mở cho agent qua **MCP chỉ đọc**, giao với phạm vi Guru (bước ④ `bizcity_hub_setup@1`) |
| R-STD-LIST-11 | Dữ liệu cá nhân (SĐT, email) trong danh sách / tệp xuất theo quyền xem cột (`column.permission`); thiếu quyền ⇒ che (`09xx…567`), không bỏ cột |

## 4. Giao diện (`@bizcity/web-shell`)

`<ListScreen action="pos.sale.list" rowActions={[…]} bulkActions={[…]} />` — bảng, thanh lọc (dựng từ `columns`: ô chọn chi nhánh, khoảng ngày, trạng thái…), sắp xếp, ảo hoá, nút Xuất (ẩn khi thiếu `exportPermission`), lưu / chọn bộ lọc, chọn cột. Thành phần tách view / model theo WEB (không `fetch` trong view).

## 5. Câu hỏi mở

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| Q-LIST-1 | `like` có bỏ dấu tiếng Việt | có — `unaccent` + chỉ mục `gin_trgm` cho cột `search` |
| Q-LIST-2 | Danh sách dùng chung giữa người dùng (bộ lọc của phòng ban) | sau — bản 0.2: `views` cấp tenant ở `setting_values` (lớp `tenant`), quyền sửa riêng |
| Q-LIST-3 | Xuất PDF | không ở chuẩn này — in dùng hồ sơ in của DOCUMENT |

## Lịch sử

- **0.2.0-draft (2026-11-28):** §2b JSON chuẩn (`ListDef`, `ListQuery`, `ListPage`, `ListExport`, `ListExportHeader`) + `schema/list/` + vector + `tools/list-check.mjs` (SC-LIST-1 vector, SC-LIST-2 URL ⇄ JSON, SC-LIST-3 CONTRACT); xuất `json` / `ndjson`; §2c luật React R-STD-LIST-12..15.
- **0.1.0-draft (2026-11-28):** bản đầu.
