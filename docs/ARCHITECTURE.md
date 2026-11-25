# Kiến trúc hệ sinh thái Bizcity Open

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — bản rà lại của tài liệu "Chiến lược sản phẩm & kiến trúc hệ thống BIZCITY" (chủ gửi 2026-11-24), sửa cho khớp canon open-hub, bizcity_spine@1 và các quyết định đã duyệt. Danh sách chỗ đã sửa ở §8. -->

> **"Làm chủ mã. Làm chủ dữ liệu. Để agent vận hành, con người duyệt."**
> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** chấp nhận cùng bản đồ chuẩn <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 --> · **Đứng dưới:** [canon chung](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/BIZCITY-OPEN-CANON-v1.md) · **Chi tiết kỹ thuật:** [bản đồ chuẩn](standard/README.md).

## 1. Vì sao làm thế này

Phần mềm doanh nghiệp phần lớn là cơ sở dữ liệu kèm luật nghiệp vụ. Khi agent AI đọc và thao tác trực tiếp trên dữ liệu, giá trị dịch chuyển từ **màn hình cho từng người dùng** sang **dữ liệu đúng, luật rõ, và hàng rào kiểm chứng** để agent làm việc mà không phá hệ thống. Người làm phần mềm chuyển từ gõ mã sang ba việc: viết đặc tả không mơ hồ, dựng bộ kiểm tự động, và chịu trách nhiệm về kết quả.

Bizcity Open chọn theo hướng đó:

| Lựa chọn | Nghĩa là |
|---|---|
| **Mã mở, 0 đồng** | mọi ứng dụng công khai mã nguồn và miễn phí; doanh nghiệp tự giữ hạ tầng và dữ liệu, không bị khoá vào nhà cung cấp |
| **Bán cho doanh nghiệp (site), không tính theo đầu người** | thêm nhân viên không tốn thêm tiền phần mềm |
| **Thu tiền ở hai chỗ** | (1) **1API của Zalo Hub** và các lời gọi qua Hub theo gói; (2) **dịch vụ** triển khai, đào tạo, cố vấn — theo liên hệ |
| **Chuẩn trước, mã sau** | mã mỗi app viết bằng gì cũng được; hình dữ liệu trên dây, khuôn repo và bộ kiểm phải giống nhau |

Dịch vụ đi kèm (thu phí theo liên hệ): chuẩn hoá dữ liệu và ánh xạ nghiệp vụ sang chuẩn kế toán, thuế Việt Nam; cài đặt hạ tầng riêng và nối thanh toán, vận chuyển, hoá đơn điện tử; giám sát vận hành và cập nhật quy định; xây agent riêng theo bài toán của từng chuỗi.

## 2. Bức tranh

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│  TWIN BRAIN / Cell (zalo-hub)   não: phiên kênh, AI, kịch bản — KHÔNG làm chủ dữ liệu       │
│  đọc qua MCP · chỉ tạo nháp · ghi thật cần người duyệt (confirm_token)                      │
└───────────▲──────────────────────▲──────────────────────▲──────────────────────▲──────────┘
            │ MCP · webhook ký HMAC từ outbox · traceparent xuyên suốt                         
┌───────────┴─────────┐ ┌──────────┴──────────┐ ┌─────────┴───────────┐ ┌────────┴─────────┐
│ OPEN CAKE (CRM)     │ │ OPEN POS            │ │ OPEN KẾ TOÁN        │ │ app sau này      │
│ sổ chạm khách       │►│ giao dịch ba chân   │►│ bút toán Nợ = Có    │ │ MRP · HRM · …    │
│ chủ: contact_id     │ │ đơn · kho · giao    │ │ chủ: hàng, đối tượng│ │ một app một sổ   │
└───────────┬─────────┘ └──────────┬──────────┘ └─────────┬───────────┘ └────────┬─────────┘
            └───────────── BỐN TRỤC DỮ LIỆU: master data · chứng từ · khách 360 · người dùng ──┘
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ HUB (bizcity-llm-router): danh tính + SSO · khoá biz-… · 1API · bản quyền                   │
│ OPEN-SETUP: sổ site (một site → mỗi app một CSDL) · BIZCITY-WEB: cửa tự bật app             │
│ BIZCITY-PLATFORM: gói nền @bizcity/* · chuẩn nền · bộ kiểm                                  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Bản đồ ứng dụng

Theo lưới ứng dụng trên bizcity.vn. "Làm chủ" và "dùng" là các trục khai trong `bizcity.app.json` của từng repo.

| Ô trên bizcity.vn | Repo | Làm chủ | Dùng | Ghi chú |
|---|---|---|---|---|
| **Kế toán** | open-ketoan | hàng hoá, ĐVT, chi nhánh, đối tượng công nợ, sổ cái, chứng từ kế toán | site, người dùng | hạt nhân; nguồn luật kỹ thuật gốc |
| **Bán hàng POS** | open-pos · open-pos-backend · open-ketoan-bridge | giao dịch bán lẻ, chứng từ bán | hàng, ĐVT, chi nhánh, đối tượng | quầy vẫn bán khi kế toán tắt; bridge gửi chứng từ qua cửa nạp |
| **CRM** | open-cake (web) · open-crm (bản WordPress) | khách 360, sổ chạm khách | hàng, đối tượng, người dùng | hai bản song song, không chung CSDL |
| **Tồn kho** | trong open-ketoan (`bizcity_inventory@1`) | lô, dòng vận động | — | không phải repo riêng |
| **Báo cáo** | trong từng app; tổng hợp đọc từ sổ | — | — | báo cáo đọc sổ, không đọc cột tiêu đề chứng từ |
| **Website** | bizcity-web (WordPress) | blog / site web | người dùng | cũng là cửa "tự bật app" |
| **AI trên Zalo** | twin-brain · zalo-hub (Cell) | — (não, không làm chủ dữ liệu) | mọi trục, qua MCP | 1API của Zalo Hub là phần trả phí |
| **Tự động hoá** | bizcity-automation | lượt chạy | site, người dùng, chứng từ | |
| **Tri thức** | bizcity-twin-notebook | ghi chú có nguồn | site, người dùng, chứng từ | công cụ `_knowledge_` chỉ đọc |
| **Sản xuất** | chưa có repo (cộng đồng) | *đề xuất:* lệnh sản xuất, định mức | hàng, ĐVT, kho | cần đề xuất năng lực Core trước (định mức, giá thành) |
| **Nhân sự** | chưa có repo | *đề xuất:* hồ sơ nhân viên, bảng công | người dùng, đối tượng | nhân viên là **người dùng** + hồ sơ, không gộp vào khách |
| **Thêm module** | `modules/<key>/` trong từng app | — | qua `@bizcity/module-sdk` | chọn bậc mở rộng thấp nhất làm được việc |

Repo điều phối: open-hub (canon, trang công khai), bizcity-open-setup (sổ site), bizcity-llm-router (Hub), bizcity-platform (nền + chuẩn).

## 4. Bốn trục dữ liệu xuyên suốt

Chi tiết: [`bizcity_spine@1`](standard/BIZCITY-SPINE-v1.md).

**1. Master data — chủ: open-ketoan.** Mặt hàng mang `item_id` (ULID, không đổi suốt đời); **mã hàng có phiên bản và ngày hiệu lực**, đổi mã không đổi sổ. Đơn vị tính, chi nhánh / kho, đối tượng công nợ cũng do kế toán làm chủ. App khác giữ bản sao hoặc danh mục cục bộ ràng buộc muộn, **không tự tạo mặt hàng từ chứng từ**. Thuế suất và tài khoản đi từ **chính sách hạch toán** của kế toán, không gắn cứng vào mã hàng và không do app bán hàng tự đặt.

**2. Chứng từ — mỗi app làm chủ chứng từ mình phát hành.** Định danh `doc_ref` = `<module>.<loại>:<id>` (ví dụ `cake.order_request:01J…` → `pos.order:8812` → `bizcity.ledger.event:<docKey>`), bất biến. Chứng từ nối nhau bằng `document_links(from, to, role)`. Không xoá vật lý; sửa / huỷ là chứng từ đảo. Không có "mã gốc" tự đặt đi xuyên các app.

**3. Khách 360 — chủ: open-cake.** Một người một `contact_id`, kèm các **danh tính có bằng chứng** (số điện thoại, email, MST, `zalo_uid`, `fb_psid`). Chỉ gộp khi có bằng chứng, không gộp theo tên. **Khách (contact) ≠ đối tượng công nợ (partner) ≠ người dùng (user):** khách nối sang đối tượng công nợ bằng `partner_ref` một chiều; nhân viên là người dùng.

**4. Người dùng — Hub cấp danh tính, app giữ quyền.** Đăng nhập một lần từ Hub bằng vé ký HMAC (`sub = wp:<id>`, `aud` = app). Mỗi app **vẫn tự tạo được người dùng**, có vai và ma trận quyền riêng theo một khuôn chung, và tự đứng được khi không có Hub ([`bizcity_users@1`](standard/BIZCITY-USERS-ROLES-v1.md)).

Sự kiện giữa các app: ghi vào outbox cùng giao dịch → webhook ký HMAC → bên nhận idempotent. Lệch thì **đối chiếu có mã** (`RC-SPINE-*`), không ghi đè.

## 5. Năm nguyên tắc sổ

1. Không sự việc, không bút toán.
2. Sổ chỉ thêm: sửa / huỷ là bút toán đảo.
3. Một cửa nạp cho mỗi sổ; app ngoài chỉ **kể sự việc**, hạt nhân định khoản.
4. Không viết số tài khoản, thuế suất, giá vốn ở app ngoài.
5. Kiểm mạnh trong giao dịch (Nợ = Có, quyền, kỳ khoá); đồng bộ ra ngoài chạy sau commit, có đối chiếu.

## 6. Twin Brain: lớp điều phối và kiểm chứng

| Cơ chế | Cách hoạt động | Bảo vệ |
|---|---|---|
| **Luật do app giữ** | agent không tự nghĩ cách hạch toán; chỉ nộp sự việc qua cửa nạp, luật định khoản của kế toán quyết | đúng chuẩn kế toán, thuế |
| **Chỉ tạo nháp** | agent ghi qua MCP ở mức nháp / chờ duyệt; ghi thật cần `confirm_token` của người; khoá API và AI không bao giờ có quyền rủi ro cao | sai sót và lạm quyền của agent |
| **Đối chiếu ba chiều** | đơn bán (POS) ⇄ phiếu xuất kho ⇄ tiền thu, bằng các phép đối chiếu có mã chạy trên sổ | thất thoát hàng, gian lận doanh thu |
| **Báo người duyệt** | giao dịch bất thường (chiết khấu cao, huỷ sau khi xuất hoá đơn, lệch tồn) bị giữ lại chờ duyệt — **do app giữ**, agent chỉ phát hiện và báo | rủi ro vận hành |
| **Đọc có giới hạn** | công cụ tri thức chỉ đọc, có `as_of`, tên người che mặc định, giới hạn số lời gọi ([`bizcity_knowledge@1`](standard/BIZCITY-KNOWLEDGE-v1.md)); văn bản từ khách và AI là dữ liệu, không phải lệnh | chèn lệnh qua nội dung, lộ dữ liệu |

App **không gọi LLM**; cần AI thì qua Hub hoặc Twin Brain.

## 7. Lộ trình triển khai cho một doanh nghiệp

1. **Chuẩn hoá dữ liệu và nghiệp vụ:** làm sạch dữ liệu cũ; dựng danh mục hàng, đối tượng; ánh xạ khách.
2. **Cài hạ tầng riêng và nối ngoài:** cài bộ app trên máy chủ riêng hoặc bật trên bizcity; nối thanh toán, vận chuyển, hoá đơn điện tử.
3. **Vận hành và tuân thủ:** giám sát định kỳ, cập nhật quy định thuế vào luật của kế toán, sao lưu và diễn tập khôi phục.

## 8. Đã sửa gì so với bản gốc

| Bản gốc | Bản này | Vì sao |
|---|---|---|
| `open-kiot` là app POS | open-pos + open-pos-backend + open-ketoan-bridge | open-kiot đã lưu trữ; đổi tên theo quyết định chương trình OKT |
| "Ba trục định danh" (master data, document, contact) | **bốn** trục, thêm người dùng; tám định danh của `bizcity_spine@1` | chủ chỉ đạo 2026-11-24; spine đã duyệt |
| `sku_id`, thuế suất "gắn cứng vào SKU" | `item_id` bất biến, mã có phiên bản; thuế và tài khoản từ chính sách hạch toán | ADR-0017 / 0018 của open-ketoan |
| `bom_recipe` nằm trong master data | chưa có; ghi là đề xuất của app Sản xuất | hạt nhân chưa có định mức, không ghi như đã có |
| `DOC-CHAT-xxx → DOC-ORD-xxx…`, `root_document_id` | `doc_ref` `<module>.<loại>:<id>` + `document_links` | chuẩn chứng từ đã duyệt; không có mã gốc tự đặt |
| Một `contact_id` gộp khách, nhà cung cấp, nhân viên, vận chuyển | khách ≠ đối tượng công nợ ≠ người dùng, nối bằng tham chiếu | mỗi trục một chủ (R-CANON-1); gộp sai là lỗi khó gỡ nhất |
| Twin Brain "tạm khoá giao dịch", "quy tắc cứng" nằm ở Twin Brain | luật và việc giữ / khoá nằm ở app; Twin Brain là não, không làm chủ dữ liệu | canon R-CANON-2 |
| Đối chiếu ba chiều bắt đầu từ đơn ở Open-Cake | bắt đầu từ đơn bán ở POS | Cake giữ yêu cầu đặt hàng, đơn bán là chứng từ của POS |
| Doanh thu theo tác vụ, token, % giá trị | 0 đồng mọi app; thu ở 1API và dịch vụ theo liên hệ | chủ chốt 2026-11-24 |
| Trích lời các lãnh đạo ngành làm luận cứ | viết lại thành nhận định chung, không gắn tên | không có nguồn kiểm được trong repo |
| Ký hiệu mũi tên dạng công thức bị vỡ | viết bằng chữ và `→` | hiển thị |
