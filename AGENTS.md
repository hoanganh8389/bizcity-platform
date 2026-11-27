# AGENTS.md — bizcity-platform

<!-- [2026-11-24 03:10 PM Johnny Chu - Chu Hoàng Anh] PLATFORM-SPLIT — luật cho người và agent làm trên gói nền dùng chung. -->

<!-- [2026-11-27 11:03 PM Johnny Chu - Chu Hoàng Anh] NC-003 — chủ chốt Q-CORE-1…4: ba vai, ba repo; repo này là open-platform -->
## Vai của repo này: open-platform (luật)

Ba vai nền (canon R-CANON-17, [NC-003](docs/research/NC-003-TACH-OPEN-CORE.md)):

| Vai | Repo | Giữ |
|---|---|---|
| **open-platform** | **repo này** | chuẩn `docs/standard/BIZCITY-*`, `standards.json`, schema hợp đồng nền máy đọc, bộ kiểm (`tools/standard-check.mjs`, `spine-check`, conformance), `docs/research/NC-*`, skills, templates |
| **open-core** | `open-core` | mã lõi `@bizcity/*` (kernel, contracts nền, server, web-shell, ui-kit, action-client, module-sdk, cli), semver chung |
| **open-setup** | `bizcity-open-setup` | registry Workspace × app, cấp instance qua `bizcity_site_provisioning@1`, ghi `core_version` |

- **Một chiều phụ thuộc:** canon open-hub → open-platform quy định → open-core hiện thực và phải qua bộ kiểm ở đây → app = open-core + module → open-setup dựng instance.
- **Mã `packages/*` ở repo này đang chờ dời** sang open-core (NC-003 bước C2). Tới lúc đó: **không thêm tính năng mới** vào `packages/*`; sửa lỗi gấp thì làm ở đây và ghi vào NC-003 §Nhật ký để C2 mang theo. Sau C2 repo này **không còn mã chạy**.
- Luật R-PLAT-1…5 dưới đây là luật của **mã lõi** — từ C2 áp ở open-core (chép nguyên mã luật, không đặt lại); R-PLAT-6, R-PLAT-7 (chuẩn, spine) ở lại repo này.
- Đổi chuẩn ⇒ PR ở đây **trước**; open-core hiện thực sau, ghi mức đạt bằng bộ kiểm (không ghi "đạt" khi chưa có phép kiểm).

Đọc: [README](README.md) → [kế hoạch tách](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/KE-HOACH-GOI-CHUNG-BIZCITY-PLATFORM.md) → [canon chung](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md).

- **R-PLAT-1** không import gói nghiệp vụ (`@ketoan/*`, `@cake/*`); không chuỗi nghiệp vụ cứng (`ketoan`, `crm`) — đọc từ cấu hình app.
- **R-PLAT-2** app gắn nghiệp vụ qua cổng đăng ký (`registerLedgerSubmitter`, `registerTouchSubmitter`, `registerCapabilities`, `registerErrorReasons`, `registerRoles`, `registerApiScopes`, `registerModulePermissions`; migration: `sources` + `hooks`) <!-- [2026-11-24 06:20 PM Johnny Chu - Chu Hoàng Anh] P2b-3 -->.
- **R-PLAT-3** thêm vào đây chỉ khi ≥ 2 app cần hoặc là hạ tầng chung theo canon; ADR ở `docs/adr/`.
- **R-PLAT-4** mọi thay đổi: dấu R-SIG `[YYYY-MM-DD HH:MM AM/PM Johnny Chu - Chu Hoàng Anh] <CODE> — …` theo giờ máy (**không** tên agent / model), mức K0–K3, CHANGELOG, test ma trận open-ketoan + open-cake.
- **R-PLAT-5** không thêm phụ thuộc khi chưa có lý do trong ADR.
- Chỉ qua PR; không đẩy thẳng `main` khi đã có mã.
- **R-PLAT-6** đổi `docs/standard/BIZCITY-SPINE-v1.md` ⇒ đổi cùng PR: schema `packages/contracts/schema/spine/`, vector, `tools/spine-check.mjs`; chạy `node tools/spine-check.mjs` phải ĐẠT. Thêm trục mới cần ADR (chuẩn §7). Đổi `tools/spine-contract.mjs` ⇒ chạy lại vào một bản open-ketoan thử (CSDL có chữ "test"), **không bao giờ** `--allow-write` vào bản cài thật. <!-- [2026-11-24 08:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 --> <!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 -->
- **R-PLAT-7** thêm / đổi tệp chuẩn ở `docs/standard/` ⇒ cùng PR: `standards.json`, bản đồ `docs/standard/README.md`, CHANGELOG; `node tools/standard-check.mjs` phải ĐẠT. **Không đặt lại mã luật** đã có ở repo gốc (R-API-*, R-SEC-*, R-LOG-*, R-OBS-*…): chuẩn nền dẫn lại mã gốc, mã mới dùng tiền tố `R-STD-*` / `R-USER-*` / `R-WEBARCH-*`. Không ghi mức "đạt" khi chưa có phép kiểm chạy được. <!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 -->
