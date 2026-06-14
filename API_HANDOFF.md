# Company Miner API Handoff

This document summarizes the APIs currently available in `backend-company-miner` for team handoff and integration.

## Base URLs

- Staging: `http://3.7.77.174:8131`
- Local: `http://localhost:8131`

API version prefix:

- `http://<host>/api/v1`

Swagger:

- UI: `http://<host>/api-docs/`
- JSON: `http://<host>/api-docs.json`

---

## Authentication

Most endpoints require JWT Bearer auth.

Header format:

`Authorization: Bearer <token>`

Token is obtained from `POST /api/v1/auth/login`.

Role access:

- `admin/company-miner/*`: any authenticated user
- `admin/master-services/*`: admin only

---

## Standard API Response Shape

Success:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Error message",
  "errors": {}
}
```

---

## 1) Health

### GET `/health`

Checks API + DB status.

Response 200:

```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-14T12:00:00.000Z"
}
```

Response 503 when DB is unavailable.

---

## 2) Auth

### POST `/api/v1/auth/register`

Register a user.

Request:

```json
{
  "email": "admin@example.com",
  "password": "StrongPass123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin"
}
```

Notes:

- `password` minimum 8 chars
- `role` optional (`admin` or `user`)

---

### POST `/api/v1/auth/login`

Login and receive token.

Request:

```json
{
  "email": "admin@example.com",
  "password": "StrongPass123"
}
```

Response `data` includes auth token and user context.

---

### GET `/api/v1/auth/profile`

Get current user profile (requires Bearer token).

---

## 3) Company Miner

### POST `/api/v1/admin/company-miner`

Mine company intelligence from website URL.

Auth: Bearer required.

Request:

```json
{
  "url": "https://example.com",
  "instruction": "Focus more on AI and cloud initiatives."
}
```

Validation:

- `url` required, max 2048
- only `http/https` allowed
- `instruction` optional, max 150 chars

Key response fields (`data`):

- `aboutTheCompany: string`
- `products: string[]`
- `services: string[]`
- `industry: string`
- `top5SourcesOfIncome: string[]`
- `financialResultsLatest5: string[]`
- `currentChallenges: string[]`
- `competitors: string[]`
- `publicSearchUsed?: boolean`
- `yahooFinanceUsed?: boolean`
- `deepSearchUsed?: boolean`
- `deepSearchSourceCount?: number`
- `suggestedServicesWeCanProvide?: Array<{ serviceId?: number; serviceName: string; rationale: string }>`
- `pdfBase64?: string`
- `pdfFilename?: string`

Notes:

- Deep search fallback is synchronous and used to enrich sparse sections (especially challenges/competitors).
- PDF is best-effort; response still succeeds if PDF generation fails.

---

### POST `/api/v1/admin/company-miner/generate-service-email`

Generate enterprise outreach email from mined data + suggested services.

Auth: Bearer required.

Request:

```json
{
  "companyUrl": "https://example.com",
  "minedResult": {
    "aboutTheCompany": "....",
    "products": [],
    "services": [],
    "industry": "Technology",
    "top5SourcesOfIncome": [],
    "financialResultsLatest5": [],
    "currentChallenges": [],
    "competitors": []
  },
  "suggestedServices": [
    {
      "serviceId": 1,
      "serviceName": "Cloud Migration",
      "rationale": "Legacy infra modernization opportunity..."
    }
  ],
  "instruction": "Keep tone consultative and concise."
}
```

Validation:

- `companyUrl` required
- `suggestedServices` must contain `{ serviceName, rationale }`
- `instruction` optional, max 300 chars

Response `data`:

```json
{
  "subject": "Potential modernization support for your platform roadmap",
  "body": "....",
  "cta": "Would you be open to a 20-minute discovery call next week?"
}
```

---

## 4) Master Services (Admin)

Base: `/api/v1/admin/master-services`

Auth: Bearer required, admin role required.

### GET `/api/v1/admin/master-services`

List master services.

Optional query:

- `isActive=true|false`

### GET `/api/v1/admin/master-services/:id`

Get one master service by ID.

### POST `/api/v1/admin/master-services`

Create service.

Request:

```json
{
  "name": "Cloud Migration",
  "description": "Lift-and-shift and modernization services",
  "sortOrder": 1,
  "isActive": true
}
```

### PUT `/api/v1/admin/master-services/:id`

Update service fields.

### DELETE `/api/v1/admin/master-services/:id`

Delete service.

---

## Common Error Codes

- `400` validation / malformed request
- `401` unauthorized / missing token
- `403` forbidden (insufficient role)
- `404` resource not found
- `422` unprocessable mining input/content
- `500` unexpected server error
- `502` upstream AI/extraction failures
- `503` degraded health (DB unavailable)

---

## 5) Zoho CRM Integration

These endpoints are for Zoho workflows / middleware. They use a dedicated integration API key (not JWT).

Header (either):

- `X-API-Key: <ZOHO_INTEGRATION_API_KEY>`
- `Authorization: Bearer <ZOHO_INTEGRATION_API_KEY>`

Processing is **async**: the API returns `202 Accepted` immediately. A background worker mines the company, generates the PDF, and uploads it to Zoho CRM as a lead attachment.

### POST `/api/v1/integrations/zoho/leads/process`

Enqueue a Company Miner job for a Zoho lead.

Request:

```json
{
  "lead_id": "1234567890123456789",
  "website": "https://acme.com",
  "company": "Acme Corp",
  "email": "john@acme.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

| Field | Required | Notes |
|---|---|---|
| `lead_id` | Yes | Used for Zoho attachment upload |
| `website` | Preferred | Mining input; if omitted, worker calls Zoho `GET /Leads/{lead_id}` |
| `company`, `email`, `first_name`, `last_name` | No | Stored on job record (metadata) |

Response `202`:

```json
{
  "success": true,
  "message": "Company Miner job accepted",
  "data": {
    "job_id": "uuid",
    "lead_id": "1234567890123456789",
    "status": "queued",
    "website": "https://acme.com",
    "resolved_website": null,
    "pdf_filename": null,
    "zoho_attachment_id": null,
    "error_message": null,
    "created_at": "2026-03-14T12:00:00.000Z",
    "started_at": null,
    "completed_at": null
  }
}
```

If a job for the same `lead_id` is already `queued` or `processing` (within 30 minutes), the API returns `202` with the existing job (idempotent).

Job statuses: `queued` → `processing` → `completed` | `failed`

### GET `/api/v1/integrations/zoho/jobs/:jobId`

Optional status polling for support/debugging.

### Zoho outbound calls (worker)

| Step | When |
|---|---|
| `GET /crm/v8/Leads/{lead_id}` | Only when `website` was not provided in the request |
| `POST /crm/v8/Leads/{lead_id}/Attachments` | After PDF is generated |

### Required environment variables

```env
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_API_BASE=https://www.zohoapis.com
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com
ZOHO_INTEGRATION_API_KEY=
```

Optional:

```env
ZOHO_WORKER_ENABLED=true
ZOHO_WORKER_POLL_INTERVAL_MS=5000
ZOHO_JOB_IDEMPOTENCY_WINDOW_MS=1800000
ZOHO_WORKER_CONCURRENCY=1
```

### Zoho process cURL

```bash
curl -X POST "http://3.7.77.174:8131/api/v1/integrations/zoho/leads/process" \
  -H "X-API-Key: <INTEGRATION_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"lead_id":"1234567890123456789","website":"https://example.com"}'
```

---

## Quick cURL Samples

### Login

```bash
curl -X POST "http://3.7.77.174:8131/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"StrongPass123"}'
```

### Mine Company

```bash
curl -X POST "http://3.7.77.174:8131/api/v1/admin/company-miner" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","instruction":"Focus on AI initiatives"}'
```

### Generate Service Email

```bash
curl -X POST "http://3.7.77.174:8131/api/v1/admin/company-miner/generate-service-email" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"companyUrl":"https://example.com","minedResult":{"aboutTheCompany":"...","products":[],"services":[],"industry":"Technology","top5SourcesOfIncome":[],"financialResultsLatest5":[],"currentChallenges":[],"competitors":[]},"suggestedServices":[{"serviceName":"Cloud Migration","rationale":"..."}]}'
```

---

## Source of Truth

For latest contract details, always check:

- Swagger UI: `http://<host>/api-docs/`
- OpenAPI JSON: `http://<host>/api-docs.json`

