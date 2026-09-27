import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// Local mock backend. Every action here maps to one API call in the real app
// (see README "Backend plan"), so screens won't change when we swap it out.

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
  timeline: { label: string; at: number }[]
}

export type Bank = { id: string; bank: string; number: string; name: string }
export type Notice = { id: string; title: string; body: string; at: number; read: boolean }

export type State = {
  loggedIn: boolean
  user: { username: string; fullName: string; email: string; phone: string; referral: string }
  balance: number
  lifetimeVolume: number
  pin: string | null
  hideBalance: boolean
  twoFactor: boolean
  pushNotifications: boolean
  banks: Bank[]
  txs: Tx[]
  notices: Notice[]
  usedCoupons: string[]
}

const KEY = 'yadex-demo-v1'
const now = Date.now()
const h = 3600_000

const seed = (): State => ({
  loggedIn: false,
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

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: start from the demo seed */
  }
  return seed()
}

const newId = () => 'YDX-' + Math.floor(48300 + Math.random() * 9000)
const noticeId = () => 'n' + Math.random().toString(36).slice(2, 9)

export type NewTx = Omit<Tx, 'id' | 'createdAt' | 'timeline' | 'status'> & { status?: TxStatus; firstStep: string }

function useStoreValue() {
  const [s, setS] = useState<State>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      /* quota or blocked storage: keep going in memory */
    }
  }, [s])

  const patch = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setS(prev => ({ ...prev, ...(typeof p === 'function' ? p(prev) : p) }))
  }, [])

  const notify = (st: State, title: string, body: string): Notice[] => [
    { id: noticeId(), title, body, at: Date.now(), read: false },
    ...st.notices,
  ]

  const addTx = useCallback((t: NewTx): Tx => {
    const { firstStep, ...rest } = t
    const tx: Tx = { ...rest, id: newId(), createdAt: Date.now(), status: t.status ?? 'pending', timeline: [{ label: firstStep, at: Date.now() }] }
    setS(prev => {
      // debits (withdrawals, crypto buys) leave the wallet immediately and are refunded on rejection
      const balance = tx.amountNgn < 0 ? prev.balance + tx.amountNgn : prev.balance
      return { ...prev, balance, txs: [tx, ...prev.txs] }
    })
    return tx
  }, [])

  const step = (tx: Tx, label: string, status: TxStatus, extra: Partial<Tx> = {}): Tx => ({
    ...tx, ...extra, status, timeline: [...tx.timeline, { label, at: Date.now() }],
  })

  /** Admin: approve a submission / release escrow / mark a payout as sent. */
  const approve = useCallback((id: string, finalAmount?: number) => {
    setS(prev => {
      const tx = prev.txs.find(t => t.id === id)
      if (!tx || tx.status === 'completed' || tx.status === 'rejected') return prev
      let { balance, lifetimeVolume, notices } = prev
      let updated: Tx
      if (tx.amountNgn > 0) {
        const amt = finalAmount ?? tx.amountNgn
        balance += amt
        lifetimeVolume += amt
        updated = step(tx, tx.type === 'giftcard' ? `Card verified, ₦${amt.toLocaleString()} paid to wallet` : `₦${amt.toLocaleString()} released from escrow to wallet`, 'completed', { amountNgn: amt })
        notices = notify(prev, tx.type === 'giftcard' ? 'Card paid' : 'Trade completed', `${tx.title} was approved. ₦${amt.toLocaleString()} is in your wallet.`)
      } else if (tx.type === 'crypto-buy') {
        lifetimeVolume += -tx.amountNgn
        updated = step(tx, `${tx.details.Amount} released to your wallet`, 'completed')
        notices = notify(prev, 'Crypto sent', `${tx.details.Amount} was released from escrow to ${tx.details['Your wallet']?.slice(0, 10)}…`)
      } else {
        updated = step(tx, `Sent to ${tx.details.Bank}`, 'completed')
        notices = notify(prev, 'Withdrawal sent', `₦${tx.details.Amount?.replace('₦', '')} is on its way to your ${tx.details.Bank} account.`)
      }
      return { ...prev, balance, lifetimeVolume, notices, txs: prev.txs.map(t => (t.id === id ? updated : t)) }
    })
  }, [])

  const reject = useCallback((id: string, reason: string) => {
    setS(prev => {
      const tx = prev.txs.find(t => t.id === id)
      if (!tx || tx.status === 'completed' || tx.status === 'rejected') return prev
      const refund = tx.amountNgn < 0 ? -tx.amountNgn : 0
      const updated = step(tx, `Rejected: ${reason}${refund ? ` (₦${refund.toLocaleString()} refunded)` : ''}`, 'rejected', { note: reason })
      return {
        ...prev,
        balance: prev.balance + refund,
        notices: notify(prev, `${tx.title} was declined`, reason),
        txs: prev.txs.map(t => (t.id === id ? updated : t)),
      }
    })
  }, [])

  /** User: marks crypto as sent to the escrow address. */
  const markSent = useCallback((id: string, hash: string) => {
    setS(prev => ({
      ...prev,
      txs: prev.txs.map(t => (t.id === id ? step(t, 'You marked the coins as sent', 'in_escrow', { details: { ...t.details, 'Tx hash': hash || 'Not provided' } }) : t)),
    }))
  }, [])

  const reset = useCallback(() => setS({ ...seed(), loggedIn: true }), [])

  return { s, patch, addTx, approve, reject, markSent, reset }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside provider')
  return v
}
