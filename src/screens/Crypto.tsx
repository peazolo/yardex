import { useState } from 'react'
import { CRYPTO } from '../data'
import { useNav } from '../nav'
import { useStore, type Tx } from '../store'
import { Icon } from '../components/Icon'
import { CoinTile, Header, Sheet, copyText, naira } from '../components/ui'

const ESCROW_STEPS = {
  sell: ['You send coins to the Yadex escrow address', 'We confirm them on the blockchain', 'Naira is released to your wallet'],
  buy: ['Naira is held from your wallet', 'Yadex sends the coins to your address', 'Trade closes once they arrive'],
}

export function Crypto({ assetId, side: initialSide }: { assetId?: string; side?: 'buy' | 'sell' }) {
  const { s, api } = useStore()
  const { toast, reset } = useNav()
  const [asset, setAsset] = useState(CRYPTO.find(a => a.id === assetId) ?? CRYPTO[0])
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide ?? 'sell')
  const [qty, setQty] = useState('')
  const [wallet, setWallet] = useState('')
  const [open, setOpen] = useState<Tx | null>(null)
  const [hash, setHash] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const n = Number(qty) || 0
  const rate = side === 'sell' ? asset.sellRate : asset.buyRate
  const total = Math.round(n * rate)
  const min = asset.symbol === 'BTC' ? 0.0005 : asset.symbol === 'ETH' ? 0.01 : 10

  const check = () => {
    if (n < min) return `The minimum trade is ${min} ${asset.symbol}.`
    if (side === 'buy' && total > s.balance) return `You need ${naira(total)} but your wallet has ${naira(s.balance)}.`
    if (side === 'buy' && wallet.trim().length < 20) return `Enter the ${asset.network} address that should receive the coins.`
    return ''
  }

  const start = async () => {
    setBusy(true)
    try {
      if (side === 'sell') {
        const tx = await api.openCryptoSell(asset.id, n)
        setConfirm(false)
        setOpen(tx)
      } else {
        const tx = await api.openCryptoBuy(asset.id, n, wallet.trim())
        setConfirm(false)
        toast('Order placed. Your naira is in escrow until the coins are sent.')
        reset('history', [{ name: 'tx', id: tx.id }])
      }
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (open) {
    return (
      <div className="screen">
        <Header title={`Send ${asset.symbol}`} sub={`Trade ${open.id}`} />
        <section className="panel center-panel">
          <CoinTile asset={asset} size={52} />
          <p className="muted">Send exactly</p>
          <div className="send-amount">{open.details.Amount}</div>
          <p className="muted">on the <strong>{asset.network}</strong> network to:</p>
          <div className="address">
            <code>{asset.depositAddress}</code>
            <button className="btn small" onClick={async () => toast((await copyText(asset.depositAddress)) ? 'Address copied' : 'Select the address to copy it')}>
              <Icon name="copy" size={16} /> Copy
            </button>
          </div>
          <p className="warn-box">Sending on any other network will lose the coins. This address is for this trade only.</p>
        </section>
        <div className="form">
          <label className="field">
            <span>Transaction hash (optional)</span>
            <input id="crypto-hash" placeholder="Paste it to speed up confirmation" value={hash} onChange={e => setHash(e.target.value)} />
          </label>
          <button
            className="btn primary block"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await api.markSent(open.id, hash.trim())
                toast('Thanks. We’ll release your naira once the coins confirm.')
                reset('history', [{ name: 'tx', id: open.id }])
              } catch (e) {
                toast((e as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            I've sent the coins
          </button>
          <p className="fine center">You'll receive {naira(open.amountNgn)} when the escrow confirms.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="screen with-cta">
      <Header title="Trade crypto" sub="Escrow protected" />
      <div className="seg">
        <button className={side === 'sell' ? 'on' : ''} onClick={() => setSide('sell')}>Sell to Yadex</button>
        <button className={side === 'buy' ? 'on' : ''} onClick={() => setSide('buy')}>Buy from Yadex</button>
      </div>

      <div className="coin-picker">
        {CRYPTO.map(a => (
          <button key={a.id} className={`coin-opt ${a.id === asset.id ? 'on' : ''}`} onClick={() => setAsset(a)}>
            <CoinTile asset={a} size={32} />
            <span>{a.symbol}</span>
          </button>
        ))}
      </div>

      <div className="form">
        <div className="rate-line">
          <span>{side === 'sell' ? 'We buy at' : 'We sell at'}</span>
          <strong>{naira(rate)} / {asset.symbol}</strong>
        </div>
        <label className="field">
          <span>Amount of {asset.symbol}</span>
          <div className="money-input">
            <input id="crypto-qty" inputMode="decimal" placeholder={String(min)} value={qty} onChange={e => setQty(e.target.value.replace(/[^\d.]/g, ''))} />
            <em>{asset.symbol}</em>
          </div>
          <small className="hint">Minimum {min} {asset.symbol}. Network: {asset.network}.</small>
        </label>
        {side === 'buy' && (
          <label className="field">
            <span>Your {asset.symbol} wallet address</span>
            <input id="crypto-wallet" placeholder={asset.depositAddress.slice(0, 6) + '…'} value={wallet} onChange={e => setWallet(e.target.value)} />
            <small className="hint">Wallet balance: {naira(s.balance)}</small>
          </label>
        )}

        <section className="steps">
          <h3><Icon name="shield" size={18} /> How escrow works</h3>
          <ol>
            {ESCROW_STEPS[side].map(t => <li key={t}>{t}</li>)}
          </ol>
        </section>
      </div>

      <div className="cta-bar">
        <div className="cta-sum">
          <small>{side === 'sell' ? "You'll receive" : "You'll pay"}</small>
          <strong>{naira(total)}</strong>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const e = check()
            if (e) toast(e)
            else setConfirm(true)
          }}
        >
          {side === 'sell' ? 'Start trade' : 'Place order'}
        </button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={side === 'sell' ? 'Open sell trade' : 'Confirm purchase'}>
        <dl className="kv">
          <dt>{side === 'sell' ? 'You send' : 'You get'}</dt><dd>{n} {asset.symbol}</dd>
          <dt>Network</dt><dd>{asset.network}</dd>
          <dt>Rate</dt><dd>{naira(rate)}</dd>
          {side === 'buy' && (<><dt>To wallet</dt><dd className="mono">{wallet.slice(0, 10)}…{wallet.slice(-6)}</dd></>)}
          <dt className="big">{side === 'sell' ? "You'll receive" : 'Held from wallet'}</dt><dd className="big">{naira(total)}</dd>
        </dl>
        <button className="btn primary block" onClick={start} disabled={busy}>{side === 'sell' ? 'Get escrow address' : 'Pay and place order'}</button>
      </Sheet>
    </div>
  )
}
