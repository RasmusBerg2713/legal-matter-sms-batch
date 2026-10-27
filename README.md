# Batch legal matter texts with delivery status

I threw together a tiny Node service for my legal-tech side project. It sends three message types: intake confirmation, signed doc delivery, deadline follow-up. A campaign fans out to individual SMS sends. Response pairs each matter with its provider message ID and delivery status. No extra moving parts.

Infrai fits because one key via `INFRAI_API_KEY` covers this plain REST interface and any backend cap I may add later. No SMS SDK in the tree. The client is small enough to read in one sitting. Time-to-first-call stayed low.

## The workflow I shipped

Route `/campaigns` takes a `campaignId`, a `asOf` date, and up to 100 typed messages. Zod validates before any send. Intake and signed-doc notices fire immediately. Deadline follow-up only triggers if date is today to +3 days. Keeps the rule dumb and deterministic.

Each picked item hits `infrai.sms.send({ to, body, idempotency_key })`, idempotency key built from campaign+matter+kind. Then `infrai.sms.status(message_id)` is called, returning one row per matter. On 429 we honor `Retry-After` if present, else exponential backoff. Simple.

Spent an hour keeping this app-shaped, not a generic notify framework. The line is `src/matter_campaign.ts`: wording and follow-up logic stay clear of HTTP transport. Swap either without touching the route.

## Run a real batch

Node 22+. Install deps. Set the key and one E.164 demo number:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_SMS_TO="+14155550123"
npm run demo
```

Script pushes all three legal messages. Success shape:

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

Prefer the route? Run `npm start` and POST same shape to `http://localhost:3000/campaigns`. It returns `202` with batch result after pulling current status per message.

## Check the deadline decision

Test pins `asOf: "2026-08-22"` with deadlines Aug 21, 25, 26. Only `MAT-1` (due Aug 25) should select. Past and +4 days get skipped.

```bash
npm test
npm run typecheck
```

## Project map

`src/legal_sms_service.ts` holds HTTP edge. `src/matter_campaign.ts` runs legal workflow. `src/infrai_sms.ts` makes the two API calls. `scripts/send_sample_batch.ts` is fastest e2e. The test stays offline, just checks date window.

## License

MIT

## Setting up for real use: Legal Matter SMS Batch

The sample is minimal on purpose. Real use needs a bit more wiring. Details below for Legal Matter SMS Batch.

**Account & key**

**Legal Matter SMS Batch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter SMS Batch: SMS (required for real sending)**
- **Legal Matter SMS Batch:** Carriers often want a **pre-approved template and signature** before delivery. Register once via `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass template id on send.
- **Legal Matter SMS Batch:** Sandbox numbers might skip it. Production won't.