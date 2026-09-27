import { useState } from 'react'
import { useNav } from '../nav'
import { useStore, type Tx } from '../store'
import { Header, Sheet, StatusPill, Empty, fmtDate, naira } from '../components/ui'
import { TxRow } from './History'

const REASONS = ['Card already redeemed', 'Photo is unclear', 'Wrong category or country', 'Coins not received', 'Suspected fraud']

/** Operator view. In production this is a separate, access-controlled web console. */
export function Admin() {
  const { s, approve, reject } = useStore()
  const { toast } = useNav()
  const [view, setView] = useState<'queue' | 'done'>('queue')
  const [sel, setSel] = useState<Tx | null>(null)
  const [payout, setPayout] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState(REASONS[0])

  const queue = s.txs.filter(t => t.status === 'pending' || t.status === 'in_escrow')
  const done = s.txs.filter(t => t.status === 'completed' || t.status === 'rejected')
  const list = view === 'queue' ? queue : done
  const owed = queue.filter(t => t.amountNgn > 0).reduce((a, t) => a + t.amountNgn, 0)

  const openTx = (t: Tx) => {
    setSel(t)
    setPayout(String(Math.abs(t.amountNgn)))
    setRejecting(false)
  }
  const cryptoAwaitingCoins = sel?.type === 'crypto-sell' && sel.status === 'pending'

  const approveLabel = !sel ? '' : sel.type === 'giftcard' ? 'Approve and pay' : sel.type === 'crypto-sell' ? 'Coins received, release naira' : sel.type === 'crypto-buy' ? 'Coins sent, close trade' : 'Mark transfer as sent'

  return (
    <div className="screen admin">
      <Header title="Admin" sub="Review and payouts" />
      <div className="stat-pair">
        <div><small>Waiting for review</small><strong>{queue.length}</strong></div>
        <div><small>Payouts pending</small><strong>{naira(owed)}</strong></div>
      </div>
      <div className="seg">
        <button className={view === 'queue' ? 'on' : ''} onClick={() => setView('queue')}>Queue ({queue.length})</button>
        <button className={view === 'done' ? 'on' : ''} onClick={() => setView('done')}>Reviewed</button>
      </div>
      {list.length === 0 && <Empty icon="check" title="Queue is clear" body="New cards, crypto trades and withdrawals appear here." />}
      <div className="list-panel">
        {list.map(t => <TxRow key={t.id} t={t} onClick={() => openTx(t)} />)}
      </div>
      <p className="fine">Sell a card or start a trade as a user, then come back here to approve it and watch the wallet update.</p>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.title} · ${sel.id}` : ''}>
        {sel && (
          <div className="form">
            <div className="admin-status"><StatusPill status={sel.status} /><small>{fmtDate(sel.createdAt)} · @{s.user.username}</small></div>
            {sel.image ? <img className="tx-image" src={sel.image} alt="Submitted card" /> : sel.type === 'giftcard' && <p className="muted">No photo attached.</p>}
            <dl className="kv small">
              {Object.entries(sel.details).map(([k, v]) => <div key={k} className="kv-row"><dt>{k}</dt><dd className={k === 'Code' || k.includes('ddress') || k.includes('wallet') || k === 'Tx hash' ? 'mono' : ''}>{v}</dd></div>)}
            </dl>
            {(sel.status === 'pending' || sel.status === 'in_escrow') && !rejecting && (
              <>
                {sel.amountNgn > 0 && (
                  <label className="field">
                    <span>Payout to user (₦)</span>
                    <input id="admin-payout" inputMode="numeric" value={payout} onChange={e => setPayout(e.target.value.replace(/\D/g, ''))} />
                    <small className="hint">Adjust if the card value differs from what was declared.</small>
                  </label>
                )}
                {cryptoAwaitingCoins && <p className="warn-box">The user has not marked the coins as sent yet.</p>}
                <button
                  className="btn primary block"
                  onClick={() => {
                    approve(sel.id, sel.amountNgn > 0 ? Number(payout) : undefined)
                    toast('Approved. The user has been notified.')
                    setSel(null)
                  }}
                >
                  {approveLabel}
                </button>
                <button className="btn ghost block" onClick={() => setRejecting(true)}>Decline</button>
              </>
            )}
            {rejecting && (
              <>
                <div className="field">
                  <span>Reason shown to the user</span>
                  <div className="chips">
                    {REASONS.map(r => <button key={r} className={`chip ${r === reason ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
                  </div>
                </div>
                {sel.amountNgn < 0 && <p className="muted">{naira(-sel.amountNgn)} will be refunded to the user's wallet.</p>}
                <button className="btn danger block" onClick={() => { reject(sel.id, reason); toast('Declined. The user has been notified.'); setSel(null) }}>Decline trade</button>
                <button className="btn ghost block" onClick={() => setRejecting(false)}>Back</button>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
