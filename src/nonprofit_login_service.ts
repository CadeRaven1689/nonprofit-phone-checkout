import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { InfraiError } from "./infrai_gateway.js";
import { campaignSummary, completeLogin, deliverReceipt, deliverVolunteerReminder, sendLoginCode } from "./nonprofit_workflows.js";

const phoneCodeBody = z.object({ phone: z.string().min(8) });
const verifyBody = z.object({ phone: z.string().min(8), code: z.string().min(4) });
const reportBody = z.object({
  receipts: z.array(z.object({ donorEmail: z.string().email(), donorName: z.string().min(1), amountCents: z.number().int().positive(), campaign: z.string().min(1) })),
  reminders: z.array(z.object({ email: z.string().email(), shift: z.string().min(1), campaign: z.string().min(1) })),
});

async function jsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of request) text += chunk;
  return JSON.parse(text);
}

function reply(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    const body = await jsonBody(request);
    const requestId = request.headers["idempotency-key"]?.toString() ?? randomUUID();
    if (request.method === "POST" && request.url === "/login/code") {
      const input = phoneCodeBody.parse(body);
      const sent = await sendLoginCode(input.phone, requestId);
      return reply(response, 202, { codeId: sent.code_id });
    }
    if (request.method === "POST" && request.url === "/login/verify") {
      const input = verifyBody.parse(body);
      return reply(response, 200, await completeLogin(input.phone, input.code, requestId));
    }
    if (request.method === "POST" && request.url === "/campaign/closeout") {
      const input = reportBody.parse(body);
      await Promise.all([
        ...input.receipts.map((item) => deliverReceipt(item, `${requestId}-receipt-${item.donorEmail}`)),
        ...input.reminders.map((item) => deliverVolunteerReminder(item, `${requestId}-reminder-${item.email}`)),
      ]);
      return reply(response, 200, campaignSummary(input.receipts, input.reminders));
    }
    return reply(response, 404, { error: "route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) return reply(response, 400, { error: error.issues });
    if (error instanceof InfraiError) return reply(response, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.detail });
    return reply(response, 500, { error: "request could not be completed" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => console.log("nonprofit login service listening"));
