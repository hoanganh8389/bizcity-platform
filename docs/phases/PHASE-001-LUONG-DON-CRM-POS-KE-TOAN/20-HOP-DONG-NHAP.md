# PHASE-001 · 20 — Hợp đồng nháp (đã chuyển thành chuẩn)

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — bản nháp hợp đồng. -->
<!-- [2026-11-25 06:00 PM Johnny Chu - Chu Hoàng Anh] ORDER-2 — chủ chốt Q-ORD-1..8; toàn bộ nội dung chuyển vào chuẩn, tệp này chỉ còn trỏ để liên kết cũ không gãy. -->

Hình trên dây, luật, máy trạng thái, sự kiện, đối chiếu và mã lỗi nay ở **một nguồn**: [`docs/standard/BIZCITY-ORDER-FLOW-v1.md`](../../standard/BIZCITY-ORDER-FLOW-v1.md) (`bizcity_order_flow@1`), schema [`order-flow.schema.json`](../../../schema/order/order-flow.schema.json), kiểm `node tools/order-flow-check.mjs`.

Khác bản nháp: mã luật R-STD-ORD-1..19; `tenant` trong thân chỉ để đối chiếu với khoá (`ORD-TENANT-MISMATCH`); thân có `tenantId` / `siteId` / `contactId` ⇒ 400; `identity.value` là băm `sha256:`; `docRef` nhận `cake.order_request:` và `ocrm.order_request:`.
