import { describe, expect, it, vi } from "vitest";

const listMock = vi.fn();
const createMock = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      customers = { list: listMock };
      billingPortal = {
        sessions: {
          create: createMock,
        },
      };
    },
  };
});

type MockReq = {
  method: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
};

type MockRes = {
  statusCode: number;
  payload: unknown;
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockRes;
  json: (data: unknown) => MockRes;
};

function createRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };
}

describe("create-portal-session handler", () => {
  it("returns 400 when only email is provided and customer is missing", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    listMock.mockResolvedValueOnce({ data: [] });

    const { default: handler } = await import("../../api/create-portal-session");
    const req: MockReq = {
      method: "POST",
      body: { email: "missing@example.com", returnUrl: "https://app.example/settings" },
      headers: { origin: "https://app.example" },
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(listMock).toHaveBeenCalledWith({ email: "missing@example.com", limit: 1 });
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: "No Stripe customer found for this account" });
  });

  it("creates portal session when email resolves to a customer", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    listMock.mockResolvedValueOnce({ data: [{ id: "cus_123" }] });
    createMock.mockResolvedValueOnce({ url: "https://billing.stripe.test/session" });

    const { default: handler } = await import("../../api/create-portal-session");
    const req: MockReq = {
      method: "POST",
      body: { email: "member@example.com", returnUrl: "https://app.example/settings" },
      headers: { origin: "https://app.example" },
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(createMock).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://app.example/settings",
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ url: "https://billing.stripe.test/session" });
  });
});
