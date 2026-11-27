# PHASE-001 · 30 — Giao việc theo repo

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — mỗi repo đọc mục của mình: vai trong luồng, nhận gì, phát gì, KHÔNG được làm gì, mở phase nào, việc nào (mã trùng CHECKLIST.md). Số phase là số kế tiếp đo ngày 2026-11-25 (open-ketoan: 041 đã do #616 / #617 giữ ⇒ 042) — giữ chỗ theo luật nhận việc của repo đó trước khi viết mã. -->

> Thứ tự: **W0** chủ chốt Q-ORD ⇒ mỗi repo giữ chỗ phase ⇒ **W1** platform + Kế Toán ⇒ **W2** open-pos-backend + CRM ⇒ **W3** open-pos + bridge ⇒ **W4** sự kiện, đối chiếu, nghiệm thu đầu-cuối. Repo nào làm trước bên kia thì chạy trên **vector + giả lập** của bizcity-platform, không chờ.
> Giao diện mới (màn đơn chờ, nút gửi đơn, ô tồn): **mockup trước, chủ duyệt rồi mới làm**.

## Bản đồ quan hệ (ai gọi ai)

```text
                 stock_read (đọc)                          ledger_intake (gửi sau)
 open-cake ─────────────────────────▶ open-ketoan ◀──────────────────────────── open-ketoan-bridge ◀── local_ledger ── open-pos
 open-crm  ─────────────────────────▶      ▲                                                                              ▲
     │                                     │ pos.order.create (shop React)                                                │
     │ order_request (gửi)                 └──────────────────────────────── open-pos (bàn giao) ◀── đơn đã xác nhận ───────┤
     └──────────────────────────────▶ open-pos-backend (đơn chờ, xác nhận) ───────────────────────────────────────────────┘
     ◀──────────── sự kiện pos.order_request.* / pos.order.* (webhook ký HMAC) ─────┘
```

---

## bizcity-platform — chuẩn và bộ kiểm (phase này)

- **Vai:** giữ hình trên dây, schema, vector, công cụ kiểm; **không** chạy nghiệp vụ.
- **Việc:** LD-PLAT-1 viết `docs/standard/BIZCITY-ORDER-FLOW-v1.md` (`bizcity_stock_read@1`, `bizcity_order_request@1`) từ [20-HOP-DONG-NHAP](20-HOP-DONG-NHAP.md) sau khi chủ chốt, kèm `standards.json`, bản đồ chuẩn, CHANGELOG (R-PLAT-7) · LD-PLAT-2 schema `schema/order/` + vector tốt / xấu · LD-PLAT-3 `tools/order-flow-check.mjs` (hộp đen, chạy được với repo PHP: gửi lặp, sửa khi đã khoá, mã lạ, sai chi nhánh, chữ ký sai) · LD-PLAT-4 phiếu nghiệm thu đầu-cuối NT-LD-001 (kịch bản README §7) + `BAN-GIAO.md` khi đóng.
- **Xong khi:** `standard-check` và `order-flow-check --self-test` ĐẠT; hai bản CRM và open-pos-backend chạy công cụ trên bản thử ĐẠT.

## open-ketoan — chủ tồn kho và sổ

- **Vai:** nguồn sự thật tồn theo `tenant` × `branch_code` × `item_id`; nhận chứng từ bán **sau** khi POS ghi nhận. **Không** biết gì về đơn chờ, **không** giữ `contact_id`.
- **Nhận:** lời đọc tồn của CRM (`stock:read`); phiếu `sale` / `sale_return` / `customer_payment` từ bridge (legacy) hoặc `pos.order.create` (shop React).
- **Phát:** `bizcity.ledger.entry.posted` (đã có); không phát gì mới trong phase này.
- **Không được:** cho CRM ghi chứng từ; tạo mặt hàng từ đơn; tính giá vốn ra ngoài.
- **Phase đề xuất:** `PHASE-042-DOC-TON-CHO-APP-NGOAI` (giữ chỗ ở `docs/phases/CLAIMS.md` theo R-FLOW trước khi viết mã).
- **Việc:** LD-KT-1 scope `stock:read` (risk `read`, vào `APP_SCOPES`) · LD-KT-2 `GET /api/v1/inventory/availability` theo ST-1..4, dùng lại `bizcity_read.stock_on_hand`, tính `pendingOut` từ phiếu đã nhận chưa ghi sổ, `held` từ kho giữ BH20 · LD-KT-3 MCP `kt_stock` (đã có trong `BIZCITY-MCP-v1.md` §5.1, chưa có mã) · LD-KT-4 cửa nạp nhận và lưu `links` (`pos.order` role `source`) trên phiếu bán — kiểm `bizcity_document@1`, thêm nếu thiếu · LD-KT-5 module `pos`: `pos.order.create` nhận `saleSource=crm` + `sourceRef` = `pos.order_request:<id>` cho shop React (Q-ORD-8), idempotent.
- **Xong khi:** test trên Postgres thật: tồn đúng sau phiếu ghi sổ / phiếu chờ / kho giữ; khoá không có `stock:read` ⇒ 403; đọc 100 mã ≤ 200 ms trên dữ liệu mẫu.

## open-pos-backend — đơn chờ và xác nhận

- **Vai:** **cửa nhận duy nhất** của đơn từ app ngoài; giữ hàng đơn chờ của blog; nhân viên xác nhận / từ chối; phát sự kiện trạng thái về CRM.
- **Nhận:** `bizcity_order_request@1` (POST, cancel, GET) bằng khoá `opb_…` của blog.
- **Phát:** 8 sự kiện ở [20 §4](20-HOP-DONG-NHAP.md) qua outbox → webhook ký HMAC tới URL CRM đã cấu hình theo blog.
- **Không được:** tạo phiếu bán / xuất khi nhận đơn; sửa luồng bán của open-pos (I-0); nhận `contact_id`.
- **Phase đề xuất:** `PHASE-003-NHAN-DON-CHO-TU-APP-NGOAI`.
- **Việc:** LD-OPB-1 khoá app theo blog (băm, hiện một lần, tiền tố, thu hồi; scope `order_request:write`) + cấu hình webhook CRM (URL, bí mật) · LD-OPB-2 bảng `{prefix}tgs_order_requests` (+ dòng, + hộp chống lặp theo `Idempotency-Key`) · LD-OPB-3 REST `open-pos/v1/order-requests` theo OR-1..7, nguồn `source_type` mới "CRM" · LD-OPB-4 màn **Đơn chờ** (mockup trước): danh sách, xem `stockSeen` vs tồn hiện tại, xác nhận (kiểm tồn + giá, L-3, L-5) / từ chối có lý do · LD-OPB-5 outbox + webhook (thử lại như bridge: lùi 1→60 phút) · LD-OPB-6 cron hết hạn (L-4, mặc định 72 giờ) · LD-OPB-7 đối chiếu RC-ORDER-2.
- **Xong khi:** `order-flow-check --profile receiver` ĐẠT; gửi lặp 10 lần ⇒ 1 đơn; đơn chờ không làm đổi tồn hay sổ; xác nhận khi thiếu hàng bị chặn.

## open-pos — bàn giao vận chuyển và ghi nhận

- **Vai:** biến đơn đã xác nhận thành **bán thật** đúng lúc bàn giao, **bằng đường bán đang có**.
- **Nhận:** đơn `confirmed` từ open-pos-backend (cùng site, đọc bảng / hook của tsm).
- **Phát:** `pos.order.shipped | delivered | returned` (qua outbox của open-pos-backend).
- **Không được:** đổi logic bán / sổ (I-0); ghi nhận trước bàn giao; tự gọi Kế Toán (đi qua bridge hoặc module `pos` như hiện nay).
- **Phase đề xuất:** `PHASE-002-BAN-GIAO-VAN-CHUYEN-DON-CHO`.
- **Việc:** LD-OP-1 danh sách đơn đã xác nhận ở quầy để soạn / đóng gói (mockup trước) · LD-OP-2 **Bàn giao**: nhập hãng + mã vận đơn + COD (hoặc "khách lấy tại quầy") ⇒ legacy: gọi trình tạo đơn hiện có (`class-tgs-pos-order-handler.php`) với `source_type` CRM; React: `pos.order.create` (LD-KT-5) · LD-OP-3 giao xong / hoàn ⇒ dùng đường trả hàng có sẵn (`sale_return`) · LD-OP-4 trạng thái giao trên đơn + phát sự kiện.
- **Xong khi:** một đơn chờ đi hết `confirmed → shipped → delivered` trên cả hai engine; phiếu bán sinh ra giống hệt bán tại quầy (cùng loại, cùng trường), chỉ khác nguồn.

## open-ketoan-bridge — kênh, không làm chủ

- **Vai:** chở phiếu bán đã ghi nhận về Kế Toán, mang theo nguồn gốc.
- **Phase đề xuất:** `PHASE-002-DOC-REF-VA-IDEMPOTENCY`.
- **Việc:** LD-BR-1 gửi header `Idempotency-Key = <docKey>@<version>` (đang khai trong manifest, chưa có mã) · LD-BR-2 phiếu bán có nguồn đơn chờ mang `links` (`pos.order:<id>` role `source`) · LD-BR-3 lưu kết quả `posted | pending | error` theo `docKey` để open-pos-backend chạy RC-ORDER-2.
- **Không được:** nhận đơn từ app khác; phục vụ đọc tồn cho app khác.
- **Xong khi:** gửi lại một lô ⇒ Kế Toán trả `unchanged`; phiếu từ đơn CRM tra được ngược về `cake.order_request` qua `document_links`.

## open-cake — CRM bản web

- **Vai:** chủ khách và **yêu cầu đặt hàng**; đọc tồn để tư vấn; gửi đơn; hiện trạng thái đơn trong Contact 360. Tự đứng: tắt Kế Toán / POS ⇒ vẫn ghi yêu cầu, chỉ không gửi được.
- **Phase:** dùng **PHASE-010** đã có (S010-1, S010-4 → chuyển sang open-pos-backend, S010-5, S010-6); thêm việc dưới vào CHECKLIST của PHASE-010.
- **Việc:** LD-CAKE-1 (= S010-1) chứng từ `cake.order_request` (nháp → đã gửi → trạng thái theo POS), không nộp sổ · LD-CAKE-2 đọc tồn qua `bizcity_stock_read@1` (đệm 60 giây, giả lập cho máy dev) trong ô chọn hàng / gửi giá ở chat (mockup trước) · LD-CAKE-3 gửi đơn: outbox gửi sau, `Idempotency-Key = doc_ref@version`, cấu hình kết nối POS theo đơn vị (URL, khoá `opb_…`, bí mật webhook) ở Cài đặt; chỉ bật khi `catalog_source=ketoan` (Q-ORD-6) · LD-CAKE-4 (= S010-5) nhận sự kiện POS ở cổng ký HMAC ⇒ touch `kind=document` · LD-CAKE-5 RC-ORDER-1 + (= S010-6) RC-ORDER-3.
- **Không được:** ghi tồn; tạo đơn bán / phiếu kế toán; gửi `contact_id` sang POS.

## open-crm — CRM bản WordPress

- **Vai:** như open-cake, cùng hợp đồng, CSDL riêng.
- **Phase đề xuất:** ghi ở repo khi `docs/` được theo dõi trong git; trước đó việc theo dõi tại [CHECKLIST.md](CHECKLIST.md) của phase này.
- **Việc:** LD-CRM-1 adapter `open_pos` cho `BizCity_CRM_Order_Adapter_Interface` (`search_products` ⇒ `bizcity_stock_read@1`; `create_order` ⇒ `bizcity_order_request@1`; `list_orders_for_contact` ⇒ GET trạng thái) · LD-CRM-2 cổng webhook nhận sự kiện POS ⇒ `bizcity_ocrm_events` (duy nhất `(source, doc_key)`) · LD-CRM-3 bỏ `crm_products.stock_qty` nhập tay khi đơn vị đã nối Kế Toán (chỉ hiện tồn đọc được).

## Không có việc trong phase này

open-hub-core, open-hub-client (không định tuyến giữa app) · open-setup (đã cấp `tenant` slug chung) · twin-brain (sau: đọc tồn qua `kt_stock`, tạo **nháp** yêu cầu đặt hàng qua MCP của CRM, không tự gửi POS).
