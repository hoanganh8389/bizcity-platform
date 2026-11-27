# bizcity-platform — open-platform: chuẩn nền và bộ kiểm của Bizcity Open

<!-- [2026-11-27 11:03 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4: ba vai, ba repo; repo này là open-platform -->
> **Vai (canon R-CANON-17):** repo này là **open-platform** — luật kỹ thuật ([`docs/standard/`](docs/standard/README.md)), schema hợp đồng nền máy đọc ([`schema/`](schema/)), bộ kiểm ([`tools/`](tools/)), nghiên cứu ([`docs/research/`](docs/research/)). Repo **không còn mã chạy**.

<!-- [2026-11-27 11:31 PM Johnny Chu - Chu Hoàng Anh] NC-003 C2 — mã lõi đã dời sang open-core -->
> **Mã lõi `@bizcity/platform`, `@bizcity/contracts` (và các gói `@bizcity/*` về sau) ở repo [open-core](https://github.com/hoanganh8389/open-core)** — dời ở bước C2 của [NC-003](docs/research/NC-003-TACH-OPEN-CORE.md) bằng `git subtree`, giữ lịch sử; phát hành từ **0.3.0**. Bản 0.2.0 cũ vẫn tải được ở [Release v0.2.0](https://github.com/hoanganh8389/bizcity-platform/releases/tag/v0.2.0). Cấp instance: [bizcity-open-setup](https://github.com/hoanganh8389/bizcity-open-setup).

## Chuẩn xuyên app

- **[Bản đồ chuẩn nền](docs/standard/README.md)** (`bizcity_standard_map@1` 1.0.0, chủ duyệt 2026-11-25) — bốn trục dữ liệu (master data, chứng từ, khách 360, người dùng) + mười ba trụ cột kỹ thuật (khuôn repo, API, người dùng–vai, bảo mật, quan sát, đệm, kiểm thử, phát hành, giao diện, nhiều CSDL, Hub, tri thức, nghiệm thu · bàn giao); mỗi trụ cột một tệp chuẩn, một bản mẫu đang chạy, một phép kiểm. Bức tranh toàn hệ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Sổ máy đọc: `docs/standard/standards.json`. Kiểm: `node tools/standard-check.mjs` (sổ chuẩn) · `--repo <thư mục>` (khuôn một repo, mức S0–S3) · `node tools/users-check.mjs --repo <thư mục>` (khuôn người dùng · vai · quyền, tệp `bizcity.authz.json` <!-- [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 -->). <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 -->

- **[`bizcity_spine@1`](docs/standard/BIZCITY-SPINE-v1.md)** — định danh và danh mục chuẩn (item, ĐVT, chi nhánh, đối tượng, khách, chứng từ, tenant, người dùng), tự đứng + đồng bộ. Mã app viết bằng gì cũng được; hình trên dây phải giống nhau. Máy đọc: `schema/spine/`. Kiểm: `node tools/spine-check.mjs` (vector) · `--manifest <bizcity.app.json>` (repo app). [ADR-0001](docs/adr/ADR-0001-spine-xuyen-app.md).
- **Bộ kiểm tương thích** — lane MANIFEST `node tools/spine-check.mjs` · lane CONTRACT (hộp đen) `node tools/spine-contract.mjs --target <url> --api-key <khoá> --profile ledger [--allow-write]`; kết quả theo [`bizcity_conformance_report@1`](docs/standard/BIZCITY-CONFORMANCE-REPORT-v1.md). Hợp đồng kèm: [`bizcity_identity@1`](docs/standard/BIZCITY-IDENTITY-v1.md) (người dùng + SSO từ WordPress), [`bizcity_knowledge@1`](docs/standard/BIZCITY-KNOWLEDGE-v1.md) (công cụ tri thức chỉ đọc cho Twin Brain). <!-- [2026-11-24 08:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 --> <!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 -->

## Kế hoạch và luật

- Kế hoạch P0–P7, quyết định D-PLAT-1..6, luật R-PLAT-1..5: [open-hub/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md)
- Canon chung: [open-hub/docs/canon/](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md)
- Luật kỹ thuật gốc (R-*): [open-ketoan/docs/rules/](https://github.com/hoanganh8389/open-ketoan/tree/main/docs/rules)

**Bốn câu:** (1) không biết nghiệp vụ của app nào — app gắn vào qua cổng đăng ký; (2) chỉ nhận thứ ≥ 2 app cần; (3) mọi PR chạy test của mọi app đang dùng; (4) phá ⇒ major + ADR + hai bản song song.

## Kiểm

```bash
npm test     # mọi bộ kiểm tự kiểm: spine-check, standard-check, users-check, no-chuan, delivery, failure, loi, order-flow
node tools/standard-check.mjs --repo ../<repo>      # kiểm một repo khác cạnh bên
```

## Giấy phép

GPL-2.0-or-later ([LICENSE](LICENSE)). Nhãn hiệu BizCity: [TRADEMARK.md](TRADEMARK.md).
