# `bizcity_ux@1` — Một giao diện cho mọi app: token, khung app, màn mẫu, mẫu tương tác

<!-- [2026-11-28 06:49 PM Johnny Chu - Chu Hoàng Anh] NC-005 — chủ (2026-11-28): "có UI UX thống nhất chuẩn hoá không?" → "đồng ý theo đề xuất". Gom từ: open-cake token (bản mẫu đã duyệt, 179 biến), open-hub brandbook, WEB R-WEB-*, bizcity-twin-ai R-SETUP-4 / R-ERROR-UX, open-ketoan ui-kit (DataGrid, FilterLayout, doc-sheet). -->

> **Phiên bản:** 0.1.0-draft · 2026-11-28 · **Trạng thái:** Đề xuất — **mockup chờ chủ duyệt** · **Trụ:** T9 · **Đứng cạnh:** [WEB](BIZCITY-WEB-v1.md) (kiến trúc màn) · [LIST](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-LIST-v1.md) · [HUB-SETUP](BIZCITY-HUB-SETUP-v1.md)
> **Hiện thực:** open-core `@bizcity/ui-kit` (token + thành phần) + `@bizcity/web-shell` (khung + màn mẫu) — PHASE-003 S003-6, S003-12 · **Mockup:** open-core `docs/ui/mockup-src/web-shell.html`, ảnh `docs/ui/mockup-shots/`

## 0. Một câu

**Người dùng mở app nào của Bizcity cũng thấy cùng một khung, cùng cách lọc, cùng cách lưu, cùng cách báo lỗi** — app chỉ khác màu nhấn và nội dung nghiệp vụ. WEB nói *mã màn tổ chức thế nào*; chuẩn này nói *màn trông và cư xử thế nào*.

## 1. Token (một nguồn)

| Nhóm | Token (tên theo nghĩa, không theo màu) | Luật |
|---|---|---|
| Bề mặt | `--background` `--card` `--popover` `--muted` `--accent` | nền xám nhạt, thẻ trắng, **không đổ bóng** (viền 1 px `--border`) |
| Viền | `--border` `--input` `--border-strong` | |
| Chữ | `--foreground` `--muted-foreground` `--subtle-foreground` | thân ≥ 15 px; số tiền / mã dùng phông số đều (`--font-mono`) |
| Nhấn | `--primary` `--primary-hover` `--primary-soft` `--primary-foreground` | **một màu nhấn mỗi app** qua `data-accent` (Q-UX-1) |
| Trạng thái | `--success` `--warning` `--destructive` (+ `-soft`) · `--info` | **chỉ** cho trạng thái; không dùng làm màu trang trí |
| Hình | `--radius` (12 thẻ, 8 nút / ô) · `--space-1…8` (4 px bậc) · `--font-sans` (Manrope) · `--font-mono` (IBM Plex Mono) | |
| Tối | cùng tên token dưới `[data-theme="dark"]` và `prefers-color-scheme` | không màu cứng trong thành phần (SC-WEB-P2) |

Bản mẫu token: open-cake `packages/ui-kit/src/tokens.css` (đã duyệt) — chuyển thành `@bizcity/ui-kit/tokens.css`.

## 2. Khung app (web-shell)

```text
┌ thanh trên ─────────────────────────────────────────────────────────────────────────┐
│ [logo app] [Workspace ▾ / Tenant ▾]      [Tìm nhanh  ⌘K]      [🔔] [?] [tài khoản ▾] │
├ menu trái (registry) ┬ vùng nội dung ────────────────────────────────────────────────┤
│ nhóm › mục            │ breadcrumb · tiêu đề màn · nút chính (bên phải)              │
│ (chỉ mục có quyền,    │ ───────────────────────────────────────────────────────────  │
│  module bật ở tenant) │ màn mẫu (§3)                                                │
│ Cài đặt hệ thống      │                                                             │
└───────────────────────┴─────────────────────────────────────────────────────────────┘
dải trạng thái: khoá mềm (vàng ≤ 14 ngày, đỏ hết hạn — không chặn sổ) · bốn bước chưa xong ⇒ nút "Hoàn tất kết nối"
```

| Mã | Luật |
|---|---|
| R-UX-1 | Mọi app dùng **một** khung web-shell; app không tự vẽ thanh trên / menu |
| R-UX-2 | Chọn Workspace / tenant ở thanh trên; đổi tenant ⇒ mọi dữ liệu trên màn đổi theo, URL giữ đường |
| R-UX-3 | Tìm nhanh `⌘K` / `Ctrl+K`: mở màn, tìm bản ghi theo `doc_ref` / mã / tên qua các danh sách có `search: true`, chạy action có quyền |
| R-UX-4 | Menu dựng từ registry (`registerMenu`); mục không có quyền **ẩn**, không hiện rồi báo lỗi |

## 3. Màn mẫu

| Màn | Dùng cho | Thành phần |
|---|---|---|
| `ListScreen` | mọi danh sách (`bizcity_list@1`) | thanh lọc sinh từ cột · bộ lọc đã lưu · chọn cột · sắp xếp · con trỏ + ảo hoá · chọn nhiều + thao tác hàng loạt · Xuất / Nhập |
| `DetailScreen` | xem một bản ghi / chứng từ | đầu: số + trạng thái (nhóm chuẩn) + nút chuyển trạng thái (workflow YAML) · thân: các khối · bên phải: **Hoạt động** (chatter — ghi chú, việc, thay đổi, tệp) |
| `FormSheet` | thêm / sửa | sheet trượt phải; tiêu đề = động từ + đối tượng; lỗi tại ô (`field`); khoá nút khi lưu; `Idempotency-Key` |
| `BoardScreen` | kanban theo trạng thái | cột = nhóm trạng thái; kéo thả = action chuyển (có quyền) |
| `SettingsScreen` | Cài đặt | sinh từ registry cài đặt (lớp A / B / C), mỗi khoá có mô tả + phạm vi |
| `SetupScreen` | bốn bước kết nối open-hub | đúng R-SETUP-4 (nhãn, thứ tự, trạng thái do máy chủ) |
| `ImportScreen` | nhập tệp | tải tệp → ghép cột → **chạy thử** (từng dòng: tạo / sửa / lỗi) → chạy thật |
| `PlatformStatus` | **Cài đặt hệ thống › Tình trạng nền tảng** | scoreboard ERP-12 (mức 0–4 theo app, bằng chứng), phiên bản open-core / app, liên kết README · kiến trúc · mockup |

## 4. Mẫu tương tác

| Mã | Luật |
|---|---|
| R-UX-5 | **Bốn trạng thái** mọi khối (R-WEB-5): đang tải (khung xương), rỗng (lý do + nút làm tiếp), lỗi, có dữ liệu |
| R-UX-6 | Lỗi theo R-ERROR-UX: `{message, hint, help_code}`; `hint` **bắt đầu bằng động từ** ("Cách sửa: …"); lỗi tại ô tô đỏ đúng ô |
| R-UX-7 | Thao tác rủi ro (xoá, huỷ chứng từ đã duyệt, xuất dữ liệu cá nhân) ⇒ hộp xác nhận nói **hậu quả** + gõ lại khi rủi ro cao |
| R-UX-8 | Nút bị khoá nói **vì sao** và **cách mở** (R-WEB-7) |
| R-UX-9 | Thông báo ngắn (toast) cho kết quả; việc dài (xuất / nhập) chạy nền, có trạng thái ở chuông |
| R-UX-10 | Phím tắt chung: `⌘K` tìm, `/` vào ô lọc, `N` thêm mới, `Esc` đóng sheet, `↑↓ Enter` trong danh sách |
| R-UX-11 | Chữ tiếng Việt có dấu, câu ngắn, động từ đầu nút; số tiền `1.250.000 ₫`, ngày `28/11/2026`; theo tệp ngôn ngữ (R-WEB-11) |
| R-UX-12 | Điện thoại ≥ 360 px: menu thành ngăn kéo, danh sách thành thẻ, sheet toàn màn |

## 5. Mockup trước, mã sau

Theo WEB R-STD-WEB-2…5: khung + bảy màn mẫu có mockup ở open-core `docs/ui/mockup-src/web-shell.html` (cùng token), ảnh 1800 × 1100 ở `docs/ui/mockup-shots/`; **chủ duyệt rồi mới dựng web-shell**; dựng xong chụp lại cùng khung để so.

## 6. Kiểm (đề xuất)

| Mã | Lane | Kiểm |
|---|---|---|
| SC-UX-1 | HOUSE | không màu hex / rgb cứng ngoài `tokens.css` (mở rộng SC-WEB-P2) |
| SC-UX-2 | HOUSE | app không tự dựng thanh trên / menu / bảng danh sách (grep thành phần ngoài web-shell) |
| SC-UX-3 | CONTRACT | chụp màn tự động so mockup đã duyệt (Playwright, cùng khung) |

## 7. Câu hỏi

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| Q-UX-1 | Màu nhấn | **tên token theo open-cake (đã duyệt); mỗi app một màu nhấn qua `data-accent`** (cake xanh `#1f6bf2`, kế toán xanh lục, POS cam…); **đỏ brand `#d0021b` chỉ cho logo / nhận diện**, không làm màu nút — tránh lẫn với `--destructive` |
| Q-UX-2 | Phông | Manrope (chữ) + IBM Plex Mono (số / mã) như open-hub R-HUB-13 |
| Q-UX-3 | Chế độ tối | có token ngay, bật sau |

## Lịch sử

- **0.1.0-draft (2026-11-28):** bản đầu.
