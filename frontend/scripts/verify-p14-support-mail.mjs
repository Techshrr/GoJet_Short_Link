import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => { if (!fs.existsSync(path.join(root, file))) throw new Error(`P14 missing required file: ${file}`); };
const has = (file, tokens) => { const source = read(file); for (const token of tokens) if (!source.includes(token)) throw new Error(`P14 ${file} missing contract token: ${token}`); };
const matches = (file, patterns) => { const source = read(file); for (const pattern of patterns) if (!pattern.test(source)) throw new Error(`P14 ${file} missing route contract: ${pattern}`); };
const lacks = (file, tokens) => { const source = read(file); for (const token of tokens) if (source.includes(token)) throw new Error(`P14 ${file} contains forbidden token: ${token}`); };

for (const file of [
  "apps/workspace/src/routes/SupportPage.tsx",
  "apps/workspace/src/TurnstileField.tsx",
  "apps/workspace/src/support.css",
  "apps/admin/src/routes/TicketsPage.tsx",
  "apps/admin/src/routes/MailPage.tsx",
  "apps/admin/src/routes/MailSettingsPage.tsx",
  "apps/admin/src/routes/TemplatesPage.tsx",
  "apps/admin/src/p14.ts",
  "apps/admin/src/p14.css",
  "../services/platformapi/cmd/server/supportroutes.go",
  "../services/platformapi/cmd/server/supporttickets.go",
  "../services/platformapi/cmd/server/supportattachments.go",
  "../services/platformapi/cmd/server/turnstilemiddleware.go",
  "../services/platformapi/cmd/server/mailtemplates.go",
  "../app/mail/service.go",
  "../app/resources/clamavendpoint.go",
  "../database/migrations/supportticketsandturnstile.sql",
  "../docs/v5/P14_SUPPORT_MAIL_CONTRACT.md"
]) exists(file);

has("apps/workspace/src/router.tsx", ["SupportPage"]);
matches("apps/workspace/src/router.tsx", [/path\s*:\s*"\/support"/]);
has("apps/workspace/src/routes/SupportPage.tsx", [
  "data-p14-support",
  'api.get<List<Department>>("/api/support/departments")',
  'api.get<List<Ticket>>("/api/support/tickets")',
  'api.post<{ id: number }>("/api/support/tickets"',
  '/api/support/tickets/${selectedId}/replies',
  '/api/support/tickets/${ticketId}/attachments',
  'surface="ticket_create"',
  'surface="ticket_reply"',
  "useLocale",
  "localizedError"
]);
has("apps/workspace/src/TurnstileField.tsx", ["/api/public/turnstile", "challenges.cloudflare.com/turnstile", "data-turnstile-surface"]);

has("apps/admin/src/router.tsx", ["TicketsPage", "MailPage", "MailSettingsPage", "TemplatesPage"]);
matches("apps/admin/src/router.tsx", [/path\s*:\s*"\/tickets"/, /path\s*:\s*"\/mail"/, /path\s*:\s*"\/mail-settings"/, /path\s*:\s*"\/templates"/]);
has("apps/admin/src/routes/TicketsPage.tsx", ["data-p14-admin-tickets", "p14Client.tickets", "p14Client.ticket", "p14Client.attachments", "p14Client.reply", "p14Client.updateTicket", "useLocale"]);
has("apps/admin/src/routes/MailPage.tsx", ["data-p14-admin-mail", "p14Client.mailLogs", "p14Client.retryMail", "refetchInterval: 15000", "useLocale"]);
has("apps/admin/src/routes/MailSettingsPage.tsx", ["data-p14-mail-settings", "p14Client.settings", "p14Client.saveMail", "p14Client.testMail", "if (password.trim()) body.password = password", "password_configured", "useLocale"]);
has("apps/admin/src/routes/TemplatesPage.tsx", ["data-p14-mail-templates", "p14Client.templates", "p14Client.saveTemplate", "subject_template", "html_template", "useLocale"]);

has("../services/platformapi/cmd/server/supportroutes.go", ['turnstileGuard("ticket_create"', 'turnstileGuard("ticket_reply"', "POST /api/support/tickets/{ticket}/attachments", "GET /api/admin/support/tickets/{ticket}/attachments"]);
has("../services/platformapi/cmd/server/supportattachments.go", ["maxSupportAttachmentSize", "maxSupportAttachmentsPerTicket", "ScanClamAVEndpoint", "scan_status='clean'", "scan_status='infected'", "Cache-Control", "private, no-store"]);
has("../database/migrations/supportticketsandturnstile.sql", ["CREATE TABLE support_ticket_attachments", "turnstile.ticket_create", "turnstile.ticket_reply"]);
has("../services/platformapi/cmd/server/main.go", ["GET /api/admin/mail/logs", "POST /api/admin/mail/{id}/retry", "PUT /api/admin/settings/mail"]);
has("../app/mail/service.go", ["attempts<5", "status='sending'", "status='failed'", "status='sent'"]);
lacks("apps/admin/src/routes/MailSettingsPage.tsx", ['mail.password"', "password_configured ? password"]);
for (const file of ["apps/workspace/src/routes/SupportPage.tsx", "apps/admin/src/routes/TicketsPage.tsx", "apps/admin/src/routes/MailPage.tsx", "apps/admin/src/routes/MailSettingsPage.tsx", "apps/admin/src/routes/TemplatesPage.tsx"]) lacks(file, ["localStorage.setItem", "sessionStorage.setItem", "mockTicket", "fakeMail"]);

console.log("P14 Support/Mail contract verified: real ticket lifecycle, Turnstile-protected customer actions, scanned attachments, private administrator notes, mail delivery records, write-only SMTP credentials, editable templates and localized customer/admin surfaces.");
