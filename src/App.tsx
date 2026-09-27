import { NavProvider, useNav, type Route, type Tab } from './nav'
import { StoreProvider, useStore } from './store'
import { Icon, type IconName } from './components/Icon'
import { Auth } from './screens/Auth'
import { Home } from './screens/Home'
import { Sell } from './screens/Sell'
import { CardSell } from './screens/CardSell'
import { Crypto } from './screens/Crypto'
import { History, TxDetail } from './screens/History'
import { Withdraw } from './screens/Withdraw'
import { Account, Banks, Help, Notifications, Pin, Profile, Rates, Referral, Settings } from './screens/Account'
import { Admin } from './screens/Admin'

function screenFor(r: Route) {
  switch (r.name) {
    case 'card': return <CardSell key={r.brandId} brandId={r.brandId} />
    case 'crypto': return <Crypto key={`${r.assetId}-${r.side}`} assetId={r.assetId} side={r.side} />
    case 'tx': return <TxDetail id={r.id} />
    case 'withdraw': return <Withdraw />
    case 'account': return <Account />
    case 'profile': return <Profile />
    case 'banks': return <Banks />
    case 'pin': return <Pin />
    case 'notifications': return <Notifications />
    case 'settings': return <Settings />
    case 'referral': return <Referral />
    case 'rates': return <Rates />
    case 'help': return <Help />
    case 'admin': return <Admin />
  }
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'sell', label: 'Sell', icon: 'tag' },
  { id: 'history', label: 'Transactions', icon: 'list' },
]

function Shell() {
  const { s } = useStore()
  const { tab, stack, setTab, toastMsg } = useNav()
  if (!s.loggedIn) return <Auth />
  const top = stack[stack.length - 1]
  const root = tab === 'home' ? <Home /> : tab === 'sell' ? <Sell /> : <History />

  return (
    <div className="app">
      <main className={top ? 'stacked' : 'has-tabs'}>{top ? screenFor(top) : root}</main>
      {!top && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={22} stroke={tab === t.id ? 2.2 : 1.8} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}

export function App() {
  return (
    <StoreProvider>
      <NavProvider>
        <Shell />
      </NavProvider>
    </StoreProvider>
  )
}
