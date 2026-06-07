import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdminClient, hasSupabaseAdminEnv } from './_lib/supabase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

function getRawBody(req: VercelRequest): Buffer {
  if (Buffer.isBuffer(req.body)) {
    return req.body
  }

  if (typeof req.body === 'string') {
    return Buffer.from(req.body, 'utf8')
  }

  return Buffer.from(JSON.stringify(req.body || {}), 'utf8')
}

function getSubscriptionPlan(subscription: Stripe.Subscription): string | null {
  const firstItem = subscription.items.data[0]
  const nickname = firstItem?.plan?.nickname
  if (nickname && nickname.trim().length > 0) {
    return nickname.trim()
  }

  const interval = firstItem?.plan?.interval
  if (!interval) {
    return null
  }

  const productId = subscription.metadata?.product_id
  if (productId === 'pro-monthly') {
    return 'pro'
  }
  if (productId === 'master-monthly') {
    return 'master'
  }

  return interval === 'year' ? 'yearly' : 'monthly'
}

async function upsertStripeCustomerMapping(userId: string | undefined, customerId: string) {
  if (!userId || !hasSupabaseAdminEnv()) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('user_id', userId)

  if (error) {
    console.error('Webhook: failed saving customer mapping:', error)
  }
}

async function updateSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  customerId: string,
  statusOverride?: SubscriptionStatus,
) {
  if (!hasSupabaseAdminEnv()) {
    return
  }

  const userId = subscription.metadata?.user_id
  if (!userId) {
    console.warn('Webhook: subscription missing metadata.user_id, skipping profile update')
    return
  }

  const supabase = getSupabaseAdminClient()
  const nextStatus = statusOverride || (subscription.status as SubscriptionStatus)
  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: nextStatus,
      subscription_plan: getSubscriptionPlan(subscription),
      subscription_current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      subscription_canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Webhook: failed updating subscription state:', error)
  }
}

async function markSubscriptionAsCanceledById(subscriptionId: string) {
  if (!hasSupabaseAdminEnv()) {
    return
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_canceled_at: new Date().toISOString(),
      subscription_cancel_at_period_end: false,
      subscription_current_period_end: null,
    })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    console.error('Webhook: failed marking canceled subscription by id:', error)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  const signature = req.headers['stripe-signature']
  if (!signature || Array.isArray(signature)) {
    return res.status(400).json({ error: 'Missing stripe-signature header' })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(getRawBody(req), signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature'
    return res.status(400).json({ error: message })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        if (typeof session.customer === 'string') {
          await upsertStripeCustomerMapping(userId, session.customer)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        if (typeof subscription.customer === 'string') {
          await updateSubscriptionFromStripe(subscription, subscription.customer)
        }
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        if (typeof subscription.customer === 'string') {
          await updateSubscriptionFromStripe(subscription, subscription.customer, 'canceled')
        } else {
          await markSubscriptionAsCanceledById(subscription.id)
        }
        break
      }
      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
