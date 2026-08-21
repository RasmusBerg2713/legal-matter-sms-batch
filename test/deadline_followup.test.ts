import assert from "node:assert/strict";
import test from "node:test";
import { campaignRequest, shouldSend } from "../src/matter_campaign";

test("sends only deadline follow-ups due within three days", () => {
  const base = { to: "+14155550123", clientName: "Avery" };
  const input = campaignRequest.parse({
    campaignId: "august-deadlines",
    asOf: "2026-08-22",
    messages: [
      { ...base, kind: "deadline_follow_up", matterId: "MAT-1", deadline: "2026-08-25" },
      { ...base, kind: "deadline_follow_up", matterId: "MAT-2", deadline: "2026-08-26" },
      { ...base, kind: "deadline_follow_up", matterId: "MAT-3", deadline: "2026-08-21" },
    ],
  });

  const selected = input.messages
    .filter((message) => shouldSend(message, input.asOf))
    .map((message) => message.matterId);

  assert.deepEqual(selected, ["MAT-1"]);
});
