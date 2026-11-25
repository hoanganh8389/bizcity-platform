# `bizcity_web@1` — Giao diện React: model · view · controller, ui-kit, mockup

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T9: phân lớp màn React để chuẩn hoá từ đầu (chủ chỉ đạo 2026-11-24: "các chuẩn về m-v-c để react chuẩn hoá từ đầu"). Luật màn lấy từ open-cake R-WEB-1..15 (docs/architecture/80-REACT.md); phân lớp M·V·C đặt tên cho cách open-cake đang làm ở screens/catalog; ui-kit và trợ giúp theo open-ketoan. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Luật gốc:** open-cake `docs/architecture/80-REACT.md` (R-WEB-1..15), `60-UI.md`; open-ketoan `docs/phat-trien.md` §5–6, `docs/rules/RULE-BLOCKED.md` (R-BLOCK), `packages/ui-kit`; canon §8, `CHUAN-TAI-SU-DUNG-NANG-LUC.md`.
> **Ngăn xếp cố định:** React 18 · Vite · @tanstack/react-query · react-router. Không Redux / Zustand, không Electron.

## 0. Một câu

**Màn nào cũng chia ba phần — dữ liệu, điều khiển, hiển thị — và phần hiển thị không bao giờ tự gọi máy chủ.**

## 1. Ba lớp của một màn

```text
modules/<key>/web/   (hoặc apps/web/src/screens/<màn>/)
├── model/        MODEL       hình dữ liệu (kiểu suy từ zod của packages/contracts) + hàm thuần (định dạng, tính, kiểm)
│                             không React, không gọi mạng — test bằng hàm thường
├── use-<màn>.ts  CONTROLLER  một hook cho một màn: đọc URL, gọi action qua client chung (react-query),
│                             kiểm quyền (useCan), gom trạng thái (đang tải / rỗng / lỗi / không quyền), trả về lệnh
├── <phần>-table.tsx, <phần>-sheet.tsx   VIEW   thành phần nhận props, phát sự kiện; chỉ import ui-kit
└── index.tsx     MÀN         nối controller với view; không chứa luật nghiệp vụ
```

Bản mẫu đang chạy: open-cake `apps/web/src/screens/catalog/` (`index.tsx` · `use-catalog.ts` · `item-table.tsx` · `item-sheet.tsx`).

| Luật (mới) | Nội dung |
|---|---|
| R-WEBARCH-1 | **View không gọi mạng**: không `fetch`, không `useQuery / useMutation`, không đọc phiên; mọi dữ liệu và lệnh đến qua props |
| R-WEBARCH-2 | **Controller là hook**, một màn một hook chính; chỉ nó được gọi client chung, đọc / ghi URL, hỏi quyền |
| R-WEBARCH-3 | **Model là mã thuần**: kiểu lấy từ schema zod dùng chung với máy chủ (không khai lại kiểu bằng tay); hàm tính / định dạng không phụ thuộc React |
| R-WEBARCH-4 | **Luật nghiệp vụ không nằm ở web**: web không tính giá vốn, thuế, công nợ, quyền; chỉ hiển thị kết quả và lý do máy chủ trả về |
| R-WEBARCH-5 | Một **client chung** cho mọi lời gọi (`ActionClient` / `lib/api.ts`): tự gắn `Idempotency-Key`, đọc phong bì, ném `ApiError {code, message, hint, reason, requestId}`; không `fetch` ngoài client (SC-REUSE-3) |
| R-WEBARCH-6 | Màn dựng trước API dùng adapter **giả lập** của cùng client, kiểm vào / ra bằng cùng schema; chuyển sang thật không sửa view |

## 2. Luật màn (giữ nguyên mã của open-cake)

| Mã | Nội dung |
|---|---|
| R-WEB-1 | module web chỉ import ui-kit (facade) và React; không import `apps/web/*`, không import module khác |
| R-WEB-2 | **URL là nguồn vị trí**: tab, bộ lọc, bản ghi đang mở, sheet đang mở; F5 về đúng chỗ; link gửi được cho người khác |
| R-WEB-3 | dữ liệu máy chủ chỉ ở react-query; khoá `['<app>', site, <tài nguyên>, <tham số>]`; trạng thái giao diện dùng `useState` |
| R-WEB-5 | **bốn trạng thái** cho mọi màn và mọi khối: đang tải · rỗng (lý do + nút) · lỗi (`message`, `hint`, thử lại, `requestId`) · không có quyền |
| R-WEB-6 | thao tác ghi qua **sheet**: tiêu đề = động từ + đối tượng; lỗi hiện trong sheet; khoá nút khi đang lưu; không `alert / confirm` |
| R-WEB-7 · R-BLOCK | nút bị khoá phải nói **vì sao** và **cách mở**; quyền hỏi bằng `useCan`, máy chủ vẫn là cửa |
| R-WEB-8 | `ErrorBoundary` ở khung và mỗi màn, báo lỗi về máy chủ (≤ 10 / phút), không gửi dữ liệu khách |
| R-WEB-10 | danh sách dài: ảo hoá + phân trang con trỏ |
| R-WEB-11 | chữ nằm trong tệp ngôn ngữ theo khoá; không `dangerouslySetInnerHTML` với dữ liệu người dùng |
| R-WEB-12 | màu, cỡ chữ, khoảng cách lấy từ **token** (`tokens.css` / `theme.css`); chữ ≥ 15 px, nút ≥ 44 px; không màu cứng |
| R-WEB-14 | tệp < 200 dòng; tên tệp kebab-case, thành phần PascalCase |
| R-WEB-15 | dùng được bằng bàn phím; nút biểu tượng có nhãn `aria-*` |

Số tiền hiển thị qua một thành phần chung (`<Money>`); số thật, không số giả lập trên màn đã nối máy chủ (R-CAKE-UI-8).

## 3. ui-kit

| Luật | Nội dung |
|---|---|
| R-STD-WEB-1 (mới) | một facade **`@bizcity/ui-kit`** cho mọi app (lưới, sheet, bước, bốn trạng thái, `BlockedHint`, `Money`, token); app không tự đặt bản ui-kit riêng. Thành phần riêng của sản phẩm nằm trong app và dựng trên facade |
| — | thành phần mới vào ui-kit khi ≥ 2 màn / 2 app cần (R-PLAT-3) |
| SC-DOC-6 | mỗi mục menu / khoá trợ giúp có trang hướng dẫn `docs/huong-dan/<khoá>.md` |

## 4. Màn chuẩn có ở mọi app

Đăng nhập (mật khẩu + nút SSO) · Cài đặt › Nhân viên · Cài đặt › Vai & quyền (ma trận) · Cài đặt › Khoá API · Cài đặt chung (theo registry) · Nhật ký / bằng chứng · trang lỗi có `requestId`. Bố cục theo [USERS-ROLES](BIZCITY-USERS-ROLES-v1.md) §3.

## 5. Mockup trước, mã sau

| Luật (mới) | Nội dung |
|---|---|
| R-STD-WEB-2 | màn mới có **mockup được chủ duyệt** trước khi viết mã; mockup đã duyệt là **đích 100%** |
| R-STD-WEB-3 | nguồn mockup ở `docs/ui/mockup-src/` (dùng cùng token với sản phẩm); ảnh đã duyệt ở `docs/ui/mockup-shots/<màn>.png`; mockup riêng của phase ở `docs/phases/PHASE-…/mockup/` |
| R-STD-WEB-4 | dựng xong chụp lại **cùng khung hình** (1800 × 1100) và lưu ở `docs/phases/PHASE-…/evidence/build-shots/`; ảnh không chứa dữ liệu thật của khách |
| R-STD-WEB-5 | mockup không được bịa số liệu, trạng thái "đã kết nối" giả; chỗ chưa có dữ liệu thì vẽ trạng thái rỗng thật |

## 6. Kiểm

| Mã | Lane | Kiểm | Trạng thái |
|---|---|---|---|
| SC-MOD-1, SC-UI-1, SC-DOC-6 | HOUSE | không import chéo module, trợ giúp theo menu | có ở open-ketoan |
| SC-WEB-P1 | HOUSE | tệp view (không phải `use-*.ts`, `index.tsx`) không chứa `fetch(`, `useQuery`, `useMutation` | đề xuất — viết được ngay bằng grep |
| SC-WEB-P2 | HOUSE | không `fetch(` ngoài client chung; không màu hex cứng trong thành phần | đề xuất |
| SC-WEB-P3 | HOUSE | mỗi phase có màn mới có `mockup/` và `evidence/build-shots/` | đề xuất |
| chụp màn tự động (Playwright) | — | so ảnh dựng với mockup | chưa có ở repo nào |

## 7. Khoảng cách hiện tại

| App | Đang |
|---|---|
| open-cake | 6 / 15 luật R-WEB đạt theo tự đánh giá 2026-11-24; ui-kit tên `@open-cake/ui-kit` (chưa là `@bizcity/ui-kit`); chưa có ErrorBoundary, tệp ngôn ngữ, SSE, ảo hoá; ảnh chụp bằng tay |
| open-ketoan | có `packages/ui-kit` và 164 trang hướng dẫn; **chưa có luật phân lớp** màn; màn cũ trộn dữ liệu và hiển thị |
| bản WordPress (Open CRM, POS React) | theo token chung; chưa áp phân lớp này |
