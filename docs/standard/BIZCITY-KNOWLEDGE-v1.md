# `bizcity_knowledge@1` — Công cụ tri thức chỉ đọc cho Twin Brain (context bank)

<!-- [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — hợp đồng thứ hai trong ba hợp đồng còn lại của bộ kiểm tương thích (open-hub DE-XUAT-BO-KIEM-TUONG-THICH §6). Là HỒ SƠ (profile) của chuẩn MCP chung (twin-brain docs/developer/contracts/BIZCITY-MCP-TOOL-CONTRACT-v1.md), không phải chuẩn riêng. -->

> **Phiên bản:** 1.0.0 · 2026-11-24 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-24 (Q-KNOW-1, 2) <!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 --> · **Thuộc:** `@bizcity/contracts` (gói nền chung)
> **Đứng dưới:** canon §5 (Twin Brain là lớp kiểm chứng và điều phối; R-CANON-2 não không là chủ dữ liệu; R-CANON-12 mọi hành động agent có bằng chứng), chuẩn MCP chung `bizcity-mcp-tool@1`, chuẩn xương sống [`bizcity_spine@1`](BIZCITY-SPINE-v1.md) §3 (ma trận: "Tri thức cho Twin Brain").
> **Máy đọc:** `packages/contracts/schema/spine/knowledge.schema.json`.

## 0. Một câu

**Mỗi app chủ công bố vài công cụ *đọc* cho não phân tích: chỉ `SELECT`, có `as_of`, thông tin nhạy cảm đã che, mọi con số dẫn về ID trục — không có quyền ghi, không cần `confirm_token`.**

## 1. Vì sao

Twin Brain điều phối và phân tích cần ngữ cảnh (context bank): tồn kho, công nợ, khách gần đây, doanh thu theo kỳ… Lấy ngữ cảnh bằng cách **đọc thẳng CSDL** của app khác thì phá ranh giới (R-CANON-2) và lộ dữ liệu nhạy cảm; lấy bằng công cụ ghi / đề xuất thì thừa quyền. Cần một lớp công cụ riêng: **đọc, đã che, có nguồn**. Tài liệu chiến lược gọi lớp này là *Read-Only LLM Analytics* ("chỉ `SELECT` trên bản sao đã ẩn danh"); hợp đồng này là bản quy định được của ý đó.

## 2. Hình công cụ (theo descriptor MCP chung)

Công cụ tri thức **là** công cụ MCP theo `bizcity-mcp-tool@1` (`name`, `title`, `description` tiếng Việt, `inputSchema`, `outputSchema` có `data.as_of`, `annotations`), thêm các ràng buộc:

| Trường | Giá trị bắt buộc |
|---|---|
| `name` | `<app>_knowledge_<chủ đề>` (vd `ketoan_knowledge_cong_no`, `cake_knowledge_khach_gan_day`) — tiền tố `_knowledge_` là dấu hiệu máy nhận ra |
| `annotations` | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| mode / scope | `read`; scope `knowledge.read` (cùng họ `business.read`, `report.read` của chuẩn MCP chung) |
| `confirm` | **không** có (không ghi) |
| `inputSchema` | luôn nhận `as_of?` (ngày / thời điểm cắt), `limit?` (≤ 200), `cursor?`; tham số lọc chỉ bằng **ID trục** hoặc mã (`ItemRef`, `PartnerRef`, `ContactRef`, `BranchRef` của spine §3) |
| `outputSchema.data` | `{ as_of, rows[], sources[], pii_masked: true, cursor? }` (§3) |

Công cụ **sinh từ action đọc** của app (chuẩn tái sử dụng R-CANON-14: một action ⇒ REST + MCP), không viết tay lặp logic.

## 3. Kết quả (`data`)

```json
{
  "as_of": "2026-11-24T10:00:00Z",
  "rows": [ { "item_id": "01JD…", "code_at": "SP-0042", "qty": 12, "branch_code": "CN01" } ],
  "sources": [ { "kind": "item", "id": "01JD…" }, { "kind": "document", "doc_ref": "bizcity.inventory.balance:CN01@2026-11-24" } ],
  "pii_masked": true,
  "cursor": "2026-11-24T10:00:00Z|01JD…"
}
```

| Luật | Nội dung |
|---|---|
| **R-KNOW-1** | Chỉ đọc. Hàm xử lý không được gọi action ghi, không mở giao dịch ghi; bộ kiểm HOUSE dò `effect: 'write'` trong đường gọi. |
| **R-KNOW-2** | Luôn có `as_of`; số liệu là **ảnh chụp tại thời điểm đó**, không phải "hiện tại mơ hồ". |
| **R-KNOW-3** | **Che thông tin nhạy cảm trước khi ra khỏi app**: điện thoại, email, mã số thuế cá nhân, số tài khoản → `sha256:` hoặc bỏ; **tên người mặc định che**, chỉ trả nguyên khi khoá có scope `knowledge.read.names` (Q-KNOW-1); `pii_masked` phải `true`. Khoá `pii: true` của registry lớp mềm (R-DATA-6) áp cho cả đây. |
| **R-KNOW-4** | Mỗi dòng dẫn nguồn bằng **ID trục** (`item_id`, `contact_id`, `partner.code`, `doc_ref`, `branch_code`) trong `sources[]`; não trích dẫn được, người kiểm lại được. Không trả tên / mã hiển thị làm khoá. |
| **R-KNOW-5** | Không trả số tài khoản kế toán, thuế suất suy luận, giá vốn tự tính — những thứ đó là của sổ và chính sách hạch toán (canon P4). Báo cáo tài chính đã khoá kỳ thì trả **đúng số đã khoá**. |
| **R-KNOW-6** | Phân trang bằng `cursor` ổn định; `limit` ≤ 200; giới hạn tần suất mặc định **60 lời gọi / phút / khoá** (Q-KNOW-2), báo ở `meta.rate`; vượt ⇒ `RATE_LIMITED` (429) kèm `Retry-After`. |
| **R-KNOW-7** | Mọi lời gọi ghi bằng chứng: actor `{ kind: 'ai', via: 'mcp:<client>', onBehalfOf, turnId }` vào `audit_logs` của app chủ (R-CANON-12) — kể cả đọc, vì đọc dữ liệu doanh nghiệp là hành động có trách nhiệm. |
| **R-KNOW-8** | Twin Brain **không cache** kết quả quá `as_of` + 24 giờ cho số liệu tiền / tồn; cache dài hơn chỉ cho danh mục. |

## 4. Công cụ tối thiểu mỗi app chủ nên có (gợi ý, không bắt buộc ở C3)

| App | Công cụ | Trả |
|---|---|---|
| open-ketoan | `ketoan_knowledge_ton_kho`, `ketoan_knowledge_cong_no`, `ketoan_knowledge_doanh_thu_ky` | tồn theo item / chi nhánh; công nợ theo `partner.code`; doanh thu theo kỳ đã khoá |
| open-cake | `cake_knowledge_khach_gan_day`, `cake_knowledge_cham_khach` | khách theo `contact_id` (danh tính đã che), lần chạm gần nhất |
| open-pos | `pos_knowledge_ban_hom_nay` | doanh số ca / quầy theo `branch_code`, dẫn `doc_ref` `pos.*` |

## 5. Kiểm (bộ kiểm tương thích, mức C3)

| Mã | Lane | Kiểm |
|---|---|---|
| SC-KNOW-1 | MANIFEST | app khai `bizcity_knowledge@1` trong `contracts` thì descriptor `tools/list` có ≥ 1 công cụ `_knowledge_` với `readOnlyHint: true` |
| SC-KNOW-2 | CONTRACT | gọi công cụ: `data.as_of` có; `pii_masked === true`; không chuỗi nào khớp khuôn số điện thoại / email / MST trong `rows` |
| SC-KNOW-3 | CONTRACT | mỗi `rows[i]` có ít nhất một khoá trục hoặc `sources[]` không rỗng |
| SC-KNOW-4 | HOUSE | hàm xử lý công cụ `_knowledge_` không gọi action `effect: 'write'` |

## 6. Quyết định của chủ (2026-11-24)

<!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 — chủ duyệt bốn gợi ý. -->

| Mã | Câu hỏi | Quyết định |
|---|---|---|
| Q-KNOW-1 | Tên người (khách, nhân viên) có được trả nguyên? | **Mặc định che**; trả nguyên khi khoá có scope `knowledge.read.names` |
| Q-KNOW-2 | Giới hạn tần suất mặc định | **60 lời gọi / phút / khoá** |

## 7. Lịch sử

- **1.0.0 (2026-11-24):** chủ duyệt Q-KNOW-1, 2; bỏ hậu tố -draft. <!-- [2026-11-24 09:50 PM Johnny Chu - Chu Hoàng Anh] SPINE-5 -->
- **1.0.0-draft (2026-11-24):** bản đầu, SPINE-4.
