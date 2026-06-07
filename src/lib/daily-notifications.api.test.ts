import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();
const authGetUserMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();

const selectChain: {
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
} = {
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
};

const updateChain: {
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
} = {
  eq: vi.fn(),
  in: vi.fn(),
};

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: createClientMock,
  };
});

type MockReq = {
  method: string;
  headers: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
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

describe("daily-notifications handler", () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockReset();
    authGetUserMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    updateMock.mockReset();
    selectChain.eq.mockReset();
    selectChain.order.mockReset();
    selectChain.limit.mockReset();
    updateChain.eq.mockReset();
    updateChain.in.mockReset();

    selectChain.eq.mockImplementation(() => selectChain);
    selectChain.order.mockImplementation(() => selectChain);
    updateChain.eq.mockImplementation(() => updateChain);

    selectMock.mockImplementation(() => selectChain);
    updateMock.mockImplementation(() => updateChain);
    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    createClientMock.mockReturnValue({
      from: fromMock,
      auth: {
        getUser: authGetUserMock,
      },
    });

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_dummy";
    process.env.SUPABASE_URL = "https://example.supabase.co";
  });

  it("returns 401 when bearer token is missing", async () => {
    const { default: handler } = await import("../../api/daily-notifications");
    const req: MockReq = {
      method: "GET",
      headers: {},
      query: {},
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ error: "Authentication required" });
  });

  it("returns pending in-app notifications for the user", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user_1", email: "member@example.com" } },
      error: null,
    });
    selectChain.limit.mockResolvedValue({
      data: [{ id: "notif_1", game_session_id: "game_1", payload: {}, created_at: "2026-05-09T00:00:00Z" }],
      error: null,
    });

    const { default: handler } = await import("../../api/daily-notifications");
    const req: MockReq = {
      method: "GET",
      headers: { authorization: "Bearer token_123" },
      query: { limit: "3" },
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(authGetUserMock).toHaveBeenCalledWith("token_123");
    expect(selectMock).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      notifications: [{ id: "notif_1", game_session_id: "game_1", payload: {}, created_at: "2026-05-09T00:00:00Z" }],
    });
  });

  it("acknowledges in-app notifications", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user_1", email: "member@example.com" } },
      error: null,
    });
    updateChain.in.mockResolvedValue({ error: null });

    const { default: handler } = await import("../../api/daily-notifications");
    const req: MockReq = {
      method: "POST",
      headers: { authorization: "Bearer token_123" },
      body: { ids: ["notif_1", "notif_2"] },
    };
    const res = createRes();

    await handler(req as never, res as never);

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "delivered" }));
    expect(updateChain.in).toHaveBeenCalledWith("id", ["notif_1", "notif_2"]);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ updated: 2 });
  });
});
