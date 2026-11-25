# PHASE-001 — Luồng đơn xuyên app: CRM đọc tồn Kế Toán → đơn chờ ở POS → xác nhận → giao vận chuyển → ghi nhận

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — phase xuyên repo đầu tiên của bizcity-platform. Chủ chỉ đạo 2026-11-25: "open-cake và open-crm là một module, hoạt động standalone nhưng có thể kết hợp để lấy tồn kho từ open-ketoan là source of truth về tồn kho theo từng tenant id ra để tạo đơn, rồi đẩy đơn về open-pos, open-pos-backend theo luật đơn chờ; open-pos xác nhận đơn ok, tạo đơn, đẩy đơn cho ship thì mới thực sự ghi nhận… chi tiết giao cho repo từng phase cụ thể, mỗi repo đều hiểu mối quan hệ với repo khác". -->

> **Áp dụng cho:** open-ketoan · open-pos · open-pos-backend · open-ketoan-bridge · open-cake · open-crm · bizcity-platform
> **Trạng thái:** ◐ — chủ chốt Q-ORD-1..8 ngày 2026-11-25; chuẩn [`bizcity_order_flow@1`](../../standard/BIZCITY-ORDER-FLOW-v1.md) + schema + bộ kiểm đã có (W1 phần platform); chờ các repo giữ chỗ phase <!-- [2026-11-25 06:00 PM Johnny Chu - Chu Hoàng Anh] ORDER-2 -->
> **Trạng thái từng việc:** [CHECKLIST.md](CHECKLIST.md) (nguồn của bảng việc) · **Giao việc theo repo:** [30-GIAO-VIEC-THEO-REPO.md](30-GIAO-VIEC-THEO-REPO.md)
> **Hiện trạng có dẫn chứng:** [10-HIEN-TRANG.md](10-HIEN-TRANG.md) · **Hợp đồng:** chuẩn [BIZCITY-ORDER-FLOW-v1](../../standard/BIZCITY-ORDER-FLOW-v1.md) (bản nháp ở 20-HOP-DONG-NHAP đã chuyển vào chuẩn)
> **Đứng trên:** [`bizcity_spine@1`](../../standard/BIZCITY-SPINE-v1.md) (định danh, `doc_ref`, gửi sau, đối chiếu) · [ARCHITECTURE §4](../../ARCHITECTURE.md) (chuỗi vàng `cake.order_request` → `pos.order` → `bizcity.ledger.event`)

## 0. Một câu

**Khách chốt trong chat ⇒ CRM tạo đơn dựa trên tồn thật của Kế Toán ⇒ đơn nằm ở POS dưới dạng "đơn chờ" ⇒ cửa hàng xác nhận, đóng gói, bàn giao vận chuyển ⇒ lúc bàn giao mới ghi nhận bán (xuất kho, doanh thu) và chứng từ chảy về Kế Toán — mỗi app chỉ ghi phần mình làm chủ, nối nhau bằng `doc_ref`.**

## 1. Ai làm chủ cái gì trong luồng

| Thứ | Chủ | Người khác giữ | Ghi chú |
|---|---|---|---|
| Tồn kho (số lượng theo `item_id` × `branch_code` × kho) | **open-ketoan** | CRM chỉ **đọc**, không lưu làm sự thật (đệm ≤ 60 giây) | tồn chỉ đổi khi chứng từ được **ghi sổ**, không đổi khi nhận |
| Khách (`contact_id`), hội thoại, **yêu cầu đặt hàng** `cake.order_request` | **open-cake** (bản WordPress: open-crm) | POS mang **danh tính có bằng chứng** (SĐT) + `doc_ref` của CRM | yêu cầu đặt hàng **không** phải chứng từ kế toán, không nộp sổ |
| **Đơn chờ** + **đơn bán** + **giao hàng** (`pos.order_request`, `pos.order`, `pos.shipment`) | **open-pos-backend / open-pos** | CRM nghe sự kiện, ghi touch `kind=document` | luật đơn chờ là luật của POS (§3) |
| Chứng từ kế toán, bút toán (`bizcity.ledger.event:<docKey>`) | **open-ketoan** | POS gửi qua bridge (gửi sau) | app ngoài kể sự việc, Kế Toán định khoản |
| Mặt hàng, ĐVT, chi nhánh, đối tượng công nợ | **open-ketoan** | bản sao ở POS (tsm) và CRM (`catalog_source=ketoan`) | dòng đơn gửi `item {id}` lấy từ bản sao, hoặc `{code}` |

Không có "mã đơn gốc" đi xuyên app (SPINE §8): mỗi app phát `doc_ref` của mình, nối bằng `document_links (from, to, role)`.

## 2. Luồng vàng

```text
 open-cake / open-crm                open-pos-backend · open-pos                 open-ketoan-bridge        open-ketoan
 ───────────────────                 ───────────────────────────                 ──────────────────        ───────────
 ① đọc tồn  ───────────────────────────────────────────────────────────────────────────────────────────▶ GET /inventory/availability
    (item_id × branch_code, as_of)                                                                        (bizcity_stock_read@1)
 ② tạo cake.order_request:01J…  (nháp → đã gửi)
 ③ gửi ─── POST order-requests ──▶ ④ nhận vào hàng ĐƠN CHỜ
    (bizcity_order_request@1,         pos.order_request:…  status=pending
     Idempotency-Key=doc_ref@ver)     ◀── 202 {pos_ref}
                                   ⑤ nhân viên XÁC NHẬN (kiểm lại tồn, giá) ⇒ pos.order:8812 (confirmed)
 ⑦ touch kind=document  ◀── sự kiện pos.order.confirmed / rejected (webhook ký HMAC)
                                   ⑥ đóng gói, BÀN GIAO VẬN CHUYỂN (hãng + mã vận đơn)
                                      ⇒ GHI NHẬN: phiếu bán + phiếu xuất duyệt ở POS ─▶ ⑧ gửi sau ─▶ POST /documents (sale)
                                         pos.order: shipped                              docKey btsoft:<blog>:sale:<id>   ⇒ ghi sổ ⇒ tồn giảm
 ⑨ touch                ◀── pos.order.shipped {waybill, ledger_doc_key}
                                   ⑩ giao xong / hoàn  ─▶ pos.order.delivered | returned (hoàn ⇒ sale_return)
 ⑪ đối chiếu 3 chiều (RC-ORDER-*): order_request ⇄ pos.order ⇄ chứng từ Kế Toán
```

**Ghi nhận** = bước ⑥: trước bàn giao, đơn chỉ là cam kết (không xuất kho, không doanh thu, không gửi Kế Toán). Huỷ trước ⑥ không sinh chứng từ đảo nào.

## 3. Luật đơn chờ (đề xuất, chốt ở Q-ORD-1..4)

Dựng trên luật **đang có** của open-pos-backend: phiếu bán từ nguồn khác quầy (`source_type ≠ POS`) nằm ở `local_ledger_status = PENDING (1)` chờ duyệt, không tự duyệt (`functions/api/class-tgs-api-sales.php:355,766`); chỉ phiếu đã duyệt (`approver_status = 1`) mới được bridge gửi đi (`open-ketoan-bridge/includes/class-tgs-acc-source.php:134`).

| # | Luật |
|---|---|
| L-1 | Đơn từ app ngoài **luôn** vào hàng đơn chờ; không app ngoài nào tạo thẳng đơn bán / phiếu xuất ở POS |
| L-2 | Một `doc_ref@version` chỉ tạo **một** đơn chờ (nhận lặp trả lại kết quả cũ); version mới hơn chỉ sửa được khi đơn còn `pending`, đã xác nhận ⇒ `409 ORD-LOCKED` |
| L-3 | Xác nhận = kiểm lại **tồn tại chi nhánh** và **giá hiện hành** của POS; thiếu hàng ⇒ không xác nhận được (cùng luật chặn bán vượt tồn NT-BH-021), nhân viên sửa số lượng / từ chối có lý do |
| L-4 | Đơn chờ quá hạn (mặc định 72 giờ, cài đặt theo blog) ⇒ tự `expired`, báo CRM |
| L-5 | Giá trên đơn của CRM là **giá đề nghị**; giá ghi nhận là giá POS lúc xác nhận; lệch ⇒ hiện cho nhân viên, sự kiện gửi CRM mang giá cuối |
| L-6 | Ghi nhận **chỉ** ở bước bàn giao vận chuyển (hoặc khách lấy tại quầy); một đơn có thể giao nhiều lần (mỗi lần một phiếu bán) |
| L-7 | Huỷ sau ghi nhận = chứng từ đảo (`sale_return` có `originalDocKey`), không sửa phiếu cũ |

## 4. Hợp đồng (chi tiết: chuẩn [BIZCITY-ORDER-FLOW-v1](../../standard/BIZCITY-ORDER-FLOW-v1.md))

| Hợp đồng | Chủ | Bên gọi / nghe | Mới hay có |
|---|---|---|---|
| `bizcity_stock_read@1` — đọc tồn theo `item_id` / `sku` × `branch_code`, `as_of`, scope `stock:read` | open-ketoan | open-cake, open-crm (sau: Twin Brain MCP `kt_stock`) | **mới** (thay route báo cáo `reports:read` đang có) |
| `bizcity_order_request@1` — gửi / sửa / huỷ đơn chờ + 8 sự kiện trạng thái | open-pos-backend (bên nhận) | open-cake, open-crm (bên gửi) | **mới** |
| `bizcity_ledger_intake@1` — phiếu bán vào Kế Toán | open-ketoan | bridge (legacy), module `pos` (React) | **có**; thêm `links` về `pos.order` |
| `bizcity_event@1` — phong bì sự kiện, ký `Bizcity-Signature` | open-ketoan (định nghĩa) | mọi app | **có** |
| `bizcity_spine@1` — `doc_ref`, `*Ref`, gửi sau, đối chiếu | bizcity-platform | mọi app | **có** |

Đường truyền: REST app → app trực tiếp theo hợp đồng + webhook ký HMAC (R-CANON-4). **Không** qua Hub: open-hub-core chỉ là sổ hub / khoá 1API, không định tuyến (xem 10-HIEN-TRANG §6).

## 5. Quyết định của chủ (chốt 2026-11-25 — "duyệt tiếp", theo đúng cột đề xuất)

| # | Câu hỏi | Đã chốt |
|---|---|---|
| Q-ORD-1 | Đơn chờ nằm ở đâu? (a) open-pos-backend — hàng đơn chờ của blog; (b) module `phieu-ban` "Đơn đặt hàng BH20" của open-ketoan (đã có giữ hàng, giao nhiều lần, hãng vận chuyển, COD) | **(a)** — đúng chỉ đạo và giữ "POS tự đứng" (ADR-0001 §5); BH20 vẫn là đơn của chính kế toán, không dùng làm cửa nhận của CRM |
| Q-ORD-2 | Giữ hàng khi đơn đang chờ? (a) không giữ, kiểm lại lúc xác nhận; (b) giữ mềm ở POS, CRM thấy "đang chờ giao"; (c) giữ cứng ở Kế Toán (chuyển sang kho giữ như BH20) | **(a) ở đợt 1**, (b) ở đợt 2 khi có số liệu bán hụt; (c) quá nặng cho đơn chưa chắc chắn |
| Q-ORD-3 | Mốc ghi nhận: bàn giao vận chuyển (có mã vận đơn) hay khi giao thành công? | **bàn giao vận chuyển** (đúng chỉ đạo "đẩy cho ship thì mới ghi nhận"); giao thất bại ⇒ hàng hoàn = `sale_return` |
| Q-ORD-4 | Vận chuyển: tích hợp API hãng (GHN, GHTK…) ngay hay nhập tay hãng + mã vận đơn? | **nhập tay ở đợt 1** (POS hiện chưa có tích hợp hãng nào); connector hãng là phase sau, dùng chung cho POS và Kế Toán |
| Q-ORD-5 | Ai xác nhận: màn quản trị open-pos-backend hay màn quầy open-pos? | **open-pos-backend** nhận + duyệt (đã có duyệt phiếu); **open-pos** hiện đơn đã xác nhận ở quầy để đóng gói / bàn giao |
| Q-ORD-6 | CRM chạy danh mục cục bộ (`catalog_source=local`) có được gửi đơn không? | **Không**: bật "Gửi đơn sang POS" đòi đơn vị đã nối Kế Toán (`catalog_source=ketoan`, cùng `tenant` slug); CRM tự đứng vẫn tạo yêu cầu đặt hàng nội bộ |
| Q-ORD-7 | Khoá gọi POS: khoá app riêng do open-pos-backend cấp theo blog (`opb_…`, băm, scope `order_request:write`) hay dùng chung khoá cài đặt của Kế Toán? | **khoá riêng của POS** (R-STD-KEY-2: không dùng khoá loại này thay loại kia); sự kiện ngược về CRM ký HMAC bằng bí mật cặp |
| Q-ORD-8 | Shop chạy engine React (bán qua module `pos` của Kế Toán): đơn chờ vẫn ở WordPress? | **có** — cửa nhận chung ở open-pos-backend; lúc bàn giao, shop React tạo đơn bằng `pos.order.create` (Idempotency-Key = `doc_ref` đơn chờ), shop legacy ghi `local_ledger` như cũ |

## 6. Đợt làm

| Đợt | Việc | Repo | Gỡ chặn cho |
|---|---|---|---|
| W0 | Chủ chốt Q-ORD-1..8; mỗi repo giữ chỗ phase theo [30-GIAO-VIEC](30-GIAO-VIEC-THEO-REPO.md) | chủ + mọi repo | tất cả |
| W1 | Chuẩn `BIZCITY-ORDER-FLOW-v1.md` + schema + vector; Kế Toán mở `stock:read` + `/inventory/availability` | bizcity-platform · open-ketoan | W2 |
| W2 | open-pos-backend nhận đơn chờ (khoá, cửa nhận, hàng chờ, màn duyệt, sự kiện); CRM đọc tồn + gửi đơn (chạy trước trên vector + giả lập) | open-pos-backend · open-cake · open-crm | W3 |
| W3 | open-pos bàn giao vận chuyển + ghi nhận; bridge mang `links` + `Idempotency-Key`; React tạo đơn qua `pos.order.create` | open-pos · open-ketoan-bridge · open-ketoan | W4 |
| W4 | Sự kiện về CRM ⇒ Contact 360; đối chiếu RC-ORDER-1..3; phiếu nghiệm thu đầu-cuối NT-LD-001 chạy trên Shop Hoa Mai | mọi repo | đóng phase |

## 7. Xong khi

Kịch bản vàng (Shop Hoa Mai, chi nhánh `Q3`) chạy thật trên bản thử, ghi bằng chứng ở mỗi repo:

1. Khách nhắn Zalo hỏi "váy hoa đỏ size M"; nhân viên CRM thấy **tồn 5 tại Q3 (as_of …)** lấy từ Kế Toán.
2. Tạo yêu cầu đặt 2 cái, COD, địa chỉ giao ⇒ `cake.order_request:01J…` ⇒ POS báo nhận (`pos.order_request:…`).
3. Gửi lặp cùng khoá ⇒ không sinh đơn thứ hai.
4. Nhân viên POS xác nhận ⇒ CRM thấy "Đã xác nhận" trong Contact 360.
5. Bàn giao GHTK, mã vận đơn ⇒ POS ghi phiếu bán + xuất ⇒ Kế Toán nhận `sale` (`document_links` về `pos.order`) ⇒ sau khi ghi sổ, tồn Q3 còn 3.
6. Một đơn khác bị từ chối / quá hạn ⇒ không chứng từ kế toán nào; CRM thấy lý do.
7. Đối chiếu RC-ORDER-1..3 ra 0 lệch; tắt Kế Toán giữa chừng ⇒ POS vẫn bán và xác nhận, phiếu gửi sau khi nối lại.

## 8. Rủi ro

| Rủi ro | Giảm |
|---|---|
| Bán hụt: CRM thấy tồn, POS xác nhận thì hết (chưa giữ hàng) | L-3 kiểm lại lúc xác nhận; số liệu từ chối vì hết hàng quyết định khi nào làm Q-ORD-2 (b) |
| Tồn Kế Toán trễ so với thực tế vì phiếu còn `pending` chờ kế toán ghi sổ | `bizcity_stock_read@1` trả kèm `pending_out` (phiếu đã nhận chưa ghi sổ) để CRM hiện "có thể bán" thận trọng |
| Lệch mã hàng giữa CRM và POS | đơn gửi `item {id}` lấy từ bản sao Kế Toán; POS tra theo `item_id` trước, SKU sau; không khớp ⇒ từ chối dòng `ORD-ITEM-UNKNOWN`, không tự tạo hàng (R-SPINE-2) |
| Hai bản CRM (open-cake, open-crm) làm lệch hợp đồng | cùng schema + vector của bizcity-platform; công cụ kiểm hợp đồng chạy trên cả hai |
| Khoá / bí mật lộ | khoá băm, hiện một lần, scope hẹp, không quyền rủi ro cao (R-STD-KEY-1..3); thân đơn có PII ⇒ log che (R-LOG-4) |
