import { useState } from 'react'
import { CARDS, CRYPTO } from '../data'
import { useNav } from '../nav'
import { Icon } from '../components/Icon'
import { BrandTile, CoinTile, naira } from '../components/ui'

export function Sell() {
  const { push } = useNav()
  const [mode, setMode] = useState<'cards' | 'crypto'>('cards')
  const [q, setQ] = useState('')
  const cards = CARDS.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="screen">
      <header className="page-head">
        <h1>Sell</h1>
        <p>Pick what you're trading. You get paid in naira once it's verified.</p>
      </header>
      <div className="seg">
        <button className={mode === 'cards' ? 'on' : ''} onClick={() => setMode('cards')}>Gift cards</button>
        <button className={mode === 'crypto' ? 'on' : ''} onClick={() => setMode('crypto')}>Crypto</button>
      </div>

      {mode === 'cards' ? (
        <>
          <label className="search">
            <Icon name="search" size={18} />
            <input id="sell-search" placeholder="Search gift cards" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <div className="list-panel">
            {cards.map(c => {
              const best = Math.max(...c.categories.flatMap(k => Object.values(k.rates) as number[]))
              return (
                <button key={c.id} className="list-item" onClick={() => push({ name: 'card', brandId: c.id })}>
                  <BrandTile brand={c} size={40} />
                  <span className="li-text">
                    <strong>{c.name}</strong>
                    <small>{c.categories.length} categor{c.categories.length > 1 ? 'ies' : 'y'} · ${c.min}–${c.max.toLocaleString()}</small>
                  </span>
                  <span className="li-rate">{naira(best)}<small>/ $1</small></span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="escrow-note">
            <Icon name="shield" size={20} />
            <p>Crypto trades go through Yadex escrow. Coins are held until both sides are confirmed, then released.</p>
          </div>
          <div className="list-panel">
            {CRYPTO.map(a => (
              <button key={a.id} className="list-item" onClick={() => push({ name: 'crypto', assetId: a.id, side: 'sell' })}>
                <CoinTile asset={a} />
                <span className="li-text">
                  <strong>{a.name}</strong>
                  <small>{a.symbol} · {a.network}</small>
                </span>
                <span className="li-rate">{naira(a.sellRate)}<small>per {a.symbol}</small></span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
