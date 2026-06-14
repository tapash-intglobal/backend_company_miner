# Company Miner — Zoho Integration API

Integration guide for the team calling Company Miner from Zoho workflows or middleware.

**Scope:** Enqueue company research → generate PDF → attach to Zoho lead. **Does not** update `Lead_Score` or other CRM fields.

**Staging base URL:** `http://3.7.77.174:8131`

---

## Endpoints

### 1. Process lead (primary)

`POST /api/v1/integrations/zoho/leads/process`

**Request body:**

| Field | Required | Notes |
|---|---|---|
| `lead_id` | Yes | Zoho lead ID; PDF is uploaded to this lead |
| `website` | Preferred | Mining input. If omitted, worker calls Zoho `GET /crm/v8/Leads/{lead_id}` for `Website` |
| `company`, `email`, `first_name`, `last_name` | No | Optional metadata stored on the job |

```json
{
  "lead_id": "1126054000006691002",
  "website": "https://acme.com",
  "company": "Acme Corp"
}
```

**Response:** `202 Accepted` (async — PDF is **not** ready yet)

```json
{
  "success": true,
  "message": "Company Miner job accepted",
  "data": {
    "job_id": "uuid",
    "lead_id": "1126054000006691002",
    "status": "queued"
  }
}
```

**Idempotency:** If the same `lead_id` already has a job in `queued` or `processing` (within 30 min), `202` returns the existing job.

**Processing time:** ~15 s – 2 min. On success, PDF appears on the lead under **Attachments** (`{company}-company-miner-report.pdf`).

**Failure cases:** Missing/unresolvable website, invalid URL, upstream AI or Zoho errors → job status `failed` (no attachment).

---

### 2. Job status (optional)

`GET /api/v1/integrations/zoho/jobs/{job_id}`

Poll for debugging. Status flow: `queued` → `processing` → `completed` | `failed`.

---

## Example

```bash
curl -X POST "http://3.7.77.174:8131/api/v1/integrations/zoho/leads/process" \
  -H "X-API-Key: <INTEGRATION_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"lead_id":"1126054000006691002","website":"https://twiezn.com"}'
```

---

## Worker behaviour (outbound Zoho calls)

| Call | When |
|---|---|
| `GET https://www.zohoapis.in/crm/v8/Leads/{lead_id}` | Only if `website` not sent in request |
| `POST https://www.zohoapis.in/crm/v8/Leads/{lead_id}/Attachments` | After PDF generation (multipart, field `file`) |

Zoho OAuth (refresh token) is configured on the Company Miner server — **not** required in your webhook calls.

---

## Integration checklist

- [ ] Send `lead_id` on every call  
- [ ] Send `website` when available (recommended — avoids extra Zoho GET and null Website issues)  
- [ ] Treat `202` as “accepted”, not “completed”  
- [ ] Do not expect a callback/webhook on completion — verify via Zoho Attachments or job status GET  
- [ ] Do not use this API for Lead Score updates  

---

*June 2026 — attachment-only integration.*
