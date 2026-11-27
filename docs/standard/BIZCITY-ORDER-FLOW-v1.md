# `bizcity_order_flow@1` — Luồng đơn xuyên app: đọc tồn, đơn chờ, trạng thái

<!-- [2026-11-25 06:00 PM Johnny Chu - Chu Hoàng Anh] ORDER-2 — chuẩn hoá hợp đồng của PHASE-001 (luồng đơn CRM → đơn chờ POS → bàn giao vận chuyển → Kế Toán) sau khi chủ chốt Q-ORD-1..8 ngày 2026-11-25 ("duyệt tiếp"). Hai hợp đồng con: bizcity_stock_read@1 (chủ open-ketoan), bizcity_order_request@1 (bên nhận open-pos-backend, bên gửi open-cake / open-crm). -->

> **Phiên bản:** 1.0.0-draft · 2026-11-25 · **Trạng thái:** Nháp — thiết kế đã chốt (Q-ORD-1..8, §8); lên 1.0.0 khi open-pos-backend và một bản CRM chạy `order-flow-check` trên bản thử ĐẠT
> **Đứng trên:** [`bizcity_spine@1`](BIZCITY-SPINE-v1.md) (định danh, `*Ref`, `doc_ref`, gửi sau, đối chiếu) · `bizcity_event@1`, `bizcity_ledger_intake@1`, `bizcity_errors@1` (open-ketoan) · [API-PROFILE](BIZCITY-API-PROFILE-v1.md) · [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md)
> **Máy đọc:** [`order-flow.schema.json`](../../schema/order/order-flow.schema.json) + vector · **Kiểm:** `node tools/order-flow-check.mjs` (SC-ORD-1, 2) · hộp đen `--profile receiver | stock` (SC-ORD-3, 4) · `--self-test`
> **Thiết kế, hiện trạng, giao việc:** [PHASE-001](../phases/PHASE-001-LUONG-DON-CRM-POS-KE-TOAN/README.md)

## 0. Một câu

**CRM đọc tồn của Kế Toán để tư vấn, gửi yêu cầu đặt hàng sang POS làm đơn chờ; POS xác nhận rồi bàn giao vận chuyển — lúc đó mới ghi nhận bán và chứng từ chảy về Kế Toán; mỗi bước nối nhau bằng `doc_ref`, gửi lặp không nhân đôi, lệch thì đối chiếu có mã.**

## 1. Ai làm chủ

| Thứ | Chủ | `doc_ref` | Bên khác |
|---|---|---|---|
| tồn kho | open-ketoan | — | CRM chỉ đọc (§2), đệm ≤ 60 giây, không lưu làm sự thật |
| yêu cầu đặt hàng | CRM (open-cake / open-crm) | `cake.order_request:<ULID>` · `ocrm.order_request:<id>` | không phải chứng từ kế toán |
| đơn chờ, đơn bán, giao hàng | open-pos-backend + open-pos | `pos.order_request:<id>` · `pos.order:<id>` · `pos.shipment:<id>` | CRM nghe sự kiện (§5) |
| phiếu bán, bút toán | open-ketoan | `bizcity.ledger.event:<docKey>` | POS gửi qua bridge / module `pos` |

Liên kết: `pos.order` → yêu cầu đặt hàng (role `source`); phiếu bán Kế Toán → `pos.order` (role `source`). Không có mã đơn gốc chung (SPINE §8).

## 2. `bizcity_stock_read@1` — đọc tồn

`GET /api/v1/inventory/availability?branchCode=<mã>&itemIds=<id,…>` hoặc `&skus=<mã,…>` (≤ 100) · khoá `X-Api-Key` có scope **`stock:read`** (risk `read`). Trả `data[]` theo `$defs.stockRow`, `meta { asOf, tenant }`.

| Luật | Nội dung |
|---|---|
| R-STD-ORD-1 | `onHand` = tồn đã ghi sổ theo **ĐVT gốc**; `pendingOut` = phiếu xuất / bán đã nhận chưa ghi sổ; `held` = đang giữ (kho giữ Đơn đặt hàng); `available = onHand − pendingOut − held`, có thể âm |
| R-STD-ORD-2 | mã lạ / ngừng ⇒ dòng mang `error` (`IN-ITEM-003`, `IN-ITEM-008`), không hỏng cả lô; không trả giá vốn |
| R-STD-ORD-3 | bên đọc đệm ≤ 60 giây theo `(tenant, branchCode, item)`; không ghi số đọc được vào danh mục của mình (R-SPINE-5) |
| R-STD-ORD-4 | công cụ MCP `kt_stock` dùng đúng hàm này, cùng scope |

## 3. `bizcity_order_request@1` — đơn chờ

| Lời gọi | Đường | Thân / trả |
|---|---|---|
| gửi / sửa | `POST /wp-json/open-pos/v1/order-requests` | `$defs.orderRequest` ⇒ `202 { status, posRef, expiresAt }` (`$defs.accepted`) |
| huỷ (chỉ khi `pending`) | `POST /wp-json/open-pos/v1/order-requests/cancel` | `$defs.cancel` ⇒ `200 { status: "cancelled", posRef }` |
| đọc trạng thái | `GET /wp-json/open-pos/v1/order-requests?docRefs=<…>` | `data[]` theo `$defs.statusRow` |

Header mọi lời gọi: `Authorization: Bearer opb_…` (khoá app của blog, scope `order_request:write`) · `Idempotency-Key: <docRef>@<version>` (gửi / sửa) · `Bizcity-Signature: t=<unix>,v1=<hex HMAC-SHA256(bí mật, "<t>.<thân>")>`, lệch giờ ≤ 300 giây (cùng khuôn `bizcity_event@1` §7a) · `traceparent`.

| Luật | Nội dung |
|---|---|
| R-STD-ORD-5 | đơn từ app ngoài **luôn** vào hàng đơn chờ; không app ngoài nào tạo thẳng đơn bán / phiếu xuất ở POS |
| R-STD-ORD-6 | cùng `Idempotency-Key` + cùng thân ⇒ trả lại kết quả cũ (cùng `posRef`); cùng khoá khác thân ⇒ `409 IDEMPOTENCY_CONFLICT` |
| R-STD-ORD-7 | `version` cao hơn khi `pending` ⇒ thay nội dung, giữ `posRef`; từ `confirmed` trở đi ⇒ `409 ORD-LOCKED` |
| R-STD-ORD-8 | dòng hàng: tra `item.id` trước, `item.code` sau; không khớp ⇒ `422 ORD-ITEM-UNKNOWN` (`details.lines`), **không tự tạo hàng**; ĐVT lạ ⇒ `IN-ITEM-003` |
| R-STD-ORD-9 | `tenant` trong thân chỉ để **đối chiếu** với đơn vị của khoá (lệch ⇒ `403 ORD-TENANT-MISMATCH`); `branchCode` không thuộc blog ⇒ `403 ORD-BRANCH-FORBIDDEN`; thân có `tenantId` / `siteId` / `contactId` ⇒ `400` |
| R-STD-ORD-10 | khách: tra / tạo người mua theo `partner.code` (SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE`); **không** nhận `contact_id` |
| R-STD-ORD-11 | `proposedPrice` chỉ là đề nghị; giá ghi nhận là giá POS lúc xác nhận; lệch ⇒ hiện cho nhân viên, sự kiện mang giá cuối |
| R-STD-ORD-12 | chữ ký sai / quá giờ ⇒ `401`; khoá không có scope ⇒ `403`; PII (`customer.*`) không vào log, không vào span |

## 4. Đơn chờ và ghi nhận

```text
pending ──xác nhận──▶ confirmed ──bàn giao──▶ shipped ──▶ delivered
   │ │                    │                    │
   │ └─quá hạn─▶ expired   └─huỷ ở POS─▶ cancelled └──hoàn──▶ returned
   └─từ chối─▶ rejected  ·  CRM huỷ khi pending ─▶ cancelled
```

| Luật | Nội dung |
|---|---|
| R-STD-ORD-13 | xác nhận = kiểm lại tồn tại chi nhánh và giá hiện hành; thiếu hàng ⇒ không xác nhận được (sửa số lượng hoặc từ chối có lý do) |
| R-STD-ORD-14 | đơn chờ quá hạn (mặc định 72 giờ, cài theo blog) ⇒ `expired` |
| R-STD-ORD-15 | **ghi nhận chỉ ở bàn giao vận chuyển** (hoặc khách lấy tại quầy) bằng **đường bán đang có** của POS (legacy `local_ledger`, React `pos.order.create`); trước đó không xuất kho, không doanh thu, không gửi Kế Toán; huỷ trước bàn giao không sinh chứng từ đảo |
| R-STD-ORD-16 | một đơn giao nhiều lần ⇒ mỗi lần một phiếu bán; hoàn ⇒ `sale_return` có `originalDocKey`; COD thu về ⇒ `customer_payment` |
| R-STD-ORD-17 | đợt 1 **không giữ hàng** khi đơn chờ (Q-ORD-2); vận chuyển nhập tay hãng + mã vận đơn (Q-ORD-4) |

## 5. Sự kiện POS → CRM

Phong bì `bizcity_event@1`, webhook ký `Bizcity-Signature`, `Idempotency-Key` = id sự kiện; hình theo `$defs.event`.

| `type` | `data` thêm (ngoài `docRef`, `posRef`, `version`) |
|---|---|
| `pos.order_request.received` | `expiresAt` |
| `pos.order_request.rejected` | `reasonCode` (`ORD-OUT-OF-STOCK` · `ORD-PRICE` · `ORD-ADDRESS` · `ORD-OTHER`), `reason` |
| `pos.order_request.expired` | — |
| `pos.order.confirmed` | `orderRef`, `lines[{ line, qty, price }]`, `total` |
| `pos.order.shipped` | `shipmentRef`, `carrier`, `waybill`, `codAmount`, `ledgerDocKey` |
| `pos.order.delivered` | `shipmentRef`, `deliveredAt` |
| `pos.order.returned` | `shipmentRef`, `returnDocKey` |
| `pos.order.cancelled` | `stage` (`pending` · `confirmed`), `reason` |

| Luật | Nội dung |
|---|---|
| R-STD-ORD-18 | bên nhận chống lặp theo id sự kiện; thứ tự không bảo đảm ⇒ không lùi trạng thái (so `version`, thời điểm) |
| R-STD-ORD-19 | CRM ghi sự kiện thành dấu chạm `kind=document` (`dims.doc_ref`) hoặc hộp sự kiện của mình; không sao chép đơn |

## 6. Đối chiếu

| Mã | Phép | Chạy ở |
|---|---|---|
| RC-ORDER-1 | yêu cầu đã gửi > 15 phút phải có trạng thái ở POS (đọc §3); thiếu ⇒ gửi lại cùng khoá | CRM |
| RC-ORDER-2 | `pos.order` `shipped` có phiếu `sale` ở Kế Toán (`posted` / `pending`) sau ≤ 24 giờ | open-pos-backend |
| RC-ORDER-3 | ba chiều yêu cầu ⇄ `pos.order` ⇄ phiếu bán + thu tiền; lệch ⇒ finding, không tự sửa bên nào | CRM / Twin Brain |

## 7. Kiểm

| Mã | Lane | Kiểm | Công cụ |
|---|---|---|---|
| SC-ORD-1 | HOUSE | vector tốt qua, vector xấu bị chặn (không `tenantId`, `docRef` sai khuôn, `qty` ≤ 0, `item` rỗng, loại sự kiện lạ…) | `order-flow-check` |
| SC-ORD-2 | HOUSE | chuẩn ↔ schema khớp: loại sự kiện và trạng thái liệt kê ở §4–§5 trùng `enum` của schema | `order-flow-check` |
| SC-ORD-3 | CONTRACT | bên nhận đang chạy: chữ ký sai ⇒ 401; gửi ⇒ 202 `pending`; gửi lặp ⇒ cùng `posRef`; cùng khoá khác thân ⇒ 409; `version` mới ⇒ cùng `posRef`; mã lạ ⇒ 422 `ORD-ITEM-UNKNOWN`; thân có `tenantId` ⇒ 400; huỷ ⇒ `cancelled`; đọc trạng thái khớp | `--profile receiver --allow-write` (chỉ bản thử) |
| SC-ORD-4 | CONTRACT | Kế Toán đang chạy: thiếu khoá ⇒ 401; dòng tồn đúng `$defs.stockRow`, `available` = công thức R-STD-ORD-1 | `--profile stock` |

`--self-test` dựng trong tiến trình một bên nhận **đúng** và một bên nhận **sai** (không chống lặp, nhận `tenantId`): bộ kiểm phải ĐẠT với bên đúng và KHÔNG ĐẠT với bên sai.

## 8. Quyết định của chủ (2026-11-25)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q-ORD-1 | đơn chờ ở đâu | **open-pos-backend** (hàng đơn chờ của blog); Đơn đặt hàng BH20 của Kế Toán không làm cửa nhận của CRM |
| Q-ORD-2 | giữ hàng khi chờ | **không ở đợt 1**, kiểm lại lúc xác nhận; giữ mềm ở POS là đợt 2 khi có số liệu bán hụt |
| Q-ORD-3 | mốc ghi nhận | **bàn giao vận chuyển**; giao hỏng ⇒ hàng hoàn `sale_return` |
| Q-ORD-4 | vận chuyển | **nhập tay** hãng + mã vận đơn; connector hãng là phase sau |
| Q-ORD-5 | ai xác nhận | **open-pos-backend** nhận + duyệt; **open-pos** đóng gói, bàn giao |
| Q-ORD-6 | CRM danh mục cục bộ | gửi đơn chỉ bật khi đơn vị đã nối Kế Toán (`catalog_source=ketoan`, cùng `tenant`) |
| Q-ORD-7 | khoá gọi POS | **khoá riêng** `opb_…` do open-pos-backend cấp theo blog; sự kiện ngược ký HMAC bằng bí mật cặp |
| Q-ORD-8 | shop React | đơn chờ vẫn ở WordPress; lúc bàn giao tạo đơn qua `pos.order.create` (Idempotency-Key = `posRef`) |

## 9. Khoảng cách hiện tại

| Repo | Thiếu | Việc |
|---|---|---|
| open-ketoan | scope `stock:read`, `/inventory/availability`, MCP `kt_stock`, `links` trên phiếu bán | LD-KT-1..5 |
| open-pos-backend | khoá app, cửa nhận, hàng đơn chờ, màn duyệt, sự kiện | LD-OPB-1..7 |
| open-pos | bàn giao vận chuyển, trạng thái giao | LD-OP-1..4 |
| open-ketoan-bridge | gửi `Idempotency-Key`, `links` | LD-BR-1..3 |
| open-cake · open-crm | đọc tồn, gửi đơn, nhận sự kiện | LD-CAKE-1..5 · LD-CRM-1..3 |

## 10. Lịch sử

| Bản | Ngày | Đổi |
|---|---|---|
| 1.0.0-draft | 2026-11-25 | bản đầu từ PHASE-001 sau khi chủ chốt Q-ORD-1..8 |
