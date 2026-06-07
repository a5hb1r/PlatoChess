import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from './_lib/supabase-admin'
import { resolveAuthenticatedUser } from './_lib/resolve-auth-user'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  mode: 'payment' | 'subscription'
  recurring?: {
    interval: 'month' | 'year'
    interval_count: number
  }
}

// Server-side product catalog - source of truth for pricing
const PRODUCTS: Product[] = [
  {
    id: 'pro-monthly',
    name: 'Pro',
    description: 'For the dedicated improver',
    priceInCents: 900,
    mode: 'subscription',
    recurring: { interval: 'month', interval_count: 1 },
  },
  {
    id: 'master-monthly',
    name: 'Master',
    description: 'Train like a titled player',
    priceInCents: 1900,
    mode: 'subscription',
    recurring: { interval: 'month', interval_count: 1 },
  },
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { productId } = req.body as {
      productId?: string
    }
    const authedUser = await resolveAuthenticatedUser(req)
    const userId = authedUser?.id

    const product = PRODUCTS.find((p) => p.id === productId)
    if (!product) {
      return res.status(400).json({ error: `Product with id "${productId}" not found` })
    }
    if (product.mode === 'subscription' && !userId) {
      return res.status(401).json({ error: 'Sign in is required to subscribe' })
    }

    let customerId: string | undefined
    if (userId && hasSupabaseAdminEnv()) {
      const supabase = getSupabaseAdminClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Failed to resolve Stripe customer from profile:', error)
      } else {
        customerId = data?.stripe_customer_id || undefined
      }
    }

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
      currency: 'usd',
      product_data: {
        name: product.name,
        description: product.description,
      },
      unit_amount: product.priceInCents,
    }

    // Add recurring info for subscriptions
    if (product.mode === 'subscription' && product.recurring) {
      priceData.recurring = {
        interval: product.recurring.interval,
        interval_count: product.recurring.interval_count,
      }
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
      mode: product.mode,
      customer: customerId,
      customer_email: customerId ? undefined : authedUser?.email || undefined,
      metadata: userId
        ? {
            user_id: userId,
            product_id: product.id,
          }
        : undefined,
      subscription_data:
        product.mode === 'subscription' && userId
          ? {
              metadata: {
                user_id: userId,
                product_id: product.id,
              },
            }
          : undefined,
      redirect_on_completion: 'never',
    })

    if (userId && typeof session.customer === 'string' && hasSupabaseAdminEnv()) {
      const supabase = getSupabaseAdminClient()
      const { error } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: session.customer })
        .eq('user_id', userId)

      if (error) {
        console.error('Failed to persist Stripe customer on profile:', error)
      }
    }

    return res.status(200).json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
