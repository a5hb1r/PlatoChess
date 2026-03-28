import { describe, expect, it, vi } from "vitest";

const authGetUserMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const maybeSingleMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: createClientMock,
  };
});

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
  beforeEach(() => {
    vi.resetModules();
    authGetUserMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    createClientMock.mockReset();

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_dummy";
    process.env.SUPABASE_URL = "https://example.supabase.co";

    maybeSingleMock.mockResolvedValue({ data: { stripe_customer_id: null }, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    createClientMock.mockReturnValue({
      from: vi.fn(() => ({ select: selectMock })),
      auth: { getUser: authGetUserMock },
    });
  });

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

  it("uses authenticated email from bearer token over body email", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user_123", email: "real-member@example.com" } },
      error: null,
    });
    listMock.mockResolvedValueOnce({ data: [{ id: "cus_456" }] });
    createMock.mockResolvedValueOnce({ url: "https://billing.stripe.test/session-2" });

    const { default: handler } = await import("../../api/create-portal-session");
    const req: MockReq = {
      method: "POST",
      body: { email: "spoofed@example.com", returnUrl: "https://app.example/settings" },
      headers: {
        origin: "https://app.example",
        authorization: "Bearer token_123",
      },
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(authGetUserMock).toHaveBeenCalledWith("token_123");
    expect(listMock).toHaveBeenCalledWith({ email: "real-member@example.com", limit: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ url: "https://billing.stripe.test/session-2" });
  });
});
