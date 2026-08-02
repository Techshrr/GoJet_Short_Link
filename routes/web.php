<?php

use App\Http\Controllers\AbuseReportController;
use App\Http\Controllers\AdminBillingController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AdminDiagnosticsController;
use App\Http\Controllers\AdminOperationsController;
use App\Http\Controllers\AdminSettingsController;
use App\Http\Controllers\AdminTrustController;
use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DomainController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\FileShareController;
use App\Http\Controllers\InstallCompleteController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\InternalRedirectController;
use App\Http\Controllers\LinkAnalyticsController;
use App\Http\Controllers\LinkBulkController;
use App\Http\Controllers\LinkController;
use App\Http\Controllers\LinkImportExportController;
use App\Http\Controllers\LinkOrganizationController;
use App\Http\Controllers\LinkWorkspaceController;
use App\Http\Controllers\LocaleController;
use App\Http\Controllers\OrganizationResourceController;
use App\Http\Controllers\PasswordController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\ProfilePageController;
use App\Http\Controllers\PublicStatusController;
use App\Http\Controllers\RedirectController;
use App\Http\Controllers\SmartRoutingController;
use App\Http\Controllers\SsoController;
use App\Http\Controllers\TextShareController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::get('/locale/{locale}', LocaleController::class)->name('locale.switch');

Route::prefix('install')->name('install.')->group(function (): void {
    Route::get('/', [InstallController::class, 'welcome'])->name('welcome');
    Route::get('/requirements', [InstallController::class, 'requirements'])->name('requirements');
    Route::get('/database', [InstallController::class, 'database'])->name('database');
    Route::post('/database', [InstallController::class, 'storeDatabase'])->middleware('throttle:10,1')->name('database.store');
    Route::get('/site', [InstallController::class, 'site'])->name('site');
    Route::post('/site', [InstallController::class, 'install'])->middleware('throttle:5,10')->name('run');
    Route::get('/complete', InstallCompleteController::class)->name('complete');
});

Route::view('/', 'home')->name('home');
Route::view('/product', 'pages.product')->name('product');
Route::redirect('/products', '/product', 301)->name('products.index');
Route::view('/features/url-shortener', 'pages.products.url-shortener')->name('products.url-shortener');
Route::view('/features/analytics', 'pages.products.analytics')->name('products.analytics');
Route::view('/features/qr-codes', 'pages.products.qr')->name('products.qr');
Route::view('/features/smart-routing', 'pages.products.smart-routing')->name('products.smart-routing');
Route::view('/features/custom-domains', 'pages.products.custom-domains')->name('products.custom-domains');
Route::view('/features/link-in-bio', 'pages.products.link-in-bio')->name('products.link-in-bio');
Route::view('/features/text-sharing', 'pages.products.text-sharing')->name('products.text-sharing');
Route::view('/features/file-sharing', 'pages.products.file-sharing')->name('products.file-sharing');
Route::view('/features/ab-testing', 'pages.products.ab-testing')->name('products.ab-testing');
Route::redirect('/products/url-shortener', '/features/url-shortener', 301);
Route::redirect('/products/analytics', '/features/analytics', 301);
Route::redirect('/products/qr-code', '/features/qr-codes', 301);
Route::redirect('/products/custom-domain', '/features/custom-domains', 301);
Route::redirect('/products/ab-testing', '/features/ab-testing', 301);
Route::view('/solutions/marketing', 'pages.solutions.marketing')->name('solutions.marketing');
Route::view('/solutions/creators', 'pages.solutions.creators')->name('solutions.creators');
Route::view('/solutions/teams', 'pages.solutions.teams')->name('solutions.teams');
Route::view('/solutions/qr-campaigns', 'pages.solutions.qr-campaigns')->name('solutions.qr-campaigns');
Route::get('/pricing', [PlanController::class, 'pricing'])->name('pricing');
Route::view('/faq', 'pages.faq')->name('faq');
Route::view('/developers', 'pages.developers')->name('developers');
Route::view('/api-docs', 'pages.api-docs')->name('api-docs');
Route::view('/blog', 'pages.blog')->name('blog');
Route::view('/browser-extension', 'pages.browser-extension')->name('browser-extension');
Route::view('/apps', 'pages.apps')->name('apps');
Route::view('/changelog', 'pages.changelog')->name('changelog');
Route::get('/status', PublicStatusController::class)->name('status');
Route::view('/about', 'pages.about')->name('about');
Route::view('/privacy', 'pages.privacy')->name('privacy');
Route::view('/terms', 'pages.terms')->name('terms');
Route::view('/acceptable-use', 'pages.acceptable-use')->name('acceptable-use');
Route::view('/contact', 'pages.contact')->name('contact');
Route::get('/internal/redirect/resolve', [InternalRedirectController::class, 'show'])->middleware('throttle:600,1')->name('internal.redirect.resolve');

Route::get('/report-abuse', [AbuseReportController::class, 'create'])->name('report.create');
Route::post('/report-abuse', [AbuseReportController::class, 'store'])->middleware('throttle:5,60')->name('report.store');

Route::get('/t/{slug}', [TextShareController::class, 'show'])->where('slug', '[A-Za-z0-9_-]{3,80}')->name('texts.public');
Route::post('/t/{slug}/unlock', [TextShareController::class, 'unlock'])->where('slug', '[A-Za-z0-9_-]{3,80}')->middleware('throttle:10,1')->name('texts.unlock');
Route::get('/t/{slug}/raw', [TextShareController::class, 'raw'])->where('slug', '[A-Za-z0-9_-]{3,80}')->name('texts.raw');
Route::get('/t/{slug}/download', [TextShareController::class, 'download'])->where('slug', '[A-Za-z0-9_-]{3,80}')->name('texts.download');
Route::get('/f/{slug}', [FileShareController::class, 'show'])->where('slug', '[A-Za-z0-9_-]{3,80}')->name('files.public');
Route::post('/f/{slug}/unlock', [FileShareController::class, 'unlock'])->where('slug', '[A-Za-z0-9_-]{3,80}')->middleware('throttle:10,1')->name('files.unlock');
Route::get('/f/{slug}/download', [FileShareController::class, 'download'])->where('slug', '[A-Za-z0-9_-]{3,80}')->middleware('throttle:120,1')->name('files.download');
Route::get('/p/{slug}', [ProfilePageController::class, 'show'])->where('slug', '[A-Za-z0-9_-]{3,80}')->name('profiles.public');
Route::get('/p/{profilePage}/block/{block}', [ProfilePageController::class, 'click'])->middleware('throttle:120,1')->name('profiles.block.click');

Route::middleware('guest')->group(function (): void {
    Route::get('/sso/{connection}/redirect', [SsoController::class, 'redirect'])->middleware('throttle:20,1')->middleware('feature:sso')->name('sso.redirect');
    Route::get('/sso/{connection}/callback', [SsoController::class, 'callback'])->middleware('throttle:20,1')->middleware('feature:sso')->name('sso.callback');
    Route::get('/login', [AuthController::class, 'loginForm'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
    Route::get('/register', [AuthController::class, 'registerForm'])->name('register');
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:4,10');
    Route::get('/forgot-password', [PasswordController::class, 'requestForm'])->name('password.request');
    Route::post('/forgot-password', [PasswordController::class, 'email'])->middleware('throttle:3,10')->name('password.email');
    Route::get('/reset-password/{token}', [PasswordController::class, 'resetForm'])->name('password.reset');
    Route::post('/reset-password', [PasswordController::class, 'reset'])->middleware('throttle:5,10')->name('password.update');
});

Route::middleware('auth')->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/verify-email', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])->middleware('throttle:3,10')->name('verification.send');
    Route::get('/workspace-invitations/{token}', [WorkspaceController::class, 'acceptInvitation'])->middleware('feature:teams')->name('workspace.invitation');
});

$accountMiddleware = config('gojet.require_email_verification') ? ['auth', 'verified'] : ['auth'];
Route::middleware(array_merge($accountMiddleware, ['workspace.access']))->group(function (): void {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::get('/links', [LinkWorkspaceController::class, 'index'])->middleware('feature:links')->name('links.index');
    Route::post('/links', [LinkController::class, 'store'])->middleware('throttle:30,1')->middleware('feature:links')->name('links.store');
    Route::post('/links/bulk', LinkBulkController::class)->middleware('throttle:30,1')->middleware('feature:links')->name('links.bulk');
    Route::get('/links/export/all', [LinkImportExportController::class, 'export'])->middleware('throttle:10,1')->middleware('feature:links')->name('links.export.all');
    Route::post('/links/import', [LinkImportExportController::class, 'import'])->middleware('throttle:5,10')->middleware('feature:links')->name('links.import');
    Route::get('/links/organization', [LinkOrganizationController::class, 'index'])->middleware('feature:links')->name('links.organization');

    Route::post('/campaigns', [OrganizationResourceController::class, 'storeCampaign'])->middleware('feature:links')->name('campaigns.store');
    Route::patch('/campaigns/{campaign}', [OrganizationResourceController::class, 'updateCampaign'])->middleware('feature:links')->name('campaigns.update');
    Route::delete('/campaigns/{campaign}', [OrganizationResourceController::class, 'destroyCampaign'])->middleware('feature:links')->name('campaigns.destroy');
    Route::post('/folders', [OrganizationResourceController::class, 'storeFolder'])->middleware('feature:links')->name('folders.store');
    Route::patch('/folders/{folder}', [OrganizationResourceController::class, 'updateFolder'])->middleware('feature:links')->name('folders.update');
    Route::delete('/folders/{folder}', [OrganizationResourceController::class, 'destroyFolder'])->middleware('feature:links')->name('folders.destroy');
    Route::post('/tags', [OrganizationResourceController::class, 'storeTag'])->middleware('feature:links')->name('tags.store');
    Route::patch('/tags/{tag}', [OrganizationResourceController::class, 'updateTag'])->middleware('feature:links')->name('tags.update');
    Route::delete('/tags/{tag}', [OrganizationResourceController::class, 'destroyTag'])->middleware('feature:links')->name('tags.destroy');

    Route::get('/links/{link}', [LinkAnalyticsController::class, 'show'])->middleware('feature:links')->name('links.show');
    Route::get('/links/{link}/export', [LinkAnalyticsController::class, 'export'])->middleware('throttle:10,1')->middleware('feature:links')->name('links.export');
    Route::patch('/links/{link}', [LinkController::class, 'update'])->middleware('feature:links')->name('links.update');
    Route::post('/links/{link}/duplicate', [LinkController::class, 'duplicate'])->middleware('feature:links')->name('links.duplicate');
    Route::post('/links/{link}/archive', [LinkController::class, 'archive'])->middleware('feature:links')->name('links.archive');
    Route::post('/links/{link}/unarchive', [LinkController::class, 'unarchive'])->middleware('feature:links')->name('links.unarchive');
    Route::post('/links/{link}/restore', [LinkController::class, 'restore'])->middleware('feature:links')->name('links.restore');
    Route::delete('/links/{link}', [LinkController::class, 'destroy'])->middleware('feature:links')->name('links.destroy');

    Route::get('/links/{link}/routing', [SmartRoutingController::class, 'show'])->middleware('feature:smart_routing')->name('links.routing');
    Route::post('/links/{link}/destinations', [SmartRoutingController::class, 'storeDestination'])->middleware('feature:smart_routing')->name('links.destinations.store');
    Route::patch('/links/{link}/destinations/{destination}', [SmartRoutingController::class, 'updateDestination'])->middleware('feature:smart_routing')->name('links.destinations.update');
    Route::delete('/links/{link}/destinations/{destination}', [SmartRoutingController::class, 'destroyDestination'])->middleware('feature:smart_routing')->name('links.destinations.destroy');
    Route::post('/links/{link}/rules', [SmartRoutingController::class, 'storeRule'])->middleware('feature:smart_routing')->name('links.rules.store');
    Route::patch('/links/{link}/rules/{rule}', [SmartRoutingController::class, 'updateRule'])->middleware('feature:smart_routing')->name('links.rules.update');
    Route::delete('/links/{link}/rules/{rule}', [SmartRoutingController::class, 'destroyRule'])->middleware('feature:smart_routing')->name('links.rules.destroy');
    Route::post('/links/{link}/routing/simulate', [SmartRoutingController::class, 'simulate'])->middleware('feature:smart_routing')->name('links.routing.simulate');

    Route::get('/texts', [TextShareController::class, 'index'])->middleware('feature:texts')->name('texts.index');
    Route::post('/texts', [TextShareController::class, 'store'])->middleware('feature:texts')->name('texts.store');
    Route::get('/texts/{textShare}/edit', [TextShareController::class, 'edit'])->middleware('feature:texts')->name('texts.edit');
    Route::patch('/texts/{textShare}', [TextShareController::class, 'update'])->middleware('feature:texts')->name('texts.update');
    Route::delete('/texts/{textShare}', [TextShareController::class, 'destroy'])->middleware('feature:texts')->name('texts.destroy');

    Route::get('/files', [FileShareController::class, 'index'])->middleware('feature:files')->name('files.index');
    Route::post('/files', [FileShareController::class, 'store'])->middleware('throttle:20,1')->middleware('feature:files')->name('files.store');
    Route::get('/files/{fileShare}/manage', [FileShareController::class, 'manage'])->middleware('feature:files')->name('files.manage');
    Route::patch('/files/{fileShare}', [FileShareController::class, 'update'])->middleware('feature:files')->name('files.update');
    Route::delete('/files/{fileShare}', [FileShareController::class, 'destroy'])->middleware('feature:files')->name('files.destroy');
    Route::post('/file-upload-sessions', [FileShareController::class, 'createUploadSession'])->middleware('throttle:20,1')->middleware('feature:files')->name('files.upload-sessions.store');
    Route::post('/file-upload-sessions/{uploadSession}/chunks/{index}', [FileShareController::class, 'uploadChunk'])->whereNumber('index')->middleware('throttle:240,1')->middleware('feature:files')->name('files.upload-sessions.chunk');
    Route::post('/file-upload-sessions/{uploadSession}/complete', [FileShareController::class, 'completeUpload'])->middleware('feature:files')->name('files.upload-sessions.complete');

    Route::get('/profiles', [ProfilePageController::class, 'index'])->middleware('feature:profiles')->name('profiles.index');
    Route::post('/profiles', [ProfilePageController::class, 'store'])->middleware('feature:profiles')->name('profiles.store');
    Route::get('/profiles/{profilePage}/edit', [ProfilePageController::class, 'edit'])->middleware('feature:profiles')->name('profiles.edit');
    Route::patch('/profiles/{profilePage}', [ProfilePageController::class, 'update'])->middleware('feature:profiles')->name('profiles.update');
    Route::delete('/profiles/{profilePage}', [ProfilePageController::class, 'destroy'])->middleware('feature:profiles')->name('profiles.destroy');
    Route::post('/profiles/{profilePage}/blocks', [ProfilePageController::class, 'storeBlock'])->middleware('feature:profiles')->name('profiles.blocks.store');
    Route::patch('/profiles/{profilePage}/blocks/{block}', [ProfilePageController::class, 'updateBlock'])->middleware('feature:profiles')->name('profiles.blocks.update');
    Route::delete('/profiles/{profilePage}/blocks/{block}', [ProfilePageController::class, 'destroyBlock'])->middleware('feature:profiles')->name('profiles.blocks.destroy');
    Route::post('/profiles/{profilePage}/blocks/reorder', [ProfilePageController::class, 'reorder'])->middleware('feature:profiles')->name('profiles.blocks.reorder');

    Route::get('/domains', [DomainController::class, 'index'])->name('domains.index');
    Route::post('/domains', [DomainController::class, 'store'])->middleware('throttle:10,60')->name('domains.store');
    Route::post('/domains/{domain}/verify', [DomainController::class, 'verify'])->middleware('throttle:10,10')->name('domains.verify');
    Route::post('/domains/{domain}/refresh', [DomainController::class, 'refresh'])->middleware('throttle:10,10')->name('domains.refresh');
    Route::patch('/domains/{domain}/default', [DomainController::class, 'setDefault'])->name('domains.default');
    Route::delete('/domains/{domain}', [DomainController::class, 'destroy'])->name('domains.destroy');

    Route::get('/workspaces', [WorkspaceController::class, 'index'])->middleware('feature:teams')->name('workspaces.index');
    Route::post('/workspaces', [WorkspaceController::class, 'store'])->middleware('feature:teams')->name('workspaces.store');
    Route::patch('/workspaces/{workspace}', [WorkspaceController::class, 'update'])->middleware('feature:teams')->name('workspaces.update');
    Route::post('/workspaces/{workspace}/switch', [WorkspaceController::class, 'switch'])->middleware('feature:teams')->name('workspaces.switch');
    Route::post('/workspaces/{workspace}/invitations', [WorkspaceController::class, 'invite'])->middleware('throttle:10,60')->middleware('feature:teams')->name('workspaces.invite');
    Route::post('/workspaces/{workspace}/invitations/{member}/resend', [WorkspaceController::class, 'resendInvitation'])->middleware('throttle:6,60')->middleware('feature:teams')->name('workspaces.invitations.resend');
    Route::delete('/workspaces/{workspace}/invitations/{member}', [WorkspaceController::class, 'revokeInvitation'])->middleware('feature:teams')->name('workspaces.invitations.revoke');
    Route::patch('/workspaces/{workspace}/members/{member}', [WorkspaceController::class, 'updateMember'])->middleware('feature:teams')->name('workspaces.members.update');
    Route::delete('/workspaces/{workspace}/members/{member}', [WorkspaceController::class, 'removeMember'])->middleware('feature:teams')->name('workspaces.members.destroy');

    Route::get('/sso', [SsoController::class, 'index'])->middleware('feature:sso')->name('sso.index');
    Route::post('/sso', [SsoController::class, 'store'])->middleware('feature:sso')->name('sso.store');
    Route::patch('/sso/{connection}', [SsoController::class, 'update'])->middleware('feature:sso')->name('sso.update');
    Route::delete('/sso/{connection}', [SsoController::class, 'destroy'])->middleware('feature:sso')->name('sso.destroy');

    Route::get('/plans', [PlanController::class, 'index'])->name('plans.index');
    Route::post('/plans/request', [PlanController::class, 'request'])->name('plans.request');
    Route::get('/invoices/{invoice}', [PlanController::class, 'invoice'])->name('plans.invoice');
    Route::post('/subscriptions/{subscription}/cancel', [PlanController::class, 'cancel'])->name('subscriptions.cancel');

    Route::get('/webhooks', [WebhookController::class, 'index'])->middleware('feature:webhooks')->name('webhooks.index');
    Route::post('/webhooks', [WebhookController::class, 'store'])->middleware('feature:webhooks')->name('webhooks.store');
    Route::patch('/webhooks/{webhook}', [WebhookController::class, 'update'])->middleware('feature:webhooks')->name('webhooks.update');
    Route::delete('/webhooks/{webhook}', [WebhookController::class, 'destroy'])->middleware('feature:webhooks')->name('webhooks.destroy');
    Route::post('/webhooks/{webhook}/test', [WebhookController::class, 'test'])->middleware('feature:webhooks')->name('webhooks.test');
    Route::post('/webhook-deliveries/{delivery}/retry', [WebhookController::class, 'retry'])->middleware('feature:webhooks')->name('webhooks.retry');

    Route::get('/api-tokens', [ApiTokenController::class, 'index'])->name('tokens.index');
    Route::post('/api-tokens', [ApiTokenController::class, 'store'])->middleware('throttle:10,60')->name('tokens.store');
    Route::delete('/api-tokens/{token}', [ApiTokenController::class, 'destroy'])->name('tokens.destroy');
});

$adminPath = trim((string) config('gojet.admin_path', 'manage'), '/');
Route::middleware(['auth', 'verified', 'admin'])->prefix($adminPath)->name('admin.')->group(function (): void {
    Route::get('/', [AdminController::class, 'index'])->name('index');
    Route::get('/settings', [AdminSettingsController::class, 'edit'])->name('settings.index');
    Route::patch('/settings/{section}', [AdminSettingsController::class, 'updateSection'])->name('settings.update');
    Route::post('/settings/mail/test', [AdminSettingsController::class, 'testMail'])->name('settings.mail.test');
    Route::post('/settings/mail/logs/{emailDeliveryLog}/retry', [AdminSettingsController::class, 'retryMail'])->name('settings.mail.retry');
    Route::post('/settings/cache/clear', [AdminSettingsController::class, 'clearCaches'])->name('settings.cache.clear');
    Route::patch('/settings/admin-path/update', [AdminSettingsController::class, 'updateAdminPath'])->name('settings.admin-path');
    Route::patch('/links/{link}/toggle', [AdminController::class, 'toggleLink'])->name('links.toggle');
    Route::patch('/reports/{report}/resolve', [AdminTrustController::class, 'resolveReport'])->name('reports.resolve');
    Route::post('/blocked-targets', [AdminTrustController::class, 'storeBlock'])->name('blocked-targets.store');
    Route::patch('/blocked-targets/{blockedTarget}/toggle', [AdminTrustController::class, 'toggleBlock'])->name('blocked-targets.toggle');
    Route::post('/subscriptions/{subscription}/approve', [PlanController::class, 'approve'])->name('subscriptions.approve');

    Route::get('/billing', [AdminBillingController::class, 'index'])->name('billing.index');
    Route::post('/billing/coupons', [AdminBillingController::class, 'storeCoupon'])->name('billing.coupons.store');
    Route::patch('/billing/coupons/{coupon}', [AdminBillingController::class, 'updateCoupon'])->name('billing.coupons.update');
    Route::delete('/billing/coupons/{coupon}', [AdminBillingController::class, 'destroyCoupon'])->name('billing.coupons.destroy');
    Route::post('/billing/invoices/{invoice}/paid', [AdminBillingController::class, 'markInvoicePaid'])->name('billing.invoices.paid');

    Route::get('/operations', [AdminOperationsController::class, 'index'])->name('operations');
    Route::patch('/operations/users/{user}', [AdminOperationsController::class, 'updateUser'])->name('users.update');
    Route::patch('/operations/workspaces/{workspace}', [AdminOperationsController::class, 'updateWorkspace'])->name('workspaces.update');
    Route::patch('/operations/links/{link}/quarantine', [AdminOperationsController::class, 'quarantineLink'])->name('operations.links.quarantine');
    Route::patch('/operations/texts/{textShare}/quarantine', [AdminOperationsController::class, 'quarantineText'])->name('operations.texts.quarantine');
    Route::patch('/operations/files/{fileShare}/quarantine', [AdminOperationsController::class, 'quarantineFile'])->name('operations.files.quarantine');
    Route::patch('/operations/profiles/{profilePage}/quarantine', [AdminOperationsController::class, 'quarantineProfile'])->name('operations.profiles.quarantine');
    Route::get('/diagnostics', [AdminDiagnosticsController::class, 'index'])->name('diagnostics');
    Route::post('/diagnostics/test/{service}', [AdminDiagnosticsController::class, 'test'])->name('diagnostics.test');
});

Route::post('/{slug}/unlock', [RedirectController::class, 'unlock'])->where('slug', '[A-Za-z0-9_-]{3,64}')->middleware('throttle:10,1')->name('links.unlock');
Route::get('/{slug}', [RedirectController::class, 'resolve'])->where('slug', '[A-Za-z0-9_-]{3,64}')->name('redirect');
