// Demo catalogue and rates. Rates are naira paid per 1 unit of the card's currency.
// In production these come from the admin rate sheet on the backend.

export type CountryCode = 'US' | 'UK' | 'CA' | 'AU' | 'EU'

export const COUNTRIES: Record<CountryCode, { name: string; flag: string; currency: string; symbol: string }> = {
  US: { name: 'United States', flag: '🇺🇸', currency: 'USD', symbol: '$' },
  UK: { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', symbol: '£' },
  CA: { name: 'Canada', flag: '🇨🇦', currency: 'CAD', symbol: 'C$' },
  AU: { name: 'Australia', flag: '🇦🇺', currency: 'AUD', symbol: 'A$' },
  EU: { name: 'Europe', flag: '🇪🇺', currency: 'EUR', symbol: '€' },
}

export type CardCategory = {
  id: string
  name: string
  /** naira per unit, by country */
  rates: Partial<Record<CountryCode, number>>
}

export type CardBrand = {
  id: string
  name: string
  mono: string
  color: string
  ink: string
  hot?: boolean
  min: number
  max: number
  categories: CardCategory[]
}

const cat = (id: string, name: string, us: number, extra: Partial<Record<CountryCode, number>> = {}): CardCategory => ({
  id,
  name,
  rates: { US: us, ...extra },
})

export const CARDS: CardBrand[] = [
  {
    id: 'apple', name: 'Apple / iTunes', mono: 'A', color: '#1C1C1E', ink: '#fff', hot: true, min: 25, max: 2000,
    categories: [
      cat('apple-100-500', 'Apple $100–$500 (single card)', 1190, { UK: 1420, CA: 860, AU: 790, EU: 1260 }),
      cat('apple-25-95', 'Apple $25–$95', 1120, { UK: 1350, CA: 820 }),
      cat('apple-ecode', 'Apple e-code (any value)', 1080, { UK: 1300 }),
    ],
  },
  {
    id: 'amazon', name: 'Amazon', mono: 'a', color: '#FF9900', ink: '#161D26', hot: true, min: 25, max: 1000,
    categories: [
      cat('amz-cash', 'Amazon cash receipt', 1060, { UK: 1270, CA: 760 }),
      cat('amz-noreceipt', 'Amazon no receipt', 960, { UK: 1150 }),
      cat('amz-ecode', 'Amazon e-code', 900),
    ],
  },
  {
    id: 'steam', name: 'Steam', mono: 'S', color: '#1B2838', ink: '#66C0F4', hot: true, min: 10, max: 500,
    categories: [
      cat('steam-physical', 'Steam physical', 1150, { UK: 1380, CA: 830, AU: 760, EU: 1230 }),
      cat('steam-ecode', 'Steam e-code', 1100, { UK: 1320, EU: 1180 }),
    ],
  },
  {
    id: 'razer', name: 'Razer Gold', mono: 'R', color: '#0B0B0B', ink: '#44D62C', min: 10, max: 500,
    categories: [cat('razer-pin', 'Razer Gold PIN', 1140, { EU: 1210 })],
  },
  {
    id: 'googleplay', name: 'Google Play', mono: 'G', color: '#E8F5EE', ink: '#0B8043', min: 10, max: 500,
    categories: [cat('gp-physical', 'Google Play physical', 820, { UK: 990 }), cat('gp-ecode', 'Google Play e-code', 760)],
  },
  {
    id: 'sephora', name: 'Sephora', mono: 'Se', color: '#000000', ink: '#fff', min: 25, max: 500,
    categories: [cat('seph', 'Sephora physical', 1010, { CA: 740 })],
  },
  {
    id: 'nordstrom', name: 'Nordstrom', mono: 'N', color: '#F2F0EB', ink: '#1A1A1A', min: 25, max: 500,
    categories: [cat('nord', 'Nordstrom physical', 990)],
  },
  {
    id: 'ebay', name: 'eBay', mono: 'e', color: '#FFFFFF', ink: '#E53238', min: 25, max: 500,
    categories: [cat('ebay', 'eBay physical', 930, { UK: 1100 })],
  },
  {
    id: 'vanilla', name: 'Vanilla Visa', mono: 'V', color: '#F6E7C1', ink: '#6B4E16', min: 25, max: 500,
    categories: [cat('vanilla', 'Vanilla one-time use', 870), cat('vanilla-gift', 'Vanilla gift card', 820)],
  },
  {
    id: 'walmart', name: 'Walmart', mono: 'W', color: '#0071DC', ink: '#FFC220', min: 25, max: 500,
    categories: [cat('walmart', 'Walmart physical', 900), cat('walmart-visa', 'Walmart Visa', 840)],
  },
  {
    id: 'xbox', name: 'Xbox', mono: 'X', color: '#107C10', ink: '#fff', min: 10, max: 500,
    categories: [cat('xbox', 'Xbox physical', 880, { UK: 1040, EU: 950 })],
  },
  {
    id: 'playstation', name: 'PlayStation', mono: 'P', color: '#003791', ink: '#fff', min: 10, max: 500,
    categories: [cat('psn', 'PlayStation physical', 870, { UK: 1030 })],
  },
]

export type CryptoAsset = {
  id: string
  symbol: string
  name: string
  color: string
  network: string
  /** naira per 1 coin */
  buyRate: number
  sellRate: number
  depositAddress: string
  decimals: number
}

export const CRYPTO: CryptoAsset[] = [
  { id: 'usdt', symbol: 'USDT', name: 'Tether', color: '#26A17B', network: 'TRC20 (Tron)', buyRate: 1592, sellRate: 1548, depositAddress: 'TXq8mYadexEscrow4hVb1n2QwZr7kLp9dS3', decimals: 2 },
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', network: 'Bitcoin', buyRate: 171_450_000, sellRate: 167_200_000, depositAddress: 'bc1qyadexescrow7h3k0v2m9w4s8f6t5r1x0pq2', decimals: 6 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', color: '#627EEA', network: 'ERC20 (Ethereum)', buyRate: 6_120_000, sellRate: 5_960_000, depositAddress: '0x7aDeX0e5c7B2f1a9C3d4E8b6F0a1Y2d3E4x5C6', decimals: 4 },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', color: '#2775CA', network: 'BEP20 (BNB Chain)', buyRate: 1588, sellRate: 1542, depositAddress: '0x9YadexEscrowB4c2F8d1E6a3C7b0D5e9F2a4C1', decimals: 2 },
]

export const COUPONS: Record<string, { label: string; bonusPerUnit: number }> = {
  YADEX10: { label: '+₦10 per $1 on every card', bonusPerUnit: 10 },
  FIRSTSALE: { label: '+₦25 per $1 on your first sale', bonusPerUnit: 25 },
}

export const BANKS = [
  'Access Bank', 'First Bank', 'GTBank', 'Kuda', 'Moniepoint', 'OPay', 'PalmPay', 'Stanbic IBTC', 'UBA', 'Wema Bank', 'Zenith Bank',
]

export const WITHDRAW_FEE = 50

export const TIERS = [
  { name: 'Bronze', min: 0, color: '#B7773E' },
  { name: 'Silver', min: 500_000, color: '#8E9AA6' },
  { name: 'Gold', min: 2_000_000, color: '#D9A21B' },
  { name: 'Diamond', min: 10_000_000, color: '#3AA6C9' },
]

export const LEADERBOARD = [
  { name: 'kingsley_x', volume: 4_820_000 },
  { name: 'adaeze.trades', volume: 3_910_500 },
  { name: 'bigmo', volume: 2_644_000 },
  { name: 'tee_cards', volume: 1_870_250 },
]
