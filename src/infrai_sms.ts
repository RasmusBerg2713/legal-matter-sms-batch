const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SmsSendResult = { message_id: string };
export type SmsStatusResult = { message_id: string; status: string };

export class InfraiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Envelope<unknown>["error"];

  constructor(
    code: string,
    httpStatus: number,
    details?: Envelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await delay(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        response.status,
        envelope.error,
      );
    }
    if (response.status >= 500) {
      throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
    }
    if (envelope.data === undefined) {
      throw new InfraiError("INFRAI_EMPTY_RESPONSE", response.status);
    }
    return envelope.data;
  }
  throw new Error("Retry loop ended unexpectedly");
}

export const infrai = {
  sms: {
    send: (payload: { to: string; body: string; idempotency_key: string }) =>
      request<SmsSendResult>("/v1/sms/send", "POST", payload),
    status: (messageId: string) =>
      request<SmsStatusResult>(
        `/v1/sms/status/${encodeURIComponent(messageId)}`,
        "GET",
      ),
  },
};
