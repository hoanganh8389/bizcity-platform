# bizcity-platform — gói nền dùng chung của Bizcity Open

<!-- [2026-11-24 03:10 PM Johnny Chu - Chu Hoàng Anh] PLATFORM-SPLIT — chủ chốt 2026-11-24: tách @bizcity/platform thành gói chung một nguồn (Q-PLAT-1 tên repo bizcity-platform, Q-PLAT-2 phát hành GitHub Packages trước). -->

> **Trạng thái:** 🟡 **P2a xong (2026-11-24)** — `packages/platform` (212 commit) và `packages/contracts` (125 commit) nhập từ open-ketoan `6ad77b6` bằng `git subtree`, **giữ lịch sử**; `@ketoan/contracts` đổi tên `@bizcity/contracts`; build + typecheck đứng riêng 0 lỗi. **Giai đoạn 0 — chưa tách sạch:** hai gói vẫn còn phần kế toán (`masterdata/`, mã lỗi / loại chứng từ kế toán, kiểu DB toàn bộ) — P2b gỡ bằng cổng đăng ký theo kiểm kê open-ketoan PHASE-041 `10-KIEM-KE.md`. open-ketoan chưa dùng gói này (P6, hoãn).

Một nguồn duy nhất cho phần nền mà **mọi** app Bizcity Open (open-ketoan, open-cake, …) cùng dựa vào: HTTP và phong bì lỗi, xác thực và phân quyền, action runtime, sự kiện (outbox), bằng chứng, cài đặt, tài liệu / chứng từ chung, nhiều site (registry, router, provisioner, migrate, backup), nhật ký, số đo, trace, chẩn đoán. **Không** chứa nghiệp vụ của app nào.

| Gói | Vai | Nguồn hiện tại |
|---|---|---|
| `@bizcity/platform` | nền chạy: http, auth, authz, actions, events, evidence, settings, documents, db + nhiều site, logger, metrics, tracing, diagnostics | `open-ketoan/packages/platform` |
| `@bizcity/contracts` | hợp đồng nền: phong bì API, mã lỗi chung, khuôn sự kiện, bằng chứng, `DOC_LINK_ROLES`, authz, settings, module, MCP | phần nền của `open-ketoan/packages/contracts` (`@ketoan/contracts` giữ phần kế toán, re-export phần nền) |
| `@bizcity/module-sdk` | facade duy nhất module được import | `open-ketoan/packages/module-sdk` |
| `@bizcity/ui-kit` | facade giao diện React | `open-ketoan/packages/ui-kit` |
| `@bizcity/cli` | lệnh `bizcity` (site, migrate, doctor, module check) | `open-ketoan/packages/cli` |
| `@bizcity/conformance` | khung selfcheck + kiểm chung (SC-*, H-*) | `open-ketoan/tests/conformance` (phần chung) |
| `@bizcity/flex` *(về sau)* | lớp dữ liệu mềm (`user_meta`, `entity_meta`, `record_types`, `records`) | bản đầu ở `open-cake/packages/flex`; vào đây ở **P7** |

## Chuẩn xuyên app

- **[Bản đồ chuẩn nền](docs/standard/README.md)** (`bizcity_standard_map@1`, bản nháp chờ duyệt) — bốn trục dữ liệu (master data, chứng từ, khách 360, người dùng) + mười hai trụ cột kỹ thuật (khuôn repo, API, người dùng–vai, bảo mật, quan sát, đệm, kiểm thử, phát hành, giao diện, nhiều CSDL, Hub, tri thức); mỗi trụ cột một tệp chuẩn, một bản mẫu đang chạy, một phép kiểm. Bức tranh toàn hệ: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Sổ máy đọc: `docs/standard/standards.json`. Kiểm: `node tools/standard-check.mjs` (sổ chuẩn) · `--repo <thư mục>` (khuôn một repo, mức S0–S3). <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 -->

- **[`bizcity_spine@1`](docs/standard/BIZCITY-SPINE-v1.md)** — định danh và danh mục chuẩn (item, ĐVT, chi nhánh, đối tượng, khách, chứng từ, tenant, người dùng), tự đứng + đồng bộ. Mã app viết bằng gì cũng được; hình trên dây phải giống nhau. Máy đọc: `packages/contracts/schema/spine/`. Kiểm: `node tools/spine-check.mjs` (vector) · `--manifest <bizcity.app.json>` (repo app). [ADR-0001](docs/adr/ADR-0001-spine-xuyen-app.md).
- **Bộ kiểm tương thích** — lane MANIFEST `node tools/spine-check.mjs` · lane CONTRACT (hộp đen) `node tools/spine-contract.mjs --target <url> --api-key <khoá> --profile ledger [--allow-write]`; kết quả theo [`bizcity_conformance_report@1`](docs/standard/BIZCITY-CONFORMANCE-REPORT-v1.md). Hợp đồng kèm: [`bizcity_identity@1`](docs/standard/BIZCITY-IDENTITY-v1.md) (người dùng + SSO từ WordPress), [`bizcity_knowledge@1`](docs/standard/BIZCITY-KNOWLEDGE-v1.md) (công cụ tri thức chỉ đọc cho Twin Brain). <!-- [2026-11-24 08:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 --> <!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 -->

## Kế hoạch và luật

- Kế hoạch P0–P7, quyết định D-PLAT-1..6, luật R-PLAT-1..5: [open-hub/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md)
- Canon chung: [open-hub/docs/canon/](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md)
- Luật kỹ thuật gốc (R-*): [open-ketoan/docs/rules/](https://github.com/hoanganh8389/open-ketoan/tree/main/docs/rules)

**Bốn câu:** (1) không biết nghiệp vụ của app nào — app gắn vào qua cổng đăng ký; (2) chỉ nhận thứ ≥ 2 app cần; (3) mọi PR chạy test của mọi app đang dùng; (4) phá ⇒ major + ADR + hai bản song song.

## Phát hành

<!-- [2026-11-24 06:31 PM Johnny Chu - Chu Hoàng Anh] P2b-5 — chủ chốt 2026-11-24: phát hành bằng tệp .tgz đính kèm GitHub Release (GitHub Packages chỉ nhận phạm vi @hoanganh8389; giữ tên @bizcity/*). -->

Gắn tag `vX.Y.Z` (phiên bản trong `packages/*/package.json` phải khớp) ⇒ workflow `release` build + test (Postgres 16) + bộ kiểm SPINE ⇒ `tools/dong-goi.mjs` đóng 2 tệp ⇒ GitHub Release đính kèm. App cài bằng URL, không cần token:

```json
"@bizcity/contracts": "https://github.com/hoanganh8389/bizcity-platform/releases/download/v0.2.0/bizcity-contracts-0.2.0.tgz",
"@bizcity/platform":  "https://github.com/hoanganh8389/bizcity-platform/releases/download/v0.2.0/bizcity-platform-0.2.0.tgz"
```

SemVer; đổi sang registry (npm công khai `@bizcity` hoặc GitHub Packages khi có tổ chức) chỉ sửa hai dòng này ở app. CI (`ci.yml`) chạy cùng bộ kiểm trên mọi PR.

## Giấy phép

GPL-2.0-or-later ([LICENSE](LICENSE)). Nhãn hiệu BizCity: [TRADEMARK.md](TRADEMARK.md).
