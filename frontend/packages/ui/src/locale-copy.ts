import type { GoJetLocale } from "./locale";

export type LocalizedCopy = Record<string, Record<GoJetLocale, string>>;

export const surfaceCopy: LocalizedCopy = {
  "Platform-wide operational and governance summary. Live values are loaded on demand so the Admin shell remains resilient while the API tier is starting or temporarily unavailable.": {
    en: "Review current account, workspace, link and service information from the administration area. Values are requested when you open this page so temporary service interruptions are shown instead of being replaced with stored sample data.",
    "zh-CN": "在管理后台查看当前用户、工作区、短链接和服务状态。页面打开时会读取最新数据，遇到服务暂时不可用时会直接显示异常状态，不会用缓存或示例数据替代真实结果。"
  },
  "Platform-wide operational and governance summary sourced from the Admin overview and diagnostics APIs.": {
    en: "Review current user, workspace, link and service information in one place. The values shown here come from the administration services and reflect the latest state returned by the system.",
    "zh-CN": "集中查看当前用户、工作区、短链接和服务状态。这里显示的数据来自后台管理服务，并以系统当前实际返回的状态为准。"
  },
  "No cached browser copy is used; values come from the Admin overview and diagnostics authorities.": {
    en: "The page requests the current values from GoJet instead of displaying a browser-stored copy.",
    "zh-CN": "页面会从 GoJet 读取当前实际数据，不会用浏览器中保存的旧数据替代。"
  },
  "Global user governance. Suspend/restore is server-enforced, audited, and requires a reason; suspension revokes active sessions.": {
    en: "Manage GoJet user accounts across all workspaces. Suspending an account signs out its active sessions; restoring or suspending an account requires an administrator reason and the change is recorded for later review.",
    "zh-CN": "管理所有工作区中的 GoJet 用户账号。暂停账号会注销该用户现有登录会话；暂停或恢复账号时必须填写管理员操作原因，修改记录会保留供后续审计查看。"
  },
  "Cross-tenant workspace inventory and lifecycle state. Workspace mutations remain RBAC-protected on the server.": {
    en: "View workspaces across the installation, including their owner, plan, current status and creation time. Workspace changes are only accepted when the signed-in administrator has the required permission.",
    "zh-CN": "查看当前站点中的全部工作区，包括所有者、套餐、当前状态和创建时间。只有当前管理员具备相应权限时，工作区修改才会被系统接受。"
  },
  "Global workspace membership view backed by the workspace membership authority, not duplicated browser state.": {
    en: "Review which users belong to each workspace, their role, membership status and join time. The list reflects the memberships currently stored by GoJet.",
    "zh-CN": "查看每个工作区的成员、角色、成员状态和加入时间。列表以 GoJet 当前实际保存的成员关系为准。"
  },
  "Cross-workspace resource governance with server-side quarantine controls and mandatory audit reason.": {
    en: "Review content across workspaces and temporarily restrict or restore items when moderation is required. Every restriction or restoration requires an administrator reason so the action can be reviewed later.",
    "zh-CN": "查看各工作区中的内容，并在需要处置时临时限制或恢复对应资源。每次限制或恢复都必须填写管理员原因，便于之后核对具体操作。"
  },
  "Cross-workspace custom-domain governance and verification state.": {
    en: "Review custom domains used by every workspace, including the owning workspace, verification result and current availability status.",
    "zh-CN": "查看所有工作区使用的自定义域名，包括所属工作区、验证结果和当前可用状态。"
  },
  "Effective Admin role templates returned by the same server authority used during authorization.": {
    en: "Review the permissions included in each administrator role. These are the role definitions GoJet uses when deciding what an administrator can access or change.",
    "zh-CN": "查看每个管理员角色实际包含的权限。GoJet 会按照这里对应的角色权限判断管理员可以查看或修改哪些后台内容。"
  },
  "Permission catalog used by Admin RBAC. Client rendering is informational; the server remains the enforcement boundary.": {
    en: "Review the administrator permissions available in this installation and what each permission allows. Actual access is checked again whenever an administrator performs a protected action.",
    "zh-CN": "查看当前站点可分配的管理员权限以及每项权限的用途。管理员执行受保护操作时，系统会再次检查实际权限后再决定是否允许。"
  },
  "Manage the public announcement bar through the validated settings authority; public rendering never trusts raw browser content.": {
    en: "Create and manage notices shown to visitors. Each notice can include a title, message, display style and active time window, and saved values are checked before they are published.",
    "zh-CN": "创建和管理对访客显示的站点公告。每条公告可以设置标题、内容、显示样式和生效时间，保存后的内容会经过系统校验后再用于公开展示。"
  },
  "Operational jobs and worker execution state from the existing diagnostics authority.": {
    en: "Review recent background tasks, including when each task started, when it finished, its current result and any reported error details.",
    "zh-CN": "查看近期后台任务，包括每项任务的开始时间、完成时间、当前结果以及发生错误时记录的详细信息。"
  },
  "Eight expected Go services. Missing heartbeat evidence is shown honestly as unknown, never synthesized into a healthy state.": {
    en: "Check each GoJet service separately. The page shows its latest reported status, version and last contact time; a service that has not reported health information is shown as unknown instead of being marked healthy automatically.",
    "zh-CN": "分别检查 GoJet 各项服务的最新状态、版本和最近上报时间。没有上报健康信息的服务会明确显示为未知状态，不会自动标记为正常。"
  },
  "Core platform settings backed by the canonical settings allowlist. Unknown keys are rejected by the server.": {
    en: "Change the basic site name, timezone and support email used by this GoJet installation. Only settings supported by the current version can be saved.",
    "zh-CN": "修改当前 GoJet 站点使用的站点名称、时区和客服邮箱。只有当前版本支持的设置项才能保存成功。"
  },
  "Platform-owned short-link domains. Domain normalization and in-use deletion protection are enforced server-side.": {
    en: "Manage official short-link domains provided by this GoJet installation. Add the hostname and display label here; domains that are still in use are protected from accidental removal.",
    "zh-CN": "管理当前 GoJet 站点提供的官方短链接域名。可以在这里添加主机名和显示名称；仍被内容使用的域名会受到保护，避免被误删。"
  },
  "Bot-protection policy and effective public configuration. Secret values are deliberately excluded from this view.": {
    en: "Review the human-verification settings currently applied to public forms and sign-in flows. Secret credentials are intentionally not displayed on this page.",
    "zh-CN": "查看当前用于公开表单和登录流程的人机验证设置。用于验证服务的私密凭据不会在此页面显示。"
  },
  "Read-only effective runtime storage configuration: backend, root/bucket, namespaces, temporary/quarantine paths and startup health. Credentials are never returned.": {
    en: "Review the file-storage configuration currently used by GoJet, including the storage type, root or bucket, content locations, temporary locations and startup status. Access credentials are never returned to the browser.",
    "zh-CN": "查看 GoJet 当前实际使用的文件存储配置，包括存储类型、根目录或存储桶、各类内容路径、临时路径以及启动检查状态。访问凭据不会返回到浏览器。"
  },
  "Storage driver and credentials are native deployment settings. Change them through deployment configuration and restart validation, not an unsafe browser hot-swap.": {
    en: "Storage type and credentials are installation settings. Change them in the server deployment configuration, restart the affected services and confirm storage access before allowing uploads again.",
    "zh-CN": "存储类型和访问凭据属于服务器部署配置。需要调整时应修改服务器配置，重启相关服务并确认存储连接正常后，再恢复文件上传。"
  },
  "Platform API keys and outbound webhooks use real server credentials. Plaintext secrets are shown once and are never persisted in browser storage.": {
    en: "Manage API keys and webhook destinations used to connect GoJet with other systems. New secrets are displayed only when they are created, so copy them to a secure server-side secret store before leaving the page.",
    "zh-CN": "管理用于把 GoJet 接入其他系统的 API 密钥和 Webhook 地址。新密钥只会在创建成功时显示一次，请在离开页面前保存到安全的服务端密钥存储中。"
  },
  "This value is returned once; the database stores only its SHA-256 hash.": {
    en: "This API key is shown only once. Save it securely now; GoJet keeps only a non-reversible verification value and cannot display the original key again.",
    "zh-CN": "此 API 密钥只会显示一次，请立即安全保存。GoJet 只保留用于验证的不可逆值，之后无法再次显示原始密钥。"
  },
  "This value is returned once; server storage is encrypted and future reads only report configured state.": {
    en: "This webhook secret is shown only once. Save it securely now; later pages only show whether a secret has been configured, not the original value.",
    "zh-CN": "此 Webhook 密钥只会显示一次，请立即安全保存。之后页面只会显示是否已经配置密钥，不会再次返回原始内容。"
  },
  "Governance reason must contain at least 3 characters.": { en: "Enter a reason with at least 3 characters so this administrator action can be recorded.", "zh-CN": "请填写至少 3 个字符的操作原因，以便记录本次管理员操作。" },
  "Governance reason": { en: "Administrator reason", "zh-CN": "管理员操作原因" },
  "3–500 characters. Stored in the audit trail.": { en: "Enter 3–500 characters. The reason is saved with the administrator activity record.", "zh-CN": "请输入 3–500 个字符，操作原因会与本次管理员活动记录一起保存。" },
  "Govern user": { en: "Change user account", "zh-CN": "修改用户账号" },
  "Change status": { en: "Change status", "zh-CN": "修改状态" },
  "New status": { en: "New status", "zh-CN": "新状态" },
  "Apply status": { en: "Save status", "zh-CN": "保存状态" },
  "User directory": { en: "User accounts", "zh-CN": "用户账号" },
  "Workspace inventory": { en: "Workspace list", "zh-CN": "工作区列表" },
  "Membership inventory": { en: "Membership list", "zh-CN": "成员关系列表" },
  "Domain inventory": { en: "Domain list", "zh-CN": "域名列表" },
  "Role templates": { en: "Administrator roles", "zh-CN": "管理员角色" },
  "Permission catalog": { en: "Available permissions", "zh-CN": "可用权限" },
  "Access controls": { en: "Account actions", "zh-CN": "账号操作" },
  "Effective permissions": { en: "Included permissions", "zh-CN": "包含权限" },
  "Permission": { en: "Permission", "zh-CN": "权限" },
  "Description": { en: "Description", "zh-CN": "说明" },
  "Administrator access": { en: "Administrator access", "zh-CN": "管理员访问权限" },
  "Save access": { en: "Save administrator access", "zh-CN": "保存管理员权限" },
  "Select an administrator.": { en: "Select an administrator first.", "zh-CN": "请先选择一个管理员账号。" },
  "Active": { en: "Active", "zh-CN": "正常" },
  "Suspended": { en: "Suspended", "zh-CN": "已暂停" },
  "Disabled": { en: "Disabled", "zh-CN": "已停用" },
  "active": { en: "active", "zh-CN": "正常" },
  "suspended": { en: "suspended", "zh-CN": "已暂停" },
  "disabled": { en: "disabled", "zh-CN": "已停用" },
  "pending": { en: "pending", "zh-CN": "等待处理" },
  "healthy": { en: "healthy", "zh-CN": "正常" },
  "ready": { en: "ready", "zh-CN": "可用" },
  "verified": { en: "verified", "zh-CN": "已验证" },
  "failed": { en: "failed", "zh-CN": "失败" },
  "error": { en: "error", "zh-CN": "错误" },
  "unknown": { en: "unknown", "zh-CN": "未知" },
  "quarantined": { en: "restricted", "zh-CN": "已限制" },
  "blocked": { en: "blocked", "zh-CN": "已阻止" },
  "published": { en: "published", "zh-CN": "已发布" },
  "completed": { en: "completed", "zh-CN": "已完成" },
  "running": { en: "running", "zh-CN": "运行中" },
  "queued": { en: "queued", "zh-CN": "等待执行" },
  "enabled": { en: "enabled", "zh-CN": "已启用" },
  "revoked": { en: "revoked", "zh-CN": "已撤销" },
  "Restore": { en: "Restore", "zh-CN": "恢复" },
  "Quarantine": { en: "Restrict", "zh-CN": "限制" },
  "Restore resource": { en: "Restore content", "zh-CN": "恢复内容" },
  "Quarantine resource": { en: "Restrict content", "zh-CN": "限制内容" },
  "Resource": { en: "Content", "zh-CN": "内容" },
  "Visibility": { en: "Visibility", "zh-CN": "可见范围" },
  "Owner": { en: "Owner", "zh-CN": "所有者" },
  "Created": { en: "Created", "zh-CN": "创建时间" },
  "Joined": { en: "Joined", "zh-CN": "加入时间" },
  "Verified": { en: "Email verified", "zh-CN": "邮箱验证" },
  "Plan": { en: "Plan", "zh-CN": "套餐" },
  "Verification": { en: "Verification", "zh-CN": "验证状态" },
  "Signal": { en: "Item", "zh-CN": "项目" },
  "Current": { en: "Current value", "zh-CN": "当前值" },
  "Open alerts": { en: "Open alerts", "zh-CN": "待处理提醒" },
  "Load live overview": { en: "Refresh overview", "zh-CN": "刷新概览" },
  "Overview partially unavailable": { en: "Some overview information is unavailable", "zh-CN": "部分概览信息暂时不可用" },
  "Platform signals": { en: "Current summary", "zh-CN": "当前概况" },
  "Job": { en: "Task", "zh-CN": "任务" },
  "Job activity": { en: "Background task history", "zh-CN": "后台任务记录" },
  "Started": { en: "Started", "zh-CN": "开始时间" },
  "Finished": { en: "Finished", "zh-CN": "完成时间" },
  "Details": { en: "Details", "zh-CN": "详细信息" },
  "Service": { en: "Service", "zh-CN": "服务" },
  "Health evidence": { en: "Latest check", "zh-CN": "最近检查结果" },
  "Version": { en: "Version", "zh-CN": "版本" },
  "Last seen": { en: "Last contact", "zh-CN": "最近上报时间" },
  "Service status": { en: "Service status", "zh-CN": "服务状态" },
  "Site name": { en: "Site name", "zh-CN": "站点名称" },
  "Timezone": { en: "Timezone", "zh-CN": "时区" },
  "Support email": { en: "Support email", "zh-CN": "客服邮箱" },
  "Settings unavailable": { en: "Settings are temporarily unavailable", "zh-CN": "设置暂时无法读取" },
  "Settings save failed": { en: "Could not save settings", "zh-CN": "设置保存失败" },
  "Save general settings": { en: "Save settings", "zh-CN": "保存设置" },
  "Hostname": { en: "Hostname", "zh-CN": "主机名" },
  "Label": { en: "Display name", "zh-CN": "显示名称" },
  "Default": { en: "Default", "zh-CN": "默认" },
  "Sort": { en: "Order", "zh-CN": "排序" },
  "Official short domains": { en: "Official short-link domains", "zh-CN": "官方短链接域名" },
  "Add official domain": { en: "Add official domain", "zh-CN": "添加官方域名" },
  "Add domain": { en: "Add domain", "zh-CN": "添加域名" },
  "Policy": { en: "Setting", "zh-CN": "设置项" },
  "Effective value": { en: "Current value", "zh-CN": "当前值" },
  "Bot protection": { en: "Human verification", "zh-CN": "人机验证" },
  "Setting": { en: "Setting", "zh-CN": "设置项" },
  "Effective storage configuration": { en: "Current storage configuration", "zh-CN": "当前存储配置" },
  "Deployment-owned configuration": { en: "Change storage on the server", "zh-CN": "请在服务器端修改存储配置" },
  "API keys": { en: "API keys", "zh-CN": "API 密钥" },
  "Create API key": { en: "Create API key", "zh-CN": "创建 API 密钥" },
  "Copy API key now": { en: "Save this API key now", "zh-CN": "请立即保存此 API 密钥" },
  "Copy webhook secret now": { en: "Save this webhook secret now", "zh-CN": "请立即保存此 Webhook 密钥" },
  "Prefix": { en: "Key prefix", "zh-CN": "密钥前缀" },
  "Scopes": { en: "Permissions", "zh-CN": "权限范围" },
  "Last used": { en: "Last used", "zh-CN": "最近使用时间" },
  "Actions": { en: "Actions", "zh-CN": "操作" },
  "Revoke": { en: "Revoke", "zh-CN": "撤销" },
  "Revoked": { en: "Revoked", "zh-CN": "已撤销" },
  "Endpoint": { en: "Destination URL", "zh-CN": "接收地址" },
  "Events": { en: "Events", "zh-CN": "事件" },
  "Last delivery": { en: "Last delivery", "zh-CN": "最近投递" },
  "Test": { en: "Send test", "zh-CN": "发送测试" },
  "Create webhook": { en: "Create webhook", "zh-CN": "创建 Webhook" },
  "Public endpoint URL": { en: "Receiving URL", "zh-CN": "接收地址" },
  "Revocation reason": { en: "Reason for revoking", "zh-CN": "撤销原因" },
  "Administrator reason": { en: "Administrator reason", "zh-CN": "管理员操作原因" },
  "Title": { en: "Title", "zh-CN": "标题" },
  "Message": { en: "Message", "zh-CN": "内容" },
  "Tone": { en: "Display style", "zh-CN": "显示样式" },
  "Enabled": { en: "Enabled", "zh-CN": "是否启用" },
  "Window": { en: "Active time", "zh-CN": "生效时间" },
  "Any time": { en: "Any time", "zh-CN": "不限开始时间" },
  "Open": { en: "No end time", "zh-CN": "不限结束时间" },
  "Announcement items": { en: "Published announcements", "zh-CN": "公告列表" },
  "Add announcement": { en: "Add announcement", "zh-CN": "添加公告" },
  "Announcement save failed": { en: "Could not save announcement", "zh-CN": "公告保存失败" },
  "Cancel": { en: "Cancel", "zh-CN": "取消" },
  "Edit": { en: "Edit", "zh-CN": "编辑" },
  "请求失败，请稍后重试。": { en: "The request failed. Please try again in a moment.", "zh-CN": "请求失败，请稍后重试。" },
  "登录尝试过于频繁，请 15 分钟后重试": { en: "Too many administrator sign-in attempts. Try again in 15 minutes.", "zh-CN": "管理员登录尝试过于频繁，请 15 分钟后重试。" },
  "管理员邮箱或密码错误": { en: "The administrator email or password is incorrect.", "zh-CN": "管理员邮箱或密码错误。" },
  "请输入有效的双因素验证码": { en: "Enter a valid two-step verification code.", "zh-CN": "请输入有效的双因素验证码。" },
  "管理员角色无效": { en: "The selected administrator role is not valid.", "zh-CN": "选择的管理员角色无效。" },
  "只有超级管理员可以执行此操作": { en: "Only a super administrator can perform this action.", "zh-CN": "只有超级管理员可以执行此操作。" },
  "管理员编号无效": { en: "The administrator ID is not valid.", "zh-CN": "管理员编号无效。" },
  "管理员列表暂时不可用": { en: "The administrator list is temporarily unavailable.", "zh-CN": "管理员列表暂时不可用。" },
  "无法强制退出管理员": { en: "Could not sign out the selected administrator sessions.", "zh-CN": "无法强制退出所选管理员的登录会话。" },
  "无法创建登录双因素认证密钥": { en: "Could not start two-step verification setup for this administrator.", "zh-CN": "无法为此管理员创建双因素验证设置。" }
};
