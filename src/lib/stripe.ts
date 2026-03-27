import { loadStripe } from '@stripe/stripe-js'

// This is the publishable key - safe to expose client-side
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')
