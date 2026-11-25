# Bộ mẫu cho `failure-check --self-test`

- `good/` — một màn có bản đồ lỗi đủ năm loại đích (ô, danh sách chọn, nguồn gốc, luồng, trạng thái); phải ĐẠT, không cảnh báo.
- `bad/` — bản đồ sai: mã không có trong danh mục, dòng chặn không có test, test trỏ tệp không có, ô không có trên form, sửa tại chỗ trỏ action không có, lời nhắc quá ngắn, thao tác khai mà không có dòng, chặn mà không bắt ở giao diện, form không có bản đồ. Mỗi kiểm SC-FAIL-1..6 phải bắt được ít nhất một lỗi.
- `observed.jsonl` — lỗi gặp thật (mẫu) cho SC-FAIL-7.
