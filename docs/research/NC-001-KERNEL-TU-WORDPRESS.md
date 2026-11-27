# NC-001 — Học backend WordPress để dựng Platform Kernel (TypeScript + PostgreSQL)
<!-- [2026-11-26 11:44 PM Johnny Chu - Chu Hoàng Anh] NC-001 — chủ (2026-11-26): nghiên cứu wp_blogs, site, sitemeta, options, posts, postmeta, users, usermeta, cơ chế cache, hooks; phân tích theo lớp Database · Multisite Context · Options · Metadata · Cache · Identity · Plugin Runtime; đứng ở vị trí system builder (open-setup + bizcity-platform) để chuẩn hoá cho open-cake, open-kiot (TS), open-ketoan. -->

> **Loại:** nghiên cứu (không phải chuẩn) · **Trạng thái:** chờ chủ đọc và chốt §12 · **Đầu ra mong đợi:** các chuẩn / phase của nền ở §11, mỗi cái một PR riêng theo R-PLAT-7.
> **Đứng trên:** [ARCHITECTURE](../ARCHITECTURE.md) · [MULTISITE](../standard/BIZCITY-MULTISITE-v1.md) · [CACHE](../standard/BIZCITY-CACHE-v1.md) · [USERS-ROLES](../standard/BIZCITY-USERS-ROLES-v1.md) · [IDENTITY](../standard/BIZCITY-IDENTITY-v1.md) · [HUB](../standard/BIZCITY-HUB-v1.md) · [SPINE](../standard/BIZCITY-SPINE-v1.md) · canon lớp mềm (open-hub `CHUAN-DU-LIEU-TRUC-VA-LOP-MEM`) · nơi lưu tệp (open-cake [26-NOI-LUU-TEP](https://github.com/hoanganh8389/open-cake/blob/main/docs/architecture/26-NOI-LUU-TEP.md)).
> **Tên gọi (chủ chốt 2026-11-27):** phía Bizcity giữ **settings** (`bizcity_settings@1`, `ctx.settings`, như open-ketoan đang dùng); "options" chỉ là tên của WordPress. <!-- [2026-11-27 10:43 AM Johnny Chu - Chu Hoàng Anh] NC-001 — giữ tên settings -->
> **Cách đọc:** mỗi lớp có bốn phần — **WordPress làm gì** · **bài học (giữ / tránh)** · **nền hiện có** (đọc mã `@bizcity/platform` 0.2.0, 2026-11-26) · **đề xuất**. §1 là kết luận một trang; §13 là bảng đọc ngược 20 tệp lõi WP 6.9 (có số dòng); §14 đối chiếu sơ đồ đích 12 engine.

## 1. Kết luận một trang

WordPress mạnh không nhờ nhiều tính năng trong lõi mà nhờ **một ngữ cảnh site + một API chung cho cấu hình / đối tượng / thuộc tính / đệm + điểm mở rộng thống nhất**. Nền Bizcity **đã có xương** của phần lớn các ý đó, nhưng rải rác và thiếu "một cửa":

| Lớp | WordPress | Nền đang có | Thiếu — đề xuất | Ưu tiên |
|---|---|---|---|---|
| Database | bảng toàn mạng (`wp_users`, `wp_blogs`, `wp_site`, `wp_sitemeta`) + bảng theo blog (`wp_20_posts`…) trong **một** CSDL | control DB (`sites`, `site_domains`…) + **mỗi site mỗi app một CSDL** + RLS theo đơn vị — cách ly mạnh hơn WP | phân loại bảng `global` / `site` có kiểm; chiến lược kết nối cho hàng nghìn site (§2.4) | cao |
| Multisite Context | `switch_to_blog()` đổi tiền tố bảng + nhóm đệm + vai, **không** nạp lại plugin | `withSite()` / `forEachSite()` qua AsyncLocalStorage, pool theo site, đóng khi thiếu (R-SITE-3) | **`SiteContext` một cửa** `ctx.{db, options, objects, meta, cache, storage, events, actor, modules}` (§3) | **cao nhất** |
| Options | `wp_options` + `autoload` + `alloptions` + `notoptions` + `wp_sitemeta` | `setting_values` có phiên bản, phạm vi tenant → đơn vị kế toán → chi nhánh → người dùng, registry có kiểu / quyền gác, `config_version` | phạm vi **mạng / hệ thống**; **nạp trước** khoá khởi động; **đệm phủ định**; đọc có kiểu theo registry (§4) | cao |
| Metadata | `wp_posts` một bảng mọi loại + `wp_postmeta` EAV + `register_post_type` / `register_meta` | canon "trục cứng + lớp mềm": `entity_meta`, `user_meta`, `record_types` / `records` (mới ở open-cake), document kernel, item master | **Universal Object API là mặt tiền, không phải một bảng**: một ngữ pháp tham chiếu + registry loại + bộ nạp lô (§5) | cao |
| Cache | object cache theo nhóm, nhóm toàn mạng / theo site, `alloptions`, `notoptions`, transient, `last_changed`, priming | **chuẩn** CACHE có luật (không đệm sổ, khoá đủ site + tenant + `config_version`) nhưng **chưa có mã** trong nền | cổng `cache` ba tầng (yêu cầu · tiến trình · Redis), không gian tên có phiên bản, bộ nạp lô (§6) | cao |
| Identity | `wp_users` toàn mạng; vai theo blog nằm trong `wp_usermeta` (`wp_20_capabilities`) | Hub (WP bizcity) là nguồn danh tính `sub = wp:<id>`; mỗi app giữ người dùng theo đơn vị (R-USER-3), vé SSO HMAC, `sid` theo site | **hai mặt phẳng**: danh tính + thành viên ở mặt điều khiển, vai + quyền ở CSDL site; `external_sub`, tài khoản dịch vụ (§7) | cao |
| Plugin Runtime | `add_action` / `add_filter` không kiểu, nạp plugin theo blog mỗi yêu cầu | `defineAction` (REST + MCP + UI), `register*` registry, hook đóng (`masterdata.referenceCheck`), module chạy bằng vai CSDL riêng, outbox | **hook có kiểu**: action / filter / guard, sau commit đi outbox, bật / tắt theo site lúc gọi (§8) | trung bình |

Ba bài học lớn nhất:

1. **Một ngữ cảnh, nhiều thứ đổi theo** — `switch_to_blog` đổi *cả* bảng lẫn đệm lẫn vai. Nền mới đổi *CSDL*. Phải để đệm, cấu hình, tệp, module bật, người thao tác cùng đi theo một `ctx`, nếu không sẽ lặp lỗi open-ketoan đã gặp: nhật ký tệp hai site ghi chung vì mọi site đều có đơn vị mã 1 (F-4 của tài liệu 26).
2. **Bảng chung cho phần đuôi dài, bảng riêng cho trục** — WooCommerce phải dời đơn hàng khỏi `wp_posts` sang bảng riêng (HPOS) vì EAV không chịu nổi tải. Canon lớp mềm của Bizcity đã chọn đúng; Universal Object API chỉ là **mặt tiền đọc / ghi thống nhất**, không gom mọi thứ vào một bảng.
3. **Điểm mở rộng phải là hợp đồng có kiểu** — hook không kiểu của WP là nguồn lỗi lớn nhất của hệ sinh thái plugin. Nền đã đi đúng (action có schema, hook đóng); cần mở rộng có kỷ luật.

## 2. Lớp Database

### 2.1 WordPress làm gì

| Loại | Bảng | Ghi chú |
|---|---|---|
| Toàn mạng | `wp_site` (mạng), `wp_sitemeta` (cấu hình mạng: `site_admins`, `active_sitewide_plugins`…), `wp_blogs` (blog: `domain`, `path`, `public`, `archived`, `deleted`), `wp_blogmeta`, `wp_users`, `wp_usermeta`, `wp_signups`, `wp_registration_log` | một bản cho cả mạng |
| Theo blog | `wp_{id}_options`, `wp_{id}_posts`, `wp_{id}_postmeta`, `wp_{id}_terms`, `…_term_taxonomy`, `…_term_relationships`, `…_comments`, `…_commentmeta` | blog chính dùng tiền tố `wp_` trần |
| Chuyển blog | `$wpdb->set_blog_id($id)` đổi `$wpdb->prefix` và tên các bảng theo blog | cùng một kết nối MySQL |
| Mở rộng | HyperDB / LudicrousDB chia blog ra nhiều máy CSDL theo luật | thêm vào sau, không có sẵn |

### 2.2 Bài học

- **Giữ:** tách rõ "bảng toàn mạng" và "bảng theo site". Mọi bảng phải biết mình thuộc loại nào.
- **Tránh:** mọi site chung một CSDL (10 000 blog × 11 bảng = 110 000 bảng, sao lưu / khôi phục một site rất khó, rò dữ liệu khi quên tiền tố). Mã cũ của mạng bizcity (`bizcity-web/lib/duplicate.php`) phải tự đi `get_blog_prefix_raw`, `get_globaldb` để nhân bản — dấu hiệu của mô hình chung CSDL.

### 2.3 Nền đang có

Control DB của từng app (`sites`, `site_domains`, `provision_keys`, `site_jobs`, `site_backups`) ≈ `wp_blogs` + `wp_site`. Mỗi site mỗi app **một CSDL** (`cake_<slug>`, `kt_<slug>`), vai CSDL riêng, RLS theo `tenant_id` bên trong (R-SITE-1, R-SITE-2). Cách ly tốt hơn WP một bậc.

### 2.4 Đề xuất

| Mã | Đề xuất |
|---|---|
| K-DB-1 | Mỗi migration khai **phạm vi** bảng: `-- @bizcity-scope control` (chỉ ở control DB) hoặc `site` (mọi CSDL site). Kiểm: không bảng `site` nào chứa danh tính gốc toàn mạng; không bảng `control` nào chứa dữ liệu nghiệp vụ |
| K-DB-2 | **Kết nối cho hàng nghìn site.** Pool hiện tại: ≤ 4 kết nối / site, đóng sau 30 giây rảnh. 3 000 site × 4 = 12 000 kết nối nếu cùng nóng — PostgreSQL chịu không nổi. Cần: trần **tổng** số pool đang mở (LRU đóng pool lạnh), và PgBouncer chế độ transaction đứng trước khi số site vượt vài trăm. WP né được nhờ một kết nối cho mọi blog — đó là cái giá của cách ly CSDL, phải trả bằng thiết kế |
| K-DB-3 | Giữ `ULID` cho mọi khoá trục (đã có); không dùng số tự tăng làm khoá trên dây — `tenant_id = 1` ở mọi site là bằng chứng số tự tăng không định danh được gì ngoài CSDL của nó |

## 3. Lớp Multisite Context

### 3.1 WordPress làm gì

```php
get_option('shop_name');            // blog đang chạy
switch_to_blog(20);                 // đẩy blog hiện tại vào $_wp_switched_stack
  get_option('shop_name');          // đọc wp_20_options
  get_post(100); get_post_meta(100, 'barcode');
restore_current_blog();             // lấy lại blog trước
```

`switch_to_blog()` đổi: tiền tố bảng (`$wpdb->set_blog_id`), không gian đệm (`wp_cache_switch_to_blog` — nhóm không toàn mạng gắn blog id), vai và quyền của người dùng hiện tại theo blog mới. **Không** đổi: plugin đã nạp, theme, hook đã gắn, hằng số. Hệ quả quen thuộc: plugin chỉ bật ở blog A vẫn chạy hook khi đang "đứng" ở blog B; quên `restore_current_blog()` thì cả phần sau của yêu cầu chạy sai blog.

### 3.2 Bài học

- **Giữ:** mã nghiệp vụ không biết CSDL ở đâu, tên gì, tiền tố đệm gì — chỉ biết "site đang chạy".
- **Tránh:** cặp switch / restore bằng tay (dễ quên, khó lồng); ngữ cảnh đổi một nửa (bảng đổi, plugin không).

### 3.3 Nền đang có

`db/site.ts`: `currentSiteId()`, `poolOf()`, `withSite(siteId, fn)`, `forEachSite(fn, onError)` trên AsyncLocalStorage (`core/request-context.ts`). Phạm vi tự đóng khi `fn` xong — tốt hơn switch / restore. Chế độ `multi` thiếu site ⇒ `SITE_CONTEXT_MISSING`, không rơi về site ngầm định. **Nhưng** chỉ CSDL đi theo site; đệm, cấu hình, tệp, module bật đang là chuyện riêng của từng chỗ.

### 3.4 Đề xuất — Site Context Engine

```ts
await platform.withSite(siteId, async (ctx) => {
  const name = await ctx.settings.get('bizcity.cake.shop.name');    // có kiểu từ registry
  const c = await ctx.objects.get(`contact:${contactId}`);          // §5
  const items = await ctx.db.selectFrom('catalog_items').selectAll().execute();
  await ctx.cache.wrap('catalog', `price:${itemId}`, () => loadPrice(ctx, itemId));
  await ctx.storage.put('chat', file);                              // 26-NOI-LUU-TEP
  await ctx.events.emit('bizcity.cake.order.requested', payload);   // outbox, sau commit
});
```

```ts
interface SiteContext {
  site: { id: string; slug: string; mode: 'single' | 'multi'; schemaVersion: number; appVersion: string };
  tenant: { id: string; configVersion: number; authzVersion: number } | null;   // đơn vị trong site (RLS)
  actor: { kind: 'user' | 'apikey' | 'agent' | 'system'; sub: string; localUserId?: string; perms: ReadonlySet<string> };
  db: Db;                 // Kysely gắn pool của site + bizcity.tenant_id cho RLS
  settings: SettingsApi;  // §4 — bizcity_settings@1
  objects: ObjectsApi;    // §5
  meta: MetaApi;          // §5
  cache: CacheApi;        // §6 — khoá tự mang site / tenant / phiên bản
  storage: StorageApi;    // 26-NOI-LUU-TEP — khoá tự mang sites/<slug>
  events: EventsApi;      // outbox
  modules: { enabled(key: string): boolean };   // §8
}
```

| Mã | Luật |
|---|---|
| R-CTX-1 | Mọi thứ thuộc site (CSDL, cấu hình, đệm, tệp, sự kiện, module bật) chỉ lấy qua `ctx`; không singleton toàn cục nào giữ dữ liệu của site |
| R-CTX-2 | Chuyển site **chỉ** bằng `withSite` / `forEachSite` (phạm vi tự đóng); không có API "đặt site hiện tại" |
| R-CTX-3 | Việc chạm hai site trong một lượt (nhân bản, đối chiếu) là việc điều hành: chạy bằng `system` actor, ghi bằng chứng ở control DB |
| R-CTX-4 | `ctx` được dựng **một lần** mỗi yêu cầu / mỗi lượt `forEachSite` (lười từng phần), không dựng lại cho từng truy vấn |
| R-CTX-5 | Khác WP: mã module nạp một lần cho cả tiến trình, nên "plugin bật theo site" quyết định **lúc gọi** (`ctx.modules.enabled` ở dispatcher action / hook / subscriber), không quyết định lúc nạp |

Đây là việc **đầu tiên** của lộ trình (§11): mọi lớp sau đều treo vào `ctx`.

## 4. Lớp Options

### 4.1 WordPress làm gì

| Cơ chế | Ý |
|---|---|
| `wp_options` (`option_name` duy nhất, `option_value` chuỗi tuần tự hoá, `autoload`) | một chỗ cho mọi cấu hình, plugin không phải tạo bảng |
| `autoload` + `wp_load_alloptions()` | mọi option tự nạp lấy bằng **một truy vấn** đầu yêu cầu, giữ trong đệm `alloptions` |
| `notoptions` | nhớ "khoá này không có" để không hỏi CSDL lần nữa |
| `get_network_option` / `wp_sitemeta` | cấu hình toàn mạng |
| `register_setting()` | khai kiểu, làm sạch, hiện qua REST |
| bộ lọc `pre_option_{name}` / `option_{name}` / `default_option_{name}` | plugin chen vào đường đọc |
| transient (`_transient_*` trong options, hoặc trong object cache) | đệm có hạn |

**Hạn chế:** giá trị không kiểu (chuỗi PHP serialize), không lịch sử, chỉ hai phạm vi (blog, mạng), `autoload` phình to làm chậm mọi trang.

### 4.2 Nền đang có

`core/settings.ts` + bảng `setting_values` (bizcity_settings@1): khoá `bizcity.<app>.<…>` khai trong registry (kiểu, mặc định, chủ, phạm vi, **quyền gác**), **chỉ thêm, có phiên bản, ngày hiệu lực, lý do, căn cứ**; phạm vi user → branch → accounting_unit → tenant → mặc định; `tenants.config_version` tăng mỗi lần ghi. Mạnh hơn WP ở kiểu, lịch sử, quyền.

### 4.3 Đề xuất

| Mã | Đề xuất | Tương ứng WP |
|---|---|---|
| K-OPT-1 | Thứ tự phạm vi đầy đủ: **hệ thống** (mặc định trong mã) → **mạng** (control plane / open-setup, áp mọi site của một bản cài) → **site** → tenant → đơn vị kế toán → chi nhánh → người dùng. Mạng và site lưu ở control DB, đọc qua `ctx.options` như các phạm vi khác | `wp_sitemeta`, `get_network_option` |
| K-OPT-2 | Khoá khai `boot: true` trong registry được **nạp một lần** khi dựng `ctx` (một truy vấn), giữ theo `(site, tenant, config_version)`; giới hạn tổng dung lượng boot / app (cảnh báo khi vượt) | `autoload` + `alloptions`, tránh phình |
| K-OPT-3 | **Đệm phủ định**: khoá đã đăng ký nhưng chưa có giá trị ở mọi phạm vi ⇒ nhớ "mặc định" theo `config_version`, không hỏi lại | `notoptions` |
| K-OPT-4 | `ctx.settings.get(key)` trả **đúng kiểu** suy từ schema của registry (zod), khoá lạ là lỗi biên dịch / lỗi chạy — không `undefined` âm thầm | `register_setting` + type |
| K-OPT-5 | Không bộ lọc chen đường đọc cấu hình (WP `pre_option_*`) — cấu hình là dữ liệu có bằng chứng; ai muốn đổi thì ghi phiên bản mới | tránh |
| K-OPT-6 | Transient **không** nằm trong options: TTL cache là việc của `ctx.cache` (§6) | tách |

## 5. Lớp Metadata và Universal Object API

### 5.1 WordPress làm gì

`wp_posts` chứa mọi loại nội dung (bài, trang, tệp, sản phẩm, đơn hàng cũ) phân biệt bằng `post_type`; `wp_postmeta` là bảng EAV `(post_id, meta_key, meta_value)`. `register_post_type()` khai loại, `register_meta()` khai khoá (kiểu, một / nhiều giá trị, làm sạch, hiện REST). Ví dụ sản phẩm 1001: `_sku = SKU001`, `_price = 350000`, `_weight = 900`, `_brand = Nutrabase`. `update_meta_cache()` nạp **mọi** meta của một lô ID bằng một truy vấn rồi giữ trong đệm. `meta_query` lọc theo meta phải JOIN nhiều lần — chậm khi dữ liệu lớn.

Bài học nặng ký nhất: **WooCommerce HPOS** dời đơn hàng khỏi `wp_posts` / `wp_postmeta` sang bảng riêng vì EAV không chịu nổi khối lượng đơn và báo cáo.

### 5.2 Nền và canon đang có

Canon lớp mềm (open-hub `CHUAN-DU-LIEU-TRUC-VA-LOP-MEM`, R-CANON-15) đã chọn đúng hướng HPOS ngay từ đầu: **trục cứng** (contact, item / partner, chứng từ, sổ, touch) có bảng riêng; **lớp mềm** kiểu WP — `setting_values` (options), `user_meta`, `entity_meta` (≈ postmeta, chỉ gắn vào thực thể trục), `record_types` / `records` (≈ custom post type) — có registry, ngưỡng nâng thành bảng. Bản đầu đang ở open-cake (`0103_flex.sql`), sẽ thành `@bizcity/flex`. Chứng từ có document kernel của nền (`business_documents`, `document_versions`, `document_links`, `document_attachments`). Mặt hàng có item master (`item_id` ULID, mã có phiên bản).

### 5.3 Ví dụ ảnh chụp, đặt theo chuẩn Bizcity

| WP (`wp_postmeta` của post 1001) | Bizcity | Vì sao |
|---|---|---|
| `_sku = SKU001` | `item_codes` (trục, mã có phiên bản + ngày hiệu lực) | mã hàng là định danh; đổi mã không đổi sổ (SPINE) |
| `_price = 350000` | `prices` theo bảng giá (trục) | tiền không bao giờ ở lớp mềm (R-DATA-2) |
| `_weight = 900` | `item` (cột chuẩn H-*) hoặc `entity_meta` `cake.item.weight_g` nếu chỉ một app cần | số lượng vật lý dùng cho vận chuyển — xét theo ngưỡng nâng |
| `_brand = Nutrabase` | `entity_meta` `cake.item.brand` (khai registry, có thể `indexed`) | thuộc tính mô tả, không chạm sổ |

### 5.4 Đề xuất — Universal Object API là mặt tiền

| Mã | Đề xuất |
|---|---|
| K-OBJ-1 | **Một ngữ pháp tham chiếu** cho mọi đối tượng xuyên app: `<loại>:<id>` cho thực thể trục (`contact:01J…`, `item:01J…`, `partner:01J…`, `record:01J…`) và `doc_ref` `<module>.<loại>:<id>` cho chứng từ (đã có ở SPINE). Không thêm ngữ pháp thứ ba |
| K-OBJ-2 | **Entity Registry** (≈ `register_post_type`): mỗi loại khai chủ (app), nơi lưu (`table` trục · `records` · `remote` — app khác làm chủ, đọc qua API / MCP), schema, quyền xem / sửa, khoá meta cho phép |
| K-OBJ-3 | `ctx.objects.get(ref)` / `getMany(refs)` / `list(type, query)` đi qua registry tới đúng nơi lưu; trả đối tượng có kiểu + meta đã khai; `remote` chỉ đọc, có đệm ngắn (R-CACHE-3) |
| K-OBJ-4 | **Bộ nạp lô bắt buộc** (≈ `update_meta_cache` + `_prime_post_caches`): `getMany` nạp đối tượng và meta của cả lô bằng một truy vấn mỗi loại, giữ trong đệm phạm vi yêu cầu — chặn N+1 |
| K-OBJ-5 | Ghi qua action của chủ đối tượng (`defineAction`), không ghi thẳng qua `ctx.objects` — giữ một cổng ghi (R-CANON-16) |
| K-OBJ-6 | Đường nâng: `records` → bảng riêng khi chạm ngưỡng canon (số dòng, có tiền / số lượng, có báo cáo, ≥ 2 app dùng) — bài học HPOS, làm bằng migration có bộ chuyển đổi `type_version` (R-DATA-7) |
| K-OBJ-7 | Gọi tên: **"đối tượng" (object) cho mặt tiền, "thực thể trục" (entity) cho bảng cứng** — tránh gợi ý mọi thứ là một bảng (Q-K-4) |

## 6. Lớp Cache

### 6.1 WordPress làm gì — và tương ứng Bizcity

| Cơ chế WP | Vai trò | Bizcity tương ứng | Ghi chú |
|---|---|---|---|
| Object Cache (`wp_cache_get/set/add/delete/incr`) | đệm đối tượng | **Cache SDK** `ctx.cache` | một giao diện, nhiều adapter (R-STD-CACHE-1) |
| Cache Groups | phân loại | **Namespace** (`catalog`, `authz`, `options`, `objects:contact`…) | khai trong registry, mỗi namespace có TTL + sự kiện làm mất hiệu lực (R-STD-CACHE-4) |
| Global Groups (`users`, `usermeta`, `site-options`, `blog-details`, `networks`…) | dùng chung mọi site | **Global Cache** (phạm vi `control`) | chỉ dữ liệu mặt điều khiển: registry site, tên miền, danh tính |
| Site-specific groups (gắn blog id) | riêng từng site | **Site Cache** | khoá tự mang `site + tenant` từ `ctx` (R-SITE-6) |
| Persistent Cache (drop-in Redis) | xuyên yêu cầu | **Redis adapter** tuỳ chọn | khởi động được khi Redis vắng (R-STD-CACHE-2) |
| Non-persistent groups | chỉ trong yêu cầu | **Request Cache** (tầng 0) | thứ gắn với một lượt: đối tượng đã nạp, quyền đã tính |
| `alloptions` | nạp trước cấu hình | **Bootstrap Cache** (K-OPT-2) | theo `config_version` |
| `notoptions` | nhớ khoá không có | **Negative Cache** | áp cho cấu hình và tra ngoài (tra MST không thấy) |
| Transients | có hạn | **TTL Cache** | không ghi vào bảng cấu hình (K-OPT-6) |
| Metadata cache (`update_meta_cache`) | thuộc tính đối tượng | **Meta Cache** qua bộ nạp lô | K-OBJ-4 |
| Query cache (`WP_Query` + `last_changed`) | kết quả truy vấn | **Query Cache có phiên bản** | chỉ danh mục chậm đổi; không bao giờ sổ / số dư (R-CACHE-1) |
| Cache priming (`_prime_post_caches`) | nạp trước nhiều đối tượng | **Batch Loader** | K-OBJ-4 |
| `wp_cache_switch_to_blog` | đổi không gian khi chuyển blog | tự động qua `ctx` | R-CTX-1 |
| `wp_cache_get_last_changed('posts')` | phiên bản nhóm | **namespace version** | mất hiệu lực bằng tăng phiên bản, không xoá theo mẫu |

### 6.2 Bài học

- **Giữ:** nhóm toàn mạng / theo site; nạp trước + nhớ phủ định; **làm mất hiệu lực bằng tăng phiên bản** (`last_changed`) thay vì quét xoá khoá; nạp lô.
- **Tránh:** `wp_cache_flush()` xoá cả mạng; đệm không giới hạn trong tiến trình (rò bộ nhớ khi hàng nghìn site); đệm dữ liệu tiền / sổ.

### 6.3 Nền đang có

Chuẩn CACHE đã có luật tốt (R-CACHE-1…6, R-STD-CACHE-1…4) nhưng **chưa có mã `cache` trong `@bizcity/platform`**; open-ketoan đệm bằng `Map` rải ở nhiều tệp; open-cake chưa đệm gì ngoài sổ vai.

### 6.4 Đề xuất

```text
khoá đầy đủ:  bz:<app>:<control|site>:<site>:<tenant|_>:<namespace>:v<phiên bản namespace>:<khoá>
tầng 0  Request   Map trong ctx, chết theo yêu cầu (nạp lô, quyền đã tính)          — luôn bật
tầng 1  Process   LRU có trần byte, chia hạn mức theo site (chống "hàng xóm ồn")      — mặc định
tầng 2  Redis     adapter tuỳ chọn, cùng khoá                                         — profile redis
```

| Mã | Đề xuất |
|---|---|
| K-CACHE-1 | Một cổng `ctx.cache.{get, set, del, wrap, many}` + `cache.global` cho phạm vi control; mã nghiệp vụ không dựng khoá tay — chỉ đưa `namespace` + khoá ngắn |
| K-CACHE-2 | Mất hiệu lực bằng **tăng phiên bản namespace** (một khoá đếm / site / namespace), làm **sau commit** qua outbox hoặc `LISTEN / NOTIFY` (open-cake đã có `notifyChanged` cho SSE — dùng cùng đường) |
| K-CACHE-3 | Tầng 1 có **trần tổng** và **hạn mức theo site**; site lạnh bị đẩy ra trước. Đây là chỗ quyết định "hàng nghìn site trên một máy" |
| K-CACHE-4 | Chống dồn (stampede): `wrap` gộp các lời gọi đồng thời cùng khoá thành một lần nạp (single-flight) |
| K-CACHE-5 | Danh sách **không bao giờ đệm** giữ nguyên R-CACHE-1; bộ kiểm SC-CACHE-P2 (`CACHE=off` vẫn xanh) là điều kiện nhận mọi namespace mới |

## 7. Lớp Identity

### 7.1 WordPress làm gì

`wp_users` và `wp_usermeta` là **toàn mạng**: một người một dòng cho mọi blog. Vai **theo blog** nằm trong usermeta với khoá có tiền tố blog: `wp_20_capabilities`, `wp_20_user_level`; "là thành viên blog 20" = có khoá `wp_20_capabilities`. Định nghĩa vai của mỗi blog nằm trong option `wp_20_user_roles`. Siêu quản trị ở `wp_sitemeta.site_admins`. Đăng nhập theo cookie từng tên miền — nhiều tên miền phải thêm SSO / domain mapping.

**Hạn chế:** usermeta phình theo số blog × số khoá; vai không có phạm vi nhỏ hơn blog; nhiều tên miền là chuyện ngoài lõi.

### 7.2 Nền đang có

- Hub (WP bizcity.vn) là **nguồn danh tính toàn mạng**: `sub = wp:<id>`; vé SSO ký HMAC (`aud` = app), đổi lấy phiên của app (IDENTITY).
- Mỗi app: `users` **theo đơn vị** (một người ở hai đơn vị = hai dòng, R-USER-3), `user_role_assignments` có phạm vi + hiệu lực, `tenant_roles` / `tenant_role_rules`, quyền khai trong mã (`<module>:<chức-năng>-<động-từ>`), `api_keys`, `session_version`, `authz_version`; phiên mang `sid` khi nhiều site (R-USER-6, R-SITE-4).
- Thiếu: chỗ **nối một người qua nhiều site / app** (đang nối bằng email, sau này `sub`); sổ ánh xạ blog ↔ site ↔ bản app ở open-setup (MULTISITE §8); danh tính cho agent / worker ngoài khoá API.

### 7.3 Đề xuất — Identity Kernel hai mặt phẳng

Đặt các bảng anh đề xuất vào **đúng mặt phẳng** — không gom về một CSDL, vì mỗi site đã là một CSDL riêng:

| Bảng đề xuất | Mặt phẳng | Đặt ở | Đang có |
|---|---|---|---|
| `users` — danh tính toàn hệ thống | **điều khiển** | Hub là nguồn (`sub`); nền giữ bản chiếu `identities(sub, email đã xác minh, phone đã xác minh, trạng thái)` ở control DB khi cần tra | Hub `wp_users` |
| `user_meta` toàn hệ thống (ngôn ngữ, múi giờ, giao diện) | điều khiển | `identity_meta`, khoá khai registry, **không** vai / quyền / bí mật (R-USER-16) | — |
| `network_memberships` | điều khiển | open-setup: người ↔ khách hàng / bản cài (ai được mở site mới, xem hoá đơn) | user meta của Hub + `external_ref` |
| `site_memberships` | điều khiển | open-setup / control DB: `sub` ↔ site (trạng thái mời / đang dùng / khoá) — ≈ có khoá `wp_20_capabilities` | — |
| `roles`, `permissions`, `role_permissions` | **dữ liệu (site)** | quyền khai trong mã (registry); vai + luật ở `tenant_roles` / `tenant_role_rules` | có |
| `membership_roles` | dữ liệu (site) | `user_role_assignments` (phạm vi tenant / đơn vị / chi nhánh, hiệu lực) | có |
| `user_preferences` | dữ liệu (site) | `user_meta` của site (cột ẩn, bộ lọc lưu) | có (open-cake) |
| `service_accounts` | cả hai | `actor.kind = 'agent' \| 'system'`, `sub = svc:<id>`; khoá ở `api_keys` của site; không bao giờ mang quyền `risk: high` (R-STD-KEY-3) | `api_keys` (`actor_kind = apikey`) |

| Mã | Đề xuất |
|---|---|
| K-ID-1 | **Một chủ danh tính**: `sub` do Hub cấp, không app nào tự sinh danh tính toàn mạng. App vẫn tạo người dùng cục bộ được (R-USER-1) — khi đó `users.external_sub` rỗng tới lúc người đó đăng nhập bằng Hub lần đầu thì nối |
| K-ID-2 | `users` ở CSDL site thêm `external_sub` (duy nhất trong site): là **bản chiếu thành viên**, không phải danh tính. Một người ở 3 site = 1 `sub` + 3 dòng (mỗi site một) |
| K-ID-3 | **Nhiều tên miền:** `site_domains` (nhiều → một site, một `is_primary`) đã có. Đăng nhập không dựa cookie chung: Hub phát vé cho **đúng tên miền đích**, app đổi vé lấy phiên có `sid` của site (R-SITE-4). Một người chuyển site = một vé mới, không đổi phiên |
| K-ID-4 | Vai luôn **theo site** (và hẹp hơn: đơn vị / chi nhánh) — giữ đúng bài học `wp_20_capabilities`; không có "vai toàn mạng" ngoài siêu quản trị ở mặt điều khiển |
| K-ID-5 | Agent / worker là `actor` hạng nhất (`kind = 'agent'`) trong `ctx`, bằng chứng ghi `actor_kind = 'agent'`; MCP chỉ tạo nháp, ghi thật cần người duyệt (đã là luật) |

## 8. Lớp Plugin Runtime: hook, registry, vòng đời

### 8.1 WordPress làm gì

Mỗi yêu cầu nạp plugin theo `active_plugins` của blog + `active_sitewide_plugins` của mạng; hook là mảng toàn cục `$wp_filter` (tên chuỗi, độ ưu tiên, số tham số); action không trả giá trị, filter trả giá trị đã sửa. Mạnh vì **lõi chỉ cung cấp điểm mở rộng**; yếu vì không kiểu, phụ thuộc thứ tự, một plugin lỗi làm sập cả trang, hook chạy giữa giao dịch không ai biết.

### 8.2 Tương ứng

| WordPress | Bizcity Platform | Đang có |
|---|---|---|
| `add_action()` / `do_action()` | Hook Registry / Dispatcher (`kind: 'action'`, sau commit qua outbox) | `registerSubscribers` + outbox |
| `add_filter()` / `apply_filters()` | Typed Pipeline (`kind: 'filter'`, hàm thuần, trả bản mới) | — |
| (không có) | Guard (`kind: 'guard'`, được quyền **phủ quyết** trong giao dịch, chỉ đọc) | `masterdata.referenceCheck` |
| `register_post_type()` | Entity Registry (K-OBJ-2) | `registerDocumentType` |
| `register_meta()` | Metadata Registry | registry khoá meta của open-cake |
| `register_rest_route()` | API Registry = `defineAction` (REST + MCP + UI một lần) | có |
| `add_menu_page()` | Menu Registry (manifest giao diện) | — |
| `register_setting()` | Settings Registry | `registerModuleSettings` |
| `register_activation_hook()` … | Plugin Lifecycle: install / upgrade / enable / disable / uninstall theo **từng site** | `module_registry`, `tenant_modules` |
| WP-Cron | Scheduler = đồng hồ chạy qua `forEachSite` | có |
| WP-CLI | Platform CLI (`bizcity site …`) | có |
| `dbDelta()` | Migration Engine (có thứ tự, có khoá, theo site, có sao lưu trước) | có — tốt hơn `dbDelta` (bài học 3.11.1 ở router: dbDelta không thêm cột vào bảng đã có) |

### 8.3 Đề xuất — hook là hợp đồng có kiểu

```ts
export const orderBeforeSubmit = defineHook({
  name: 'bizcity.order.before_submit', kind: 'filter', version: 1,
  input: OrderDraftSchema, output: OrderDraftSchema, timeoutMs: 200, transactional: true,
});
registerHookHandler(orderBeforeSubmit, { module: 'loyalty', priority: 50 }, async (ctx, draft) => ({ ...draft, note: … }));
```

| Mã | Đề xuất |
|---|---|
| K-HOOK-1 | Danh sách hook **đóng theo phiên bản nền** (như `HOOKS` hiện có): thêm hook = đổi hợp đồng, có số phiên bản, có test hợp đồng |
| K-HOOK-2 | Ba loại: `guard` (trong giao dịch, chỉ đọc, phủ quyết bằng lý do), `filter` (trong giao dịch, hàm thuần, có trần thời gian, lỗi ⇒ bỏ handler đó + ghi lỗi, không sập luồng chính — trừ khi khai `critical`), `action` (**sau commit**, đi outbox, thử lại được) |
| K-HOOK-3 | Handler chạy với `ctx` của site và **vai CSDL của module** (`mod_<key>_rw`, đã có) — điều WP không làm được |
| K-HOOK-4 | Module tắt ở site / đơn vị ⇒ dispatcher bỏ qua handler (R-CTX-5) |
| K-HOOK-5 | Mỗi lần gọi hook ghi span (OTel) theo handler — truy được "plugin nào làm chậm" |

## 9. open-setup và bizcity-platform — đứng ở vị trí system builder

```text
            MẶT PHẲNG ĐIỀU KHIỂN (control plane)                          MẶT PHẲNG DỮ LIỆU (data plane)
Hub (WP bizcity.vn) ─ danh tính sub, khoá biz-…, 1API             mỗi site × mỗi app = một CSDL
open-setup (Site Manager) ─ khách hàng, site, sản phẩm bật,        cake_<slug> · kt_<slug> · pos_<slug> …
   sổ blog ↔ site ↔ bản app, cấu hình bản cài (R2 …)               RLS theo tenant, vai theo site
control DB của từng app ─ sites, site_domains, provision_keys,     ctx = withSite(site) → db · options ·
   site_jobs, site_backups                                         objects · meta · cache · storage · events
```

| Mã | Việc của system builder |
|---|---|
| K-SYS-1 | **Một mã site xuyên app:** open-setup cấp `site_ref` (ULID) + `slug` một lần; mọi app lưu `site_ref` vào `sites.external_ref`. `slug` là tên, `site_ref` là danh tính — đổi tên miền / slug không đứt liên kết |
| K-SYS-2 | Hợp đồng cấp site (`bizcity_site_provisioning@1`) mang thêm: `site_ref`, `product`, `owner_sub`, `template` (site mẫu để nhân bản), tham chiếu cấu hình lưu tệp (tài liệu 26) |
| K-SYS-3 | **Nhân bản site** = CSDL từ mẫu (`CREATE DATABASE … TEMPLATE`) + `copyPrefix` tệp (học `MUCD_Files` của mạng WP) — cùng một lệnh ở mọi app |
| K-SYS-4 | **Bộ khung app chung**: app mới (open-kiot TS, MRP…) khởi đầu từ `templates/` của nền có sẵn `ctx`, registry, migration, kiểm — không chép mã từ app khác |
| K-SYS-5 | Bảng **phân vai repo**: nền giữ kernel + chuẩn + bộ kiểm; open-setup giữ mặt điều khiển; app giữ trục và nghiệp vụ của mình; Hub giữ danh tính và khoá |

## 10. Áp vào từng app

| App | Bắt đầu từ | Ghi chú |
|---|---|---|
| open-cake | `ctx` + cache + flex → `@bizcity/flex` + objects facade | nền mới nhất, ít mã cũ — nơi thử đầu tiên |
| open-kiot (POS bản TypeScript tương lai) | khởi tạo từ `templates/` của nền với `ctx` sẵn | không mang nợ của bản WP (`tgs_pos`) |
| open-ketoan | nhận `ctx` qua `withSite` sẵn có; thay `Map` đệm bằng `ctx.cache`; sửa khoá tệp theo site (26 F-4) | qua R-FLOW của repo đó |
| plugin WP (open-crm, open-pos) | khai `bizcity.authz.json`, dùng cùng ngữ pháp tham chiếu (K-OBJ-1) | không dùng kernel TS, chỉ dùng hợp đồng |

## 11. Lộ trình đề xuất cho nền (mỗi mục một PR + chuẩn / phase riêng)

| Bước | Nội dung | Phụ thuộc |
|---|---|---|
| P-K1 | **`SiteContext`** bọc `withSite` sẵn có: `ctx.{site, tenant, actor, db, events, modules}`; R-CTX-1…5; kiểm "không singleton giữ dữ liệu site" | — |
| P-K2 | **`cache`**: ba tầng, khoá chuẩn, namespace có phiên bản, single-flight, hạn mức theo site; thay `Map` ở open-ketoan | P-K1 |
| P-K3 | **options**: phạm vi mạng / site, boot preload, đệm phủ định, đọc có kiểu | P-K1, P-K2 |
| P-K4 | **`@bizcity/flex` + objects**: nâng lớp mềm của open-cake, Entity Registry, ngữ pháp tham chiếu, bộ nạp lô | P-K1, P-K2 |
| P-K5 | **identity**: `users.external_sub`, actor `agent`, `site_memberships` ở open-setup, sổ blog ↔ site ↔ app | P-K1; Hub |
| P-K6 | **hook có kiểu** (guard / filter / action), vòng đời module theo site | P-K1 |
| P-K7 | **storage** (tài liệu 26 của open-cake) | P-K1 |
| P-K8 | **kết nối cho hàng nghìn site**: trần pool tổng, LRU pool, PgBouncer | — |

## 12. Trạng thái câu hỏi
<!-- [2026-11-27 10:43 AM Johnny Chu - Chu Hoàng Anh] NC-001 — gom theo quyết định ở NC-002 §12, tránh hai tài liệu hai trạng thái -->

| Mã | Câu hỏi | Trạng thái |
|---|---|---|
| Q-K-1 | nguồn danh tính | **chốt**: Hub giữ `sub`; A ngay, sẵn sàng B (NC-002 Q-OC-4) |
| Q-K-2 | phạm vi cấu hình mạng | đề xuất: có, ở control plane, trong `bizcity_settings@1` |
| Q-K-3 | làm P-K1 (`ctx`) ở nền trước | **chốt** qua NC-002 (S019-3) — nhưng **chặn** tới khi gỡ "hai bản mã nền" (NC-002 §13) |
| Q-K-4 | "object" cho mặt tiền, "entity" cho bảng trục | đề xuất |
| Q-K-5 | ngưỡng bật PgBouncer | đề xuất: đo khi có 100 site |
| Q-K-6 | NATS | **chốt**: outbox là nguồn sự kiện (NC-002 Q-OC-3) |
| Q-K-7 | Keycloak | **chốt**: A ngay, sẵn sàng B (NC-002 Q-OC-4) |
| Q-K-8 | Open Inventory | chưa chốt — ARCHITECTURE đang để tồn kho trong open-ketoan |
| Q-K-9 | Storage Engine | đề xuất; chờ Q-STOR-1…3 (open-cake 26-NOI-LUU-TEP) |

## 13. Đọc ngược 20 tệp lõi — WordPress 6.9 (`$wp_db_version = 60717`), bản đang chạy của mạng bizcity

<!-- [2026-11-26 11:49 PM Johnny Chu - Chu Hoàng Anh] NC-001 — chủ gửi danh sách 20 tệp cần đọc ngược; đọc thẳng mã của bản cài (wp-includes / wp-admin 6.9) và hai drop-in đang chạy (sunrise.php, object-cache.php). -->

Số dòng theo bản cài `huongnguyen.vibeyeu.com.vn` (WP 6.9). "Engine" là ô tương ứng trong sơ đồ đích §14.

| Tệp | Cơ chế đọc được | Chỗ | Bài học cho Kernel | Engine |
|---|---|---|---|---|
| `wp-admin/includes/schema.php` | `wp_get_db_schema($scope)` chia 3 nhóm: `blog` (options, posts, postmeta, terms…, comments, links), `global` (users, usermeta), `ms_global` (blogs, blogmeta, site, sitemeta, signups, registration_log); mọi bảng meta có `KEY meta_key(191)`; `wp_options` có `KEY autoload` | :36, :56–:184, :248–:299, :319–:328 | phân loại bảng theo phạm vi **ngay trong định nghĩa lược đồ** — chính là K-DB-1 | Database Router · Migration |
| `wp-settings.php` | thứ tự khởi động: `require_wp_db` → `wp_set_wpdb_vars` → `wp_start_object_cache` → `ms-settings.php` (nhận site) → **mu-plugins** → **network plugins** → `muplugins_loaded` → post type / taxonomy lõi → **plugin của site** → `plugins_loaded` → `WP_Roles` → theme → `init` → `ms_site_check` → `wp_loaded` | :136–:160, :470–:765 | khởi động theo **tầng cố định** và móc có tên ở mỗi tầng; plugin site nạp **sau** khi đã biết site. Kernel: dựng `ctx` (site → cấu hình → module bật) trước mọi handler | Site · Plugin |
| `wp-includes/ms-settings.php` | `SUNRISE` ⇒ `include sunrise.php` để tự dựng `$current_blog` / `$current_site`; không có thì `ms_load_current_site_and_network($domain, $path)`; cuối cùng `$wpdb->set_prefix()` | :51–:102 | bộ phân giải site **cắm được** trước mọi thứ — giống Site Resolver theo `Host` của nền | Site |
| `wp-includes/ms-load.php` | `get_site_by_path()` thử đoạn đường dài nhất trước, có `pre_get_site_by_path`; mạng đọc từ đệm `current_network` / nhóm `site-options`; `ms_site_check()` chặn site archived / spam / deleted | :141, :163, :212, :297–:370, :74 | phân giải **phải có đệm** và phải trả trạng thái site (khoá, nâng cấp) — nền đã có (đệm 30 s, 503 `SITE_UPGRADING`) | Site |
| `wp-content/sunrise.php` (bản bizcity) | **mỗi yêu cầu** mở một kết nối `mysqli` riêng tới CSDL toàn mạng, tra `wp_domain_mapping` (theo domain + path, rồi domain), kiểm `wp_blogs` (archived / spam / deleted), đọc `wp_site` — **không đệm**; bỏ `www.`, ưu tiên `X-Forwarded-Host` | :1–:181 | điểm nóng thật của mạng hiện tại: 3 truy vấn + 1 kết nối cho mọi trang. Kernel: phân giải tên miền **đệm theo phiên bản** registry, không mở kết nối riêng | Site · Cache |
| `wp-includes/ms-blogs.php` | `switch_to_blog()`: đẩy `_wp_switched_stack`, `$wpdb->set_blog_id()`, `wp_cache_switch_to_blog()` (không có thì `wp_cache_init()` + nạp lại nhóm toàn mạng), móc `switch_blog` ⇒ `wp_switch_roles_and_user()` gọi `wp_roles()->for_site()` + `wp_get_current_user()->for_site()`; **không** nạp lại plugin | :500–:600, :609, :698–:722 | xác nhận §3: đổi CSDL + đệm + vai, không đổi runtime plugin ⇒ R-CTX-1, R-CTX-5 | Site |
| `wp-includes/ms-site.php` | vòng đời: `wp_insert_site` → móc `wp_initialize_site` → `wp_initialize_site()` tạo bảng, `populate_options`, `populate_roles`; xoá: `wp_uninitialize_site` → `DROP TABLE` từng bảng + **xoá thư mục uploads** của site; mọi đổi ⇒ `clean_blog_cache()` + `wp_cache_set_sites_last_changed()` | :44–:105, :212–:283, :653–:743, :784–:882, :959, :1319 | vòng đời site có **móc trước / sau** và **dọn cả tệp** — hợp đồng cấp site của nền (`bizcity_site_provisioning@1`) cần thêm bước tệp (tài liệu 26) | Site · Migration |
| `wp-includes/class-wpdb.php` | `$tables` (theo blog), `$global_tables` (users, usermeta), `$ms_global_tables`; `set_blog_id()` đổi `prefix` rồi gán lại tên mọi bảng theo blog; `get_blog_prefix()` = `base_prefix` + `{id}_` (blog chính không có số) | :291–:351, :1049–:1093, :1128–:1170 | "đổi site" = đổi **tên bảng** trong một kết nối; nền đổi **CSDL / pool** — mạnh hơn nhưng đắt hơn (K-DB-2) | Database Router |
| `wp-includes/option.php` | `get_option()`: `pre_option_*` → đệm `alloptions` → đệm `notoptions` → đệm từng khoá → CSDL, khoá không có ⇒ ghi vào `notoptions`; `wp_prime_option_caches()` nạp lô; `wp_load_alloptions()`; giá trị autoload 6.6+: `yes · on · auto-on · auto`; option > **150 000 byte** không tự nạp (`wp_max_autoloaded_option_size`); `get_network_option` có `{$network_id}:notoptions` riêng | :78–:230, :270–:336, :601–:661, :726, :1353–:1365, :3259 | đủ bộ ba Bootstrap / Negative / Prime cho cấu hình; **trần kích thước** để autoload không phình — đưa vào K-OPT-2 | Options · Cache |
| `wp-includes/meta.php` | một API cho mọi loại meta (`post`, `user`, `term`, `comment`, `site`); `update_meta_cache($type, $ids)`: lấy đệm nhiều khoá, phần thiếu **một truy vấn `IN (...)`**, `wp_cache_add_multiple` vào nhóm `{type}_meta`; `register_meta()` có `type`, `single`, `object_subtype`, `sanitize_callback`, `auth_callback`, `show_in_rest` (schema); `wp_metadata_lazyloader()` | :40, :628, :1141–:1236, :1248, :1437–:1559 | Meta Engine dùng **một** API cho mọi loại thực thể, nạp lô bắt buộc, khoá khai kiểu + quyền đọc / ghi riêng từng khoá | Meta |
| `wp-includes/cache.php` + `class-wp-object-cache.php` | API mỏng gọi `WP_Object_Cache`; khoá = `{blog_id}:{key}` trừ nhóm toàn mạng; nhóm toàn mạng mặc định gồm `blog-details`, `blog-lookup`, `networks`, `sites`, `site-options`, `site-transient`, `users`, `user_meta`, `useremail`, `userlogins`, `userslugs`…; nhóm không bền: `counts`, `plugins`, `theme_json`; `object-cache.php` thay toàn bộ nếu có | object-cache :65–:82, :212–:529, :585; load.php :835–:928 | Cache Engine: **nhóm khai trước** + phạm vi (global / site / không bền) + adapter thay được — đúng K-CACHE-1 | Cache |
| `wp-content/object-cache.php` (bản bizcity) | **Object Cache Pro 1.21.3** (Redis) đang chạy; `WP_CACHE_KEY_SALT` đặt trong `wp-config.php` | :1–:57 | mạng hiện tại đã dựa Redis cho đệm bền — Kernel có thể dùng chung cụm Redis nhưng **tiền tố riêng** `bz:` (K-CACHE) | Cache |
| `wp-includes/class-wp-query.php` | `cache_results`, `update_post_meta_cache`, `update_post_term_cache` mặc định bật; kết quả truy vấn lưu nhóm `post-queries` **muối bằng** `wp_cache_get_last_changed('posts')` (+ `terms`) qua `wp_cache_get_salted` / `wp_cache_set_salted` (6.9); có ID thì `_prime_post_caches()` | :1977–:1996, :3252–:3324 | Query Cache **không xoá** — đổi "muối" phiên bản là mọi kết quả cũ tự chết (K-CACHE-2) | Cache · Object |
| `wp-includes/post.php` | `get_post()` → `WP_Post::get_instance()` đọc đệm nhóm `posts` rồi mới `SELECT`; `register_post_type()`; `wp_insert_post()`: filter `wp_insert_post_data` → ghi → `save_post_{type}` → `save_post` → `wp_insert_post` → `transition_post_status`; `clean_post_cache()` ⇒ `wp_cache_set_posts_last_changed()`; `_prime_post_caches()` | :1115, :1815, :4506, :4886–:5205, :5826, :7689–:7776, :8272, :8411 | Object Engine: đọc qua đệm định danh, ghi có **chuỗi móc cố định** (trước ghi = filter, sau ghi = action), ghi xong tăng phiên bản nhóm | Object |
| `wp-includes/plugin.php` + `class-wp-hook.php` | `$wp_filter[$name] = new WP_Hook`; callback theo **độ ưu tiên** (`ksort`), `accepted_args`; chạy lồng được (`nesting_level`, `resort_active_iterations` khi thêm hook giữa lúc đang chạy); `do_action` = filter bỏ giá trị; móc `all`; `did_action`, `doing_filter` | plugin :121–:542, :685, :971–:1000; hook :51–:338 | Hook Engine cần: độ ưu tiên, chạy lồng an toàn, đếm đã chạy, truy được đang ở móc nào — và **kiểu** (WP không có) ⇒ K-HOOK-1…5 | Plugin |
| `wp-includes/class-wp-user.php` + `class-wp-roles.php` + `capabilities.php` | quyền của người dùng lưu ở usermeta khoá `{blog_prefix}capabilities` (`_init_caps`), `level_*` cũ; vai của site ở option `{blog_prefix}user_roles` (`for_site()`); `map_meta_cap()` đổi quyền "meta" (`edit_post` với ID) thành quyền gốc theo chủ sở hữu / trạng thái, có filter `map_meta_cap`; `current_user_can_for_site()`; siêu quản trị ở sitemeta `site_admins` | user :74, :479–:704; roles :58, :190–:352; caps :45–:879, :913–:1045, :1169–:1236 | Identity: vai **theo site**, quyền **theo đối tượng** qua một hàm ánh xạ (meta-cap) — nền đã có quyền theo loại chứng từ (`registerDocumentType`); thêm "quyền trên đối tượng cụ thể" vào Object Engine | Identity |
| `wp-admin/includes/plugin.php` | `active_plugins` (option theo site) và `active_sitewide_plugins` (sitemeta); `activate_plugin()` chạy thử trong sandbox (`plugin_sandbox_scrape`) rồi `activate_{plugin}`; gỡ = `uninstall.php` hoặc móc `uninstall_plugins` | :540–:585, :641–:714, :758–:848 | Plugin lifecycle có **hai tầng bật** (mạng / site) và **chạy thử trước khi bật** — Kernel: bật module = migration schema `mod_<key>` + test khói trước khi `tenant_modules` ghi bật | Plugin · Migration |
| `wp-admin/includes/upgrade.php` (+ `network/upgrade.php`) | `wp_upgrade()` so `db_version` của site với `$wp_db_version`, ghi `db_version` vào **blogmeta** từng site; `upgrade_all()` chạy chuỗi `upgrade_xxx` theo mốc; `dbDelta()` so lược đồ; nâng cả mạng = trang quản trị lặp **5 site / lượt**, gọi HTTP tới `upgrade.php` của từng site | upgrade :657–:742, :894, :2492; network/upgrade :54–:139 | phiên bản lược đồ **theo từng site** là đúng (nền: `sites.schema_version`); cách lặp qua HTTP 5 site một lượt là cái **không** học — nền đã dùng `site-migrate` có sao lưu trước, site lỗi bị chặn riêng | Migration |
| `wp-includes/abilities-api.php` + `abilities-api/` (mới ở 6.9) | `wp_register_ability($name, …)`: `input_schema`, `output_schema` (JSON Schema), `permission_callback`, `execute_callback`, `meta`, nhóm theo `category`; móc `wp_abilities_api_init` | abilities-api.php :278, :467; class-wp-ability :92–:150 | chính WordPress đang đi về **năng lực có schema + quyền, gọi được từ AI** — trùng `defineAction` (REST + MCP + UI) của nền. Hướng "AI-native" của sơ đồ đích là đúng hướng lõi WP | Contract Registry |

## 14. Đối chiếu sơ đồ đích "BIZCITY PLATFORM — WordPress-inspired · TypeScript · AI-native"

<!-- [2026-11-26 11:49 PM Johnny Chu - Chu Hoàng Anh] NC-001 — chủ gửi sơ đồ đích (Platform Kernel 12 engine + hạ tầng); đối chiếu với nền đang có và chuẩn đã duyệt. -->

### 14.1 Hàng app

| Ô | Repo | Nhận xét |
|---|---|---|
| Open CRM · Open Cake | open-crm (WP) · open-cake (web) | hai bản song song, không chung CSDL (ARCHITECTURE §3) |
| Open Kiot | open-kiot — bản TS tương lai khởi tạo từ khung của nền (K-SYS-4) | |
| Open Kế Toán | open-ketoan | nguồn luật kỹ thuật gốc; nhận Kernel qua R-FLOW của repo đó |
| **Open Inventory** | **chưa có repo**; ARCHITECTURE §3 ghi tồn kho **nằm trong open-ketoan** (`bizcity_inventory@1`) | **va với chuẩn đã duyệt** — Q-K-8 |
| Community Plugins | `modules/<key>/` qua `@bizcity/module-sdk`, bậc mở rộng thấp nhất làm được việc | cần K-HOOK trước khi mở cho cộng đồng |

### 14.2 Plugin SDK & Contract Registry (REST · MCP · Events · Hooks · Permissions · Schema)

| Phần | Đang có | Thiếu |
|---|---|---|
| REST · MCP · Schema | `defineAction` một lần ra REST + MCP + UI, zod ⇒ JSON Schema, `@open-cake/contracts` / `packages/contracts` | đăng ký **Entity** (K-OBJ-2), **Menu** |
| Events | outbox + `registerSubscribers`, hợp đồng `bizcity_event@1` | — |
| Hooks | `registerHooks` danh sách đóng (`masterdata.referenceCheck`) | guard / filter / action có kiểu (K-HOOK) |
| Permissions | `registerModulePermissions`, `registerRoles`, `bizcity.authz.json` | quyền trên đối tượng (meta-cap, §13) |

### 14.3 Mười hai engine của Kernel

| Engine | Đang có trong `@bizcity/platform` 0.2.0 | Mức | Bước lộ trình |
|---|---|---|---|
| Site Engine | `db/site.ts` (`withSite`, `forEachSite`, pool theo site), `site-registry`, `site-provisioner`, `site-lifecycle`, Site Resolver theo `Host` | ◐ — thiếu `SiteContext` một cửa | P-K1 |
| Identity Engine | `core/auth.ts`, `core/roles.ts`, `users` / `user_role_assignments` / `tenant_roles`, SSO vé từ Hub | ◐ — thiếu `external_sub`, actor `agent`, thành viên site | P-K5 |
| Plugin Engine | `core/module-registry.ts`, `tenant_modules`, vai CSDL `mod_<key>_rw`, `core/hooks.ts` | ◐ — hook đóng, chưa có vòng đời đủ | P-K6 |
| Settings Engine (≈ Options của WP) | `core/settings.ts` + `setting_values` (phiên bản, phạm vi, quyền gác) | ◐ — thiếu phạm vi mạng / site, boot, phủ định | P-K3 |
| Meta Engine | `entity_meta` / `user_meta` ở open-cake (chưa ở nền) | ☐ ở nền | P-K4 |
| Object Engine | document kernel (`business_documents`…), item master ở open-ketoan; `records` ở open-cake | ☐ mặt tiền chung | P-K4 |
| Cache Engine | chuẩn CACHE, **chưa có mã** | ☐ | P-K2 |
| Database Router | `db/site.ts` + `db/client.ts` (pool theo site, RLS theo tenant) | ☑ — thiếu trần pool tổng | P-K8 |
| Migration Engine | `db/migrate.ts`, `db/site-migrate.ts` (theo site, sao lưu trước, chặn riêng site lỗi) | ☑ | — |
| Event Engine | `core/events.ts` (outbox, subscriber, traceparent) | ☑ | — |
| Workflow Engine | `core/workflow.ts` (luồng duyệt chứng từ) | ◐ | — |
| Audit Engine | `core/audit.ts` + `audit_logs` (bằng chứng, chuỗi băm), `evidence-export` (niêm phong) | ☑ | — |
| *(thiếu trong sơ đồ)* **Storage Engine** | — | ☐ | P-K7 (tài liệu 26) |

Đề xuất thêm ô **Storage Engine** vào sơ đồ — tệp là thứ WP xử lý ngay trong `ms-site.php` khi xoá site, và là chỗ open-ketoan đang có rủi ro cô lập (26 F-4).

### 14.4 Hạ tầng

| Ô | Chuẩn đã duyệt nói gì | Nhận xét |
|---|---|---|
| PostgreSQL | nguồn sự thật duy nhất, mỗi site một CSDL | khớp |
| Redis | **tuỳ chọn**, app phải chạy khi Redis vắng, CI không Redis (R-CACHE-6, R-STD-CACHE-2/3) | khớp nếu giữ "tuỳ chọn"; mạng WP đã chạy Redis (Object Cache Pro) — dùng chung cụm, tiền tố riêng |
| **NATS** | **R-OUTBOX-1: hàng đợi sự kiện là outbox trong PostgreSQL; Redis / NATS không thay outbox** | **va** nếu NATS là nơi phát sự kiện gốc. Cách dung hoà: outbox vẫn là nguồn, NATS chỉ là **đường chuyển** phía sau outbox khi số site / số bên nhận lớn — Q-K-6 |
| **Keycloak** | IDENTITY / USERS-ROLES: **Hub (WP bizcity) là nguồn danh tính** `sub = wp:<id>`, vé HMAC; app tự đứng được không cần Hub (R-USER-1) | **va** với một máy chủ danh tính thứ hai. Hai lối: (a) giữ Hub, Keycloak không dùng; (b) Keycloak làm OIDC trung tâm, liên kết (federate) người dùng WP — phải di cư vé SSO của mọi app — Q-K-7 |
| S3 / MinIO | tài liệu 26: bộ `s3` (R2 trên mạng bizcity), MinIO cho test | khớp; R2 là S3 nên một bộ cho cả ba |
| OpenTelemetry | `core/tracing.ts`, `traceparent` qua outbox (ADR-0010 open-ketoan) | khớp |

## 15. Nguồn

WordPress Developer Resources: `switch_to_blog()`, `restore_current_blog()`, `wp_cache_switch_to_blog()`, `wp_load_alloptions()`, `get_network_option()`, `register_setting()`, `register_post_type()`, `register_meta()`, `update_meta_cache()`, `WP_Object_Cache`, `wp_cache_get_last_changed()`, Plugin API (actions / filters); WooCommerce High-Performance Order Storage (HPOS). Mã đang chạy đã đọc: `wp-content/mu-plugins/bizcity-r2.php`, `bizcity-web/lib/{duplicate,files}.php`, `@bizcity/platform` 0.2.0 (`db/site.ts`, `core/request-context.ts`, `core/settings.ts`, `core/hooks.ts`, migration `0001_platform_nen_tang.sql`), open-cake `db/migrations/0103_flex.sql`, open-ketoan `core/documents.ts`, `core/run-log.ts`.

## Nhật ký

- 2026-11-26: bản đầu.
- 2026-11-26: §13 đọc ngược 20 tệp lõi WP 6.9 + hai drop-in đang chạy; §14 đối chiếu sơ đồ đích (12 engine, hạ tầng); Q-K-6…9.
- 2026-11-27: giữ tên settings (`ctx.settings`, `bizcity_settings@1`); §12 thành bảng trạng thái theo NC-002.
