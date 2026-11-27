# PHASE-001-LUONG-DON-CRM-POS-KE-TOAN — checklist

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — nguồn trạng thái từng việc (bảng việc docs/phases/BANG-VIEC.md sinh từ đây). Mô tả việc ở 30-GIAO-VIEC-THEO-REPO.md. Repo làm việc cập nhật ô trạng thái bằng PR vào đây kèm đường dẫn bằng chứng. -->

> Ký hiệu: ☐ chưa làm · ◐ đang làm · ☑ xong (có bằng chứng) · ⛔ bị chặn. Sinh lại bảng việc: `node tools/bang-viec.mjs --repo . --write`.

| Mã | Repo | Việc | Đợt | Trạng thái |
|---|---|---|---|---|
| LD-0 | chủ | chốt Q-ORD-1..8 (README §5) | W0 | ☑ |
| LD-PLAT-0 | bizcity-platform | nghiên cứu hiện trạng 6 repo + thiết kế luồng, hợp đồng nháp, giao việc (tệp 10, 20, 30) | W0 | ☑ |
| LD-PLAT-1 | bizcity-platform | chuẩn `BIZCITY-ORDER-FLOW-v1.md` + `standards.json` + bản đồ + CHANGELOG | W1 | ☑ |
| LD-PLAT-2 | bizcity-platform | schema `schema/order/` + vector tốt / xấu | W1 | ☑ |
| LD-PLAT-3 | bizcity-platform | `tools/order-flow-check.mjs` (vector, chuẩn ↔ schema, hộp đen bên nhận / đọc tồn, tự thử) | W1 | ☑ |
| LD-PLAT-4 | bizcity-platform | phiếu nghiệm thu NT-LD-001 đầu-cuối + BAN-GIAO | W4 | ☐ |
| LD-KT-1 | open-ketoan | scope `stock:read` | W1 | ☐ |
| LD-KT-2 | open-ketoan | `GET /api/v1/inventory/availability` (onHand, pendingOut, held, available) | W1 | ☐ |
| LD-KT-3 | open-ketoan | MCP `kt_stock` | W2 | ☐ |
| LD-KT-4 | open-ketoan | phiếu bán lưu `links` về `pos.order` | W3 | ☐ |
| LD-KT-5 | open-ketoan | `pos.order.create` nhận nguồn đơn chờ (shop React) | W3 | ☐ |
| LD-OPB-1 | open-pos-backend | khoá app theo blog + cấu hình webhook CRM | W2 | ☐ |
| LD-OPB-2 | open-pos-backend | bảng đơn chờ + hộp chống lặp | W2 | ☐ |
| LD-OPB-3 | open-pos-backend | REST `open-pos/v1/order-requests` (POST, cancel, GET) | W2 | ☐ |
| LD-OPB-4 | open-pos-backend | màn Đơn chờ: xác nhận / từ chối (mockup trước) | W2 | ☐ |
| LD-OPB-5 | open-pos-backend | outbox + webhook sự kiện về CRM | W2 | ☐ |
| LD-OPB-6 | open-pos-backend | hết hạn đơn chờ | W2 | ☐ |
| LD-OPB-7 | open-pos-backend | đối chiếu RC-ORDER-2 | W4 | ☐ |
| LD-OP-1 | open-pos | danh sách đơn đã xác nhận ở quầy (mockup trước) | W3 | ☐ |
| LD-OP-2 | open-pos | bàn giao vận chuyển ⇒ ghi nhận bằng đường bán có sẵn (legacy + React) | W3 | ☐ |
| LD-OP-3 | open-pos | giao xong / hoàn hàng | W3 | ☐ |
| LD-OP-4 | open-pos | trạng thái giao + sự kiện shipped / delivered / returned | W3 | ☐ |
| LD-BR-1 | open-ketoan-bridge | header `Idempotency-Key` | W3 | ☐ |
| LD-BR-2 | open-ketoan-bridge | `links` nguồn đơn chờ trên phiếu bán | W3 | ☐ |
| LD-BR-3 | open-ketoan-bridge | lưu kết quả ghi sổ theo `docKey` cho RC-ORDER-2 | W3 | ☐ |
| LD-CAKE-1 | open-cake | `cake.order_request` (= S010-1) | W2 | ☐ |
| LD-CAKE-2 | open-cake | đọc tồn Kế Toán ở màn chọn hàng (mockup trước) | W2 | ☐ |
| LD-CAKE-3 | open-cake | gửi đơn sang POS (outbox, cấu hình kết nối) | W2 | ☐ |
| LD-CAKE-4 | open-cake | nhận sự kiện POS ⇒ Contact 360 (= S010-5) | W4 | ☐ |
| LD-CAKE-5 | open-cake | RC-ORDER-1 + RC-ORDER-3 (= S010-6) | W4 | ☐ |
| LD-CRM-1 | open-crm | adapter `open_pos` | W2 | ☐ |
| LD-CRM-2 | open-crm | webhook sự kiện POS ⇒ `bizcity_ocrm_events` | W4 | ☐ |
| LD-CRM-3 | open-crm | bỏ tồn nhập tay khi đã nối Kế Toán | W4 | ☐ |
