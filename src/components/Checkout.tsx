'use client'

import { useCallback, useState } from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'
import { X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

interface CheckoutProps {
  productId: string
  onClose: () => void
}

export default function Checkout({ productId, onClose }: CheckoutProps) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          productId,
          userEmail: user?.email,
          successUrl: `${window.location.origin}/`,
          cancelUrl: `${window.location.origin}/`,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create checkout session')
      }

      const data = await response.json()
      return data.clientSecret
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      throw err
    }
  }, [productId, user?.email, user?.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-auto rounded-lg border border-border bg-card p-6 shadow-lg">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close checkout"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="font-display text-xl font-semibold mb-6">Complete Your Purchase</h2>
        
        {error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div id="checkout">
            <EmbeddedCheckoutProvider
              stripe={stripePromise}
              options={{ fetchClientSecret }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </div>
  )
}
