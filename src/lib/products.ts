export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  period: string
  features: string[]
  highlighted: boolean
  cta: string
  mode: 'payment' | 'subscription'
  recurring?: {
    interval: 'month' | 'year'
    interval_count: number
  }
}

export const PRODUCTS: Product[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Start your improvement journey',
    priceInCents: 0,
    period: 'forever',
    features: [
      '10 tactical puzzles per day',
      'Basic game analysis',
      '1 opening repertoire slot',
      'Community forums access',
    ],
    cta: 'Get Started',
    highlighted: false,
    mode: 'payment',
  },
  {
    id: 'pro-monthly',
    name: 'Pro',
    description: 'For the dedicated improver',
    priceInCents: 900, // $9.00
    period: '/month',
    features: [
      'Unlimited tactical puzzles',
      'Deep engine analysis',
      '5 opening repertoire slots',
      'Spaced repetition training',
      'Endgame courses',
      'Performance analytics',
    ],
    cta: 'Start Pro Trial',
    highlighted: true,
    mode: 'subscription',
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
  },
  {
    id: 'master-monthly',
    name: 'Master',
    description: 'Train like a titled player',
    priceInCents: 1900, // $19.00
    period: '/month',
    features: [
      'Everything in Pro',
      'Unlimited repertoire slots',
      'GM-curated puzzle sets',
      'Advanced weakness detection',
      'Priority game reviews',
      '1-on-1 coaching matchmaking',
    ],
    cta: 'Go Master',
    highlighted: false,
    mode: 'subscription',
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
  },
]
