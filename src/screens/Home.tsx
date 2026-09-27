import { useState } from 'react'
import { CARDS, COUPONS, CRYPTO, LEADERBOARD, TIERS } from '../data'
import { useNav } from '../nav'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { BrandTile, StatusPill, naira, timeAgo } from '../components/ui'

export function tierFor(volume: number) {
  let i = 0
  TIERS.forEach((t, idx) => volume >= t.min && (i = idx))
  const tier = TIERS[i]
  const next = TIERS[i + 1]
  const progress = next ? (volume - tier.min) / (next.min - tier.min) : 1
  return { tier, next, progress }
}

export function Home() {
  const { s, patch } = useStore()
  const { push, setTab } = useNav()
  const [q, setQ] = useState('')
  const unread = s.notices.filter(n => !n.read).length
  const pending = s.txs.filter(t => t.status === 'pending' || t.status === 'in_escrow')
  const { tier, next, progress } = tierFor(s.lifetimeVolume)
  const cards = CARDS.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
  const usdt = CRYPTO[0]

  const board = [...LEADERBOARD, { name: s.user.username, volume: s.lifetimeVolume, me: true }].sort((a, b) => b.volume - a.volume)
  const myRank = board.findIndex(b => 'me' in b) + 1

  return (
    <div className="screen home">
      <header className="home-top">
        <button className="avatar" onClick={() => push({ name: 'account' })} aria-label="Account">
          {s.user.username.slice(0, 1).toUpperCase()}
        </button>
        <div className="hello">
          <small>Welcome back</small>
          <strong>@{s.user.username}</strong>
        </div>
        <button className="icon-btn bell" onClick={() => push({ name: 'notifications' })} aria-label={`Notifications, ${unread} unread`}>
          <Icon name="bell" size={22} />
          {unread > 0 && <span className="dot">{unread}</span>}
        </button>
      </header>

      <section className="balance">
        <div className="balance-label">
          <span>Wallet balance</span>
          <button className="icon-btn ghost-light" onClick={() => patch({ hideBalance: !s.hideBalance })} aria-label={s.hideBalance ? 'Show balance' : 'Hide balance'}>
            <Icon name={s.hideBalance ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
        <div className="balance-amount">{s.hideBalance ? '₦ • • • • • •' : naira(s.balance)}</div>
        <div className="balance-meta">
          {pending.length > 0 ? `${pending.length} trade${pending.length > 1 ? 's' : ''} being reviewed` : 'All trades settled'}
        </div>
        <div className="balance-actions">
          <button className="btn light" onClick={() => push({ name: 'withdraw' })}>
            <Icon name="up" size={18} /> Withdraw
          </button>
          <button className="btn gold" onClick={() => setTab('sell')}>
            <Icon name="tag" size={18} /> Sell card
          </button>
        </div>
      </section>

      <nav className="quick">
        <button onClick={() => setTab('sell')}>
          <span><Icon name="gift" /></span>Gift cards
        </button>
        <button onClick={() => push({ name: 'crypto' })}>
          <span><Icon name="coin" /></span>Crypto
        </button>
        <button onClick={() => push({ name: 'rates' })}>
          <span><Icon name="chart" /></span>Rates
        </button>
        <button onClick={() => push({ name: 'referral' })}>
          <span><Icon name="users" /></span>Refer
        </button>
      </nav>

      <button className="coupon" onClick={() => push({ name: 'card', brandId: 'apple' })}>
        <Icon name="ticket" size={22} />
        <span>
          <strong>Coupon YADEX10</strong>
          <small>{COUPONS.YADEX10.label}. Tap to use it.</small>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <section className="panel rank">
        <div className="panel-head">
          <h2>Your ranking</h2>
          <span className="tier-badge" style={{ background: tier.color }}>{tier.name}</span>
        </div>
        <div className="progress" aria-label="Progress to next tier">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="rank-meta">
          {next ? `${naira(next.min - s.lifetimeVolume)} more trading to reach ${next.name} (+₦5 per $1 on every card)` : 'Top tier reached'}
        </p>
        <ol className="board">
          {board.slice(0, 5).map((b, i) => (
            <li key={b.name} className={'me' in b ? 'me' : ''}>
              <span className="pos">{i + 1}</span>
              <span className="who">@{b.name}{'me' in b && ' (you)'}</span>
              <span className="vol">{naira(b.volume)}</span>
            </li>
          ))}
        </ol>
        {myRank > 5 && <p className="rank-meta">You are #{myRank} this week.</p>}
      </section>

      <section className="panel crypto-strip" onClick={() => push({ name: 'crypto' })} role="button" tabIndex={0}>
        <div>
          <small>USDT rate today</small>
          <strong>We buy at {naira(usdt.sellRate)}</strong>
        </div>
        <span className="btn small">Trade crypto</span>
      </section>

      <section className="cards-section">
        <div className="panel-head">
          <h2>Gift cards</h2>
          <button className="link" onClick={() => push({ name: 'rates' })}>All rates</button>
        </div>
        <label className="search">
          <Icon name="search" size={18} />
          <input id="home-search" placeholder="Search Apple, Steam, Amazon…" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <div className="card-grid">
          {cards.map(c => {
            const best = Math.max(...c.categories.flatMap(k => Object.values(k.rates) as number[]))
            return (
              <button key={c.id} className="card-cell" onClick={() => push({ name: 'card', brandId: c.id })}>
                <BrandTile brand={c} />
                <span className="card-name">{c.name}</span>
                <span className="card-rate">up to {naira(best)}/$</span>
                {c.hot && <span className="hot">Hot</span>}
              </button>
            )
          })}
        </div>
        {cards.length === 0 && <p className="muted center">No card matches “{q}”.</p>}
      </section>

      {s.txs.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>Recent</h2>
            <button className="link" onClick={() => setTab('history')}>See all</button>
          </div>
          {s.txs.slice(0, 3).map(t => (
            <button key={t.id} className="tx-row" onClick={() => push({ name: 'tx', id: t.id })}>
              <span className={`tx-icon ${t.amountNgn < 0 ? 'out' : 'in'}`}>
                <Icon name={t.amountNgn < 0 ? 'up' : 'down'} size={18} />
              </span>
              <span className="tx-text">
                <strong>{t.title}</strong>
                <small>{timeAgo(t.createdAt)}</small>
              </span>
              <span className="tx-amt">
                <strong className={t.amountNgn < 0 ? '' : 'pos'}>{naira(t.amountNgn, { sign: true })}</strong>
                <StatusPill status={t.status} />
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  )
}
