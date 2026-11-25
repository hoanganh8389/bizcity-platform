# PHASE-001 · 10 — Hiện trạng từng repo (có dẫn chứng)

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — đo trên bản main 2026-11-25: open-ketoan 34cb459, open-pos 15a72eb, open-pos-backend 9c3bfb3, open-ketoan-bridge 3fea0ab, open-crm d9db2d1, open-hub-core a9272b6, open-cake 2a51d49. Đường dẫn tính từ gốc repo đó. -->

> Mục đích: ai nhận việc ở [30-GIAO-VIEC](30-GIAO-VIEC-THEO-REPO.md) biết **cái gì đã có để dùng lại**, cái gì **chưa có** — không làm lại, không đoán.

## 1. open-ketoan — chủ tồn kho

| Có | Ở đâu |
|---|---|
| View tồn `bizcity_read.stock_on_hand` (`tenant_id, branch_code, warehouse_code, item_id, sku, qty`), cộng `inventory_movements` theo ĐVT nhỏ nhất, có thể âm, có RLS | `db/migrations/0109_doc_gia_ton_chi_nhanh.sql:47` |
| `GET /api/v1/inventory/items?search&branchCode&skus` ⇒ `{sku, name, unit, taxOutCode, taxInCode, stock}` — khoá API cần `reports:read` | `apps/api/src/modules/inventory/inventory-report.routes.ts:60` |
| `pos.stock.get` (`GET /api/v1/m/pos/stock`, quyền `pos:sell`) ⇒ `{sku, available, held}` — **`held` cứng 0**, chỉ chi nhánh của người gọi | `modules/pos/api/catalog.ts:77-85` |
| `phieu-ban.quote.get` — giá + tồn theo chi nhánh, duy nhất có `mcp: true` | module `phieu-ban` |
| **Đơn đặt hàng BH20** (`mod_phieu_ban.orders`, `order_events`, `order_shipments`): `draft/pending/open/closed/cancelled`; "gửi" đơn ⇒ phiếu `transfer` ghi sổ chuyển hàng sang **kho giữ KCB**; mỗi lần giao ⇒ phiếu bán BH10 nháp; hãng vận chuyển, mã vận đơn, COD; doanh thu chỉ khi kế toán duyệt | `modules/phieu-ban/migrations/0002_don_dat_hang.sql:16`, `modules/phieu-ban/api/domain/order.ts:308`, `docs/huong-dan/don-dat-hang.md`, NT-BH-023, NT-BH-032 |
| Cửa nạp `POST /api/v1/documents` (+ `/batch` ≤ 200, `/cancel`): `bizcity_ledger_intake@1`, `docType` = `sale, sale_return, purchase, purchase_return, transfer, stock_adjustment, cash_transfer, customer_payment, supplier_payment`; idempotent theo `docKey` + `version` (cùng ⇒ `unchanged`, cao hơn ⇒ đảo + ghi lại, thấp hơn ⇒ 409) | `packages/kernel/src/modules/documents/document.routes.ts:83,243`, `docs/api/01-quy-uoc.md`, `docs/api/08-sua-huy.md` |
| Phiếu nhận mặc định `pending` tới khi kế toán ghi sổ ở ACC14; **`inventory_movements` chỉ ghi khi ghi sổ** ⇒ phiếu chờ không trừ tồn | `document.service.ts:467` vs `:511` |
| Sự kiện outbox → webhook ký `Bizcity-Signature`: `bizcity.ledger.entry.posted|reversed`, `bizcity.masterdata.catalog.changed`, `bizcity.intake.rejected|resolved`, `pos.order.recorded|cancelled`, `pos.return.recorded`, `phieu-ban.doc.recorded|cancelled` | `docs/contracts/BIZCITY-EVENT-v1.md` §3, §7a; `document.service.ts:522`; `modules/pos/api/order-service.ts:294` |
| Changefeed `GET /api/v1/sync/:axis` + `/digest` (`items|partners|branches`, scope `catalog:read`) | `apps/api/src/modules/sync/sync.routes.ts` |
| Scope khoá API hiện có: `documents:write`, `reports:read`, `catalog:write` | `apps/api/src/modules/access/access.schemas.ts:84` |

| **Chưa có** | Hệ quả cho luồng |
|---|---|
| "có thể bán = tồn − đang giữ", bảng giữ hàng | CRM chỉ thấy tồn sổ; `pending_out` phải tính mới |
| `GET /api/v1/inventory/balances` và công cụ MCP `kt_stock` — **có trong tài liệu, không có mã** | `docs/contracts/BIZCITY-INVENTORY-v1.md:82`, `docs/contracts/BIZCITY-MCP-v1.md` §5.1 |
| scope chỉ đọc tồn (`stock:read`) | hiện phải cấp `reports:read` (rộng: mọi báo cáo) |
| sự kiện "tồn đổi"; sự kiện cho đơn đặt hàng `phieu-ban.order.*` | CRM đọc theo yêu cầu + đệm ngắn, không đẩy |
| Kho (`warehouseCode`) trong changefeed | đọc tồn theo `branch_code`, kho mặc định `''` |

## 2. open-pos-backend (tsm) — quản trị cửa hàng

| Có | Ở đâu |
|---|---|
| `POST /wp-json/tgs-shop/v1/sales/create`: `source_type` (0 Thủ công, 1 POS, 2 Shopee, 3 Tiki, 4 TikTok, 5 Livestream, 6 Offline, 99 Khác), `source_id` ⇒ `local_ledger_source_id`, `products`, `total_amount`, `person_phone` | `functions/api/class-tgs-api-sales.php:22` |
| **Luật đơn chờ đang có:** nguồn ≠ POS ⇒ `local_ledger_status = PENDING (1)`, không tự duyệt | `class-tgs-api-sales.php:355,766` |
| Duyệt phiếu chung `wp_ajax_tgs_ticket_approve`; hằng trạng thái DRAFT 0 · PENDING 1 · APPROVED 2 · REJECTED 3 · COMPLETED 4 | `functions/ajax/class-tgs-ajax-ticket.php:39`, `includes/class-tgs-constants.php:421-451` |
| Danh mục theo site: `{prefix}tgs_catalog_*` (nguồn local) hoặc `wp_global_*` (kéo từ Kế Toán), cột `global_product_item_id VARCHAR(26)` = `item_id`; SKU lạ bị từ chối | `functions/class-tgs-catalog-store.php` |

| **Chưa có** | |
|---|---|
| xác thực máy-máy cho `/sales/create` (chỉ `is_user_logged_in()`), **không** idempotency theo `source_id` | `class-tgs-api-sales.php:122` |
| nguồn "CRM", hạn đơn chờ, lý do từ chối, sự kiện trạng thái ra ngoài | — |
| tích hợp hãng vận chuyển; trạng thái giao | — |

## 3. open-pos — quầy

| Có | Ở đâu |
|---|---|
| Hai engine theo blog `tgs_pos_engine`: `legacy` (PHP ghi `local_ledger*`) và `react` (bán qua module `pos` của Kế Toán, WordPress giữ bản soi) | `includes/class-tgs-pos-engine-switch.php`, `react/openapi/pos.yaml` |
| Legacy: ghi phiếu bán (10), xuất (2), thu (7) rồi tự duyệt (`local_ledger_status=4`, `approver_status=1`); hook `tgs_after_order_create`, `tgs_sale_completed` | `functions/class-tgs-pos-order-handler.php:684,803,2082,2120` |
| React: `POST /pos/orders` bắt buộc `Idempotency-Key` + `id` UUID v7; đơn `completed | awaiting_payment | cancelled`; giữ tồn **5 phút** cho đơn chờ QR (`QR_HOLD_MS`), huỷ nhả tồn | `pos.yaml:368,405,483,2716,2881`; open-ketoan `modules/pos/api/domain/order.ts:430` |
| Nhãn kênh bán `TGS_POS_Sale_Source` (Zalo, Website, Facebook, Shopee/Lazada, Livestream…) | `includes/class-tgs-pos-sale-source.php` |
| Nhận sự kiện Kế Toán ký HMAC: `tgs-pos/v1/ketoan-events` (hộp `tgs_pos_ketoan_inbox`) | `includes/class-tgs-pos-ketoan-events.php` |
| Định tuyến blog theo `branchCode` | `includes/class-tgs-pos-react-shell.php:423` |
| Luật tối thượng: phụ thuộc một chiều open-pos ← tsm ← bridge ← open-ketoan; **I-0 không đổi luồng bán / logic bán / sổ** | `LUAT-TOI-THUONG.md` |

| **Chưa có** | |
|---|---|
| đơn chờ chung để nhân viên xác nhận (JS `tmd_hold_order` còn sót, không có xử lý PHP) | `assets/js/ajax.js:304,337` |
| vận chuyển: không GHN / GHTK / ViettelPost; `delivery_method` mặc định "Tại chỗ" | `functions/ajax/class-tgs-pos-ajax-order.php:189-200` |
| nhận đơn từ CRM / sàn / Zalo | — |

⇒ **I-0 của open-pos:** luồng mới phải **đứng trước** luồng bán (đơn chờ → lúc bàn giao gọi đúng đường bán đang có), không sửa logic bán / sổ.

## 4. open-ketoan-bridge — cầu POS ⇄ Kế Toán

| Có | Ở đâu |
|---|---|
| Gọi Kế Toán: `POST /api/v1/documents/batch` (100 / lô), `/documents/cancel`, `/partners/upsert`, `/branches`, feed danh mục, `/intake/preflight` | `includes/class-tgs-acc-api-client.php:125,135,247,289` |
| Bắt mọi ghi `local_ledger*` qua bộ lọc `query` (hoặc `do_action('tgs_acc/event', …)`), gửi cuối yêu cầu; **chỉ** phiếu `approver_status = 1` | `includes/class-tgs-acc-events.php:1-35`, `includes/class-tgs-acc-source.php:134` |
| `docKey = btsoft:<blog>:<kind>:<id>` + `version` tăng khi băm nội dung đổi | `class-tgs-acc-mapper.php:221`, `class-tgs-acc-pusher.php:24-28,384-400` |
| Thử lại: tệp JSONL, cron mỗi phút, lùi 1→60 phút, 30 lần, 7 ngày | `class-tgs-acc-events.php:22-24,45-46` |
| Nhận sự kiện Kế Toán ký HMAC (`tgs-acc/v1/ketoan-events`, hộp chống lặp), định tuyến theo `branchCode` | `class-tgs-acc-ketoan-events.php:41,54-77,85-90` |
| Khoá: `X-Api-Key` theo blog, hoặc khoá cài đặt `okti_` + `X-OKT-Blog` (chain) | `class-tgs-acc-config.php`, `class-tgs-acc-install.php:87-89` |

| **Chưa có** | |
|---|---|
| header `Idempotency-Key = <doc_ref>@<version>` — manifest khai nhưng **mã không gửi** | `bizcity.app.json:20` vs `includes/` |
| mang `links` (`pos.order` → `cake.order_request`) lên chứng từ | — |
| nhận đơn từ app khác, phục vụ đọc tồn cho app khác | — (đúng vai: bridge chỉ là kênh) |

## 5. open-cake và open-crm — CRM

| Repo | Có | Chưa có |
|---|---|---|
| **open-cake** | danh mục độc lập + `catalog_source local|ketoan`, `item_id` ULID, `tenant_links` (PHASE-017); ingress ký HMAC `bizcity_touch@1`; Contact 360; kế hoạch **PHASE-010** đã có S010-1 `cake.order_request`, S010-4 (POS nhận), S010-5 (nghe `pos.order.*`), S010-6 (đối chiếu 3 chiều) — tất cả ☐ | đọc tồn Kế Toán; gửi đơn; nhận sự kiện POS |
| **open-crm** (plugin `bizcity-twin-crm`) | `BizCity_CRM_Order_Adapter_Interface` (`search_products`, `create_order`, `list_orders_for_contact`) — chỉ có adapter WooCommerce + QR (`includes/class-order-adapter.php:19-45,78,88`); REST `/order-adapter/products`, `/conversations/{id}/orders`, `/send-order` (`includes/class-rest-controller.php:118-168`); bảng `crm_products.stock_qty` nhập tay; connector khai báo `open-kiot` (`order.create`) **chưa có mã**; hộp sự kiện `bizcity_ocrm_events` duy nhất `(source, doc_key)` | adapter `open_pos`; đọc tồn Kế Toán; `docs/` không theo dõi trong git ⇒ phase của open-crm phải ghi ở đây hoặc mở `docs/` |

## 6. Hub và repo điều phối

- **open-hub-core**: sổ hub, khoá 1API theo hub, gói (`ohc_hubs`, `ohc_keys`, `ohc_plans`); **không** định tuyến sự kiện / yêu cầu giữa app, không sổ site, không đơn / tồn ⇒ **không** làm trung gian cho luồng này.
- **open-setup**: sổ site ⇒ `tenant` slug chung giữa các app (SPINE §2) — luồng dùng, không cần việc mới.
- **Không tồn tại ở đâu:** hợp đồng `bizcity_order*@N`, hợp đồng đọc tồn cho bên thứ ba ⇒ hai hợp đồng mới ở [20-HOP-DONG-NHAP](20-HOP-DONG-NHAP.md).
