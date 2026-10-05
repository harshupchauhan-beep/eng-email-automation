from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

path = r"C:\Users\alina\OneDrive\Desktop\backup\Iccip\ENG Email Automation\ICCPP-Email-Intelligence-Project-Work.xlsx"

wb = Workbook()

TEAL_DK = "0F3D4A"
TEAL = "1A6B73"
NAVY = "13232B"
WHITE = "FFFFFF"
ROW_ALT = "F4F8F9"
GRAY = "5B6B73"

header_fill = PatternFill("solid", fgColor=TEAL_DK)
header_font = Font(name="Calibri", bold=True, color=WHITE, size=11)
title_font = Font(name="Calibri", bold=True, color=TEAL_DK, size=20)
subtitle_font = Font(name="Calibri", color=TEAL, size=12)
section_font = Font(name="Calibri", bold=True, color=WHITE, size=12)
section_fill = PatternFill("solid", fgColor=TEAL)
label_font = Font(name="Calibri", bold=True, color=TEAL_DK, size=11)
body_font = Font(name="Calibri", color=NAVY, size=11)
alt_fill = PatternFill("solid", fgColor=ROW_ALT)
wrap = Alignment(wrap_text=True, vertical="center")
center = Alignment(wrap_text=True, vertical="center", horizontal="center")
thin = Border(
    left=Side(style="thin", color="C5D5D8"),
    right=Side(style="thin", color="C5D5D8"),
    top=Side(style="thin", color="C5D5D8"),
    bottom=Side(style="thin", color="C5D5D8"),
)
status_done = PatternFill("solid", fgColor="D1FAE5")
status_done_font = Font(name="Calibri", bold=True, color="065F46", size=11)

def style_header_row(ws, row, cols):
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = thin
    ws.row_dimensions[row].height = 28
    ws.freeze_panes = f"A{row + 1}"

def paint_row(ws, r, cols):
    ws.row_dimensions[r].height = 42
    for c in range(1, cols + 1):
        cell = ws.cell(row=r, column=c)
        cell.font = body_font
        cell.alignment = wrap
        cell.border = thin
        if r % 2 == 0:
            cell.fill = alt_fill

def color_status(ws, col, start, end):
    for r in range(start, end + 1):
        cell = ws.cell(row=r, column=col)
        if str(cell.value or "") == "Completed":
            cell.fill = status_done
            cell.font = status_done_font
            cell.alignment = center

def set_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

def landscape(ws):
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.oddFooter.right.text = "Page &P of &N"

# -------------------- Project Summary --------------------
ws = wb.active
ws.title = "Project Summary"
ws.sheet_properties.tabColor = TEAL
ws.merge_cells("A1:F1")
ws["A1"] = "ICCPP Email Intelligence System"
ws["A1"].font = title_font
ws["A1"].alignment = Alignment(vertical="center")
ws.row_dimensions[1].height = 32

ws.merge_cells("A2:F2")
ws["A2"] = "Internal email campaign platform — work completed in this project"
ws["A2"].font = subtitle_font
ws.row_dimensions[2].height = 22

ws.merge_cells("A3:F3")
ws["A3"] = (
    f"Report date: {date.today().isoformat()}  |  "
    "Product: ICCPP Email Intelligence System  |  "
    "Type: Internal (single-organization, not SaaS)"
)
ws["A3"].font = Font(name="Calibri", italic=True, color=GRAY, size=10)
ws.row_dimensions[3].height = 18

ws.merge_cells("A5:F5")
ws["A5"] = "OVERVIEW"
ws["A5"].font = section_font
ws["A5"].fill = section_fill
ws.row_dimensions[5].height = 24

ws["A6"] = "Item"
ws["B6"] = "Detail"
ws.merge_cells("B6:F6")
style_header_row(ws, 6, 6)

overview = [
    ("Project name", "ICCPP Email Intelligence System (repo folder: ENG Email Automation)"),
    ("Purpose", "Operators import contacts, compose campaigns, confirm send, and walk away. The browser never sends bulk mail."),
    ("Core rule", "Send creates an immutable CampaignSend snapshot. Background workers deliver at the provider rate. PostgreSQL is the source of truth."),
    ("Processes", "Next.js app (UI + API)  ·  BullMQ worker  ·  PostgreSQL  ·  Redis (job transport only)"),
    ("Default UI theme", "Dark teal operations console, with Bright / Dark toggle in the header"),
    ("Local URL", "http://localhost:3000"),
]
for i, (k, v) in enumerate(overview):
    r = 7 + i
    ws.cell(row=r, column=1, value=k).font = label_font
    ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=6)
    ws.cell(row=r, column=2, value=v).font = body_font
    ws.row_dimensions[r].height = 36
    for c in range(1, 7):
        ws.cell(row=r, column=c).alignment = wrap
        ws.cell(row=r, column=c).border = thin
        if r % 2 == 0:
            ws.cell(row=r, column=c).fill = alt_fill

ws.merge_cells("A14:F14")
ws["A14"] = "SCOPE BUILT"
ws["A14"].font = section_font
ws["A14"].fill = section_fill
ws.row_dimensions[14].height = 24

for i, h in enumerate(["Area", "Count", "Status", "Notes"], 1):
    ws.cell(row=15, column=i, value=h)
style_header_row(ws, 15, 4)

counts = [
    ("Work packages listed", 30, "Completed", "Foundation through UI polish, local auth bypass, and resilience"),
    ("Operator screens", 13, "Completed", "Dashboard, Contacts, Import, Segments, Suppression, Campaigns, wizard, detail, Templates, Settings, Audit logs"),
    ("API routes", 34, "Completed", "Auth, contacts, campaigns, templates, webhooks, health, metrics, unsubscribe"),
    ("Database models", 18, "Completed", "Users, contacts, campaigns, sends, recipients, events, suppression, imports, audit, settings, heartbeat"),
    ("Background queues", 6, "Completed", "Materialize, send, CSV import, webhooks, scheduled start, reconcile"),
    ("Email providers", 5, "Completed", "Amazon SES, SendGrid, Mailgun, Postmark, Fake (dev/load test)"),
    ("Automated test files", 6, "Completed", "Vitest: render, crypto, webhooks, provider, state machine, suppression"),
    ("Bright / Dark theme", 1, "Completed", "Header toggle; choice saved in the browser"),
]
for i, row in enumerate(counts):
    r = 16 + i
    for c, v in enumerate(row, 1):
        ws.cell(row=r, column=c, value=v)
    paint_row(ws, r, 4)
    color_status(ws, 3, r, r)
    ws.cell(row=r, column=2).alignment = center

ws.merge_cells("A25:F25")
ws["A25"] = "PRODUCT BOUNDARY"
ws["A25"].font = section_font
ws["A25"].fill = section_fill

ws.merge_cells("A26:C26")
ws.merge_cells("D26:F26")
ws["A26"] = "Included"
ws["D26"] = "Not included (by design)"
for c in range(1, 7):
    ws.cell(row=26, column=c).fill = header_fill
    ws.cell(row=26, column=c).font = header_font
    ws.cell(row=26, column=c).alignment = center

included = [
    "Contact import (CSV), tags, segments, suppression list",
    "HTML/text templates with personalization and versions",
    "Campaign wizard, confirm send, pause / resume / cancel",
    "Immutable send snapshot; workers deliver mail",
    "Provider webhooks: bounce, complaint, unsubscribe",
    "Dashboard analytics, audit logs, health/metrics",
    "Docker Compose for Postgres + Redis; Bright/Dark UI",
]
excluded = [
    "Public signup, billing, plans, or multi-tenant SaaS",
    "Sending bulk mail from the browser",
    "Bypassing suppression or faking engagement",
    "Rotating domains to evade sender reputation",
    "Recalling mail already accepted by the provider",
    "Using Redis as the source of truth",
    "Login required for local operator use (login currently bypassed)",
]
for i in range(7):
    r = 27 + i
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=6)
    ws.cell(row=r, column=1, value=included[i])
    ws.cell(row=r, column=4, value=excluded[i])
    ws.row_dimensions[r].height = 28
    for c in range(1, 7):
        ws.cell(row=r, column=c).font = body_font
        ws.cell(row=r, column=c).alignment = wrap
        ws.cell(row=r, column=c).border = thin
        if i % 2 == 1:
            ws.cell(row=r, column=c).fill = alt_fill

set_widths(ws, [28, 18, 16, 78, 16, 16])
landscape(ws)
ws.print_title_rows = "1:3"

# -------------------- Work Completed --------------------
ws2 = wb.create_sheet("Work Completed")
ws2.sheet_properties.tabColor = TEAL
ws2.merge_cells("A1:G1")
ws2["A1"] = "Work completed in this project"
ws2["A1"].font = title_font
ws2.row_dimensions[1].height = 30
ws2.merge_cells("A2:G2")
ws2["A2"] = "Each row is a delivered capability."
ws2["A2"].font = subtitle_font

for i, h in enumerate(
    ["#", "Phase / area", "What was built", "What it does", "Where it lives", "Status", "Notes"], 1
):
    ws2.cell(row=4, column=i, value=h)
style_header_row(ws2, 4, 7)

work = [
    (1, "Foundation", "Next.js 16 App Router scaffold, TypeScript, Tailwind v4, shadcn/ui", "Application shell, routing, UI kit, and project structure", "src/app, src/components", "Completed", "Next.js 16 conventions followed from local docs"),
    (2, "Foundation", "Prisma 6 schema + PostgreSQL + Docker Compose", "Durable data store; Postgres and Redis start as containers", "prisma/schema.prisma, docker-compose.yml", "Completed", "PostgreSQL is source of truth; Redis is job transport only"),
    (3, "Foundation", "Architecture and operations documentation", "System, ER, state machines, queues, webhooks, recovery, security", "README.md, docs/ARCHITECTURE.md", "Completed", ""),
    (4, "Auth (original)", "Session cookies, login API, roles ADMIN / OPERATOR / VIEWER", "Internal operators only; no public registration", "src/lib/auth.ts, src/app/api/auth", "Completed", "Login later bypassed for local use"),
    (5, "Contacts", "Contact list, search, pagination, tags, export CSV", "Manage permission-based recipients", "src/app/(app)/contacts, src/lib/contacts", "Completed", ""),
    (6, "Contacts", "Streamed CSV import with job progress", "Import tens of thousands of rows without blocking the UI", "src/app/api/contacts/import, src/worker/processors/import.ts", "Completed", "Invalid rows counted; job continues"),
    (7, "Contacts", "Downloadable CSV import template", "Operators can download a sample file next to Import CSV", "public/templates/contacts-import-template.csv", "Completed", "Added on Contacts and Import screens"),
    (8, "Audience", "Tags and segments with JSON filters", "Target campaigns by tag, segment, all contacts, or manual list", "src/app/(app)/segments, src/lib/campaigns/audience.ts", "Completed", ""),
    (9, "Suppression", "Suppression list (unsubscribe, bounce, complaint, manual)", "Blocked addresses are never sent again", "src/app/(app)/suppression, src/lib/email/suppression.ts", "Completed", ""),
    (10, "Templates", "HTML + text templates, versions, personalization, test send, duplicate", "Safe merge fields with escaping and fallbacks", "src/app/(app)/templates, src/lib/email/render.ts", "Completed", ""),
    (11, "Campaigns", "Campaign wizard (audience, content, schedule, confirm)", "Operator confirms eligible count before send", "src/app/(app)/campaigns/new", "Completed", "Large sends require an extra checkbox"),
    (12, "Campaigns", "Immutable CampaignSend snapshot", "HTTP request only snapshots; send never happens in the browser", "src/lib/campaigns/send.ts", "Completed", "Idempotency key prevents double send"),
    (13, "Campaigns", "Pause, resume, cancel + cancellation window", "Control in-flight sends without resending completed recipients", "src/app/api/campaigns/[id]/pause|resume|cancel", "Completed", "Cannot recall provider-accepted mail"),
    (14, "Workers", "BullMQ workers: materialize, send, import, webhook, scheduled, reconcile", "Background delivery at EMAIL_RATE_LIMIT_PER_SECOND", "src/worker", "Completed", "jobId = campaignSendId:email"),
    (15, "Workers", "Atomic claim of recipients before provider send", "No duplicate delivery if workers crash or Redis reconnects", "src/worker/processors/send.ts", "Completed", "Terminal statuses are never resent"),
    (16, "Providers", "Adapter layer: SES, SendGrid, Mailgun, Postmark, Fake", "Switch providers without changing campaign logic", "src/lib/email/adapters, src/lib/email/provider.ts", "Completed", "Dev/load tests must use fake provider"),
    (17, "Webhooks", "Signed webhook ingest per provider", "Updates delivery status; unique providerEventId", "src/app/api/webhooks/[provider], src/lib/email/webhooks.ts", "Completed", "Verify first, enqueue second"),
    (18, "Unsubscribe", "Public unsubscribe page + signed token", "One-click unsubscribe writes suppression and contact status", "src/app/unsubscribe, src/lib/email/unsubscribe.ts", "Completed", "Token is tamper-resistant"),
    (19, "Dashboard", "Intelligence dashboard: audience + delivery stats", "Live campaign and delivery rates", "src/app/(app)/dashboard, src/lib/dashboard.ts", "Completed", "Shows a clear alert if Postgres is down"),
    (20, "Ops", "Health, ready, metrics APIs + worker heartbeat", "Liveness, Postgres/Redis/worker readiness, queue depths", "src/app/api/health, ready, metrics; src/worker/health.ts", "Completed", "Worker health on port 3001"),
    (21, "Ops", "Audit logs UI and API", "Who did what on campaigns, contacts, settings", "src/app/(app)/audit-logs", "Completed", ""),
    (22, "Ops", "Settings: org, sending domain checklist, users", "SPF/DKIM/DMARC checklist; operator users", "src/app/(app)/settings", "Completed", "DNS is a console task, not an app trick"),
    (23, "Quality", "Vitest suite (render, crypto, webhooks, provider, state machine, suppression)", "Guards personalization, tokens, no-resend rules", "tests", "Completed", "npm test"),
    (24, "Quality", "Load-test script against fake provider", "Measure enqueue and worker throughput without real recipients", "scripts/load-test.ts", "Completed", "EMAIL_PROVIDER=fake only"),
    (25, "Deploy", "Dockerfile, Compose, production README", "App + worker + migrate services; standalone Next build", "Dockerfile, docker-compose.yml, README.md", "Completed", ""),
    (26, "UI polish", "Rebrand to ICCPP Email Intelligence System", "Teal operations console, grouped nav, live pulse, UTC clock", "src/components/app-shell.tsx, globals.css", "Completed", "Default from-name ICCPP"),
    (27, "UI polish", "Bright and Dark theme buttons on screen", "Header segmented control; theme persists in the browser", "src/components/theme-toggle.tsx, theme-provider.tsx", "Completed", "Default theme is Dark"),
    (28, "Local UX", "Login gate removed for initial local use", "/login redirects to dashboard; APIs use a local operator", "src/proxy.ts, src/app/login/page.tsx, src/lib/auth.ts", "Completed", "Logout removed from shell"),
    (29, "Resilience", "Graceful dashboard when database is down", "Empty stats plus a Database is not running alert instead of a 500 page", "src/lib/dashboard.ts, src/app/(app)/dashboard/page.tsx", "Completed", "Needs Docker Desktop for real data"),
    (30, "Resilience", "Rate limiter fallback and Redis lazy connect", "App stays up if Redis is not running yet", "src/lib/rate-limit.ts, src/lib/queue/redis.ts", "Completed", ""),
]
for i, row in enumerate(work):
    r = 5 + i
    for c, v in enumerate(row, 1):
        ws2.cell(row=r, column=c, value=v)
    paint_row(ws2, r, 7)
    color_status(ws2, 6, r, r)
    ws2.cell(row=r, column=1).alignment = center
    ws2.row_dimensions[r].height = 48

set_widths(ws2, [6, 16, 42, 52, 42, 14, 40])
ws2.auto_filter.ref = "A4:G34"
landscape(ws2)

# -------------------- Screens --------------------
ws3 = wb.create_sheet("Screens")
ws3.sheet_properties.tabColor = TEAL
ws3.merge_cells("A1:E1")
ws3["A1"] = "Operator screens built"
ws3["A1"].font = title_font
ws3.row_dimensions[1].height = 30

for i, h in enumerate(["Screen", "URL", "What the operator can do", "Nav group", "Status"], 1):
    ws3.cell(row=3, column=i, value=h)
style_header_row(ws3, 3, 5)

screens = [
    ("Intelligence dashboard", "/dashboard", "Audience health, delivery rates, campaign status; DB-down alert", "Intelligence", "Completed"),
    ("Contacts", "/contacts", "Search, filter, paginate, export CSV, download import template, open import", "Intelligence", "Completed"),
    ("CSV import", "/contacts/import", "Upload CSV, watch streamed import job progress, download template", "Intelligence", "Completed"),
    ("Segments", "/segments", "Create and manage audience filters for campaigns", "Intelligence", "Completed"),
    ("Suppression", "/suppression", "View and add suppressed emails (unsubscribe, bounce, complaint, manual)", "Intelligence", "Completed"),
    ("Campaigns", "/campaigns", "List campaigns and statuses; open wizard or a campaign", "Campaigns", "Completed"),
    ("New campaign", "/campaigns/new", "Wizard: audience, template, schedule, confirm eligible count, send", "Campaigns", "Completed"),
    ("Campaign detail", "/campaigns/[id]", "Progress, pause, resume, cancel, preview, test send", "Campaigns", "Completed"),
    ("Templates", "/templates", "List email templates", "Campaigns", "Completed"),
    ("New template", "/templates/new", "Create HTML/text template with personalization", "Campaigns", "Completed"),
    ("Template detail", "/templates/[id]", "Edit, version, duplicate, send a test", "Campaigns", "Completed"),
    ("Audit logs", "/audit-logs", "Inspect operator actions", "Workspace", "Completed"),
    ("Settings", "/settings", "Org details, sending-domain checklist, users", "Workspace", "Completed"),
    ("Unsubscribe (public)", "/unsubscribe/[token]", "Recipient opts out with a signed token", "Public", "Completed"),
    ("Login (bypassed)", "/login", "Currently redirects to dashboard for local use", "Public", "Completed"),
]
for i, row in enumerate(screens):
    r = 4 + i
    for c, v in enumerate(row, 1):
        ws3.cell(row=r, column=c, value=v)
    paint_row(ws3, r, 5)
    color_status(ws3, 5, r, r)
set_widths(ws3, [24, 28, 78, 16, 14])
ws3.auto_filter.ref = "A3:E18"
landscape(ws3)

# -------------------- APIs --------------------
ws4 = wb.create_sheet("API Endpoints")
ws4.sheet_properties.tabColor = TEAL
ws4.merge_cells("A1:D1")
ws4["A1"] = "API routes built"
ws4["A1"].font = title_font
ws4.row_dimensions[1].height = 30

for i, h in enumerate(["Method / area", "Path", "Purpose", "Status"], 1):
    ws4.cell(row=3, column=i, value=h)
style_header_row(ws4, 3, 4)

apis = [
    ("Auth", "/api/auth/login", "Create session (still present; UI login bypassed)", "Completed"),
    ("Auth", "/api/auth/logout", "Destroy session", "Completed"),
    ("Auth", "/api/auth/me", "Current operator", "Completed"),
    ("Contacts", "/api/contacts", "List / create contacts", "Completed"),
    ("Contacts", "/api/contacts/[id]", "Get / update / archive a contact", "Completed"),
    ("Contacts", "/api/contacts/import", "Start CSV import job", "Completed"),
    ("Contacts", "/api/contacts/import/[id]", "Import job progress", "Completed"),
    ("Contacts", "/api/contacts/export", "Export CSV", "Completed"),
    ("Tags", "/api/tags", "List / create tags", "Completed"),
    ("Segments", "/api/segments", "List / create segments", "Completed"),
    ("Suppression", "/api/suppression", "List / add suppressions", "Completed"),
    ("Templates", "/api/templates", "List / create templates", "Completed"),
    ("Templates", "/api/templates/[id]", "Get / update template", "Completed"),
    ("Templates", "/api/templates/[id]/duplicate", "Duplicate template", "Completed"),
    ("Templates", "/api/templates/[id]/test", "Send a test email", "Completed"),
    ("Campaigns", "/api/campaigns", "List / create campaigns", "Completed"),
    ("Campaigns", "/api/campaigns/[id]", "Get / update campaign", "Completed"),
    ("Campaigns", "/api/campaigns/audience", "Preview eligible audience count", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/send", "Confirm send — snapshot + enqueue only", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/pause", "Pause in-flight send", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/resume", "Resume paused send", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/cancel", "Cancel remaining unsent recipients", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/progress", "Live send progress", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/preview", "Preview personalized message", "Completed"),
    ("Campaigns", "/api/campaigns/[id]/test", "Test send for a campaign", "Completed"),
    ("Webhooks", "/api/webhooks/[provider]", "SES / SendGrid / Mailgun / Postmark / fake events", "Completed"),
    ("Public", "/api/unsubscribe/[token]", "Process unsubscribe token", "Completed"),
    ("Dashboard", "/api/dashboard", "Aggregated intelligence stats", "Completed"),
    ("Ops", "/api/health", "Liveness", "Completed"),
    ("Ops", "/api/ready", "Postgres, Redis, worker heartbeat", "Completed"),
    ("Ops", "/api/metrics", "Queue depths and failed deliveries", "Completed"),
    ("Ops", "/api/audit-logs", "Audit trail", "Completed"),
    ("Ops", "/api/settings", "Org and sending settings", "Completed"),
    ("Ops", "/api/users", "Operator users", "Completed"),
]
for i, row in enumerate(apis):
    r = 4 + i
    for c, v in enumerate(row, 1):
        ws4.cell(row=r, column=c, value=v)
    paint_row(ws4, r, 4)
    color_status(ws4, 4, r, r)
    ws4.row_dimensions[r].height = 28
set_widths(ws4, [16, 40, 58, 14])
ws4.auto_filter.ref = "A3:D37"
landscape(ws4)

# -------------------- Data and queues --------------------
ws5 = wb.create_sheet("Data and Queues")
ws5.sheet_properties.tabColor = TEAL
ws5.merge_cells("A1:D1")
ws5["A1"] = "Database models and background queues"
ws5["A1"].font = title_font
ws5.row_dimensions[1].height = 30

ws5.merge_cells("A3:D3")
ws5["A3"] = "DATABASE MODELS"
ws5["A3"].font = section_font
ws5["A3"].fill = section_fill

for i, h in enumerate(["Model", "Role in the system", "Key rules", "Status"], 1):
    ws5.cell(row=4, column=i, value=h)
style_header_row(ws5, 4, 4)

models = [
    ("User / Session / LoginAttempt", "Internal operators and sessions", "Roles ADMIN, OPERATOR, VIEWER; no public signup", "Completed"),
    ("Contact / Tag / ContactTag", "Recipient directory", "emailNormalized unique; status includes unsubscribed/bounced", "Completed"),
    ("Segment", "Saved audience filter (JSON)", "Used by campaigns", "Completed"),
    ("Template / TemplateVersion", "Email content versions", "Current version pointer; HTML + text + fallbacks", "Completed"),
    ("Campaign", "Draft / scheduled / sending campaign", "Audience type ALL, TAGS, SEGMENT, MANUAL", "Completed"),
    ("CampaignSend", "Immutable snapshot at confirm-send", "Unique campaignId and idempotencyKey", "Completed"),
    ("CampaignRecipient", "One row per address in a send", "Unique (send, email); unique idempotencyKey", "Completed"),
    ("EmailDelivery", "Per-attempt provider result", "Unique (recipient, attemptNumber)", "Completed"),
    ("EmailEvent", "Provider webhook events", "providerEventId unique — duplicates ignored", "Completed"),
    ("Suppression", "Do-not-send list", "emailNormalized unique", "Completed"),
    ("ImportJob", "CSV import progress", "Counts imported / duplicate / invalid / suppressed", "Completed"),
    ("AuditLog", "Operator actions", "Indexed by entity and user", "Completed"),
    ("Setting", "Key/value org settings", "JSON values", "Completed"),
    ("WorkerHeartbeat", "Worker liveness", "Used by /api/ready", "Completed"),
]
for i, row in enumerate(models):
    r = 5 + i
    for c, v in enumerate(row, 1):
        ws5.cell(row=r, column=c, value=v)
    paint_row(ws5, r, 4)
    color_status(ws5, 4, r, r)

ws5.merge_cells("A20:D20")
ws5["A20"] = "BACKGROUND QUEUES (BullMQ)"
ws5["A20"].font = section_font
ws5["A20"].fill = section_fill

for i, h in enumerate(["Queue", "Job", "What it does", "Status"], 1):
    ws5.cell(row=21, column=i, value=h)
for c in range(1, 5):
    ws5.cell(row=21, column=c).fill = header_fill
    ws5.cell(row=21, column=c).font = header_font
    ws5.cell(row=21, column=c).alignment = center
    ws5.cell(row=21, column=c).border = thin

queues = [
    ("campaign-materialize", "Materialize audience", "Resolve audience in EMAIL_BATCH_SIZE batches into CampaignRecipient rows", "Completed"),
    ("email-send", "Deliver one email", "One job per recipient; jobId = idempotencyKey; rate-limited", "Completed"),
    ("csv-import", "Import contacts", "Stream CSV from disk; continue on malformed rows", "Completed"),
    ("provider-webhook", "Process events", "Apply bounce/complaint/delivery after signature verify", "Completed"),
    ("campaign-scheduled", "Delayed start", "Start a campaign at scheduledAt", "Completed"),
    ("campaign-reconcile", "Rebuild missing jobs", "If Redis is lost, re-enqueue PENDING/QUEUED/stuck PROCESSING from Postgres", "Completed"),
]
for i, row in enumerate(queues):
    r = 22 + i
    for c, v in enumerate(row, 1):
        ws5.cell(row=r, column=c, value=v)
    paint_row(ws5, r, 4)
    color_status(ws5, 4, r, r)

ws5.merge_cells("A29:D29")
ws5["A29"] = "CAMPAIGN STATUSES"
ws5["A29"].font = section_font
ws5["A29"].fill = section_fill
ws5.merge_cells("A30:D30")
ws5["A30"] = "DRAFT to READY / SCHEDULED to QUEUING to QUEUED to SENDING to COMPLETED / PARTIALLY_FAILED / FAILED. Also PAUSED and CANCELLED."
ws5["A30"].font = body_font
ws5["A30"].alignment = wrap
ws5.row_dimensions[30].height = 36

ws5.merge_cells("A32:D32")
ws5["A32"] = "DELIVERY STATUSES"
ws5["A32"].font = section_font
ws5["A32"].fill = section_fill
ws5.merge_cells("A33:D33")
ws5["A33"] = "PENDING to QUEUED to PROCESSING to SENT to DELIVERED (or BOUNCED / COMPLAINED / DEFERRED). Also SUPPRESSED, FAILED, CANCELLED, SKIPPED. SENT is never resent after pause/resume."
ws5["A33"].font = body_font
ws5["A33"].alignment = wrap
ws5.row_dimensions[33].height = 42

set_widths(ws5, [32, 28, 72, 14])
landscape(ws5)

# -------------------- Tech stack --------------------
ws6 = wb.create_sheet("Tech Stack")
ws6.sheet_properties.tabColor = TEAL
ws6.merge_cells("A1:D1")
ws6["A1"] = "Technology used"
ws6["A1"].font = title_font
ws6.row_dimensions[1].height = 30

for i, h in enumerate(["Layer", "Choice", "Version / note", "Why it is in the project"], 1):
    ws6.cell(row=3, column=i, value=h)
style_header_row(ws6, 3, 4)

stack = [
    ("Web framework", "Next.js App Router", "16.3.4", "UI + API in one app"),
    ("Language", "TypeScript", "5.x", "Typed domain and API contracts"),
    ("UI", "React", "19.2.8", "Operator console"),
    ("Styling", "Tailwind CSS + shadcn/ui", "Tailwind 4", "Teal operations theme, Bright/Dark"),
    ("Theme", "next-themes", "0.4.6", "Bright and Dark buttons persist locally"),
    ("Database", "PostgreSQL + Prisma", "Postgres 16 / Prisma 6.16.3", "Source of truth for campaigns and recipients"),
    ("Queue", "Redis + BullMQ", "Redis 7 / BullMQ 6", "Job transport; reconstructable from Postgres"),
    ("Validation", "Zod", "4.x", "Request and env validation"),
    ("Email", "SES / SendGrid / Mailgun / Postmark / Fake", "Adapters behind one provider interface", "Swap providers without changing send path"),
    ("CSV", "csv-parse / csv-stringify", "Streamed import and export", "Large contact files"),
    ("Auth crypto", "bcryptjs + signed tokens", "Passwords and unsubscribe tokens", "Internal operators; tamper-resistant unsubscribe"),
    ("Logging", "pino", "10.x", "Structured logs with campaign IDs"),
    ("Tests", "Vitest", "4.x", "Critical path coverage"),
    ("Containers", "Docker Compose", "app, worker, postgres, redis, migrate", "Local and production-shaped deploy"),
    ("Worker runtime", "tsx", "Separate process on port 3001 health", "Must not run send from Next.js request"),
]
for i, row in enumerate(stack):
    r = 4 + i
    for c, v in enumerate(row, 1):
        ws6.cell(row=r, column=c, value=v)
    paint_row(ws6, r, 4)
    ws6.row_dimensions[r].height = 32
set_widths(ws6, [18, 42, 42, 48])
landscape(ws6)

# -------------------- How to run --------------------
ws7 = wb.create_sheet("How to run")
ws7.sheet_properties.tabColor = TEAL
ws7.merge_cells("A1:C1")
ws7["A1"] = "Local run (what you need for real data)"
ws7["A1"].font = title_font
ws7.row_dimensions[1].height = 30

for i, h in enumerate(["Step", "Command / action", "Why"], 1):
    ws7.cell(row=3, column=i, value=h)
style_header_row(ws7, 3, 3)

run_steps = [
    ("1", "Start Docker Desktop", "Postgres and Redis run in containers. If the daemon is off, the dashboard shows Database is not running."),
    ("2", "Copy .env.example to .env (already done locally)", "Environment: DATABASE_URL, REDIS_URL, EMAIL_PROVIDER=fake, secrets."),
    ("3", "docker compose up -d postgres redis", "Start database and queue."),
    ("4", "npx prisma migrate deploy", "Create tables."),
    ("5", "npx prisma db seed", "Seed admin / sample data."),
    ("6", "npm run dev", "Next.js UI + API at http://localhost:3000"),
    ("7", "npm run worker (separate terminal)", "Background send/import. Do not chain this after next dev in one command."),
    ("8", "Open http://localhost:3000/dashboard", "Login is currently skipped; you land in the operator console."),
    ("9", "Use Bright / Dark in the header", "Theme is saved in the browser."),
    ("10", "npm test", "Run Vitest suite."),
]
for i, row in enumerate(run_steps):
    r = 4 + i
    for c, v in enumerate(row, 1):
        ws7.cell(row=r, column=c, value=v)
    paint_row(ws7, r, 3)
    ws7.cell(row=r, column=1).alignment = center
    ws7.row_dimensions[r].height = 40
set_widths(ws7, [10, 55, 78])

ws7.merge_cells("A15:C15")
ws7["A15"] = (
    "Note: npm run worker was previously chained after npm run dev in the same terminal, "
    "so the worker never started. Run the worker in its own terminal."
)
ws7["A15"].font = Font(name="Calibri", italic=True, color="92400E", size=11)
ws7["A15"].alignment = wrap
ws7.row_dimensions[15].height = 36
landscape(ws7)

wb.properties.title = "ICCPP Email Intelligence System — Project Work"
wb.properties.creator = "ICCPP Email Intelligence System"
wb.properties.description = (
    "Inventory of work completed in the ENG Email Automation / ICCPP Email Intelligence System project"
)

wb.save(path)
print(path)
