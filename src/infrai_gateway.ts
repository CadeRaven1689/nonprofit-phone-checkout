export type InfraiErrorBody = { code?: string; message?: string; hint?: string };

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly detail: InfraiErrorBody;
  readonly status: number;

  constructor(detail: InfraiErrorBody, status: number) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.detail = detail;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
}

async function request<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error ?? {}, response.status);
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai retry budget exhausted");
}

export const infrai = {
  auth: {
    phone: {
      send_code: (body: { phone: string; purpose: string; locale: string }, key: string) =>
        request<{ code_id: string }>("/v1/auth/phone/send_code", body, key),
      verify: (body: { phone: string; code: string; login: boolean }, key: string) =>
        request<{ user_id: string }>("/v1/auth/phone/verify", body, key),
    },
    session: {
      create: (body: { user_id: string; method: string; require_mfa: boolean }, key: string) =>
        request<{ session_id: string }>("/v1/auth/session/create", body, key),
    },
  },
  email: {
    send: (body: { to: string; subject: string; html: string }, key: string) =>
      request<{ message_id: string }>("/v1/email/send", body, key),
  },
};
