# Changelog

## [Chưa phát hành]

### Thêm
- 2026-11-24 — SPINE-1.1 (K1, chủ duyệt open-cake Q-017-1/2): `uom` nhận tên ĐVT có dấu của chủ (Cái, Thùng — khớp open-ketoan / open-pos H-9); `partner.code` từ open-cake: SĐT đã xác minh → `CAKE-<contact_id>` → `KHACH-LE`. Chuẩn + schema + vector cùng PR (R-PLAT-6); spine-check ĐẠT.
- 2026-11-24 — **chủ duyệt `bizcity_spine@1` 1.0.0** (Q-SPINE-1..4): bỏ hậu tố -draft ở chuẩn, ADR-0001, schema, công cụ; vị trí kho / lô ở lớp mềm; open-ketoan sẽ mở changefeed + digest (R-FLOW); manifest ở gốc mọi repo kể cả plugin WordPress. <!-- [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 -->
- 2026-11-24 — **`bizcity_spine@1-draft`** — xương sống xuyên app: tám trục định danh (tenant, user, item, uom, branch, partner, contact, document), bốn hình thức `*Ref` trên dây, bốn kiểu bảng (chủ · bản sao · gửi sau · đối chiếu), luật R-SPINE-1..10, kiểm SC-SPINE-1..6; manifest `bizcity.app.json` (`bizcity_app@1-draft`); schema máy đọc `packages/contracts/schema/spine/` + vector; công cụ `tools/spine-check.mjs` (không phụ thuộc gói ngoài). ADR-0001. Mức K1. <!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 -->
- 2026-11-24 — khởi tạo repo: README, AGENTS, LICENSE, TRADEMARK. Chưa có mã (mã vào ở P2 bằng subtree split từ open-ketoan).
