import { useState, type FormEvent } from 'react'
import { useStore } from '../store'

export function Auth() {
  const { s, api } = useStore()
  const live = api.mode === 'live'
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState(live ? '' : s.user.username)
  const [password, setPassword] = useState(live ? '' : 'demo1234')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  // the live backend logs in by email; the demo by username
  const needsEmail = live || mode === 'signup'
  const needsUsername = !live || mode === 'signup'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (needsUsername && !/^[a-zA-Z0-9_.]{3,24}$/.test(username.trim())) return setError('Usernames need 3 to 24 letters, numbers, dots or underscores.')
    if (needsEmail && !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 6) return setError('Passwords need at least 6 characters.')
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const msg = await api.signUp(email, username.trim().toLowerCase(), password)
        if (msg) {
          setInfo(msg)
          setMode('login')
        }
      } else {
        await api.signIn(live ? email : username, password)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <span className="logo-mark">Y</span>
        <h1>Yadex</h1>
        <p>Sell gift cards and crypto. Get paid in naira, fast.</p>
        <ul className="auth-points">
          <li>Every trade held in escrow until it's verified</li>
          <li>Payouts straight to your Nigerian bank</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>
        {needsUsername && (
          <label className="field">
            <span>Username</span>
            <input id="auth-username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
          </label>
        )}
        {needsEmail && (
          <label className="field">
            <span>Email</span>
            <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          </label>
        )}
        <label className="field">
          <span>Password</span>
          <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {error && <p className="form-error">{error}</p>}
        {info && <p className="hint ok">{info}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        {!live && <p className="fine">Demo mode: any username and a 6+ character password will work.</p>}
      </form>
    </div>
  )
}
