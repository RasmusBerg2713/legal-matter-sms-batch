import { createServer } from "node:http";
import { ZodError } from "zod";
import { campaignRequest, sendMatterCampaign } from "./matter_campaign";
import { InfraiError } from "./infrai_sms";

const port = Number(process.env.PORT ?? 3000);

function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/campaigns") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = campaignRequest.parse(await readJson(request));
    json(response, 202, await sendMatterCampaign(input));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid campaign request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.httpStatus >= 400 && error.httpStatus < 500
        ? error.httpStatus
        : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "Campaign could not be processed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => console.log(`Legal SMS service listening on http://localhost:${port}`));
}
