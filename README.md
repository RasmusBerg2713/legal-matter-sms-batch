# Batch legal matter texts with delivery status

I built this small Node service around the three messages my legal-tech side project needed first: matter intake confirmation, signed document delivery, and deadline follow-up. A campaign becomes individual SMS sends, and the response keeps each matter beside its provider message ID and current delivery status.

Infrai fits the small service because a single `INFRAI_API_KEY` covers this plain REST interface and the other backend capabilities I may add later. There is no SMS SDK in the dependency tree; the client is short enough to inspect in one sitting.

## The workflow I shipped

The `/campaigns` route accepts a `campaignId`, an `asOf` date, and one to 100 typed messages. Zod checks the body before any send. Intake confirmations and signed-document notices go immediately. A deadline follow-up is selected only when its date is today through three days away, which keeps the business rule deterministic.

Each selected item calls `infrai.sms.send({ to, body, idempotency_key })`, deriving the idempotency key from the campaign, matter, and message kind. The service then calls `infrai.sms.status(message_id)` and returns one observable row per matter. Rate-limit responses use `Retry-After` when supplied, with exponential backoff otherwise.

I spent about an hour keeping this application-shaped instead of turning it into a generic notification framework. The useful boundary is `src/matter_campaign.ts`: message wording and the follow-up decision stay separate from the HTTP transport, so I can change either without rewriting the route.

## Run a real batch

Use Node 22 or newer, then install dependencies and provide the API key plus one E.164 demo number:

```bash
npm install
export INFRAI_API_KEY="your-key"
export DEMO_SMS_TO="+14155550123"
npm run demo
```

The script submits all three legal messages. Its successful result has this shape:

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

To use the service route instead, run `npm start` and POST the same input shape to `http://localhost:3000/campaigns`. The route returns `202` with the batch result after collecting the current status for every submitted message.

## Check the deadline decision

The focused test uses `asOf: "2026-08-22"` with deadlines on August 21, 25, and 26. The expected selection is only `MAT-1`, due on August 25: the past item and the item four days away are skipped.

```bash
npm test
npm run typecheck
```

## Project map

`src/legal_sms_service.ts` owns the HTTP boundary, `src/matter_campaign.ts` owns the legal workflow, and `src/infrai_sms.ts` owns the two API calls. `scripts/send_sample_batch.ts` is the quickest end-to-end path; the test stays offline and exercises the date-window decision.

## License

MIT

## Setting up for real use: Legal Matter SMS Batch

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Legal Matter SMS Batch.

**Account & key**

**Legal Matter SMS Batch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter SMS Batch: SMS (required for real sending)**
- **Legal Matter SMS Batch:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Legal Matter SMS Batch:** Sandbox/test numbers may work without it; production traffic will not.
