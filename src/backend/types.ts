import type { CountryCode } from '../data'

export type TxType = 'giftcard' | 'crypto-sell' | 'crypto-buy' | 'withdrawal'
export type TxStatus = 'pending' | 'in_escrow' | 'completed' | 'rejected'

export type Tx = {
  id: string
  type: TxType
  title: string
  subtitle: string
  /** naira; positive = credit to user, negative = debit */
  amountNgn: number
  status: TxStatus
  createdAt: number
  details: Record<string, string>
  image?: string
  note?: string
  /** owner's username, filled in for the admin view */
  username?: string
  timeline: { label: string; at: number }[]
}

export type Bank = { id: string; bank: string; number: string; name: string }
export type Notice = { id: string; title: string; body: string; at: number; read: boolean }

export type User = { username: string; fullName: string; email: string; phone: string; referral: string }
export type Prefs = { hideBalance: boolean; twoFactor: boolean; pushNotifications: boolean }

export type State = Prefs & {
  loggedIn: boolean
  user: User
  isAdmin: boolean
  hasPin: boolean
  balance: number
  lifetimeVolume: number
  banks: Bank[]
  /** the signed-in user's own trades */
  txs: Tx[]
  /** every user's trades, loaded for admins only (the demo reuses txs) */
  reviewTxs?: Tx[]
  notices: Notice[]
}

export type SellCardInput = {
  brandId: string
  categoryId: string
  country: CountryCode
  value: number
  kind: 'physical' | 'ecode'
  code: string
  /** data: URLs of the (already shrunk) photos */
  images: string[]
  coupon: string
}

/** Everything the screens can ask of the backend. Errors are thrown as Error with a message fit to show the user. */
export type Api = {
  mode: 'demo' | 'live'
  signIn(login: string, password: string): Promise<void>
  /** resolves to a message to show when the account needs email confirmation */
  signUp(email: string, username: string, password: string): Promise<string | void>
  signOut(): Promise<void>
  refresh(): Promise<void>

  sellCard(input: SellCardInput): Promise<Tx>
  openCryptoSell(assetId: string, amount: number): Promise<Tx>
  markSent(tradeId: string, hash: string): Promise<void>
  openCryptoBuy(assetId: string, amount: number, wallet: string): Promise<Tx>
  withdraw(bankId: string, amount: number, pin: string): Promise<Tx>
  setPin(current: string, next: string): Promise<void>

  addBank(bank: string, number: string, name: string): Promise<void>
  removeBank(id: string): Promise<void>
  updateProfile(u: Pick<User, 'fullName' | 'username' | 'phone'> & Partial<Pick<User, 'email'>>): Promise<void>
  setPrefs(p: Partial<Prefs>): Promise<void>
  markAllRead(): Promise<void>

  approve(tradeId: string, finalAmount?: number): Promise<void>
  reject(tradeId: string, reason: string): Promise<void>
  resetDemo?(): void
}
