import { useEffect, useState } from 'react'
import { BANKS, CARDS, COUNTRIES, CRYPTO, type CountryCode } from '../data'
import { useNav } from '../nav'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { BrandTile, CoinTile, Empty, Header, Row, Sheet, Toggle, copyText, naira, timeAgo } from '../components/ui'
import { tierFor } from './Home'

export function Account() {
  const { s, patch } = useStore()
  const { push, reset } = useNav()
  const [confirmOut, setConfirmOut] = useState(false)
  const { tier } = tierFor(s.lifetimeVolume)
  const unread = s.notices.filter(n => !n.read).length

  return (
    <div className="screen">
      <Header title="Account" />
      <section className="profile-card">
        <span className="avatar big">{s.user.username.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{s.user.fullName}</strong>
          <small>@{s.user.username}</small>
        </div>
        <span className="tier-badge" style={{ background: tier.color }}>{tier.name}</span>
      </section>
      <section className="panel wallet-mini">
        <div><small>Wallet</small><strong>{s.hideBalance ? '₦ • • • •' : naira(s.balance)}</strong></div>
        <button className="btn small" onClick={() => push({ name: 'withdraw' })}>Withdraw</button>
      </section>

      <div className="row-group">
        <h3>Account</h3>
        <Row icon="user" label="Profile" hint="Name, email, phone" onClick={() => push({ name: 'profile' })} />
        <Row icon="bank" label="Bank accounts" hint={`${s.banks.length} saved`} onClick={() => push({ name: 'banks' })} />
        <Row icon="bell" label="Notifications" hint={unread ? `${unread} unread` : 'All caught up'} onClick={() => push({ name: 'notifications' })} />
        <Row icon="users" label="Refer and earn" hint="₦1,000 per friend who trades" onClick={() => push({ name: 'referral' })} />
      </div>
      <div className="row-group">
        <h3>Security</h3>
        <Row icon="lock" label="Transaction PIN" hint={s.pin ? 'Set' : 'Not set'} onClick={() => push({ name: 'pin' })} />
        <Row icon="gear" label="Settings" hint="Two-factor, alerts, privacy" onClick={() => push({ name: 'settings' })} />
      </div>
      <div className="row-group">
        <h3>More</h3>
        <Row icon="chart" label="Rates" onClick={() => push({ name: 'rates' })} />
        <Row icon="help" label="Help and support" onClick={() => push({ name: 'help' })} />
        <Row icon="admin" label="Admin panel" hint="Review cards and pay out (demo)" onClick={() => push({ name: 'admin' })} />
        <Row icon="logout" label="Log out" danger onClick={() => setConfirmOut(true)} right={<span />} />
      </div>

      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title="Log out of Yadex?">
        <p className="muted">You'll need your username and password to log back in.</p>
        <button className="btn danger block" onClick={() => { patch({ loggedIn: false }); reset('home') }}>Log out</button>
      </Sheet>
    </div>
  )
}

export function Profile() {
  const { s, patch } = useStore()
  const { pop, toast } = useNav()
  const [u, setU] = useState(s.user)
  return (
    <div className="screen">
      <Header title="Profile" />
      <div className="form">
        {([['fullName', 'Full name'], ['username', 'Username'], ['email', 'Email'], ['phone', 'Phone number']] as const).map(([k, label]) => (
          <label key={k} className="field">
            <span>{label}</span>
            <input id={`profile-${k}`} value={u[k]} onChange={e => setU({ ...u, [k]: e.target.value })} />
          </label>
        ))}
        <div className="kyc">
          <Icon name="shield" size={20} />
          <div>
            <strong>Verify your identity</strong>
            <small>Add your BVN or NIN to raise your daily limit from ₦500,000 to ₦5,000,000.</small>
          </div>
        </div>
        <button className="btn primary block" onClick={() => { patch({ user: u }); toast('Profile saved'); pop() }}>Save changes</button>
      </div>
    </div>
  )
}

export function Banks() {
  const { s, patch } = useStore()
  const { toast } = useNav()
  const [adding, setAdding] = useState(false)
  const [bank, setBank] = useState(BANKS[2])
  const [num, setNum] = useState('')
  const [resolved, setResolved] = useState('')

  // Real app: resolve the account name through the payout provider's lookup API.
  useEffect(() => {
    setResolved('')
    if (num.length !== 10) return
    const t = window.setTimeout(() => setResolved(s.user.fullName.toUpperCase()), 500)
    return () => window.clearTimeout(t)
  }, [num, bank, s.user.fullName])

  return (
    <div className="screen">
      <Header title="Bank accounts" right={<button className="icon-btn" onClick={() => setAdding(true)} aria-label="Add bank"><Icon name="plus" /></button>} />
      {s.banks.length === 0 && <Empty icon="bank" title="No bank account yet" body="Add one to withdraw your earnings." />}
      <div className="list-panel">
        {s.banks.map(b => (
          <div key={b.id} className="list-item">
            <span className="row-icon"><Icon name="bank" /></span>
            <span className="li-text"><strong>{b.bank}</strong><small>{b.number} · {b.name}</small></span>
            <button className="icon-btn" aria-label={`Remove ${b.bank}`} onClick={() => { patch({ banks: s.banks.filter(x => x.id !== b.id) }); toast('Bank account removed') }}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn ghost block" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Add bank account</button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add bank account">
        <div className="form">
          <label className="field">
            <span>Bank</span>
            <select id="bank-name" value={bank} onChange={e => setBank(e.target.value)}>
              {BANKS.map(b => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Account number</span>
            <input id="bank-number" inputMode="numeric" maxLength={10} placeholder="10 digits" value={num} onChange={e => setNum(e.target.value.replace(/\D/g, ''))} />
            {num.length === 10 && <small className={`hint ${resolved ? 'ok' : ''}`}>{resolved || 'Checking account name…'}</small>}
          </label>
          <button
            className="btn primary block"
            disabled={!resolved}
            onClick={() => {
              patch({ banks: [...s.banks, { id: 'b' + Date.now(), bank, number: num, name: resolved }] })
              setAdding(false)
              setNum('')
              toast('Bank account added')
            }}
          >
            Save account
          </button>
        </div>
      </Sheet>
    </div>
  )
}

export function Pin() {
  const { s, patch } = useStore()
  const { pop, toast } = useNav()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const save = () => {
    if (s.pin && cur !== s.pin) return toast('Your current PIN is wrong.')
    if (!/^\d{4}$/.test(next)) return toast('Your new PIN must be 4 digits.')
    patch({ pin: next })
    toast('PIN updated')
    pop()
  }
  return (
    <div className="screen">
      <Header title="Transaction PIN" />
      <div className="form">
        <p className="muted">You'll enter this PIN to confirm every withdrawal.</p>
        {s.pin && (
          <label className="field"><span>Current PIN</span><input id="pin-current" type="password" inputMode="numeric" maxLength={4} value={cur} onChange={e => setCur(e.target.value.replace(/\D/g, ''))} /></label>
        )}
        <label className="field"><span>New PIN</span><input id="pin-new" type="password" inputMode="numeric" maxLength={4} value={next} onChange={e => setNext(e.target.value.replace(/\D/g, ''))} /></label>
        <button className="btn primary block" onClick={save}>Save PIN</button>
      </div>
    </div>
  )
}

export function Notifications() {
  const { s, patch } = useStore()
  useEffect(() => {
    const t = window.setTimeout(() => patch(st => ({ notices: st.notices.map(n => ({ ...n, read: true })) })), 1200)
    return () => window.clearTimeout(t)
  }, [patch])
  return (
    <div className="screen">
      <Header title="Notifications" />
      {s.notices.length === 0 && <Empty icon="bell" title="No notifications" body="Trade updates and rate alerts show up here." />}
      <div className="list-panel">
        {s.notices.map(n => (
          <div key={n.id} className={`notice ${n.read ? '' : 'unread'}`}>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <small>{timeAgo(n.at)}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Settings() {
  const { s, patch, reset } = useStore()
  const { toast } = useNav()
  return (
    <div className="screen">
      <Header title="Settings" />
      <div className="row-group">
        <Row icon="shield" label="Two-factor login" hint="Ask for a code sent to your phone" right={<Toggle id="set-2fa" label="Two-factor login" on={s.twoFactor} onChange={v => patch({ twoFactor: v })} />} />
        <Row icon="bell" label="Push notifications" hint="Trade updates and rate alerts" right={<Toggle id="set-push" label="Push notifications" on={s.pushNotifications} onChange={v => patch({ pushNotifications: v })} />} />
        <Row icon="eyeOff" label="Hide balance" hint="Mask your wallet on the home screen" right={<Toggle id="set-hide" label="Hide balance" on={s.hideBalance} onChange={v => patch({ hideBalance: v })} />} />
      </div>
      <div className="row-group">
        <h3>Demo</h3>
        <Row icon="swap" label="Reset demo data" hint="Restore the sample balance and trades" onClick={() => { reset(); toast('Demo data reset') }} right={<span />} />
      </div>
    </div>
  )
}

export function Referral() {
  const { s } = useStore()
  const { toast } = useNav()
  return (
    <div className="screen">
      <Header title="Refer and earn" />
      <section className="panel center-panel">
        <Icon name="users" size={34} />
        <h2>Earn ₦1,000 per friend</h2>
        <p className="muted">When someone signs up with your code and completes a trade of $50 or more, you both get ₦1,000.</p>
        <div className="address">
          <code className="big-code">{s.user.referral}</code>
          <button className="btn small" onClick={async () => toast((await copyText(s.user.referral)) ? 'Code copied' : 'Select the code to copy it')}><Icon name="copy" size={16} /> Copy</button>
        </div>
      </section>
      <div className="stat-pair">
        <div><small>Friends joined</small><strong>3</strong></div>
        <div><small>Earned</small><strong>₦2,000</strong></div>
      </div>
    </div>
  )
}

export function Rates() {
  const [country, setCountry] = useState<CountryCode>('US')
  return (
    <div className="screen">
      <Header title="Today's rates" sub="Naira paid per unit" />
      <div className="chips scroll">
        {(Object.keys(COUNTRIES) as CountryCode[]).map(k => (
          <button key={k} className={`chip ${k === country ? 'on' : ''}`} onClick={() => setCountry(k)}>{COUNTRIES[k].flag} {k}</button>
        ))}
      </div>
      <div className="list-panel">
        {CARDS.flatMap(b => b.categories.filter(c => c.rates[country]).map(c => (
          <div key={c.id} className="list-item">
            <BrandTile brand={b} size={34} />
            <span className="li-text"><strong>{c.name}</strong></span>
            <span className="li-rate">{naira(c.rates[country]!)}<small>/ {COUNTRIES[country].symbol}1</small></span>
          </div>
        )))}
      </div>
      <h3 className="section-label">Crypto</h3>
      <div className="list-panel">
        {CRYPTO.map(a => (
          <div key={a.id} className="list-item">
            <CoinTile asset={a} size={34} />
            <span className="li-text"><strong>{a.symbol}</strong><small>Buy {naira(a.buyRate)}</small></span>
            <span className="li-rate">{naira(a.sellRate)}<small>we buy</small></span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FAQ = [
  ['How long does a card take?', 'Most cards are checked within 5 to 15 minutes between 7am and 11pm. You get a notification as soon as it is approved.'],
  ['Why was my card declined?', 'Usually because the code was already used, the photo was unclear, or the card type did not match the category you picked. The reason is shown on the transaction.'],
  ['How does escrow work for crypto?', 'When you sell, you send coins to a one-time Yadex address and we release naira once they confirm. When you buy, your naira is held until we send the coins.'],
  ['What does a withdrawal cost?', 'A flat ₦50 per withdrawal to any Nigerian bank.'],
]

export function Help() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="screen">
      <Header title="Help and support" />
      <div className="list-panel">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="faq">
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              <span>{q}</span><Icon name={open === i ? 'x' : 'plus'} size={16} />
            </button>
            {open === i && <p>{a}</p>}
          </div>
        ))}
      </div>
      <section className="panel">
        <h2 className="panel-title">Talk to us</h2>
        <p className="muted">Live chat and WhatsApp support will be connected here. Support email: <span className="mono">support@yadex.app</span></p>
      </section>
    </div>
  )
}
