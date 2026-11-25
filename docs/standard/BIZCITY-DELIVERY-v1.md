# `bizcity_delivery@1` — Nghiệm thu, bảng việc, rà soát, bàn giao

<!-- [2026-11-25 01:39 PM Johnny Chu - Chu Hoàng Anh] STD-8 — trụ cột T13. Chủ chỉ đạo 2026-11-25: "bizcity-platform cũng cần yêu cầu các repo có docs/nghiem-thu, bảng việc, bàn giao, review, check lại chưa, pass chưa… xem open-ketoan đã làm tốt chưa và các repo khác cần tương tự". Rút từ open-ketoan docs/nghiem-thu (71 phiếu), docs/phases/BANG-VIEC.md (sinh tự động), docs/reviews + scripts/cham-pr.mjs, PHASE-031/BAN-GIAO.md. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — theo chỉ đạo của chủ dự án 2026-11-25
> **Bản mẫu:** open-ketoan `docs/nghiem-thu/` (README, `_MAU.md`), `docs/phases/BANG-VIEC.md` + `scripts/bang-viec.mjs`, `docs/reviews/`, `scripts/cham-pr.mjs`, `docs/phases/PHASE-031-…/BAN-GIAO.md`.
> **Kiểm:** `node tools/delivery-check.mjs --repo <thư mục>` (SC-DLV-1..8) · báo cáo trạng thái: `--report`.

## 0. Một câu

**Một việc chỉ "xong" khi có phiếu nghiệm thu được bộ phận sử dụng ký Đạt trên phần mềm thật, có test khoá đúng số, đã qua rà soát, và người làm tiếp đọc được bàn giao — và một lệnh trả lời được "đã kiểm lại chưa, đạt chưa".**

## 1. Vòng đời một việc

```text
yêu cầu ─► PHIẾU NGHIỆM THU (Nháp → Đã chốt) ─► giữ chỗ ─► làm ─► test khoá số ─► PR + bằng chứng ─► RÀ SOÁT
      ─► Chờ nghiệm thu ─► bộ phận sử dụng chạy lại ─► BIÊN BẢN: Đạt / Chưa đạt ─► BÀN GIAO ─► đóng
                                    ▲                                   │ Chưa đạt
                                    └───────────────────────────────────┘
BẢNG VIỆC (sinh tự động) cho thấy mọi việc đang ở đâu.
```

| Bước | Sản phẩm | Ai | Kiểm |
|---|---|---|---|
| Chốt yêu cầu | phiếu `docs/nghiem-thu/<phân hệ>/NT-<MÃ>-<số>-<tên>.md`, trạng thái **Đã chốt** | bộ phận sử dụng | SC-DLV-2 |
| Làm | dòng giữ chỗ (nếu repo có `CLAIMS.md`), nhánh, PR | người làm | R-FLOW (repo) |
| Khoá số | test có `describe` mở đầu bằng mã phiếu | người làm | SC-DLV-4 |
| Rà soát | PR có khối *Bằng chứng chạy máy* + người duyệt; rà định kỳ ghi `docs/reviews/` | người duyệt | SC-DLV-6 |
| Nghiệm thu | §7 *Kết quả chạy* (commit, tệp test) + §8 *Biên bản* (ngày, bộ phận, Đạt / Chưa đạt) | bộ phận sử dụng | SC-DLV-3 |
| Bàn giao | `BAN-GIAO.md` của phase khi đổi người hoặc đóng phase | người giao | SC-DLV-7 |
| Theo dõi | bảng việc sinh tự động | công cụ | SC-DLV-5 |

## 2. Phiếu nghiệm thu (`docs/nghiem-thu/`)

Khuôn giữ nguyên của open-ketoan: `README.md` (quy trình + danh sách), `_MAU.md` (mẫu), thư mục theo phân hệ, một phiếu một tính năng, **không ghi tên người** trong phiếu (ghi bộ phận).

**Trạng thái là từ khoá đóng** — ô *Trạng thái* bắt đầu bằng đúng một trong:

| Từ khoá | Nghĩa | Bắt buộc có |
|---|---|---|
| `Nháp` | đang viết tình huống | §1–§6 |
| `Đã chốt` | bộ phận sử dụng đồng ý tình huống và số mong đợi — được code | như trên |
| `Đang làm` | đã giao việc | đường dẫn phiếu trong câu giao việc / PR |
| `Chờ nghiệm thu` | test khoá số, đã ghi §7 | §7: commit + tệp test; mã phiếu có trong test |
| `Đạt` | bộ phận sử dụng chạy lại trên phần mềm thật, ký biên bản | §8: ít nhất một dòng có ngày + bộ phận + "Đạt" |
| `Chưa đạt` | biên bản ghi chỗ sai; quay về `Đang làm` | §8 có dòng "Chưa đạt" |
| `Huỷ` | không làm nữa, ghi lý do ở §9 | §9 |

Ngày, người, ghi chú để **sau** từ khoá (`Đã chốt — 18/11/2026, bộ phận Kho`), không thay từ khoá.

| Luật | Nội dung |
|---|---|
| R-STD-DLV-1 | Repo app có `docs/nghiem-thu/README.md` và `_MAU.md`; plugin WordPress có thể đặt ở `NGHIEM-THU/` nếu `.gitignore` bỏ qua `docs/` |
| R-STD-DLV-2 | Chưa có phiếu **Đã chốt** thì chưa code tính năng; sửa lỗi nhỏ / đổi giao diện không cần phiếu |
| R-STD-DLV-3 | Phiếu `Chờ nghiệm thu` / `Đạt` phải có test mang mã phiếu; phiếu `Đạt` phải có biên bản |
| R-STD-DLV-4 | Phiếu `Chờ nghiệm thu` quá **14 ngày** là việc treo — đưa lên bảng việc / buổi họp; không để trôi |
| R-STD-DLV-5 | Danh sách phiếu ở README phải đủ mọi phiếu (khuyên sinh tự động); không phiếu nào "mồ côi" |

## 3. Bảng việc

| Luật | Nội dung |
|---|---|
| R-STD-DLV-6 | Repo có `docs/phases/` thì có **bảng việc sinh tự động** (`docs/phases/BANG-VIEC.md` + `bang-viec.json`) từ checklist các phase và `CLAIMS.md`, dòng đầu ghi "tệp sinh, không sửa tay". Cột tối thiểu: Đang làm · Bị chặn · Chưa ai nhận · Xong; theo phân hệ |
| — | Bản mẫu: open-ketoan `scripts/bang-viec.mjs` (693 việc, theo phân hệ). Bản chung: `tools/bang-viec.mjs --repo . --write` — đọc ô *Trạng thái* ở README phase và dòng bảng `| <mã> | … | <ký hiệu> |` trong `*CHECKLIST*.md` (☐ 🟡 ✅ ⛔ ⏸ ❌ ➡, ☐ ◐ ☑); việc ghi trạng thái ở repo điều phối (`→ open-setup`) chỉ trỏ sang, không đếm lại; không đè bảng do công cụ riêng của repo sinh <!-- [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 --> |

## 4. Rà soát

| Luật | Nội dung |
|---|---|
| R-STD-DLV-7 | Mỗi PR có mô tả: việc gì, phiếu / mã việc nào, **khối Bằng chứng chạy máy** (lệnh + kết quả: kiểm chuẩn, test, typecheck), ghi rõ chỗ đỏ có sẵn trên `main` (không do PR) |
| R-STD-DLV-8 | Rà định kỳ (sau mỗi vài phase / mỗi đợt đóng góp lớn) ghi ở `docs/reviews/` hoặc `docs/audits/REVIEW-<ngày>-<phạm vi>.md`: kết luận **ĐẠT / ĐẠT có điều kiện / KHÔNG ĐẠT**, phát hiện có mã luật + `tệp:dòng`, việc giao cho ai |
| — | Bản mẫu: open-ketoan RULE-REVIEW (11 trục, T1/T2/T4/T5 là cổng), `scripts/cham-pr.mjs` (chấm PR đã merge), `scripts/ra-soat-dong-gop.mjs` |

## 5. Bàn giao

| Luật | Nội dung |
|---|---|
| R-STD-DLV-9 | Phase **đổi người làm** hoặc **đóng** thì có `BAN-GIAO.md` trong thư mục phase |
| — | Mục bắt buộc: (1) phase là gì trong một đoạn; (2) đã xong — bảng đợt · việc · PR · mã chính; (3) còn lại — thứ tự khuyên, chặn bởi gì; (4) quy trình bắt buộc / cách chạy, kiểm; (5) bản đồ mã và hợp đồng; (6) quyết định cần nhớ (đừng đảo); (7) cạm bẫy đã gặp. Bản mẫu: open-ketoan `PHASE-031-…/BAN-GIAO.md` |

## 6. Dựng khung và "đã kiểm lại chưa, đạt chưa"

<!-- [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 -->

Repo chưa có gì: `node ../bizcity-platform/tools/scaffold-delivery.mjs --repo . --write` tạo khung từ `templates/delivery/` — README + mẫu phiếu nghiệm thu, README rà soát, mẫu bàn giao `docs/phases/_MAU-BAN-GIAO.md`, bảng việc (nếu có phase). **Chỉ tạo tệp còn thiếu**, không ghi đè, không viết phiếu hay biên bản thay bộ phận sử dụng. Repo để git bỏ qua `docs/` thì đặt ở gốc: `NGHIEM-THU/`, `RA-SOAT/`. Danh sách phiếu trong README nghiệm thu: `delivery-check.mjs --repo . --write-index`.

### Một lệnh trả lời

```bash
node ../bizcity-platform/tools/delivery-check.mjs --repo . --report
```

In bảng: số phiếu theo trạng thái, phiếu `Đạt`, phiếu treo (`Chờ nghiệm thu` > 14 ngày), phiếu thiếu test, phiếu thiếu biên bản, phase thiếu bàn giao, có bảng việc / có rà soát hay chưa. Phát hiện chảy vào tệp nợ `NO-CHUAN-NEN.md` (R-STD-9) khi sinh lại.

## 7. Kiểm

| Mã | Kiểm | Mức |
|---|---|---|
| SC-DLV-1 | có `docs/nghiem-thu/README.md` + `_MAU.md` (R-STD-DLV-1) | app Node: chặn · plugin: cảnh báo |
| SC-DLV-2 | ô *Trạng thái* của mỗi phiếu bắt đầu bằng từ khoá đóng (§2) | cảnh báo |
| SC-DLV-3 | `Đạt` ⇒ có biên bản; `Chờ nghiệm thu` ⇒ §7 có commit và tệp test | cảnh báo |
| SC-DLV-4 | phiếu `Chờ nghiệm thu` / `Đạt` có mã xuất hiện trong test | cảnh báo |
| SC-DLV-5 | có bảng việc sinh tự động khi repo có `docs/phases/` (R-STD-DLV-6); README nghiệm thu liệt kê đủ phiếu (R-STD-DLV-5) | cảnh báo |
| SC-DLV-6 | có nơi ghi rà soát (`docs/reviews/` hoặc `docs/audits/`) | cảnh báo |
| SC-DLV-7 | phase đã đóng (checklist không còn việc mở) có `BAN-GIAO.md` | ghi chú |
| SC-DLV-8 | phiếu `Chờ nghiệm thu` quá 14 ngày (theo lần sửa cuối trong git) | cảnh báo |

**Giới hạn đã biết:** tuổi phiếu lấy từ lần sửa cuối trong git — một commit gộp chạm mọi phiếu sẽ làm tuổi về 0. Phiếu nên ghi ngày sau từ khoá trạng thái (`Chờ nghiệm thu — 20/11/2026`); bản sau của công cụ đọc ngày này trước.

Chỉ SC-DLV-1 chặn (với app Node); phần còn lại là cảnh báo để repo trả dần qua tệp nợ — không chặn công việc đang chạy.

## 8. Hiện trạng (đo 2026-11-25)

| Repo | Nghiệm thu | Bảng việc | Rà soát | Bàn giao |
|---|---|---|---|---|
| open-ketoan | 71 phiếu: Nháp 10 · Đã chốt 44 · Chờ nghiệm thu 13 · 4 ngoài từ khoá; **0 Đạt có biên bản** (vòng chưa khép lần nào); 6 phiếu chờ nghiệm thu chưa có test nhắc mã; README thiếu 38 phiếu | có, sinh tự động (693 việc) | có (`docs/reviews`, `docs/audits`, `cham-pr`) | 1 / 39 phase (PHASE-031) |
| 9 repo còn lại | chưa có | chưa có | chưa có | chưa có |

Chi tiết từng repo: `delivery-check --report`; việc phải làm: tệp `NO-CHUAN-NEN.md` của repo.
