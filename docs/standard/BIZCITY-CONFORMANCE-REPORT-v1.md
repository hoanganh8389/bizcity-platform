# `bizcity_conformance_report@1` — Kết quả một lần chạy bộ kiểm tương thích

<!-- [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — hợp đồng thứ ba của bộ kiểm tương thích (open-hub DE-XUAT-BO-KIEM-TUONG-THICH §5–§6): tệp máy đọc mà bizcity.vn dùng để hiện nhãn mức C0–C3 và trạng thái, thay vì gõ tay (R-CANON-10: nhãn phải khớp nghiệm thu). -->

> **Phiên bản:** 1.0.0 · 2026-11-24 · **Trạng thái:** Đang dùng (`tools/spine-check.mjs --json` in theo hợp đồng này) · **Thuộc:** `@bizcity/contracts`
> **Máy đọc:** `packages/contracts/schema/spine/conformance-report.schema.json` · vector trong `schema/spine/vectors/`.

## 1. Hình

```json
{
  "schema": "bizcity_conformance_report@1",
  "tool": "spine-check",            // spine-check (MANIFEST) · spine-contract (CONTRACT) · spine-house (HOUSE)
  "tool_version": "1.1.0",
  "standard": "bizcity_spine@1",
  "ran_at": "2026-11-24T13:00:00.000Z",
  "lane": "MANIFEST",
  "app_id": "open-pos",             // khi kiểm đúng một app
  "target": "https://pos.example.vn",   // lane CONTRACT: bản đang chạy
  "scope": ["bizcity.app.json"],
  "level": "C1",                    // mức đạt được, chỉ khi tool tính được
  "checks":   [ { "id": "SC-SPINE-1", "status": "pass" } ],
  "findings": [ { "id": "SC-SPINE-1", "level": "warn", "where": "bizcity.app.json", "msg": "…" } ],
  "verdict": "ĐẠT"
}
```

## 2. Luật

| Luật | Nội dung |
|---|---|
| **R-REP-1** | Kết luận theo **cổng**: có một `findings[].level = fail` ⇒ `verdict = KHÔNG ĐẠT`, không cộng điểm bù. |
| **R-REP-2** | `level` chỉ ghi khi tool **đã chạy đủ** các kiểm của mức đó (C0: SC-SPINE-1 · C1: + SC-SPINE-2, 4 · C2: + 3, 5 · C3: + 6, MCP, tri thức); thiếu thì bỏ trống, không đoán. |
| **R-REP-3** | `findings[].where` là tệp / route / id — **không** chứa dữ liệu doanh nghiệp (tên khách, tiền, MST). |
| **R-REP-4** | bizcity.vn đọc tệp này để hiện nhãn ("Đang chạy", mức C) — nhãn không được đặt tay trái với báo cáo mới nhất. Báo cáo cũ hơn bản phát hành hiện tại ⇒ nhãn "chưa kiểm lại". |
| **R-REP-5** | CI của mỗi repo lưu báo cáo thành artefact (`conformance/<app_id>.json`); repo private vẫn công bố được báo cáo (không có mã). |

## 3. Ai sinh

| Tool | Lane | Có |
|---|---|---|
| `tools/spine-check.mjs --json` | MANIFEST | **có** (1.1.0) |
| `tools/spine-contract.mjs --json` | CONTRACT | bản đầu (profile `ledger`: SC-SPINE-4 phần đọc, SC-SPINE-5) |
| `spine-house` | HOUSE | chưa — ở open-ketoan là `tests/conformance` (SC-*); gói chung bọc lại ở bước sau |

## 4. Lịch sử

- **1.0.0 (2026-11-24):** bản đầu, SPINE-4.
