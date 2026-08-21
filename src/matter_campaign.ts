import { z } from "zod";
import { infrai } from "./infrai_sms";

const baseMessage = z.object({
  matterId: z.string().min(1).max(80),
  to: z.string().regex(/^\+[1-9]\d{7,14}$/),
  clientName: z.string().min(1).max(80),
});

const campaignMessage = z.discriminatedUnion("kind", [
  baseMessage.extend({
    kind: z.literal("matter_intake"),
    appointmentAt: z.string().datetime({ offset: true }),
  }),
  baseMessage.extend({
    kind: z.literal("signed_document"),
    documentName: z.string().min(1).max(120),
  }),
  baseMessage.extend({
    kind: z.literal("deadline_follow_up"),
    deadline: z.string().date(),
  }),
]);

export const campaignRequest = z.object({
  campaignId: z.string().min(1).max(100),
  asOf: z.string().date(),
  messages: z.array(campaignMessage).min(1).max(100),
});

export type CampaignRequest = z.infer<typeof campaignRequest>;
type CampaignMessage = z.infer<typeof campaignMessage>;

export function shouldSend(message: CampaignMessage, asOf: string): boolean {
  if (message.kind !== "deadline_follow_up") return true;
  const today = Date.parse(`${asOf}T00:00:00Z`);
  const deadline = Date.parse(`${message.deadline}T00:00:00Z`);
  const daysRemaining = Math.round((deadline - today) / 86_400_000);
  return daysRemaining >= 0 && daysRemaining <= 3;
}

export function renderMessage(message: CampaignMessage): string {
  switch (message.kind) {
    case "matter_intake":
      return `Hi ${message.clientName}, intake for matter ${message.matterId} is booked for ${message.appointmentAt}.`;
    case "signed_document":
      return `Hi ${message.clientName}, ${message.documentName} was signed and delivered for matter ${message.matterId}.`;
    case "deadline_follow_up":
      return `Hi ${message.clientName}, matter ${message.matterId} has a deadline on ${message.deadline}. Please review the next step.`;
  }
}

export async function sendMatterCampaign(input: CampaignRequest) {
  const selected = input.messages.filter((message) => shouldSend(message, input.asOf));
  const sent = await Promise.all(
    selected.map(async (message) => {
      const delivery = await infrai.sms.send(
        {
          to: message.to,
          body: renderMessage(message),
          idempotency_key: `${input.campaignId}:${message.matterId}:${message.kind}`,
        },
      );
      const status = await infrai.sms.status(delivery.message_id);
      return {
        matterId: message.matterId,
        kind: message.kind,
        messageId: delivery.message_id,
        status: status.status,
      };
    }),
  );

  return {
    campaignId: input.campaignId,
    submitted: sent.length,
    skipped: input.messages.length - sent.length,
    messages: sent,
  };
}
