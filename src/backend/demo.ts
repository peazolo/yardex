import { useCallback, useEffect, useMemo, useState } from 'react'
import { CARDS, COUNTRIES, COUPONS, CRYPTO, WITHDRAW_FEE } from '../data'
import type { Api, Notice, State, Tx, TxStatus } from './types'

// In-browser stand-in for the Supabase backend, used when no Supabase keys are configured.
// It mirrors the rules in supabase/migrations so the demo behaves like the real thing.

type DemoState = State & { pin: string | null; usedCoupons: string[] }

const KEY = 'yadex-demo-v2'
const now = Date.now()
const h = 3600_000
const ngn = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG')

const seed = (): DemoState => ({
  loggedIn: false,
  isAdmin: true,
  hasPin: true,
  user: { username: 'tunde_o', fullName: 'Tunde Okafor', email: 'tunde@example.com', phone: '0803 000 1122', referral: 'TUNDE24' },
  balance: 184_250,
  lifetimeVolume: 1_236_400,
  pin: '1234',
  hideBalance: false,
  twoFactor: false,
  pushNotifications: true,
  banks: [{ id: 'b1', bank: 'GTBank', number: '0123456789', name: 'TUNDE OKAFOR' }],
  txs: [
    {
      id: 'YDX-48213', type: 'giftcard', title: 'Steam $100', subtitle: 'Steam physical · US', amountNgn: 115_000, status: 'pending',
      createdAt: now - 0.6 * h, details: { Brand: 'Steam', Category: 'Steam physical', Country: 'United States', 'Card value': '$100', Type: 'Physical', Rate: '₦1,150 / $' },
      timeline: [{ label: 'Submitted for review', at: now - 0.6 * h }],
    },
    {
      id: 'YDX-48170', type: 'giftcard', title: 'Apple $200', subtitle: 'Apple $100–$500 · US', amountNgn: 238_000, status: 'completed',
      createdAt: now - 26 * h, details: { Brand: 'Apple / iTunes', Category: 'Apple $100–$500 (single card)', Country: 'United States', 'Card value': '$200', Type: 'E-code', Rate: '₦1,190 / $' },
      timeline: [{ label: 'Submitted for review', at: now - 26 * h }, { label: 'Card verified', at: now - 25.7 * h }, { label: '₦238,000 paid to wallet', at: now - 25.6 * h }],
    },
    {
      id: 'YDX-48102', type: 'withdrawal', title: 'Withdrawal', subtitle: 'GTBank ·· 6789', amountNgn: -200_050, status: 'completed',
      createdAt: now - 25 * h, details: { Bank: 'GTBank', Account: '0123456789', 'Account name': 'TUNDE OKAFOR', Amount: '₦200,000', Fee: '₦50' },
      timeline: [{ label: 'Withdrawal requested', at: now - 25 * h }, { label: 'Sent to GTBank', at: now - 24.9 * h }],
    },
    {
      id: 'YDX-47988', type: 'crypto-sell', title: 'Sold 150 USDT', subtitle: 'USDT · TRC20', amountNgn: 232_200, status: 'completed',
      createdAt: now - 72 * h, details: { Asset: 'USDT', Network: 'TRC20 (Tron)', Amount: '150 USDT', Rate: '₦1,548 / USDT' },
      timeline: [{ label: 'Trade opened', at: now - 72 * h }, { label: 'USDT received in escrow', at: now - 71.8 * h }, { label: '₦232,200 released to wallet', at: now - 71.7 * h }],
    },
    {
      id: 'YDX-47850', type: 'giftcard', title: 'Amazon $50', subtitle: 'Amazon no receipt · US', amountNgn: 48_000, status: 'rejected',
      createdAt: now - 120 * h, details: { Brand: 'Amazon', Category: 'Amazon no receipt', Country: 'United States', 'Card value': '$50', Type: 'Physical', Rate: '₦960 / $' },
      note: 'Card was already redeemed.',
      timeline: [{ label: 'Submitted for review', at: now - 120 * h }, { label: 'Rejected: card was already redeemed', at: now - 119.5 * h }],
    },
  ],
  notices: [
    { id: 'n1', title: 'Apple rates are up', body: 'Apple $100–$500 cards now pay ₦1,190 per $1.', at: now - 3 * h, read: false },
    { id: 'n2', title: 'Card paid', body: 'Your Apple $200 card was approved. ₦238,000 is in your wallet.', at: now - 25.6 * h, read: true },
  ],
  usedCoupons: [],
})

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: start from the demo seed */
  }
  return seed()
}

let counter = 48300 + Math.floor(Math.random() * 9000)
const newId = () => 'YDX-' + counter++
const noticeId = () => 'n' + Math.random().toString(36).slice(2, 9)
const fail = (msg: string): never => {
  throw new Error(msg)
}

export function useDemoBackend(): { s: State; api: Api } {
  const [s, setS] = useState<DemoState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* quota or blocked storage: keep going in memory */
    }
  }, [s])

  const notify = (st: DemoState, title: string, body: string): Notice[] => [{ id: noticeId(), title, body, at: Date.now(), read: false }, ...st.notices]
  const step = (tx: Tx, label: string, status: TxStatus, extra: Partial<Tx> = {}): Tx => ({ ...tx, ...extra, status, timeline: [...tx.timeline, { label, at: Date.now() }] })

  const add = useCallback((t: Omit<Tx, 'id' | 'createdAt' | 'timeline' | 'status'> & { status?: TxStatus; firstStep: string }): Tx => {
    const { firstStep, ...rest } = t
    const tx: Tx = { ...rest, id: newId(), createdAt: Date.now(), status: t.status ?? 'pending', timeline: [{ label: firstStep, at: Date.now() }] }
    setS(prev => ({ ...prev, balance: tx.amountNgn < 0 ? prev.balance + tx.amountNgn : prev.balance, txs: [tx, ...prev.txs] }))
    return tx
  }, [])

  const api = useMemo<Api>(() => ({
    mode: 'demo',
    async signIn(login) {
      setS(st => ({ ...st, loggedIn: true, user: { ...st.user, username: login.trim() || st.user.username } }))
    },
    async signUp(email, username) {
      setS(st => ({ ...st, loggedIn: true, user: { ...st.user, username, email, fullName: username } }))
    },
    async signOut() {
      setS(st => ({ ...st, loggedIn: false }))
    },
    async refresh() {},

    async sellCard(i) {
      const brand = CARDS.find(c => c.id === i.brandId) ?? fail('That card is not available.')
      const cat = brand.categories.find(c => c.id === i.categoryId) ?? fail('That card category is not available.')
      const rate = cat.rates[i.country] ?? fail(`We do not buy ${cat.name} cards from ${COUNTRIES[i.country].name}.`)
      const cur = COUNTRIES[i.country]
      const key = i.coupon.trim().toUpperCase()
      if (key && (!COUPONS[key] || s.usedCoupons.includes(key))) fail('That coupon code is not valid or has been used.')
      const bonus = key ? COUPONS[key].bonusPerUnit : 0
      const tx = add({
        type: 'giftcard',
        title: `${brand.name.split(' /')[0]} ${cur.symbol}${i.value}`,
        subtitle: `${cat.name} · ${i.country}`,
        amountNgn: Math.round(i.value * (rate + bonus)),
        details: {
          Brand: brand.name, Category: cat.name, Country: cur.name, 'Card value': `${cur.symbol}${i.value}`,
          Type: i.kind === 'physical' ? 'Physical' : 'E-code', Rate: `${ngn(rate)} / ${cur.symbol}`,
          ...(i.kind === 'ecode' && i.code.trim() ? { Code: i.code.trim().toUpperCase() } : {}),
          ...(bonus ? { Coupon: `${key} (+${ngn(bonus)}/${cur.symbol})` } : {}),
        },
        image: i.images[0],
        firstStep: 'Submitted for review',
      })
      if (bonus) setS(st => ({ ...st, usedCoupons: [...st.usedCoupons, key] }))
      return tx
    },

    async openCryptoSell(assetId, n) {
      const a = CRYPTO.find(x => x.id === assetId) ?? fail('That coin is not available.')
      return add({
        type: 'crypto-sell', title: `Sell ${n} ${a.symbol}`, subtitle: `${a.symbol} · ${a.network}`, amountNgn: Math.round(n * a.sellRate),
        details: { Asset: a.name, Network: a.network, Amount: `${n} ${a.symbol}`, Rate: `${ngn(a.sellRate)} / ${a.symbol}`, 'Escrow address': a.depositAddress },
        firstStep: 'Trade opened, waiting for your coins',
      })
    },

    async markSent(id, hash) {
      setS(prev => ({
        ...prev,
        txs: prev.txs.map(t => (t.id === id ? step(t, 'You marked the coins as sent', 'in_escrow', { details: { ...t.details, 'Tx hash': hash || 'Not provided' } }) : t)),
      }))
    },

    async openCryptoBuy(assetId, n, wallet) {
      const a = CRYPTO.find(x => x.id === assetId) ?? fail('That coin is not available.')
      const total = Math.round(n * a.buyRate)
      if (total > s.balance) fail(`You need ${ngn(total)} but your wallet has ${ngn(s.balance)}.`)
      return add({
        type: 'crypto-buy', title: `Buy ${n} ${a.symbol}`, subtitle: `${a.symbol} · ${a.network}`, amountNgn: -total, status: 'in_escrow',
        details: { Asset: a.name, Network: a.network, Amount: `${n} ${a.symbol}`, Rate: `${ngn(a.buyRate)} / ${a.symbol}`, 'Your wallet': wallet.trim() },
        firstStep: `${ngn(total)} held in escrow`,
      })
    },

    async withdraw(bankId, amount, pin) {
      if (pin !== s.pin) fail('Wrong PIN. Try again.')
      const b = s.banks.find(x => x.id === bankId) ?? fail('Choose one of your saved bank accounts.')
      if (amount < 1000) fail('The minimum withdrawal is ₦1,000.')
      if (amount + WITHDRAW_FEE > s.balance) fail(`You can withdraw up to ${ngn(Math.max(0, s.balance - WITHDRAW_FEE))} after the ${ngn(WITHDRAW_FEE)} fee.`)
      return add({
        type: 'withdrawal', title: 'Withdrawal', subtitle: `${b.bank} ·· ${b.number.slice(-4)}`, amountNgn: -(amount + WITHDRAW_FEE),
        details: { Bank: b.bank, Account: b.number, 'Account name': b.name, Amount: ngn(amount), Fee: ngn(WITHDRAW_FEE) },
        firstStep: 'Withdrawal requested',
      })
    },

    async setPin(cur, next) {
      if (s.pin && cur !== s.pin) fail('Your current PIN is wrong.')
      if (!/^\d{4}$/.test(next)) fail('Your new PIN must be 4 digits.')
      setS(st => ({ ...st, pin: next, hasPin: true }))
    },

    async addBank(bank, number, name) {
      setS(st => ({ ...st, banks: [...st.banks, { id: 'b' + Date.now(), bank, number, name }] }))
    },
    async removeBank(id) {
      setS(st => ({ ...st, banks: st.banks.filter(b => b.id !== id) }))
    },
    async updateProfile(u) {
      setS(st => ({ ...st, user: { ...st.user, ...u } }))
    },
    async setPrefs(p) {
      setS(st => ({ ...st, ...p }))
    },
    async markAllRead() {
      setS(st => ({ ...st, notices: st.notices.map(n => ({ ...n, read: true })) }))
    },

    async approve(id, finalAmount) {
      setS(prev => {
        const tx = prev.txs.find(t => t.id === id)
        if (!tx || tx.status === 'completed' || tx.status === 'rejected') return prev
        let { balance, lifetimeVolume, notices } = prev
        let updated: Tx
        if (tx.amountNgn > 0) {
          const amt = finalAmount ?? tx.amountNgn
          balance += amt
          lifetimeVolume += amt
          updated = step(tx, tx.type === 'giftcard' ? `Card verified, ${ngn(amt)} paid to wallet` : `${ngn(amt)} released from escrow to wallet`, 'completed', { amountNgn: amt })
          notices = notify(prev, tx.type === 'giftcard' ? 'Card paid' : 'Trade completed', `${tx.title} was approved. ${ngn(amt)} is in your wallet.`)
        } else if (tx.type === 'crypto-buy') {
          lifetimeVolume += -tx.amountNgn
          updated = step(tx, `${tx.details.Amount} released to your wallet`, 'completed')
          notices = notify(prev, 'Crypto sent', `${tx.details.Amount} was released from escrow to your wallet.`)
        } else {
          updated = step(tx, `Sent to ${tx.details.Bank}`, 'completed')
          notices = notify(prev, 'Withdrawal sent', `${tx.details.Amount} is on its way to your ${tx.details.Bank} account.`)
        }
        return { ...prev, balance, lifetimeVolume, notices, txs: prev.txs.map(t => (t.id === id ? updated : t)) }
      })
    },

    async reject(id, reason) {
      setS(prev => {
        const tx = prev.txs.find(t => t.id === id)
        if (!tx || tx.status === 'completed' || tx.status === 'rejected') return prev
        const refund = tx.amountNgn < 0 ? -tx.amountNgn : 0
        const updated = step(tx, `Rejected: ${reason}${refund ? ` (${ngn(refund)} refunded)` : ''}`, 'rejected', { note: reason })
        return { ...prev, balance: prev.balance + refund, notices: notify(prev, `${tx.title} was declined`, reason), txs: prev.txs.map(t => (t.id === id ? updated : t)) }
      })
    },

    resetDemo() {
      setS({ ...seed(), loggedIn: true })
    },
  }), [s, add])

  return { s, api }
}
