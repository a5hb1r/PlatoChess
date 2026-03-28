ALTER TABLE public.profiles
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN stripe_subscription_id TEXT,
  ADD COLUMN subscription_status TEXT,
  ADD COLUMN subscription_plan TEXT,
  ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN subscription_canceled_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX profiles_stripe_customer_id_key
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX profiles_stripe_subscription_id_key
  ON public.profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
