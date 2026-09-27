# Yadex

Mobile-first web app for selling gift cards and trading crypto for naira. Every trade is held in escrow until an admin verifies it, then the user is paid into their Yadex wallet and can withdraw to a Nigerian bank.

## Run it

```bash
npm install
npm run dev            # demo mode: everything runs in the browser with sample data
npm run build          # production build in dist/
npm run build:preview  # single-file HTML preview in dist-preview/
```

Demo mode starts automatically when no Supabase keys are set. Log in with any username, the withdrawal PIN is 1234, and the Admin panel is under Account.

## Live backend

The Supabase project is **yadex** (ref `mzzvgxdgpyiowyrjoqne`, London). Its URL and publishable key are in `.env.production`, so `npm run build` produces the real app and `npm run dev` stays in demo mode. To try the real backend locally, copy `.env.production` to `.env.local`.

Before real users:

- Put your real escrow wallet addresses in the `crypto_assets` table. They are placeholders (`SET-YOUR-USDT-ADDRESS` and so on) and the app shows them as-is.
- Once the app is hosted, set **Authentication → URL Configuration → Site URL** in Supabase to the app's address so confirmation emails link back to it.

## Setting up a new Supabase project

1. Create a Supabase project.
2. Apply the database: `npx supabase link --project-ref <ref>` then `npx supabase db push`, and load the starting rates with `psql "$DATABASE_URL" -f supabase/seed.sql` (or paste both into the SQL editor).
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.
4. Sign up in the app, then make yourself an admin in the SQL editor:
   `update profiles set is_admin = true where email = 'you@example.com';`

## How the backend works

| Piece | Where |
| --- | --- |
| Tables, security rules, trade logic | `supabase/migrations/20260927000001_init.sql` |
| Private bucket for card photos | `supabase/migrations/20260927000002_storage.sql` |
| Card and crypto rates | `supabase/seed.sql`, generated from `src/data.ts` by `scripts/gen-seed.ts` |
| App side | `src/backend/live.ts` (Supabase) and `src/backend/demo.ts` (in-browser), both behind `src/backend/types.ts` |

Rules the database enforces, whatever the app sends:

- Payouts are computed on the server from the rate sheet. The app never sends an amount.
- Balances only change inside database functions. Users cannot edit their balance, admin flag or PIN hash.
- Withdrawals and crypto buys lock the wallet row, check the balance, and debit in one step. Rejected ones are refunded.
- The withdrawal PIN is stored as a bcrypt hash. Five wrong PINs lock withdrawals for 15 minutes.
- Users see only their own trades, banks, notifications and photos. Only admins can approve or decline.
- Coupons are single-use per user and are released again if the trade is declined.

## Tests

```bash
PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
```

Runs the migrations on a throwaway Postgres database (with small stand-ins for Supabase's `auth` and `storage` schemas) and checks the money flows and access rules in `supabase/tests/flows.sql`.

## Still to do before launch

- **Bank payouts.** Approving a withdrawal marks it sent. The transfer is done by hand until a payout provider (Paystack, Flutterwave or Monnify) is connected, which also gives real account-name lookup when adding a bank.
- **Crypto custody.** Deposit addresses are fixed per coin. Use per-trade addresses from a custody provider and confirm deposits on-chain.
- **KYC and compliance.** BVN/NIN verification and limits, plus SEC Nigeria and AML requirements for crypto.
- **Admin rate editing.** Rates live in the database and admins can change them through Supabase. An in-app editor is not built yet.
