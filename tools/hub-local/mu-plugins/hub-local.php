<?php
/**
 * Plugin Name: Hub local (CHỈ máy dev)
 * Description: Máy chủ SSO thử theo bizcity_identity@1 cho mọi app + nới chốt chặn "site thử nghiệm" của Hub. Chỉ nạp khi BIZCITY_HUB_LOCAL.
 *
 * [2026-11-24 11:55 PM Johnny Chu - Chu Hoàng Anh] SPINE-7 — bizcity-platform tools/hub-local. KHÔNG BAO GIỜ đưa lên site thật:
 * file chỉ được gắn vào container hub-local, và tự tắt nếu thiếu hằng BIZCITY_HUB_LOCAL hoặc địa chỉ site không phải *.localhost.
 *
 * Phát vé (đúng khuôn vé của open-ketoan-bridge, xem bizcity-platform docs/standard/BIZCITY-IDENTITY-v1.md):
 *   trình duyệt:  /wp-admin/admin-post.php?action=bizcity_hub_sso&aud=<app>&return=<địa chỉ app>
 *                 → đăng nhập WordPress nếu chưa → chuyển về <return>#sso=<vé>
 *   dòng lệnh:    wp hub-sso ticket --login=<login> --aud=<app> [--tenant=<mã>]   (in vé, cho test tự động)
 *                 wp hub-sso apps                                                 (liệt kê app đã khai)
 * App khai ở biến HUB_SSO_APPS = "open-cake=http://cake.localhost:8110,open-crm=http://crm.localhost:8130"
 * (aud = id app trong bizcity.app.json; return phải cùng scheme+host+cổng với địa chỉ đã khai — chống chuyển hướng lạ).
 * open-ketoan dùng luôn đường của bridge (action=tgs_acc_sso_go) — chính là mã sẽ chạy trên site thật.
 */
defined('ABSPATH') || exit;

// Chốt an toàn kép: thiếu hằng hoặc địa chỉ site không phải *.localhost → không làm gì.
if (!defined('BIZCITY_HUB_LOCAL') || !BIZCITY_HUB_LOCAL
    || substr((string) parse_url(defined('WP_HOME') ? (string) WP_HOME : '', PHP_URL_HOST), -10) !== '.localhost') {
    return;
}

// ── 1. Nới chốt chặn site thử nghiệm (kinh nghiệm fb017-wp) ─────────────────────────────────────────────
// Hub từ chối khoá API gắn tên miền thử (localhost, .local, .test) → cho phép trên máy dev.
add_filter('bizcity_zalo_hub_key_allowed', '__return_true', 99);
// wp_safe_remote_* từ chối host nội bộ: cho phép các container trong mạng bizcity-hub (tên có dạng *-1 hoặc *.localhost).
add_filter('http_request_host_is_external', static function ($external, $host) {
    $host = strtolower((string) $host);
    return (substr($host, -10) === '.localhost' || preg_match('/^[a-z0-9-]+-\d+$/', $host)) ? true : $external;
}, 99, 2);

// ── 2. Máy chủ SSO thử cho mọi app ──────────────────────────────────────────────────────────────────────
final class Bizcity_Hub_Local_SSO
{
    const TTL = 300; // bizcity_identity@1: vé ≤ 5 phút

    /** @return array<string,string> aud => địa chỉ gốc của app */
    public static function apps()
    {
        $out = [];
        foreach (array_filter(array_map('trim', explode(',', (string) getenv('HUB_SSO_APPS')))) as $pair) {
            [$aud, $url] = array_pad(explode('=', $pair, 2), 2, '');
            if (preg_match('/^[a-z0-9][a-z0-9-]{1,63}$/', $aud) && $url !== '') {
                $out[$aud] = rtrim($url, '/');
            }
        }
        return $out;
    }

    private static function b64url($s)
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    /** Vé cho người dùng $u gửi app $aud. '' nếu chưa có khoá chung. */
    public static function ticket(WP_User $u, $aud, $tenant = null)
    {
        $secret = (string) getenv('HUB_SSO_SECRET');
        if ($secret === '' || !$u->exists() || (string) $u->user_email === '') {
            return '';
        }
        $now = time();
        $body = self::b64url(wp_json_encode([
            'sub'    => 'wp:' . (int) $u->ID,
            'aud'    => (string) $aud,
            'email'  => strtolower((string) $u->user_email),
            'name'   => (string) $u->display_name,
            'login'  => (string) $u->user_login,
            // Q-IDENT-1: WordPress cấp perms, app tự lọc. Bản thử: quản trị → '*', người khác → theo vai.
            'perms'  => user_can($u, 'manage_options') ? ['*'] : array_values((array) $u->roles),
            'tenant' => $tenant !== null ? (string) $tenant : (string) getenv('HUB_SSO_TENANT'),
            'iat'    => $now,
            'exp'    => $now + self::TTL,
        ]));
        return $body . '.' . self::b64url(hash_hmac('sha256', $body, $secret, true));
    }

    public static function go()
    {
        $aud = sanitize_key(wp_unslash($_GET['aud'] ?? ''));
        $apps = self::apps();
        if (!isset($apps[$aud])) {
            wp_die('App chưa khai trong HUB_SSO_APPS: ' . esc_html($aud), 'Hub local', ['response' => 400]);
        }
        $return = (string) wp_unslash($_GET['return'] ?? '');
        $a = wp_parse_url($apps[$aud]);
        $b = $return !== '' ? wp_parse_url($return) : false;
        $same = $b && strtolower($a['scheme'] ?? '') === strtolower($b['scheme'] ?? '')
            && strtolower($a['host'] ?? '') === strtolower($b['host'] ?? '') && (int) ($a['port'] ?? 0) === (int) ($b['port'] ?? 0);
        $return = $same ? strtok($return, '#') : $apps[$aud] . '/';
        if (!is_user_logged_in()) {
            wp_redirect(wp_login_url(add_query_arg(['action' => 'bizcity_hub_sso', 'aud' => $aud, 'return' => rawurlencode($return)], admin_url('admin-post.php'))));
            exit;
        }
        $t = self::ticket(wp_get_current_user(), $aud);
        if ($t === '') {
            wp_die('Chưa đặt HUB_SSO_SECRET hoặc tài khoản không có email.', 'Hub local', ['response' => 403]);
        }
        nocache_headers();
        wp_redirect($return . (strpos($return, '?') === false ? '?' : '&') . '_t=' . time() . '#sso=' . rawurlencode($t));
        exit;
    }
}
add_action('admin_post_bizcity_hub_sso', ['Bizcity_Hub_Local_SSO', 'go']);
add_action('admin_post_nopriv_bizcity_hub_sso', ['Bizcity_Hub_Local_SSO', 'go']);
// Cho phép chuyển hướng về app đã khai (wp_safe_redirect không dùng ở đây, nhưng giữ cho trang đăng nhập redirect_to).
add_filter('allowed_redirect_hosts', static function ($hosts) {
    foreach (Bizcity_Hub_Local_SSO::apps() as $url) {
        $hosts[] = (string) wp_parse_url($url, PHP_URL_HOST);
    }
    return $hosts;
});

if (defined('WP_CLI') && WP_CLI) {
    WP_CLI::add_command('hub-sso', new class {
        /**
         * In vé SSO cho một người dùng.
         *
         * ## OPTIONS
         * --login=<login>
         * --aud=<app>
         * [--tenant=<mã>]
         */
        public function ticket($args, $assoc)
        {
            $u = get_user_by('login', (string) $assoc['login']);
            if (!$u) {
                WP_CLI::error('Không có người dùng ' . $assoc['login']);
            }
            $t = Bizcity_Hub_Local_SSO::ticket($u, (string) $assoc['aud'], $assoc['tenant'] ?? null);
            $t !== '' ? WP_CLI::line($t) : WP_CLI::error('Chưa đặt HUB_SSO_SECRET hoặc người dùng không có email.');
        }

        /** Liệt kê app đã khai (aud → địa chỉ). */
        public function apps()
        {
            foreach (Bizcity_Hub_Local_SSO::apps() as $aud => $url) {
                WP_CLI::line(str_pad($aud, 20) . $url);
            }
        }
    });
}
