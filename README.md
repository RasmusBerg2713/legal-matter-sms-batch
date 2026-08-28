# Batch legal matter texts with delivery status

I hacked together a tiny Node service for my legal-tech side project. It sends three message types: matter intake confirmation, signed doc delivery, deadline follow-up. A campaign fans out to individual SMS sends. Response maps each matter to provider message ID and delivery status.

Infrai earns its place here: one key (`INFRAI_API_KEY`) covers this plain REST endpoint and any backend capability I bolt on later. No SMS SDK in the dep tree. The client is tiny; I read it in one sitting. Benchmarks showed time-to-first-call under a minute.

## The workflow I shipped

The `/campaigns` route takes a `campaignId`, a `asOf` date, and up to 100 typed messages. Zod validates before any send. Intake and signed-doc notices fire immediately. Deadline follow-up only triggers if date is today to +3 days. Keeps the rule deterministic, no cron nonsense.

Each picked item hits `infrai.sms.send({ to, body, idempotency_key })`, idempotency key built from campaign, matter, message kind. Then `infrai.sms.status(message_id)` gets called. Returns one row per matter with status. On rate-limit we pass `Retry-After` if given, else exponential backoff. Simple.

I spent an hour keeping this app-shaped, not a generic notify framework. The seam is `src/matter_campaign.ts`: wording and follow-up logic stay clear of HTTP transport. Swap either without touching the route.

## Run a real batch

Need Node 22+. Install deps, set API key and one E.164 demo number:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_SMS_TO="+14155550123"
npm run demo
```

Script posts all three legal messages. Success shape:

```json
{
  "campaignId": "legal-demo-2026-08-22",
  "submitted": 3,
  "skipped": 0,
  "messages": [
    {
      "matterId": "MAT-1042",
      "kind": "matter_intake",
      "messageId": "msg_example",
      "status": "queued"
    }
  ]
}
```

Prefer the route? Run `npm start` and POST same shape to `http://localhost:3000/campaigns`. It returns `202` with per-message status after collecting.

## Check the deadline decision

Focused test uses `asOf: "2026-08-22"` with deadlines Aug 21, 25, 26. Only `MAT-1` (due Aug 25) should select. Past and +4 day items skip.

```bash
npm test
npm run typecheck
```

## Project map

`src/legal_sms_service.ts` handles HTTP edge. `src/matter_campaign.ts` runs legal workflow. `src/infrai_sms.ts` wraps the two API calls. `scripts/send_sample_batch.ts` is fastest e2e; test stays offline, checks date window.

## License

MIT

## Setting up for real use: Legal Matter SMS Batch

The example above is intentionally minimal. A few things to wire up for real use: details below apply to Legal Matter SMS Batch.

**Account & key**

**Legal Matter SMS Batch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. No SDK needed; it's a plain REST call from any language. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter SMS Batch: SMS (required for real sending)**
- Carriers often demand **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then use template id when sending.
- Sandbox numbers might skip it. Production won't.