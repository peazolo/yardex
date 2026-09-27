# Yadex

Mobile-first web app for selling gift cards and trading crypto for naira, with escrow and an admin review queue.

## Run it

```bash
npm install
npm run dev            # local dev server
npm run build:preview  # single-file HTML preview in dist-preview/
```

## What's here

- `src/data.ts`: gift card catalogue, rates per country, crypto assets, coupons, banks (demo values)
- `src/store.tsx`: mock backend kept in localStorage. Each action maps to one future API call.
- `src/screens/`: Home, Sell, CardSell (sell flow), Crypto (escrow buy/sell), History + TxDetail, Withdraw, Account pages, Admin

## Backend plan (next step)

| Mock action | Real endpoint |
| --- | --- |
| `addTx` gift card | `POST /trades/giftcard` (upload images to storage) |
| `addTx` crypto sell/buy | `POST /trades/crypto`, one-time deposit address per trade |
| `markSent` | `POST /trades/:id/sent` |
| `approve` / `reject` | `POST /admin/trades/:id/approve` / `reject` (admin only) |
| withdraw | `POST /withdrawals`, then payout provider transfer (Paystack / Flutterwave / Monnify) |
| bank name lookup | payout provider account resolve API |

Needs before launch: real auth with 2FA, KYC (BVN/NIN), rate sheet managed by admin, audit log, SEC/AML compliance for crypto.
