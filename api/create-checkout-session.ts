import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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
    const { productId, successUrl, cancelUrl } = req.body

    const product = PRODUCTS.find((p) => p.id === productId)
    if (!product) {
      return res.status(400).json({ error: `Product with id "${productId}" not found` })
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
      redirect_on_completion: 'never',
    })

    return res.status(200).json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
}
