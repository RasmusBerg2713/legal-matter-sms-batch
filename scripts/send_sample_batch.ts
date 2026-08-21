import { campaignRequest, sendMatterCampaign } from "../src/matter_campaign";

const to = process.env.DEMO_SMS_TO;
if (!to) throw new Error("DEMO_SMS_TO is required in E.164 format");

const asOf = new Date().toISOString().slice(0, 10);
const deadline = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
const input = campaignRequest.parse({
  campaignId: `legal-demo-${asOf}`,
  asOf,
  messages: [
    {
      kind: "matter_intake",
      matterId: "MAT-1042",
      to,
      clientName: "Avery",
      appointmentAt: `${asOf}T16:00:00Z`,
    },
    {
      kind: "signed_document",
      matterId: "MAT-1042",
      to,
      clientName: "Avery",
      documentName: "Representation agreement",
    },
    {
      kind: "deadline_follow_up",
      matterId: "MAT-1042",
      to,
      clientName: "Avery",
      deadline,
    },
  ],
});

console.log(JSON.stringify(await sendMatterCampaign(input), null, 2));
