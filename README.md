# bizcity-platform — gói nền dùng chung của Bizcity Open

<!-- [2026-11-24 03:10 PM Johnny Chu - Chu Hoàng Anh] PLATFORM-SPLIT — chủ chốt 2026-11-24: tách @bizcity/platform thành gói chung một nguồn (Q-PLAT-1 tên repo bizcity-platform, Q-PLAT-2 phát hành GitHub Packages trước). -->

> **Trạng thái:** 🟡 khởi tạo — **chưa có mã**. Mã vào ở bước **P2** của kế hoạch bằng `git subtree split` từ `open-ketoan/packages/platform` (giữ lịch sử), sau khi P0 (kiểm kê) và P1 (hợp đồng nền) xong.

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

## Kế hoạch và luật

- Kế hoạch P0–P7, quyết định D-PLAT-1..6, luật R-PLAT-1..5: [open-hub/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md)
- Canon chung: [open-hub/docs/canon/](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md)
- Luật kỹ thuật gốc (R-*): [open-ketoan/docs/rules/](https://github.com/hoanganh8389/open-ketoan/tree/main/docs/rules)

**Bốn câu:** (1) không biết nghiệp vụ của app nào — app gắn vào qua cổng đăng ký; (2) chỉ nhận thứ ≥ 2 app cần; (3) mọi PR chạy test của mọi app đang dùng; (4) phá ⇒ major + ADR + hai bản song song.

## Phát hành

GitHub Packages của `hoanganh8389` (Q-PLAT-2), SemVer; chuyển npm công khai `@bizcity` khi có người dùng ngoài.

## Giấy phép

GPL-2.0-or-later ([LICENSE](LICENSE)). Nhãn hiệu BizCity: [TRADEMARK.md](TRADEMARK.md).
