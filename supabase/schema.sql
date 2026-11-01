-- Run this once in the Supabase SQL editor for the starter's package/order tables.
-- Prices are stored in pesewas (100 = GH₵1).
create extension if not exists pgcrypto;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  price_kobo bigint not null check (price_kobo > 0),
  total_odds text,
  match_count integer,
  betting_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  package_id uuid not null references public.packages(id),
  customer_email text not null,
  amount_kobo bigint not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  paystack_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.packages enable row level security;
alter table public.orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'packages'
      and policyname = 'Public can view active package listing'
  ) then
    create policy "Public can view active package listing"
      on public.packages for select using (active = true);
  end if;
end
$$;

-- No public order policies. Server routes use the service-role key.
