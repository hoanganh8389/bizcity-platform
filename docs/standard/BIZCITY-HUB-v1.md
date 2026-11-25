# `bizcity_hub@1` — Hub, 1API, khoá, open-setup, bizcity-web

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T11: vai của các repo điều phối và bốn loại khoá, để app mới biết gọi ai, bằng khoá nào. Rút từ bizcity-llm-router docs/PHASE-0-CANON.md (R-GW-*, R-LLM-KEY-ONLY, R-B2B2C), bizcity-open-setup docs/00-CANON.md, bizcity-web ARCHITECTURE, canon §2.1. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Luật gốc:** canon §2.1 (R-CANON-13), `MO-HINH-KINH-DOANH-B2B.md`; bizcity-llm-router `docs/PHASE-0-CANON.md`, `docs/api/15-master-plans.md`, `18-commerce-license-hub.md`; bizcity-open-setup `docs/00-CANON.md`, ADR-0001.

## 0. Một câu

**Hub giữ danh tính, khoá và cửa thương mại; open-setup giữ sổ site; bizcity-web là cửa cho người dùng tự bật app; không repo nào trong ba repo đó giữ dữ liệu nghiệp vụ.**

## 1. Ai làm gì

| Repo | Vai | Không làm |
|---|---|---|
| **bizcity-llm-router** (Hub) | cửa duy nhất tới nhà cung cấp ngoài (LLM, ảnh, tìm kiếm, lưu trữ, thanh toán); cấp và kiểm khoá `biz-…`; gói, hạn mức, sổ bản quyền; đăng ký Cell (zalo-hub); **gốc danh tính** (WordPress user → `sub = wp:<id>`) | giữ cookie / token kênh, giữ dữ liệu nghiệp vụ của app |
| **open-hub** (trong Hub, `templates/v2/`) | canon, mô hình kinh doanh, trang công khai bizcity.vn | mã nghiệp vụ |
| **bizcity-open-setup** | Site Manager: khách, site, sản phẩm bật trên site; gọi `/_sites/v1` của app; điều phối chương trình OKT | nối PostgreSQL của app (R-ROLE-3) |
| **bizcity-web** | mu-plugin WordPress của mạng bizcity.vn: nhân bản blog, "một cửa" bật năm app (Agent Zalo, Web, Kế toán, POS, CRM), trang dùng thử kế toán | giữ sổ site (đó là open-setup) |
| **bizcity-platform** (repo này) | gói nền + chuẩn nền + bộ kiểm + `tools/hub-local` | nghiệp vụ |
| **zalo-hub** (Cell) · **twin-brain** | phiên kênh, AI, kịch bản; ghi vào app chỉ qua MCP, chỉ tạo nháp | làm chủ dữ liệu |

## 2. Bốn loại khoá (đừng lẫn)

| Khoá | Dạng | Ai cấp | Gắn với | Dùng để |
|---|---|---|---|---|
| **Khoá Hub / 1API** | `biz-<32 hex>` | Hub | một **site** (một tên miền chính) | app / plugin gọi Hub: LLM, Zalo Hub, bản quyền |
| **Khoá API của app** | `kt_…` (kế toán), tương tự ở app khác | từng app | một **tenant**, có phạm vi | máy ↔ app: POS gửi chứng từ, đồng bộ danh mục (`X-Api-Key`) |
| **Khoá cấp site** | `prov_…` | từng app (control DB) | máy chủ quản trị, danh sách IP | open-setup gọi `/_sites/v1` |
| **Khoá cài đặt** | `inst_…` | open-ketoan | một bản cài chuỗi cửa hàng | kiểu cài chain: một khoá + `X-OKT-Blog` |

Ngoài ra **khoá chung SSO** (`WP_SSO_SECRET`) ký vé người dùng — không phải khoá API, không dùng cho máy ↔ máy.

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-STD-KEY-1 (mới) | mọi khoá lưu **băm**, hiện một lần; giao diện chỉ hiện tiền tố | Hub `class-router-auth.php`, R-SEC-2 |
| R-LLM-KEY-ONLY | gói (`free · master_pro · master_premium`) đọc **chỉ** từ đúng dòng khoá; `user_id` trên khoá chỉ là con trỏ sở hữu, không bao giờ dùng để suy gói | Hub (sự cố 2026-07-23) |
| R-STD-KEY-2 (mới) | **không dùng khoá loại này thay loại kia**: `biz-…` không mở được API nghiệp vụ của app; `kt_…` không gọi được Hub. Tài liệu của mỗi repo ghi rõ mình cần loại nào | khoảng trống: chưa repo nào ghi phân biệt này |
| R-STD-KEY-3 (mới) | khoá không bao giờ mang quyền `risk: high`; khoá hết hạn bản quyền ⇒ **hạ gói**, không khoá dữ liệu | canon §9, R-SITE-13 |
| R-CANON-13 | một site, một khoá `biz-…`, mỗi app một CSDL; bật thêm app không cần khoá mới | canon |
| R-GW-2 | khoá của nhà cung cấp ngoài chỉ nằm ở Hub; app và plugin khách không giữ | Hub |

## 3. Cái gì trả phí

Chủ chốt 2026-11-24: **mọi ứng dụng 0 đồng, mã nguồn công khai**. Trả phí chỉ có:

1. **1API của Zalo Hub** (và các lời gọi qua Hub tính theo gói của khoá `biz-…`);
2. **dịch vụ triển khai, đào tạo, cố vấn** — theo liên hệ.

Manifest `bizcity.app.json` của app mã mở phải `paid: false` (SC-SPINE-1 chặn). App **không** gọi thẳng nhà cung cấp LLM; cần AI thì qua Hub hoặc qua Twin Brain (canon R-CANON-2).

## 4. App nói chuyện với Hub

| Việc | Cách | Chuẩn |
|---|---|---|
| Người dùng mở app từ Hub | vé SSO ký HMAC, `aud` = id app | [IDENTITY](BIZCITY-IDENTITY-v1.md), [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) |
| App gọi dịch vụ của Hub | `Authorization: Bearer biz-…`, không gian `bizcity/v1/*` (R-GW-6) | Hub `docs/api/README.md`, `openapi-1api.json` |
| Cell gọi Hub thay khách | bí mật Cell + `X-BizCity-On-Behalf-Of` | hợp đồng `zalo-hub-bridge@1` (đóng băng tên cũ) |
| Agent đọc / đề xuất vào app | MCP: đọc, tạo nháp, gửi có `confirm_token` | `bizcity_mcp@1`, [KNOWLEDGE](BIZCITY-KNOWLEDGE-v1.md) |
| Truy lỗi qua nhiều chặng | `traceparent` | [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md) §2 |

| Luật (mới) | Nội dung |
|---|---|
| R-STD-HUB-1 | Hub tắt thì app **vẫn chạy** phần của mình (đăng nhập cục bộ, ghi sổ); chỉ mất tính năng đi qua Hub |
| R-STD-HUB-2 | chốt chặn site thử nghiệm của Hub (tên miền `.local / .test / .localhost`, callback phải HTTPS cùng tên miền) **không nới trong mã sản phẩm**; thử trên máy bằng `tools/hub-local` |
| R-STD-HUB-3 | danh sách đuôi tên miền thử phải **một nguồn** dùng chung giữa Hub và plugin khách (hiện hai bản chép: `DEV_DOMAIN_SUFFIXES` và `DEV_SUFFIXES`) |

## 5. Thử trên máy

[`tools/hub-local`](../../tools/hub-local/README.md): WordPress đóng vai Hub (`http://hub.localhost:8095`) + open-ketoan bản `main`; phát vé thật cho mọi app (`wp hub-sso ticket --login=<người> --aud=<app>`); `check.sh` kiểm cả chuỗi.

## 6. Kiểm

| Mã | Lane | Kiểm | Trạng thái |
|---|---|---|---|
| SC-SPINE-1 | MANIFEST | giấy phép mở thì `paid: false` | có |
| `tools/hub-local/check.sh` | liên repo | vé Hub → app: `sub`, `aud`, chuyển hướng, địa chỉ lạ | có (13 mục, open-ketoan) |
| SC-HUB-P1 | HOUSE | mã app không chứa tên miền / khoá của nhà cung cấp LLM | đề xuất |
| SC-HUB-P2 | CONTRACT | Hub trả trạng thái một khoá `biz-…` cho app (bản quyền mềm) | chưa có điểm cuối (open-ketoan S039-14) |

## 7. Khoảng cách hiện tại

| Nơi | Thiếu |
|---|---|
| Hub | không có README / AGENTS ở gốc repo; chưa có điểm cuối máy ↔ máy "trạng thái khoá"; chưa có `bizcity.app.json` |
| bizcity-web | dùng lại một khoá `biz-…` cho nhiều blog của cùng chủ, trong khi kiểu cài bizcity của bridge đòi mỗi blog một khoá — hai loại khoá khác nhau nhưng chưa tài liệu nào nói rõ (R-STD-KEY-2) |
| open-setup | chưa có bộ cài / lệnh "nhân bản" tổng quát; cấp site mới chỉ qua Site Manager → `/_sites/v1` |
| chung | chưa có sổ ánh xạ blog ↔ site ↔ bản app ([MULTISITE](BIZCITY-MULTISITE-v1.md) §8) |
