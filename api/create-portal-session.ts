import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { customerId, email, returnUrl } = req.body as {
      customerId?: string
      email?: string
      returnUrl?: string
    }

    let resolvedCustomerId = customerId
    if (!resolvedCustomerId && email) {
      const customers = await stripe.customers.list({
        email,
        limit: 1,
      })
      resolvedCustomerId = customers.data[0]?.id
    }

    if (!resolvedCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' })
    }

    // Create a billing portal session for subscription management
    const session = await stripe.billingPortal.sessions.create({
      customer: resolvedCustomerId,
      return_url: returnUrl || `${req.headers.origin}/`,
    })

    return res.status(200).json({ url: session.url })
  } catch (error) {
    console.error('Portal session error:', error)
    return res.status(500).json({ error: 'Failed to create portal session' })
  }
}
