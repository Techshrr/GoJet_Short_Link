#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_optional(path: str, old: str, new: str) -> bool:
    file = ROOT / path
    text = file.read_text(encoding="utf-8")

    if old not in text:
        return False

    file.write_text(text.replace(old, new), encoding="utf-8")
    return True


def insert_once(path: str, marker: str, addition: str) -> bool:
    file = ROOT / path
    text = file.read_text(encoding="utf-8")

    if addition.strip() in text:
        return False
    if marker not in text:
        raise SystemExit(f"Required insertion marker missing in {path}: {marker!r}")

    file.write_text(text.replace(marker, marker + addition, 1), encoding="utf-8")
    return True


def require(path: str, marker: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    if marker not in text:
        raise SystemExit(f"Required V3 marker missing in {path}: {marker!r}")


changes = 0

# Retain safe legacy transformations. Re-running must not depend on obsolete copy
# or formatting, but genuine missing route and provider wiring must still fail.
changes += replace_optional(
    "app/Http/Controllers/AdminOperationsController.php",
    "$user->sessions()->delete();",
    "DB::table('sessions')->where('user_id', $user->id)->delete();",
)
changes += replace_optional(
    "app/Http/Controllers/AdminOperationsController.php",
    "$profile->update(['status' => $profile->status === 'published' ? 'draft' : 'published', 'published_at' => $profile->status === 'published' ? now() : null]);",
    "$status = $profile->status === 'published' ? 'draft' : 'published';\n"
    "        $profile->update(['status' => $status, 'published_at' => $status === 'published' ? now() : null]);",
)
changes += replace_optional(
    "resources/views/links/organization.blade.php",
    "f.innerHTML='@csrf @method('delete')';",
    "f.innerHTML=`@csrf @method('delete')`;",
)

# Persist enterprise OIDC routes in the canonical web route file.
changes += insert_once(
    "routes/web.php",
    "use App\\Http\\Controllers\\SmartRoutingController;\n",
    "use App\\Http\\Controllers\\SsoController;\n",
)
changes += insert_once(
    "routes/web.php",
    "Route::middleware('guest')->group(function (): void {\n",
    "    Route::get('/sso/{connection}/redirect', [SsoController::class, 'redirect'])->middleware('throttle:20,1')->name('sso.redirect');\n"
    "    Route::get('/sso/{connection}/callback', [SsoController::class, 'callback'])->middleware('throttle:20,1')->name('sso.callback');\n",
)
changes += insert_once(
    "routes/web.php",
    "    Route::delete('/workspaces/{workspace}/members/{member}', [WorkspaceController::class, 'removeMember'])->name('workspaces.members.destroy');\n",
    "\n    Route::get('/sso', [SsoController::class, 'index'])->name('sso.index');\n"
    "    Route::post('/sso', [SsoController::class, 'store'])->name('sso.store');\n"
    "    Route::patch('/sso/{connection}', [SsoController::class, 'update'])->name('sso.update');\n"
    "    Route::delete('/sso/{connection}', [SsoController::class, 'destroy'])->name('sso.destroy');\n",
)

# Persist full Simplified Chinese and English enterprise login copy.
changes += insert_once(
    "lang/en/v3.php",
    "    'webhook_test_queued' => 'A test delivery was queued.', 'webhook_retry_queued' => 'The delivery retry was queued.',\n",
    "    'sso_created' => 'OIDC connection created.', 'sso_updated' => 'OIDC connection updated.', 'sso_deleted' => 'OIDC connection deleted.',\n"
    "    'sso_expired' => 'The enterprise login request expired.', 'sso_state_invalid' => 'The enterprise login state is invalid.', 'sso_code_missing' => 'The identity provider did not return an authorization code.',\n"
    "    'sso_exchange_failed' => 'The identity provider could not complete the login.', 'sso_email_missing' => 'The identity provider did not return a valid email address.',\n"
    "    'sso_email_unverified' => 'The identity provider has not verified this email address.', 'sso_domain_denied' => 'This email domain is not permitted for the selected workspace.',\n"
    "    'sso_login_success' => 'Enterprise login completed.', 'account_suspended' => 'This account is suspended.',\n"
    "    'sso_title' => 'Enterprise single sign-on', 'sso_subtitle' => 'Connect an OpenID Connect provider using authorization code flow, PKCE and workspace domain restrictions.',\n"
    "    'sso_new' => 'New OIDC connection', 'sso_name' => 'Connection name', 'sso_issuer' => 'Issuer URL', 'sso_client_id' => 'Client ID', 'sso_client_secret' => 'Client secret',\n"
    "    'sso_scopes' => 'Scopes', 'sso_domains' => 'Allowed email domains', 'sso_enforce' => 'Require this connection for matching workspace members',\n"
    "    'sso_all_domains' => 'All verified email domains', 'sso_test_login' => 'Test login', 'sso_secret_unchanged' => 'Leave blank to keep the current secret', 'sso_empty' => 'No enterprise identity connection is configured.',\n",
)
changes += insert_once(
    "lang/zh_CN/v3.php",
    "    'webhook_retry_queued' => '重新投递已加入队列。',\n",
    "    'sso_created' => 'OIDC 连接已创建。', 'sso_updated' => 'OIDC 连接已更新。', 'sso_deleted' => 'OIDC 连接已删除。',\n"
    "    'sso_expired' => '企业登录请求已过期。', 'sso_state_invalid' => '企业登录状态校验失败。', 'sso_code_missing' => '身份提供商没有返回授权码。',\n"
    "    'sso_exchange_failed' => '身份提供商未能完成登录。', 'sso_email_missing' => '身份提供商没有返回有效邮箱。',\n"
    "    'sso_email_unverified' => '身份提供商尚未验证该邮箱。', 'sso_domain_denied' => '该邮箱域名不允许加入当前工作区。',\n"
    "    'sso_login_success' => '企业单点登录成功。', 'account_suspended' => '该账户已被停用。',\n"
    "    'sso_title' => '企业单点登录', 'sso_subtitle' => '通过授权码、PKCE 和工作区邮箱域名限制接入 OpenID Connect 身份提供商。',\n"
    "    'sso_new' => '新建 OIDC 连接', 'sso_name' => '连接名称', 'sso_issuer' => 'Issuer 地址', 'sso_client_id' => '客户端 ID', 'sso_client_secret' => '客户端密钥',\n"
    "    'sso_scopes' => 'Scopes', 'sso_domains' => '允许的邮箱域名', 'sso_enforce' => '要求匹配域名的工作区成员使用此连接',\n"
    "    'sso_all_domains' => '允许所有已验证邮箱域名', 'sso_test_login' => '测试登录', 'sso_secret_unchanged' => '留空则保持现有密钥', 'sso_empty' => '尚未配置企业身份连接。',\n",
)

# Fail only when a genuinely required implementation marker disappears.
require("bootstrap/providers.php", "V3ServiceProvider::class")
require("routes/web.php", "AdminOperationsController")
require("routes/web.php", "AdminDiagnosticsController")
require("routes/web.php", "AdminBillingController")
require("routes/web.php", "SsoController")
require("routes/web.php", "name('sso.redirect')")
require("routes/web.php", "name('sso.index')")
require("routes/web.php", "workspace.access")
require("app/Http/Middleware/EnsureWorkspaceAccess.php", "class EnsureWorkspaceAccess")
require("app/Http/Controllers/AdminBillingController.php", "class AdminBillingController")
require("resources/views/admin/billing.blade.php", "admin.billing.coupons.store")
require("lang/en/billing.php", "coupon_invalid")
require("lang/zh_CN/billing.php", "coupon_invalid")
require("lang/en/v3.php", "sso_login_success")
require("lang/zh_CN/v3.php", "sso_login_success")

print(f"V3 consolidation complete; source changes applied: {changes}.")
