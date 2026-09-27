import { useState } from 'react'
import { useNav } from '../nav'
import { useStore, type Tx, type TxType } from '../store'
import { Icon } from '../components/Icon'
import { Empty, Header, StatusPill, fmtDate, naira } from '../components/ui'

const FILTERS: { id: 'all' | TxType | 'crypto'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'giftcard', label: 'Gift cards' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'withdrawal', label: 'Withdrawals' },
]

const dayLabel = (t: number) => {
  const d = new Date(t)
  const today = new Date()
  const y = new Date(Date.now() - 86400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function TxRow({ t, onClick }: { t: Tx; onClick: () => void }) {
  return (
    <button className="tx-row" onClick={onClick}>
      <span className={`tx-icon ${t.amountNgn < 0 ? 'out' : 'in'} ${t.status === 'rejected' ? 'rej' : ''}`}>
        <Icon name={t.type === 'withdrawal' ? 'bank' : t.type === 'giftcard' ? 'gift' : 'coin'} size={18} />
      </span>
      <span className="tx-text">
        <strong>{t.title}</strong>
        <small>{t.subtitle}</small>
      </span>
      <span className="tx-amt">
        <strong className={t.status === 'rejected' ? 'strike' : t.amountNgn < 0 ? '' : 'pos'}>{naira(t.amountNgn, { sign: true })}</strong>
        <StatusPill status={t.status} />
      </span>
    </button>
  )
}

export function History() {
  const { s } = useStore()
  const { push } = useNav()
  const [f, setF] = useState<(typeof FILTERS)[number]['id']>('all')
  const list = s.txs.filter(t => f === 'all' || t.type === f || (f === 'crypto' && t.type.startsWith('crypto')))
  const groups = list.reduce<Record<string, Tx[]>>((acc, t) => {
    ;(acc[dayLabel(t.createdAt)] ??= []).push(t)
    return acc
  }, {})
  const earned = s.txs.filter(t => t.status === 'completed' && t.amountNgn > 0).reduce((a, t) => a + t.amountNgn, 0)
  const withdrawn = s.txs.filter(t => t.status === 'completed' && t.type === 'withdrawal').reduce((a, t) => a - t.amountNgn, 0)

  return (
    <div className="screen">
      <header className="page-head">
        <h1>Transactions</h1>
      </header>
      <div className="stat-pair">
        <div><small>Total earned</small><strong>{naira(earned)}</strong></div>
        <div><small>Withdrawn</small><strong>{naira(withdrawn)}</strong></div>
      </div>
      <div className="chips scroll">
        {FILTERS.map(x => (
          <button key={x.id} className={`chip ${f === x.id ? 'on' : ''}`} onClick={() => setF(x.id)}>{x.label}</button>
        ))}
      </div>
      {list.length === 0 && <Empty icon="list" title="Nothing here yet" body="Trades you make will show up here." />}
      {Object.entries(groups).map(([day, txs]) => (
        <section key={day} className="tx-group">
          <h3>{day}</h3>
          <div className="list-panel">
            {txs.map(t => <TxRow key={t.id} t={t} onClick={() => push({ name: 'tx', id: t.id })} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

export function TxDetail({ id }: { id: string }) {
  const { s } = useStore()
  const { push } = useNav()
  const t = s.txs.find(x => x.id === id)
  if (!t) return <div className="screen"><Header title="Transaction" /><Empty icon="list" title="Not found" body="This transaction no longer exists." /></div>

  return (
    <div className="screen">
      <Header title={t.title} sub={t.id} />
      <section className="tx-hero">
        <small>{t.amountNgn < 0 ? 'Debit' : t.status === 'completed' ? 'Paid to wallet' : 'Expected payout'}</small>
        <strong className={t.status === 'rejected' ? 'strike' : ''}>{naira(t.amountNgn, { sign: true })}</strong>
        <StatusPill status={t.status} />
        {t.note && <p className="note">{t.note}</p>}
      </section>
      {t.image && <img className="tx-image" src={t.image} alt="Uploaded card" />}
      <section className="panel">
        <dl className="kv">
          {Object.entries(t.details).map(([k, v]) => (
            <div key={k} className="kv-row"><dt>{k}</dt><dd className={k.includes('address') || k.includes('wallet') || k === 'Code' || k === 'Tx hash' ? 'mono' : ''}>{v}</dd></div>
          ))}
          <div className="kv-row"><dt>Date</dt><dd>{fmtDate(t.createdAt)}</dd></div>
        </dl>
      </section>
      <section className="panel">
        <h2 className="panel-title">Progress</h2>
        <ol className="timeline">
          {t.timeline.map((e, i) => (
            <li key={i} className={i === t.timeline.length - 1 ? 'last' : ''}>
              <span>{e.label}</span>
              <small>{fmtDate(e.at)}</small>
            </li>
          ))}
          {(t.status === 'pending' || t.status === 'in_escrow') && (
            <li className="waiting"><span>{t.type === 'giftcard' ? 'Waiting for card check' : t.type === 'withdrawal' ? 'Waiting for bank transfer' : 'Waiting for escrow release'}</span></li>
          )}
        </ol>
      </section>
      <button className="btn ghost block" onClick={() => push({ name: 'help' })}>
        <Icon name="help" size={18} /> Get help with this trade
      </button>
    </div>
  )
}
