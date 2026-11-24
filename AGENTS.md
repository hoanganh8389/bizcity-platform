# AGENTS.md — bizcity-platform

<!-- [2026-11-24 03:10 PM Johnny Chu - Chu Hoàng Anh] PLATFORM-SPLIT — luật cho người và agent làm trên gói nền dùng chung. -->

Đọc: [README](README.md) → [kế hoạch tách](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md) → [canon chung](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md).

- **R-PLAT-1** không import gói nghiệp vụ (`@ketoan/*`, `@cake/*`); không chuỗi nghiệp vụ cứng (`ketoan`, `crm`) — đọc từ cấu hình app.
- **R-PLAT-2** app gắn nghiệp vụ qua cổng đăng ký (`registerLedgerSubmitter`, `registerTouchSubmitter`, `registerCapabilities`, `registerErrorReasons`).
- **R-PLAT-3** thêm vào đây chỉ khi ≥ 2 app cần hoặc là hạ tầng chung theo canon; ADR ở `docs/adr/`.
- **R-PLAT-4** mọi thay đổi: dấu R-SIG `[YYYY-MM-DD HH:MM AM/PM Johnny Chu - Chu Hoàng Anh] <CODE> — …` theo giờ máy (**không** tên agent / model), mức K0–K3, CHANGELOG, test ma trận open-ketoan + open-cake.
- **R-PLAT-5** không thêm phụ thuộc khi chưa có lý do trong ADR.
- Chỉ qua PR; không đẩy thẳng `main` khi đã có mã.
- **R-PLAT-6** đổi `docs/standard/BIZCITY-SPINE-v1.md` ⇒ đổi cùng PR: schema `packages/contracts/schema/spine/`, vector, `tools/spine-check.mjs`; chạy `node tools/spine-check.mjs` phải ĐẠT. Thêm trục mới cần ADR (chuẩn §7). <!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 -->
