# Bản đồ chuẩn nền Bizcity Open (`bizcity_standard_map@1`)

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — bản đồ chuẩn nền: bốn trục dữ liệu + mười ba trụ cột kỹ thuật, gom từ cái ĐANG CÓ ở open-ketoan (luật + mã + bộ kiểm) và open-cake (bản áp dụng gọn), để repo mới (MRP, HRM, …) đi cùng một hướng. Chủ chỉ đạo 2026-11-24: "bizcity-platform hình thành, định hình chuẩn hoá… như một hệ sinh thái liền mạch". -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Đứng dưới:** [BIZCITY OPEN CANON](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md) (open-hub). Canon đặt luật; ở đây giữ **chuẩn kỹ thuật chi tiết, schema máy đọc và bộ kiểm**.
> **Máy đọc:** [`standards.json`](standards.json) · **Kiểm:** `node tools/standard-check.mjs --repo <thư mục repo>`
> **Bức tranh toàn hệ:** [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## 0. Một câu

**Một doanh nghiệp bật app nào cũng thấy cùng một mặt hàng, một khách, một chứng từ, một người dùng; app nào cũng được dựng, kiểm, phát hành và vận hành theo cùng một khuôn.**

## 1. Ba tầng luật

| Tầng | Ở đâu | Giữ gì | Ai đổi |
|---|---|---|---|
| 1. Canon | open-hub `docs/canon/` | vì sao, mô hình kinh doanh, một app một trục, bốn trục dữ liệu, điểm không được lệch | chủ dự án |
| 2. **Chuẩn nền** (tệp này) | bizcity-platform `docs/standard/` | chuẩn kỹ thuật xuyên app: hình trên dây, khuôn repo, bộ kiểm, bản mẫu tham chiếu | PR vào đây + chủ duyệt |
| 3. Luật của repo | `<repo>/docs/00-CANON.md`, `docs/rules/` | luật riêng của sản phẩm (R-CAKE-*, R-OKT-*…) | chủ repo, **không được nới** tầng 1–2 |

**Không đặt lại mã luật.** Luật kỹ thuật gốc (R-API-*, R-SEC-*, R-LOG-*, R-DB-*, R-SITE-*, R-CACHE-*, R-REL-*…) do [open-ketoan `docs/rules/`](https://github.com/hoanganh8389/open-ketoan/tree/main/docs/rules) định nghĩa và kiểm. Chuẩn nền chỉ nói: luật nào **bắt buộc xuyên app**, bản mẫu ở đâu, kiểm bằng gì, chỗ nào còn trống. Mã mới (R-STD-*, R-USER-*, R-WEBARCH-*) chỉ sinh ở chỗ chưa repo nào có luật. Khi một gói chuyển về đây (kế hoạch P2b–P7), tệp luật của gói đó chuyển theo.

## 2. Bốn trục dữ liệu xuyên suốt

Đây là thứ làm nên "liền mạch". Chi tiết ở [`bizcity_spine@1`](BIZCITY-SPINE-v1.md) (tám định danh thuộc bốn nhóm dưới đây).

| # | Trục | Định danh trên dây | Chủ | Chuẩn |
|---|---|---|---|---|
| 1 | **Master data** (hàng hoá, ĐVT, chi nhánh / kho, đối tượng công nợ) | `item_id` ULID · `uom` · `branch_code` · `partner.code` | open-ketoan | [SPINE](BIZCITY-SPINE-v1.md) §2 · `bizcity_item_master@1`, `bizcity_master_data@1` (open-ketoan) |
| 2 | **Chứng từ** | `doc_ref` = `<module>.<loại>:<id>` + `document_links(from, to, role)` | app phát hành chứng từ | [SPINE](BIZCITY-SPINE-v1.md) §2 · `bizcity_document@1` (open-ketoan) |
| 3 | **Khách 360** | `contact_id` ULID + danh tính có bằng chứng | open-cake | [SPINE](BIZCITY-SPINE-v1.md) §2 · `bizcity_contact@1`, `bizcity_touch@1` (open-cake) |
| 4 | **Người dùng** | `sub` = `wp:<id>` (người dùng tạo tại app chưa có `sub` cho tới khi nối với WordPress) | Hub WordPress cấp `sub`; **từng app làm chủ người dùng cục bộ, vai và quyền** | [IDENTITY](BIZCITY-IDENTITY-v1.md) · [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) |

Đi cùng bốn trục: **site / đơn vị** (`site` slug, `tenant` — xem [MULTISITE](BIZCITY-MULTISITE-v1.md) §1 về từ vựng) và **sự kiện** (outbox → webhook ký HMAC, `bizcity_event@1`).

## 3. Mười ba trụ cột kỹ thuật

Mỗi trụ cột có một tệp chuẩn, một bản mẫu tham chiếu đang chạy, và phép kiểm. Cột "Mức" là mức của **bản mẫu**, theo thang: **đạt** (có mã + phép kiểm chạy được) · **một phần** · **tài liệu** (mới có luật) · **chưa**. Không ghi "đạt" khi không có phép kiểm (R-ECP-SCORE).

| # | Trụ cột | Chuẩn | Bản mẫu | Mức |
|---|---|---|---|---|
| T1 | Khuôn repo, lớp, manifest, CLI, nếp làm việc | [APP-SKELETON](BIZCITY-APP-SKELETON-v1.md) | open-ketoan · open-cake | đạt (ketoan) |
| T2 | API nội bộ + kiểm đầu vào / đầu ra | [API-PROFILE](BIZCITY-API-PROFILE-v1.md) | open-ketoan `packages/platform/src/core/{http,errors,actions}.ts` | đạt |
| T3 | Người dùng, user meta, vai, ma trận quyền, ma trận cài đặt (SSO nối sau) | [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) · SSO: [IDENTITY](BIZCITY-IDENTITY-v1.md) | `@bizcity/platform` `core/{auth,roles,authz}` · open-cake `auth/` · kiểm `tools/users-check.mjs` | một phần <!-- [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 --> |
| T4 | Bảo mật | [SECURITY](BIZCITY-SECURITY-v1.md) | open-ketoan R-SEC / R-TEN | đạt |
| T5 | Quan sát và truy lỗi (OpenTelemetry, Tempo, Loki, Grafana, Prometheus) | [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md) | open-ketoan `infrastructure/monitoring/` | đạt |
| T6 | Bộ nhớ đệm, hàng đợi (Redis tuỳ chọn) | [CACHE](BIZCITY-CACHE-v1.md) | open-ketoan R-CACHE (chưa có Redis) | tài liệu |
| T7 | Kiểm thử, selfcheck, bằng chứng | [TESTING](BIZCITY-TESTING-v1.md) | open-ketoan `tests/conformance/` | đạt |
| T8 | Phiên bản, migration SQL, sao lưu, nâng cấp, phát hành | [RELEASE](BIZCITY-RELEASE-v1.md) | open-ketoan R-REL / R-DB / R-BAK | một phần |
| T9 | Giao diện React (model · view · controller), ui-kit, mockup | [WEB](BIZCITY-WEB-v1.md) | open-cake R-WEB-1..15 · open-ketoan `packages/ui-kit` | một phần |
| T10 | Một bản mã, nhiều CSDL: registry site, định tuyến, cấp site | [MULTISITE](BIZCITY-MULTISITE-v1.md) | open-ketoan `packages/platform/src/db/site-*.ts` | một phần |
| T11 | Hub, 1API, khoá, open-setup, bizcity-web | [HUB](BIZCITY-HUB-v1.md) | bizcity-llm-router · bizcity-open-setup · bizcity-web | một phần |
| T12 | Tri thức và agent (MCP, Twin Brain) | [KNOWLEDGE](BIZCITY-KNOWLEDGE-v1.md) · `bizcity_mcp@1` (open-ketoan) | open-ketoan `/mcp` | một phần |
| T13 | Nghiệm thu, bảng việc, rà soát, bàn giao — "đã kiểm lại chưa, đạt chưa" | [DELIVERY](BIZCITY-DELIVERY-v1.md) | open-ketoan `docs/nghiem-thu/`, `BANG-VIEC.md`, `docs/reviews/`, `BAN-GIAO.md` · kiểm `tools/delivery-check.mjs` | một phần <!-- [2026-11-25 01:39 PM Johnny Chu - Chu Hoàng Anh] STD-8 --> |

Báo cáo kiểm theo [`bizcity_conformance_report@1`](BIZCITY-CONFORMANCE-REPORT-v1.md).

## 4. Repo mới bắt đầu thế nào (MRP, HRM, …)

1. Đọc [ARCHITECTURE](../ARCHITECTURE.md) §3 để biết app mình **làm chủ trục nào** và **dùng trục nào**. Chưa trả lời được thì chưa viết mã.
2. Viết `bizcity.app.json` ([SPINE](BIZCITY-SPINE-v1.md) §5), chạy `node tools/spine-check.mjs --manifest bizcity.app.json`.
3. Dựng khuôn repo theo [APP-SKELETON](BIZCITY-APP-SKELETON-v1.md) §2; `docs/canon/README.md` trỏ về tệp này.
4. Người dùng và quyền theo [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md); API theo [API-PROFILE](BIZCITY-API-PROFILE-v1.md); màn theo [WEB](BIZCITY-WEB-v1.md).
5. Chạy `node tools/standard-check.mjs --repo .`; chỗ chưa đạt ghi thành nợ ở `docs/NO-CHUAN-NEN.md` (`tools/no-chuan.mjs`, R-STD-9) <!-- [2026-11-25 01:16 PM Johnny Chu - Chu Hoàng Anh] STD-5 --> — mức tối thiểu để được liệt kê trên bizcity.vn là **S1** (§5).
6. Thử đăng nhập một lần và gọi Hub trên máy bằng [`tools/hub-local`](../../tools/hub-local/README.md).

## 5. Mức tuân thủ của một repo

| Mức | Nghĩa | Kiểm |
|---|---|---|
| **S0** | có manifest hợp lệ | SC-SPINE-1 |
| **S1** | S0 + trỏ canon và bản đồ chuẩn đúng, có khuôn tài liệu tối thiểu | SC-STD-1, SC-STD-2 |
| **S2** | S1 + chạy được bộ kiểm của chính repo (selfcheck hoặc test) trong CI | SC-STD-3 |
| **S3** | S2 + qua lane CONTRACT (hộp đen) cho các hợp đồng đã khai | SC-SPINE-4.., SC-IDENT-* |

Mức C0–C3 của [SPINE](BIZCITY-SPINE-v1.md) đo **dữ liệu trên dây**; mức S đo **khuôn repo**. Hai thang độc lập.

## 6. Quyết định của chủ dự án (2026-11-25)

<!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->

Cả tám đề xuất được duyệt nguyên văn.

| Mã | Câu hỏi | Quyết định |
|---|---|---|
| Q-STD-1 | "tenant" đang mang bốn nghĩa (site, đơn vị trong site, blog, pháp nhân) | tách hai từ: **site** = doanh nghiệp thuê (slug, mỗi app một CSDL) · **tenant** = đơn vị / pháp nhân / sổ bên trong site. Áp vào [MULTISITE](BIZCITY-MULTISITE-v1.md) §1; chuẩn spine đổi theo bằng ADR riêng |
| Q-STD-2 | Ba khuôn slug khác nhau (registry, spine, bizcity-web) | một khuôn `^[a-z][a-z0-9-]{2,29}$` (khuôn của registry đang chạy); schema spine đổi cùng ADR ở Q-STD-1 |
| Q-STD-3 | Hai cách đếm trụ cột ở open-ketoan (11 và 17) | hệ dùng cách chia ở tệp này (4 trục + 12 trụ cột; thêm T13 nghiệm thu · bàn giao ngày 2026-11-25 theo chỉ đạo của chủ <!-- [2026-11-25 01:39 PM Johnny Chu - Chu Hoàng Anh] STD-8 -->); hai bảng của open-ketoan là chi tiết của riêng Core kế toán |
| Q-USER-1 | Quyền trong vé SSO thay ma trận cục bộ hay chỉ là trần? | **trần**: quyền hiệu lực = ma trận cục bộ ∩ quyền trong vé; từ chối cục bộ luôn thắng. Áp vào [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) §4 (R-USER-12) và [IDENTITY](BIZCITY-IDENTITY-v1.md) 1.1.0 (R-IDENT-4) |
| Q-USER-2 | Người dùng tạo tại app (không qua WordPress) mang `sub` dạng gì? | **không mang `sub`** (`external_sub` trống) cho tới lần đăng nhập SSO đầu tiên có email khớp — đúng cách open-ketoan đang chạy; không thêm dạng mới |
| Q-API-1 | Phân trang con trỏ chưa có chuẩn | con trỏ `<thời điểm ISO>\|<id>` như `bizcity_sync@1`, mã hoá base64url |
| Q-CACHE-1 | Có đưa Redis vào bản cài mặc định không? | không; giữ tuỳ chọn, chỉ thêm khi chạy ≥ 2 bản API |
| Q-REL-1 | Kênh phát hành gói nền | giữ GitHub Release (.tgz) cho tới khi có tổ chức npm `@bizcity` |

## 7. Đổi chuẩn

PR vào repo này: sửa tệp chuẩn + `standards.json` + CHANGELOG, chạy `node tools/standard-check.mjs` (tự kiểm sổ chuẩn) ĐẠT. Câu hỏi mới ghi vào §6 với mã `Q-<chủ đề>-<số>` kèm đề xuất; chỉ thành luật khi chủ duyệt. Thêm trục dữ liệu hoặc trụ cột mới cần ADR và ít nhất hai app cần (R-PLAT-3). Phá tương thích: tệp `-v2`, chạy song song ≥ 2 bản phát hành hoặc 6 tháng (VER-3 của open-ketoan `docs/standard/VERSIONING.md`).
