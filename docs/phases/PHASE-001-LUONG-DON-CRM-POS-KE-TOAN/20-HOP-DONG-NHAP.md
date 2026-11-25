# PHASE-001 · 20 — Hợp đồng nháp: đọc tồn, đơn chờ, trạng thái

<!-- [2026-11-25 05:33 PM Johnny Chu - Chu Hoàng Anh] ORDER-1 — hình trên dây của hai hợp đồng mới. Bản nháp để chủ chốt Q-ORD; sau khi chốt chuyển thành docs/standard/BIZCITY-ORDER-FLOW-v1.md + schema packages/contracts/schema/order/ + vector (việc LD-PLAT-1/2, R-PLAT-7). -->

> Quy ước chung: phong bì `{ ok, data, meta }` / `{ ok:false, error:{ code, message, requestId, traceId?, details } }` (`bizcity_api@1`); ID theo [`bizcity_spine@1`](../../standard/BIZCITY-SPINE-v1.md) §2–3; mọi lời gọi mang `traceparent` ([OBSERVABILITY](../../standard/BIZCITY-OBSERVABILITY-v1.md) R-STD-OBS-1). **Không** nhận `tenantId` / `siteId` trong thân: đơn vị suy từ khoá.

## 1. `bizcity_stock_read@1` — đọc tồn (chủ: open-ketoan)

```http
GET /api/v1/inventory/availability?branchCode=Q3&itemIds=01JD…,01JE…   (hoặc &skus=SP-0042,SP-0043; ≤ 100 mã)
X-Api-Key: kt_…            (scope stock:read — mới, chỉ đọc, risk: read)
```

```json
{ "ok": true,
  "data": [{
    "item": { "id": "01JD8K2Q4F3M9R7X5T1V0W6Y8Z", "code": "SP-0042" },
    "branchCode": "Q3", "uom": "Cái",
    "onHand": 5, "pendingOut": 1, "held": 0, "available": 4
  }],
  "meta": { "asOf": "2026-11-25T10:31:02Z", "tenant": "hoa-mai" } }
```

| Luật | Nội dung |
|---|---|
| ST-1 | `onHand` = tồn đã ghi sổ (`stock_on_hand`) theo **ĐVT gốc** của mặt hàng; `pendingOut` = phiếu xuất / bán đã nhận nhưng chưa ghi sổ; `held` = đang giữ (kho giữ BH20; 0 khi chưa có); `available = onHand − pendingOut − held`, có thể âm |
| ST-2 | Mã lạ / mặt hàng ngừng ⇒ dòng có `"error": "IN-ITEM-003|IN-ITEM-008"`, không làm hỏng cả lô |
| ST-3 | Bên đọc đệm ≤ 60 giây theo `(tenant, branchCode, item)` (R-CACHE); **không lưu làm sự thật**, không ghi vào danh mục của mình |
| ST-4 | Không trả giá vốn, không trả số theo kho con khi chưa có trục kho (SPINE Q-SPINE-2) |
| ST-5 | MCP `kt_stock` (Twin Brain) gọi đúng hàm này, cùng scope |

## 2. `bizcity_order_request@1` — đơn chờ (bên nhận: open-pos-backend; bên gửi: CRM)

### 2.1 Gửi / sửa

```http
POST /wp-json/open-pos/v1/order-requests
Authorization: Bearer opb_…          (khoá app do open-pos-backend cấp theo blog, scope order_request:write)
Idempotency-Key: cake.order_request:01JF…@1
Bizcity-Signature: t=1795601000,v1=<HMAC-SHA256(secret, t + "." + body)>
traceparent: 00-…
```

```json
{
  "docRef": "cake.order_request:01JF3X…",
  "version": 1,
  "tenant": "hoa-mai",
  "branchCode": "Q3",
  "channel": "zalo",
  "customer": {
    "partner": { "code": "0909123456" },
    "identity": { "kind": "phone", "value": "sha256:9f2c…", "proof": "otp" },
    "name": "Chị Lan",
    "shipTo": { "name": "Chị Lan", "phone": "0909123456", "address": "12 Lê Lợi, P. Bến Nghé, Q.1, TP.HCM" }
  },
  "lines": [
    { "line": 1, "item": { "id": "01JD8K2Q…", "code": "SP-0042" }, "uom": "Cái", "qty": 2, "proposedPrice": 450000, "note": "size M" }
  ],
  "payment": { "method": "cod", "prepaid": 0 },
  "shipping": { "method": "carrier", "preferredCarrier": "GHTK" },
  "note": "giao giờ hành chính",
  "createdBy": { "sub": "wp:42" },
  "stockSeen": { "asOf": "2026-11-25T10:31:02Z", "available": { "01JD8K2Q…": 4 } }
}
```

Trả `202`:

```json
{ "ok": true, "data": { "status": "pending", "posRef": "pos.order_request:7731", "expiresAt": "2026-11-28T10:31:05Z" } }
```

| Luật | Nội dung |
|---|---|
| OR-1 | Cùng `Idempotency-Key` + cùng thân ⇒ trả lại kết quả cũ; cùng khoá khác thân ⇒ `409 IDEMPOTENCY_CONFLICT` |
| OR-2 | `version` cao hơn khi đơn còn `pending` ⇒ thay nội dung, giữ `posRef`; đơn đã `confirmed` trở đi ⇒ `409 ORD-LOCKED` |
| OR-3 | Dòng hàng: tra `item.id` trước, `item.code` (SKU có hiệu lực) sau; không khớp ⇒ `422 ORD-ITEM-UNKNOWN` kèm `details.lines`, **không tự tạo hàng**; `uom` không khai cho mặt hàng ⇒ `IN-ITEM-003` |
| OR-4 | `branchCode` không thuộc blog của khoá ⇒ `403 ORD-BRANCH-FORBIDDEN` |
| OR-5 | Khách: POS tra / tạo người mua theo `partner.code` (SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE`, SPINE §2); **không** nhận `contact_id` |
| OR-6 | `proposedPrice` chỉ là đề nghị (L-5); `stockSeen` để nhân viên thấy CRM đã nhìn số nào |
| OR-7 | PII (`customer.*`) không vào log, không vào span (R-LOG-4) |

### 2.2 Huỷ từ CRM

```http
POST /wp-json/open-pos/v1/order-requests/cancel        { "docRef": "cake.order_request:01JF3X…", "reason": "khách đổi ý" }
```

Chỉ khi `pending` ⇒ `cancelled`; đã `confirmed` ⇒ `409 ORD-LOCKED` (huỷ ở POS).

### 2.3 Đọc trạng thái (đối chiếu, gửi lại)

```http
GET /wp-json/open-pos/v1/order-requests?docRefs=cake.order_request:01JF…,…     ⇒ [{ docRef, version, status, posRef, orderRef?, shipments[], updatedAt }]
```

## 3. Máy trạng thái (một nguồn: POS)

```text
pending ──xác nhận──▶ confirmed ──bàn giao──▶ shipped ──▶ delivered
   │ │                    │                    │
   │ └─quá hạn─▶ expired   └─huỷ ở POS─▶ cancelled └──hoàn──▶ returned (sale_return)
   └─từ chối─▶ rejected (lý do)  ·  CRM huỷ khi pending ─▶ cancelled
```

| Trạng thái | Chứng từ kế toán | `doc_ref` sinh ra |
|---|---|---|
| `pending`, `rejected`, `expired`, `cancelled` (trước bàn giao) | **không có** | `pos.order_request:<id>` |
| `confirmed` | không có | + `pos.order:<id>` (`document_links` role `source` → `cake.order_request`) |
| `shipped` (**ghi nhận**) | phiếu bán + xuất ⇒ `sale` vào Kế Toán | + `pos.shipment:<id>`; `bizcity.ledger.event:btsoft:<blog>:sale:<id>` (role `posting`) |
| `delivered` | thu COD ⇒ `customer_payment` khi tiền về | — |
| `returned` | `sale_return` có `originalDocKey` | — |

## 4. Sự kiện POS → CRM (`bizcity_event@1`, webhook ký HMAC, `Idempotency-Key` = id sự kiện)

| Sự kiện | `data` (ngoài `docRef`, `posRef`, `version`) |
|---|---|
| `pos.order_request.received` | `expiresAt` |
| `pos.order_request.rejected` | `reasonCode` (`ORD-OUT-OF-STOCK`, `ORD-PRICE`, `ORD-ADDRESS`, `ORD-OTHER`), `reason` |
| `pos.order_request.expired` | — |
| `pos.order.confirmed` | `orderRef`, `lines[{ line, qty, price }]` (số cuối), `total` |
| `pos.order.shipped` | `shipmentRef`, `carrier`, `waybill`, `codAmount`, `ledgerDocKey` |
| `pos.order.delivered` | `shipmentRef`, `deliveredAt` |
| `pos.order.returned` | `shipmentRef`, `returnDocKey` |
| `pos.order.cancelled` | `stage` (`pending|confirmed`), `reason` |

CRM nhận ⇒ ghi touch `kind=document`, `dims.doc_ref` (open-cake `bizcity_touch@1`) hoặc `bizcity_ocrm_events` (open-crm); nhận lặp không nhân đôi. Thứ tự không bảo đảm ⇒ bên nhận so `version` / thời điểm, không lùi trạng thái.

## 5. Đối chiếu có mã

| Mã | Phép | Chạy ở |
|---|---|---|
| RC-ORDER-1 | mọi `cake.order_request` đã gửi > 15 phút có trạng thái ở POS (gọi §2.3) — thiếu ⇒ gửi lại cùng khoá | CRM |
| RC-ORDER-2 | mọi `pos.order` `shipped` có chứng từ `sale` ở Kế Toán (`posted` hoặc `pending`) sau ≤ 24 giờ | open-pos-backend (qua bridge) |
| RC-ORDER-3 | ba chiều: `cake.order_request` ⇄ `pos.order` ⇄ `sale` + thu tiền — lệch ⇒ finding `CAKE-DOC-*` (open-cake S010-6), không tự sửa bên nào | open-cake / Twin Brain |

## 6. Mã lỗi mới (đăng ký vào `bizcity_errors@1` khi chuẩn hoá)

`ORD-LOCKED` 409 · `ORD-ITEM-UNKNOWN` 422 · `ORD-BRANCH-FORBIDDEN` 403 · `ORD-EXPIRED` 409 · `ORD-OUT-OF-STOCK` (lý do từ chối, không phải lỗi HTTP) · `ORD-PRICE` · `ORD-ADDRESS`.
