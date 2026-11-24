# ADR-0001: Xương sống xuyên app `bizcity_spine@1` đặt ở gói nền chung

<!-- [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 — ADR đầu của bizcity-platform: chuẩn định danh / bản sao / gửi sau / đối chiếu xuyên app, máy đọc được, kiểm được ở mọi repo. -->

**Trạng thái:** Đề xuất (chờ chủ duyệt Q-SPINE-1..4) · **Ngày:** 2026-11-24 · **Mức:** K1 (thêm hợp đồng, không đổi hành vi app nào)

## Bối cảnh

Ba nhóm app chạy trên ba nền khác nhau: open-ketoan / open-cake (TypeScript, PostgreSQL, Docker), open-pos / open-pos-backend / open-ketoan-bridge (PHP, WordPress multisite, MySQL), twin-brain (PHP, WordPress). Chủ dự án yêu cầu (2026-11-24): *mã lập trình có thể khác nhau, nhưng API contracts phải xuyên suốt*; app vừa **tự đứng** (quầy vẫn bán khi kế toán dừng) vừa **đồng bộ** được.

Từng mảnh đã có nhưng rải ở nhiều repo và nhiều tên: `item_id` bất biến (open-ketoan ADR-0017), `doc_ref` + `document_links`, `contact_id` (open-cake), lớp đệm tsm + bridge (OKT P-0 ý 4), SSO từ WordPress (canon). Chưa có nơi nào nói **chung** về bản sao, gửi sau, đối chiếu, và chưa có tệp máy đọc để bộ kiểm chạy trên repo PHP.

## Quyết định

1. Chuẩn `bizcity_spine@1` sống ở **bizcity-platform** (`docs/standard/`, `packages/contracts/schema/spine/`), vì ≥ 2 app cần và là hạ tầng chung (R-PLAT-3). Canon ở open-hub chỉ trỏ tới.
2. Hình dạng **trên dây** là bắt buộc; **schema CSDL** của từng app là tự do (chỉ quy định cột tối thiểu).
3. Mỗi repo app khai `bizcity.app.json` (`bizcity_app@1-draft`): trục làm chủ / dùng / bản sao / cục bộ, cách đồng bộ, hợp đồng thực hiện, giấy phép, `paid`.
4. Công cụ kiểm `tools/spine-check.mjs` **không phụ thuộc gói ngoài** (R-PLAT-5): kiểm vector + manifest, chạy được ở mọi repo bằng một lệnh node.
5. Mô hình POS (open-pos ← tsm ← bridge ← open-ketoan) **được giữ nguyên** và được đặt tên theo chuẩn (bản sao, gửi sau, đối chiếu); không yêu cầu đội POS đổi luồng bán (I-0).

## Hệ quả

- Repo sản phẩm thêm hai tệp: `bizcity.app.json` và `docs/canon/README.md` (trỏ về canon + chuẩn này + trục của riêng app). Không đổi mã.
- open-ketoan cần mở changefeed `since` + digest cho danh mục (Q-SPINE-3) để bridge và cake kéo theo cursor; việc đó đi theo R-FLOW của open-ketoan.
- Bộ kiểm lane CONTRACT (SC-SPINE-4..6) là việc tiếp theo; bản này mới có lane MANIFEST (SC-SPINE-1, 2).
- Khi `bizcity.app.json` được duyệt chính thức, bỏ hậu tố `-draft` và bump phiên bản chuẩn.

## Phương án đã bỏ

- **Chuẩn hoá schema CSDL chung cho mọi app:** không khả thi giữa MySQL/WordPress và PostgreSQL, và trái mục tiêu "mã khác nhau".
- **Một bảng danh mục trung tâm mọi app gọi trực tiếp (không bản sao):** app không tự đứng được khi mất kết nối; trái P-0 ý 4.
- **ID toàn cục kiểu `DOC-ORD-xxx` / `root_document_id`:** canon 1.1 đã bác; dùng `doc_ref` + `document_links`.
