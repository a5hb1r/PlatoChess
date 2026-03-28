import { beforeEach, describe, expect, it, vi } from 'vitest'

const constructEventMock = vi.fn()
const checkoutSessionCreateMock = vi.fn()
const billingPortalCreateMock = vi.fn()
const customersListMock = vi.fn()

vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      webhooks = {
        constructEvent: constructEventMock,
      }

      checkout = {
        sessions: {
          create: checkoutSessionCreateMock,
        },
      }

      billingPortal = {
        sessions: {
          create: billingPortalCreateMock,
        },
      }

      customers = {
        list: customersListMock,
      }
    },
  }
})

const authGetUserMock = vi.fn()
const profilesSelectEqMaybeSingleMock = vi.fn()
const profilesSelectEqSingleMock = vi.fn()
const profilesUpdateEqMock = vi.fn()
const profilesUpdateMock = vi.fn()
const profilesSelectMock = vi.fn()
const profilesTableMock = vi.fn()
const supabaseCreateClientMock = vi.fn()

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: supabaseCreateClientMock,
  }
})

type MockReq = {
  method: string
  body: unknown
  headers: Record<string, string>
}

type MockRes = {
  statusCode: number
  payload: unknown
  headers: Record<string, string>
  setHeader: (name: string, value: string) => void
  status: (code: number) => MockRes
  json: (data: unknown) => MockRes
}

function createRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.payload = data
      return this
    },
  }
}

function setupSupabaseMock() {
  profilesSelectEqMaybeSingleMock.mockReset()
  profilesSelectEqSingleMock.mockReset()
  profilesUpdateEqMock.mockReset()
  profilesSelectMock.mockReset()
  profilesTableMock.mockReset()
  profilesUpdateMock.mockReset()
  authGetUserMock.mockReset()

  profilesSelectEqMaybeSingleMock.mockResolvedValue({ data: null, error: null })
  profilesSelectEqSingleMock.mockResolvedValue({ data: null, error: null })
  profilesUpdateEqMock.mockResolvedValue({ error: null })

  profilesSelectMock.mockImplementation(() => ({
    eq: (column: string, value: string) => {
      if (column === 'user_id') {
        return {
          maybeSingle: profilesSelectEqMaybeSingleMock,
          single: profilesSelectEqSingleMock,
        }
      }
      return {
        maybeSingle: profilesSelectEqMaybeSingleMock,
        single: profilesSelectEqSingleMock,
      }
    },
  }))

  profilesUpdateMock.mockImplementation(() => ({
    eq: profilesUpdateEqMock,
  }))

  profilesTableMock.mockImplementation(() => ({
    select: profilesSelectMock,
    update: profilesUpdateMock,
  }))

  supabaseCreateClientMock.mockReturnValue({
    from: profilesTableMock,
    auth: {
      getUser: authGetUserMock,
    },
  })
}

describe('stripe webhook + subscription handlers', () => {
  beforeEach(() => {
    vi.resetModules()
    constructEventMock.mockReset()
    checkoutSessionCreateMock.mockReset()
    billingPortalCreateMock.mockReset()
    customersListMock.mockReset()
    supabaseCreateClientMock.mockReset()

    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_dummy'
    process.env.SUPABASE_URL = 'https://example.supabase.co'

    setupSupabaseMock()
  })

  it('updates profile when customer.subscription.updated is received', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          current_period_end: nowSeconds + 60 * 60 * 24,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: { user_id: 'user_123', product_id: 'pro-monthly' },
          items: {
            data: [
              {
                plan: {
                  nickname: null,
                  interval: 'month',
                },
              },
            ],
          },
        },
      },
    })

    const { default: webhookHandler } = await import('../../api/stripe-webhook')

    const req: MockReq = {
      method: 'POST',
      body: { any: 'payload' },
      headers: { 'stripe-signature': 't=1,v1=sig' },
    }
    const res = createRes()

    await webhookHandler(req as never, res as never)

    expect(constructEventMock).toHaveBeenCalled()
    expect(profilesUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        subscription_status: 'active',
        subscription_plan: 'pro',
        subscription_cancel_at_period_end: false,
      }),
    )
    expect(profilesUpdateEqMock).toHaveBeenCalledWith('user_id', 'user_123')
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ received: true })
  })

  it('returns 400 when stripe-signature header is missing', async () => {
    const { default: webhookHandler } = await import('../../api/stripe-webhook')
    const req: MockReq = {
      method: 'POST',
      body: {},
      headers: {},
    }
    const res = createRes()

    await webhookHandler(req as never, res as never)

    expect(res.statusCode).toBe(400)
    expect(res.payload).toEqual({ error: 'Missing stripe-signature header' })
  })

  it('checkout stores customer and adds subscription metadata using auth token', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user_abc', email: 'member@example.com' } },
      error: null,
    })
    profilesSelectEqMaybeSingleMock.mockResolvedValueOnce({
      data: { stripe_customer_id: null },
      error: null,
    })
    checkoutSessionCreateMock.mockResolvedValue({
      client_secret: 'cs_test_123',
      customer: 'cus_new_123',
    })

    const { default: checkoutHandler } = await import('../../api/create-checkout-session')
    const req: MockReq = {
      method: 'POST',
      body: { productId: 'pro-monthly' },
      headers: { authorization: 'Bearer token_123' },
    }
    const res = createRes()

    await checkoutHandler(req as never, res as never)

    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'member@example.com',
        metadata: {
          user_id: 'user_abc',
          product_id: 'pro-monthly',
        },
        subscription_data: {
          metadata: {
            user_id: 'user_abc',
            product_id: 'pro-monthly',
          },
        },
      }),
    )
    expect(profilesUpdateMock).toHaveBeenCalledWith({ stripe_customer_id: 'cus_new_123' })
    expect(profilesUpdateEqMock).toHaveBeenCalledWith('user_id', 'user_abc')
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ clientSecret: 'cs_test_123' })
  })

  it('portal resolves customer id from profile for authenticated user', async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: 'user_abc', email: 'member@example.com' } },
      error: null,
    })
    profilesSelectEqMaybeSingleMock.mockResolvedValueOnce({
      data: { stripe_customer_id: 'cus_existing_123' },
      error: null,
    })
    billingPortalCreateMock.mockResolvedValueOnce({ url: 'https://billing.stripe.test/session' })

    const { default: portalHandler } = await import('../../api/create-portal-session')
    const req: MockReq = {
      method: 'POST',
      body: { returnUrl: 'https://app.example/settings' },
      headers: {
        origin: 'https://app.example',
        authorization: 'Bearer token_123',
      },
    }
    const res = createRes()

    await portalHandler(req as never, res as never)

    expect(billingPortalCreateMock).toHaveBeenCalledWith({
      customer: 'cus_existing_123',
      return_url: 'https://app.example/settings',
    })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toEqual({ url: 'https://billing.stripe.test/session' })
  })
})
