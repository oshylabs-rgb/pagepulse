import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

export const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || '',
  agency: process.env.STRIPE_AGENCY_PRICE_ID || '',
} as const
