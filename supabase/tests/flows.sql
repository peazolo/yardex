-- End-to-end checks of the money flows and security rules.
-- Run with scripts/test-db.sh (plain Postgres + local_stubs.sql). Any failed check aborts with an error.
\set ON_ERROR_STOP 1
\set QUIET 1
-- hide result tables; the ok/FAILED notices still print
\o /dev/null

create function pg_temp.expect_error(stmt text, fragment text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected an error containing "%" from: %', fragment, stmt;
exception when others then
  if sqlerrm not ilike '%' || fragment || '%' then
    raise exception 'wrong error for %: got "%", wanted "%"', stmt, sqlerrm, fragment;
  end if;
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'CHECK FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"username":"Alice_1"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"username":"alice_1"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'ops@example.com', '{"username":"ops"}');
update public.profiles set is_admin = true where email = 'ops@example.com';

select pg_temp.check((select count(*) = 3 from public.profiles), 'profiles created on sign-up');
select pg_temp.check((select username from public.profiles where email = 'bob@example.com') <> 'alice_1', 'duplicate usernames get a suffix');

-- ---------------------------------------------------------------- alice
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select pg_temp.check((select count(*) = 1 from public.profiles), 'user sees only their own profile');
select pg_temp.expect_error($$update public.profiles set balance = 1000000$$, 'permission denied');
select pg_temp.expect_error($$update public.profiles set is_admin = true$$, 'permission denied');
select pg_temp.expect_error($$select pin_hash from public.profiles$$, 'permission denied');
select pg_temp.expect_error($$insert into public.trades (user_id, type, title, amount_ngn) values (auth.uid(), 'giftcard', 'x', 9999999)$$, 'row-level security');
select pg_temp.check((select count(*) > 0 from public.card_rates), 'catalogue is readable');

select public.set_pin(null, '1234');
select pg_temp.expect_error($$select public.set_pin('0000', '5555')$$, 'current PIN is wrong');

select pg_temp.expect_error($$select public.submit_giftcard_trade('steam-physical', 'US', 5, 'physical', null, array['00000000-0000-0000-0000-00000000000a/a.jpg'])$$, 'between $10 and $500');
select pg_temp.expect_error($$select public.submit_giftcard_trade('steam-physical', 'US', 100, 'physical', null, '{}')$$, 'Upload a clear photo');
select pg_temp.expect_error($$select public.submit_giftcard_trade('steam-physical', 'US', 100, 'physical', null, array['00000000-0000-0000-0000-00000000000b/stolen.jpg'])$$, 'your own folder');
select pg_temp.expect_error($$select public.submit_giftcard_trade('razer-pin', 'UK', 100, 'ecode', 'ABCDEFGH1234')$$, 'do not buy');

select pg_temp.check(
  (select amount_ngn = 116000 and status = 'pending' from public.submit_giftcard_trade('steam-physical', 'US', 100, 'physical', null, array['00000000-0000-0000-0000-00000000000a/steam.jpg'], 'yadex10')),
  'gift card payout uses server rate plus coupon (100 x (1150 + 10))');
select pg_temp.expect_error($$select public.submit_giftcard_trade('steam-physical', 'US', 50, 'physical', null, array['00000000-0000-0000-0000-00000000000a/b.jpg'], 'YADEX10')$$, 'not valid or has been used');
select pg_temp.expect_error($$select public.admin_approve((select id from public.trades limit 1))$$, 'Admins only');
select pg_temp.check((select balance = 0 from public.profiles), 'no balance before approval');

-- ---------------------------------------------------------------- admin approves the card
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select pg_temp.check((select count(*) = 1 from public.trades where status = 'pending'), 'admin sees the pending card');
select pg_temp.check((select status = 'completed' from public.admin_approve((select id from public.trades where type = 'giftcard'), 115000)), 'admin approves with an adjusted payout');
select pg_temp.expect_error($$select public.admin_approve((select id from public.trades where type = 'giftcard'))$$, 'already been reviewed');

-- ---------------------------------------------------------------- alice withdraws and trades crypto
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select balance = 115000 and lifetime_volume = 115000 from public.profiles), 'wallet credited 115,000 after approval');
select pg_temp.check((select count(*) = 1 from public.notifications where title = 'Card paid'), 'user notified');
select pg_temp.check((select count(*) = 2 from public.trade_events), 'timeline shows submit and approve steps');

insert into public.bank_accounts (bank, number, name) values ('GTBank', '0123456789', 'ALICE A');
select pg_temp.expect_error($$insert into public.bank_accounts (user_id, bank, number, name) values ('00000000-0000-0000-0000-00000000000b', 'UBA', '1111111111', 'X')$$, 'row-level security');

select pg_temp.check((select public.request_withdrawal((select id from public.bank_accounts), 10000, '9999') is null), 'wrong PIN is refused');
select pg_temp.check((select balance = 115000 from public.profiles), 'wrong PIN moves no money');
select pg_temp.expect_error($$select public.request_withdrawal((select id from public.bank_accounts), 200000, '1234')$$, 'You can withdraw up to');
select pg_temp.check((select amount_ngn = -10050 from public.request_withdrawal((select id from public.bank_accounts), 10000, '1234')), 'withdrawal debits amount + ₦50 fee');
select pg_temp.check((select balance = 104950 from public.profiles), 'balance after withdrawal');

select pg_temp.expect_error($$select public.open_crypto_buy('btc', 1, 'bc1qexampleaddressexampleaddress00')$$, 'You need');
select pg_temp.check((select status = 'in_escrow' and amount_ngn = -15920 from public.open_crypto_buy('usdt', 10, 'TXexampleTronAddress000000000001')), 'crypto buy holds naira in escrow');
select pg_temp.check((select balance = 89030 from public.profiles), 'escrow debited 15,920');

select pg_temp.check((select status = 'pending' and amount_ngn = 154800 from public.open_crypto_sell('usdt', 100)), 'crypto sell opened at 1,548');
select pg_temp.check((select status = 'in_escrow' from public.mark_crypto_sent((select id from public.trades where type = 'crypto-sell'), '0xhash')), 'user marks coins sent');
select pg_temp.expect_error($$select public.mark_crypto_sent((select id from public.trades where type = 'crypto-sell'), null)$$, 'not waiting for coins');

-- ---------------------------------------------------------------- bob cannot see alice
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.check((select count(*) = 0 from public.trades), 'other users see none of alice''s trades');
select pg_temp.check((select count(*) = 0 from public.bank_accounts), 'other users see none of alice''s banks');
select pg_temp.expect_error($$select public.mark_crypto_sent((select 'YDX-48302'), null)$$, 'not waiting for coins');

-- ---------------------------------------------------------------- admin settles the rest
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select public.admin_reject((select id from public.trades where type = 'crypto-buy'), 'Wallet address is invalid');
select public.admin_approve((select id from public.trades where type = 'crypto-sell'));
select public.admin_approve((select id from public.trades where type = 'withdrawal'));

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select balance = 104950 + 154800 from public.profiles), 'reject refunds escrow, sell releases naira');
select pg_temp.check((select count(*) = 0 from public.trades where status in ('pending', 'in_escrow')), 'every trade settled');
select public.mark_notifications_read();
select pg_temp.check((select bool_and(read) from public.notifications), 'notifications marked read');

-- ---------------------------------------------------------------- anon
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check((select count(*) > 0 from public.crypto_assets), 'rates are public');
select pg_temp.check((select count(*) = 0 from public.trades), 'anon sees no trades');
select pg_temp.expect_error($$select public.open_crypto_sell('usdt', 100)$$, 'permission denied');
reset role;

\o
\echo 'All database checks passed.'
