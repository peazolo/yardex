-- Yadex core schema.
-- Money is naira in numeric(14,2). Balances only change inside the security definer
-- functions at the bottom of this file, so the app can never set its own balance or payout.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- types
create type public.trade_type as enum ('giftcard', 'crypto-sell', 'crypto-buy', 'withdrawal');
create type public.trade_status as enum ('pending', 'in_escrow', 'completed', 'rejected');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  referral_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 7)),
  referred_by uuid references public.profiles (id),
  is_admin boolean not null default false,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  lifetime_volume numeric(16, 2) not null default 0,
  pin_hash text,
  pin_failed_attempts int not null default 0,
  pin_locked_until timestamptz,
  hide_balance boolean not null default false,
  two_factor boolean not null default false,
  push_notifications boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create a profile for every new sign-up. Username comes from sign-up metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'user'), '[^a-zA-Z0-9_.]', '', 'g'));
  candidate text;
begin
  if length(base) < 3 then base := base || 'user'; end if;
  candidate := left(base, 24);
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := left(base, 19) || floor(random() * 90000 + 10000)::int;
  end loop;
  insert into public.profiles (id, username, full_name, email)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------- catalogue
create table public.card_brands (
  id text primary key,
  name text not null,
  mono text not null,
  color text not null,
  ink text not null,
  hot boolean not null default false,
  min_value numeric(10, 2) not null,
  max_value numeric(10, 2) not null,
  sort int not null default 0,
  active boolean not null default true
);

create table public.card_categories (
  id text primary key,
  brand_id text not null references public.card_brands (id) on delete cascade,
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

create table public.card_rates (
  category_id text not null references public.card_categories (id) on delete cascade,
  country text not null check (country in ('US', 'UK', 'CA', 'AU', 'EU')),
  rate numeric(10, 2) not null check (rate > 0),
  updated_at timestamptz not null default now(),
  primary key (category_id, country)
);

create table public.crypto_assets (
  id text primary key,
  symbol text not null,
  name text not null,
  color text not null,
  network text not null,
  buy_rate numeric(16, 2) not null,
  sell_rate numeric(16, 2) not null,
  -- Replace with per-trade addresses from your custody provider before launch.
  deposit_address text not null,
  min_amount numeric(20, 8) not null,
  decimals int not null default 2,
  sort int not null default 0,
  active boolean not null default true
);

create table public.coupons (
  code text primary key check (code = upper(code)),
  label text not null,
  bonus_per_unit numeric(10, 2) not null check (bonus_per_unit > 0),
  first_sale_only boolean not null default false,
  active boolean not null default true
);

-- ---------------------------------------------------------------- user data
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  bank text not null,
  number text not null check (number ~ '^\d{10}$'),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, bank, number)
);

create sequence public.trade_seq start 48300;

create table public.trades (
  id text primary key default 'YDX-' || nextval('public.trade_seq'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.trade_type not null,
  status public.trade_status not null default 'pending',
  title text not null,
  subtitle text not null default '',
  -- positive = credit to the user when approved, negative = already debited from the wallet
  amount_ngn numeric(14, 2) not null,
  details jsonb not null default '{}',
  image_paths text[] not null default '{}',
  note text,
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trades_user_created on public.trades (user_id, created_at desc);
create index trades_open on public.trades (status) where status in ('pending', 'in_escrow');

create table public.trade_events (
  id bigint generated always as identity primary key,
  trade_id text not null references public.trades (id) on delete cascade,
  label text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index trade_events_trade on public.trade_events (trade_id, id);

create table public.coupon_redemptions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null references public.coupons (code),
  trade_id text not null references public.trades (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.card_brands enable row level security;
alter table public.card_categories enable row level security;
alter table public.card_rates enable row level security;
alter table public.crypto_assets enable row level security;
alter table public.coupons enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.trades enable row level security;
alter table public.trade_events enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.notifications enable row level security;

create policy "own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Only harmless columns are writable by the user; balance, is_admin and pin_hash are not.
-- The PIN hash is never readable from the app (column grants only work after a table-level revoke).
revoke select, insert, update, delete on public.profiles from authenticated, anon;
grant select (id, username, full_name, email, phone, referral_code, referred_by, is_admin, balance, lifetime_volume,
              pin_locked_until, hide_balance, two_factor, push_notifications, created_at) on public.profiles to authenticated;
grant update (username, full_name, phone, hide_balance, two_factor, push_notifications) on public.profiles to authenticated;

create policy "catalogue is public" on public.card_brands for select using (true);
create policy "catalogue is public" on public.card_categories for select using (true);
create policy "catalogue is public" on public.card_rates for select using (true);
create policy "catalogue is public" on public.crypto_assets for select using (true);
create policy "admin edits brands" on public.card_brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin edits categories" on public.card_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin edits rates" on public.card_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin edits crypto" on public.crypto_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin reads coupons" on public.coupons for select to authenticated using (public.is_admin());
create policy "admin edits coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "own banks" on public.bank_accounts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "add own bank" on public.bank_accounts for insert to authenticated with check (user_id = auth.uid());
create policy "remove own bank" on public.bank_accounts for delete to authenticated using (user_id = auth.uid());

create policy "own trades or admin" on public.trades for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "own trade events or admin" on public.trade_events for select to authenticated
  using (exists (select 1 from public.trades t where t.id = trade_id and (t.user_id = auth.uid() or public.is_admin())));
create policy "own redemptions" on public.coupon_redemptions for select to authenticated using (user_id = auth.uid());

create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated, anon;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------- helpers
create function public._log(p_trade text, p_label text) returns void
language sql security definer set search_path = public as $$
  insert into public.trade_events (trade_id, label) values (p_trade, p_label)
$$;

create function public._notify(p_user uuid, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body) values (p_user, p_title, p_body)
$$;

create function public._ngn(n numeric) returns text
language sql immutable as $$ select '₦' || to_char(round(n), 'FM999,999,999,990') $$;

create function public._require_user() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Log in first.' using errcode = '28000'; end if;
  return auth.uid();
end $$;

-- ---------------------------------------------------------------- user actions
create function public.submit_giftcard_trade(
  p_category_id text,
  p_country text,
  p_value numeric,
  p_kind text,
  p_code text default null,
  p_image_paths text[] default '{}',
  p_coupon text default null
) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_user();
  cat public.card_categories;
  brand public.card_brands;
  v_rate numeric;
  v_bonus numeric := 0;
  v_coupon public.coupons;
  v_symbol text := case p_country when 'UK' then '£' when 'CA' then 'C$' when 'AU' then 'A$' when 'EU' then '€' else '$' end;
  v_country text := case p_country when 'UK' then 'United Kingdom' when 'CA' then 'Canada' when 'AU' then 'Australia' when 'EU' then 'Europe' else 'United States' end;
  v_details jsonb;
  t public.trades;
begin
  select * into cat from public.card_categories where id = p_category_id and active;
  if not found then raise exception 'That card category is not available.'; end if;
  select * into brand from public.card_brands where id = cat.brand_id and active;
  if not found then raise exception 'That card is not available.'; end if;
  select rate into v_rate from public.card_rates where category_id = p_category_id and country = p_country;
  if v_rate is null then raise exception 'We do not buy % cards from %.', cat.name, v_country; end if;

  if p_value is null or p_value < brand.min_value or p_value > brand.max_value then
    raise exception '% cards must be between % and %.', brand.name, v_symbol || trim_scale(brand.min_value), v_symbol || trim_scale(brand.max_value);
  end if;
  if p_kind not in ('physical', 'ecode') then raise exception 'Choose physical card or e-code.'; end if;
  if p_kind = 'physical' and coalesce(array_length(p_image_paths, 1), 0) = 0 then
    raise exception 'Upload a clear photo of the card with the code scratched.';
  end if;
  if p_kind = 'ecode' and length(coalesce(trim(p_code), '')) < 8 and coalesce(array_length(p_image_paths, 1), 0) = 0 then
    raise exception 'Enter the card code or upload a screenshot of it.';
  end if;
  if coalesce(array_length(p_image_paths, 1), 0) > 4 then raise exception 'Upload at most 4 photos.'; end if;
  if exists (select 1 from unnest(p_image_paths) p where p not like uid::text || '/%') then
    raise exception 'Photos must be uploaded to your own folder.';
  end if;

  if nullif(trim(p_coupon), '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_coupon)) and active;
    if not found
       or exists (select 1 from public.coupon_redemptions where user_id = uid and code = v_coupon.code)
       or (v_coupon.first_sale_only and exists (select 1 from public.trades where user_id = uid and type = 'giftcard' and status <> 'rejected')) then
      raise exception 'That coupon code is not valid or has been used.';
    end if;
    v_bonus := v_coupon.bonus_per_unit;
  end if;

  v_details := jsonb_build_object(
    'Brand', brand.name, 'Category', cat.name, 'Country', v_country,
    'Card value', v_symbol || trim_scale(p_value)::text, 'Type', case p_kind when 'physical' then 'Physical' else 'E-code' end,
    'Rate', public._ngn(v_rate) || ' / ' || v_symbol
  );
  if p_kind = 'ecode' and nullif(trim(p_code), '') is not null then v_details := v_details || jsonb_build_object('Code', upper(trim(p_code))); end if;
  if v_bonus > 0 then v_details := v_details || jsonb_build_object('Coupon', v_coupon.code || ' (+' || public._ngn(v_bonus) || '/' || v_symbol || ')'); end if;

  insert into public.trades (user_id, type, title, subtitle, amount_ngn, details, image_paths)
  values (uid, 'giftcard', split_part(brand.name, ' /', 1) || ' ' || v_symbol || trim_scale(p_value)::text, cat.name || ' · ' || p_country,
          round(p_value * (v_rate + v_bonus)), v_details, p_image_paths)
  returning * into t;
  perform public._log(t.id, 'Submitted for review');
  if v_bonus > 0 then insert into public.coupon_redemptions (user_id, code, trade_id) values (uid, v_coupon.code, t.id); end if;
  return t;
end $$;

create function public.open_crypto_sell(p_asset_id text, p_amount numeric) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_user();
  a public.crypto_assets;
  t public.trades;
  v_amount text;
begin
  select * into a from public.crypto_assets where id = p_asset_id and active;
  if not found then raise exception 'That coin is not available.'; end if;
  if p_amount is null or p_amount < a.min_amount then raise exception 'The minimum trade is % %.', trim_scale(a.min_amount), a.symbol; end if;
  v_amount := trim_scale(p_amount) || ' ' || a.symbol;
  insert into public.trades (user_id, type, title, subtitle, amount_ngn, details)
  values (uid, 'crypto-sell', 'Sell ' || v_amount, a.symbol || ' · ' || a.network, round(p_amount * a.sell_rate),
          jsonb_build_object('Asset', a.name, 'Network', a.network, 'Amount', v_amount,
                             'Rate', public._ngn(a.sell_rate) || ' / ' || a.symbol, 'Escrow address', a.deposit_address))
  returning * into t;
  perform public._log(t.id, 'Trade opened, waiting for your coins');
  return t;
end $$;

create function public.mark_crypto_sent(p_trade_id text, p_hash text default null) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  t public.trades;
begin
  update public.trades
     set status = 'in_escrow', updated_at = now(),
         details = details || jsonb_build_object('Tx hash', coalesce(nullif(trim(p_hash), ''), 'Not provided'))
   where id = p_trade_id and user_id = public._require_user() and type = 'crypto-sell' and status = 'pending'
  returning * into t;
  if not found then raise exception 'This trade is not waiting for coins.'; end if;
  perform public._log(t.id, 'You marked the coins as sent');
  return t;
end $$;

create function public.open_crypto_buy(p_asset_id text, p_amount numeric, p_wallet text) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_user();
  a public.crypto_assets;
  v_total numeric;
  v_balance numeric;
  v_amount text;
  t public.trades;
begin
  select * into a from public.crypto_assets where id = p_asset_id and active;
  if not found then raise exception 'That coin is not available.'; end if;
  if p_amount is null or p_amount < a.min_amount then raise exception 'The minimum trade is % %.', trim_scale(a.min_amount), a.symbol; end if;
  if length(coalesce(trim(p_wallet), '')) < 20 then raise exception 'Enter the % address that should receive the coins.', a.network; end if;
  v_total := round(p_amount * a.buy_rate);
  select balance into v_balance from public.profiles where id = uid for update;
  if v_balance < v_total then raise exception 'You need % but your wallet has %.', public._ngn(v_total), public._ngn(v_balance); end if;
  update public.profiles set balance = balance - v_total where id = uid;
  v_amount := trim_scale(p_amount) || ' ' || a.symbol;
  insert into public.trades (user_id, type, status, title, subtitle, amount_ngn, details)
  values (uid, 'crypto-buy', 'in_escrow', 'Buy ' || v_amount, a.symbol || ' · ' || a.network, -v_total,
          jsonb_build_object('Asset', a.name, 'Network', a.network, 'Amount', v_amount,
                             'Rate', public._ngn(a.buy_rate) || ' / ' || a.symbol, 'Your wallet', trim(p_wallet)))
  returning * into t;
  perform public._log(t.id, public._ngn(v_total) || ' held in escrow');
  return t;
end $$;

create function public.set_pin(p_current text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public._require_user();
  v_hash text;
begin
  if p_new !~ '^\d{4}$' then raise exception 'Your new PIN must be 4 digits.'; end if;
  select pin_hash into v_hash from public.profiles where id = uid;
  if v_hash is not null and (p_current is null or crypt(p_current, v_hash) <> v_hash) then
    raise exception 'Your current PIN is wrong.';
  end if;
  update public.profiles set pin_hash = crypt(p_new, gen_salt('bf')), pin_failed_attempts = 0, pin_locked_until = null where id = uid;
end $$;

create function public.has_pin() returns boolean
language sql stable security definer set search_path = public as $$
  select pin_hash is not null from public.profiles where id = auth.uid()
$$;

create function public.request_withdrawal(p_bank_id uuid, p_amount numeric, p_pin text) returns public.trades
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := public._require_user();
  fee constant numeric := 50;
  p public.profiles;
  b public.bank_accounts;
  t public.trades;
begin
  select * into p from public.profiles where id = uid for update;
  if p.pin_hash is null then raise exception 'Set a transaction PIN in Account first.'; end if;
  if p.pin_locked_until > now() then raise exception 'Too many wrong PINs. Try again after %.', to_char(p.pin_locked_until at time zone 'Africa/Lagos', 'HH24:MI'); end if;
  if crypt(coalesce(p_pin, ''), p.pin_hash) <> p.pin_hash then
    update public.profiles
       set pin_failed_attempts = pin_failed_attempts + 1,
           pin_locked_until = case when pin_failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
     where id = uid;
    -- return instead of raise so the attempt counter is not rolled back
    return null;
  end if;
  update public.profiles set pin_failed_attempts = 0, pin_locked_until = null where id = uid;

  select * into b from public.bank_accounts where id = p_bank_id and user_id = uid;
  if not found then raise exception 'Choose one of your saved bank accounts.'; end if;
  if p_amount is null or p_amount < 1000 then raise exception 'The minimum withdrawal is ₦1,000.'; end if;
  if p_amount <> round(p_amount) then raise exception 'Withdraw whole naira amounts.'; end if;
  if p.balance < p_amount + fee then
    raise exception 'You can withdraw up to % after the % fee.', public._ngn(greatest(p.balance - fee, 0)), public._ngn(fee);
  end if;

  update public.profiles set balance = balance - (p_amount + fee) where id = uid;
  insert into public.trades (user_id, type, title, subtitle, amount_ngn, details)
  values (uid, 'withdrawal', 'Withdrawal', b.bank || ' ·· ' || right(b.number, 4), -(p_amount + fee),
          jsonb_build_object('Bank', b.bank, 'Account', b.number, 'Account name', b.name, 'Amount', public._ngn(p_amount), 'Fee', public._ngn(fee)))
  returning * into t;
  perform public._log(t.id, 'Withdrawal requested');
  return t;
end $$;

create function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read = true where user_id = auth.uid() and not read
$$;

-- ---------------------------------------------------------------- admin actions
create function public.admin_approve(p_trade_id text, p_final_amount numeric default null) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  t public.trades;
  v_amt numeric;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select * into t from public.trades where id = p_trade_id for update;
  if not found or t.status not in ('pending', 'in_escrow') then raise exception 'This trade has already been reviewed.'; end if;

  if t.amount_ngn > 0 then
    v_amt := coalesce(p_final_amount, t.amount_ngn);
    if v_amt <= 0 then raise exception 'The payout must be more than ₦0.'; end if;
    update public.profiles set balance = balance + v_amt, lifetime_volume = lifetime_volume + v_amt where id = t.user_id;
    update public.trades set status = 'completed', amount_ngn = v_amt, reviewed_by = auth.uid(), updated_at = now() where id = t.id returning * into t;
    perform public._log(t.id, case when t.type = 'giftcard' then 'Card verified, ' else '' end || public._ngn(v_amt)
                              || case when t.type = 'giftcard' then ' paid to wallet' else ' released from escrow to wallet' end);
    perform public._notify(t.user_id, case when t.type = 'giftcard' then 'Card paid' else 'Trade completed' end,
                           t.title || ' was approved. ' || public._ngn(v_amt) || ' is in your wallet.');
  elsif t.type = 'crypto-buy' then
    update public.profiles set lifetime_volume = lifetime_volume - t.amount_ngn where id = t.user_id;
    update public.trades set status = 'completed', reviewed_by = auth.uid(), updated_at = now() where id = t.id returning * into t;
    perform public._log(t.id, (t.details ->> 'Amount') || ' released to your wallet');
    perform public._notify(t.user_id, 'Crypto sent', (t.details ->> 'Amount') || ' was released from escrow to your wallet.');
  else
    -- withdrawal: the bank transfer itself is sent by the payout provider (see supabase/functions/payout)
    update public.trades set status = 'completed', reviewed_by = auth.uid(), updated_at = now() where id = t.id returning * into t;
    perform public._log(t.id, 'Sent to ' || (t.details ->> 'Bank'));
    perform public._notify(t.user_id, 'Withdrawal sent', (t.details ->> 'Amount') || ' is on its way to your ' || (t.details ->> 'Bank') || ' account.');
  end if;
  return t;
end $$;

create function public.admin_reject(p_trade_id text, p_reason text) returns public.trades
language plpgsql security definer set search_path = public as $$
declare
  t public.trades;
  v_refund numeric;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if length(coalesce(trim(p_reason), '')) < 3 then raise exception 'Give the user a reason.'; end if;
  select * into t from public.trades where id = p_trade_id for update;
  if not found or t.status not in ('pending', 'in_escrow') then raise exception 'This trade has already been reviewed.'; end if;
  v_refund := greatest(-t.amount_ngn, 0);
  if v_refund > 0 then update public.profiles set balance = balance + v_refund where id = t.user_id; end if;
  delete from public.coupon_redemptions where trade_id = t.id;
  update public.trades set status = 'rejected', note = trim(p_reason), reviewed_by = auth.uid(), updated_at = now() where id = t.id returning * into t;
  perform public._log(t.id, 'Rejected: ' || trim(p_reason) || case when v_refund > 0 then ' (' || public._ngn(v_refund) || ' refunded)' else '' end);
  perform public._notify(t.user_id, t.title || ' was declined', trim(p_reason));
  return t;
end $$;

-- Only the public entry points are callable from the app.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.is_admin(), public.has_pin(),
  public.submit_giftcard_trade(text, text, numeric, text, text, text[], text),
  public.open_crypto_sell(text, numeric), public.mark_crypto_sent(text, text),
  public.open_crypto_buy(text, numeric, text), public.set_pin(text, text),
  public.request_withdrawal(uuid, numeric, text), public.mark_notifications_read(),
  public.admin_approve(text, numeric), public.admin_reject(text, text)
to authenticated;
