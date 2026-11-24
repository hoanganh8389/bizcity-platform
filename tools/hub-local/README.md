# hub-local: Hub + máy chủ SSO thử trên máy dev

<!-- [2026-11-24 11:55 PM Johnny Chu - Chu Hoàng Anh] SPINE-7 — hướng dẫn + bài học dựng hub-local (rút từ okt.local / shop-b.okt.local và fb017-wp) -->

Bộ này dựng trên máy dev một **WordPress đóng vai Hub bizcity**, gồm plugin `bizcity-llm-router` đang code và `open-ketoan-bridge`. Hub là **gốc danh tính**: nó phát vé đăng nhập một lần theo `bizcity_identity@1` ([BIZCITY-IDENTITY-v1](../../docs/standard/BIZCITY-IDENTITY-v1.md)). Bộ dựng kèm một **open-ketoan** bản `main` riêng để nhận vé. Mục đích: repo nào cũng thử được đăng nhập bằng tài khoản WordPress và gọi Hub mà không cần site thật, không đụng CSDL thật.

```
trình duyệt ──► http://hub.localhost:8095      WordPress (hub-local-wp-1)   llm-router + bridge + mu-plugin hub-local
     │              │ admin-post …sso_go / bizcity_hub_sso  →  302  <app>#sso=<vé>
     ▼              ▼
http://ketoan.localhost:8094   open-ketoan main (hub-ketoan-*)   POST /api/v1/auth/wp-sso  → khớp sub, kiểm aud
http://cake.localhost:8110     app khác (open-cake…)              tự kiểm vé bằng HUB_SSO_SECRET
                 mạng Docker chung: bizcity-hub (bí danh hub.localhost, ketoan.localhost)
```

## Dùng

```bash
bash tools/hub-local/up.sh          # dựng / cập nhật; lần đầu ~5 phút (build open-ketoan)
bash tools/hub-local/check.sh       # kiểm đầu cuối, phải ra KẾT QUẢ: ĐẠT
bash tools/hub-local/down.sh        # dừng (giữ dữ liệu);  --xoa  xoá sạch CSDL
```

- Khoá và mật khẩu nằm ở `D:/projects/hub-local/.env`, sinh một lần. Script không in khoá ra màn hình; đừng dán khoá vào chat, commit hay PR.
- Tài khoản: Hub `admin` / `nv1` (mật khẩu `HUB_ADMIN_PASS`). open-ketoan `admin@hub.local` (mật khẩu `KT_ADMIN_PASS`), đơn vị `hub`.
- `up.sh` cập nhật open-ketoan và bridge theo `main` mỗi lần chạy, trừ khi thư mục có sửa dở. `--khong-cap-nhat` để giữ nguyên bản đang có.
- Plugin llm-router được gắn **chỉ đọc** từ thư mục đang code (`HUB_LLM_ROUTER_DIR`), nên sửa mã là thấy ngay, không cần chép.

## Nối một repo khác vào Hub

1. Khai app ở `HUB_SSO_APPS` trong `.env`, dạng `aud=địa-chỉ-gốc`, cách nhau dấu phẩy. `aud` là `id` của app trong `bizcity.app.json`. Ví dụ: `open-cake=http://cake.localhost:8110`. Chạy lại `up.sh`.
2. App đặt khoá chung bằng `HUB_SSO_SECRET` trong `.env`. App chấp nhận `aud` bằng id của chính nó. Địa chỉ phát vé của app là:
   `http://hub.localhost:8095/wp-admin/admin-post.php?action=bizcity_hub_sso&aud=<app>&return=<địa chỉ trong app>`
3. Nếu app chạy trong Docker và cần gọi Hub, nối nó vào mạng chung: `docker network connect bizcity-hub <container>`. Từ trong container, gọi Hub ở `http://hub.localhost:8095`.
4. Test tự động không cần trình duyệt:
   `docker exec -u www-data hub-local-wp-1 wp hub-sso ticket --login=nv1 --aud=<app>` in ra một vé. Gửi vé đó vào app. Vé hết hạn sau 5 phút.
5. Thêm bước kiểm của app vào `check.sh` (theo mẫu mục [4]), để lần sau một lệnh kiểm được cả chuỗi.

open-ketoan dùng đường phát vé của **bridge** (`action=tgs_acc_sso_go`), cũng là mã chạy trên site thật. Đường `bizcity_hub_sso` chỉ có ở mu-plugin máy dev, dành cho các app chưa có plugin phát vé riêng. Mu-plugin tự tắt nếu thiếu hằng `BIZCITY_HUB_LOCAL` hoặc địa chỉ site không phải `*.localhost`.

## Bài học (đã gặp thật, đừng lặp lại)

| # | Chuyện đã gặp | Cách làm đúng |
|---|---|---|
| 1 | Tên `okt.local`, `shop-b.okt.local` phải thêm vào `C:\Windows\System32\drivers\etc\hosts`. Việc này cần quyền Administrator: agent không tự làm được, hộp UAC bị chặn, người dùng phải tự chạy PowerShell "Run as administrator". | Dùng `*.localhost`. Chrome, Edge, Firefox và curl tự trỏ `*.localhost` về máy, không cần hosts. Nếu bắt buộc dùng `.local`: người dùng chạy `Add-Content C:\Windows\System32\drivers\etc\hosts "`r`n127.0.0.1 <tên>"; ipconfig /flushdns`. |
| 2 | Lỗi `DNS_PROBE_FINISHED_NXDOMAIN` dù đã sửa hosts. | Edge bật "Use secure DNS" thì bỏ qua hosts: tắt ở `edge://settings/privacy`, đóng hẳn trình duyệt rồi mở lại. Hộp đỏ của tiện ích VPN (UrbanVPN) chỉ là cảnh báo tên miền lạ. |
| 3 | Cổng 80 đã có `okt-wp` giữ, cổng 443 có `fb017-wp`. WordPress multisite không cài được trên cổng khác 80 / 443. | Hub là WordPress **một site** trên cổng 8095. Bridge khai `Network: true` nhưng vẫn bật được trên một site. Cần multisite (shop-a, shop-b) thì dùng `okt-wp`. |
| 4 | Địa chỉ `http://hub.localhost:8095` gọi từ trong container không tới được Apache (Apache nghe cổng 80). WP-Cron và REST loopback hỏng. | Apache trong container nghe **đúng cổng ngoài** (compose sửa `ports.conf`). Trên mạng chung, container mang bí danh `hub.localhost`. |
| 5 | WordPress nối nhầm CSDL khi container nằm trên hai mạng mà cả hai đều có dịch vụ tên `db`. | Đặt tên dịch vụ CSDL riêng (`hubdb`, `wpdb`), không dùng `db`. |
| 6 | WP-CLI mất sau mỗi lần tạo lại container (`/usr/local/bin` không nằm trong volume). | `up.sh` cài lại khi thiếu. |
| 7 | Git Bash đổi `/var/www/html` thành `C:/Program Files/Git/var/www/html` khi gọi `docker exec`. Docker Desktop không hiểu đường dẫn kiểu `/d/projects`. | `export MSYS_NO_PATHCONV=1` và dùng đường dẫn kiểu `D:/…` (`pwd -W`). |
| 8 | `--blog=N` và `--user=x` không tới được lệnh WP-CLI vì đó là tham số chung của WP-CLI. | Lệnh riêng dùng tên khác: `--shop=N` (bridge), `--login=x` (hub-sso). |
| 9 | `wp plugin activate` trả mã lỗi khi plugin in cảnh báo PHP, dù plugin đã bật. | Bật xong thì hỏi lại bằng `wp plugin is-active`. |
| 10 | Hub chặn site thử nghiệm: khoá API gắn tên miền `localhost` / `.local` / `.test` bị từ chối; `wp_safe_remote_*` từ chối host nội bộ; callback của Hub phải là HTTPS cùng tên miền; Zalo Brain chặn tạo số trên site thử (`dev_site_block`). | Mu-plugin nới hai chốt đầu (`bizcity_zalo_hub_key_allowed`, `http_request_host_is_external` cho `*.localhost` và container `*-1`). Hai chốt sau **không** nới ở đây. Muốn thử Zalo Brain ↔ Cell đầu cuối thì dùng `D:/projects/fb017-wp` (HTTPS tự ký trên 443). Không nới chốt nào trong mã plugin. |
| 11 | Stack của phiên khác (`okt-wp`, `okt-thu`, `fb017-*`, `cake`) đang có người dùng. `okt-thu` là open-ketoan cũ, chưa có `users.external_sub`. | Không sửa, không tạo lại stack của phiên khác. Hub-local có stack riêng (`hub-local`, `hub-ketoan`), cổng riêng (8094, 8095, 5446). |
| 12 | Phải có vé thật do mã PHP dựng thì mới biết hai bên khớp nhau; test tự viết vé dễ khớp sai với chính nó. | `check.sh` mục [2] dùng đúng `TGS_Acc_Embed::ticket()` của bridge. Mục [3] đi đúng đường chuyển hướng của trình duyệt, kể cả chặn địa chỉ quay về lạ. |

## Bản đồ stack trên máy dev (24/11/2026)

| Stack | Địa chỉ | Dùng cho |
|---|---|---|
| `hub-local` + `hub-ketoan` | hub.localhost:8095, ketoan.localhost:8094 | Hub + SSO + open-ketoan main (bộ này) |
| `okt-wp` + `okt-thu` | okt.local, shop-a / shop-b.okt.local (cổng 80), 127.0.0.1:8098 | lát dọc POS → bridge → kế toán, multisite (phiên bridge) |
| `fb017-wp` + `fb017-local` | fb017-trial.com (443, tự ký) | Zalo Brain ↔ Hub ↔ Cell đầu cuối (phiên automation) |
| `cake` | 127.0.0.1:8110 / 8120 | open-cake |
| `ketoan` | 0.0.0.0:8088 | bản cài open-ketoan chính trên máy, **không** dùng để thử |
