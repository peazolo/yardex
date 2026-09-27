import { useState, type FormEvent } from 'react'
import { useStore } from '../store'

export function Auth() {
  const { s, patch } = useStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState(s.user.username)
  const [password, setPassword] = useState('demo1234')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (username.trim().length < 3) return setError('Usernames need at least 3 characters.')
    if (password.length < 6) return setError('Passwords need at least 6 characters.')
    if (mode === 'signup' && !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    setError('')
    patch(st => ({
      loggedIn: true,
      user: mode === 'signup' ? { ...st.user, username: username.trim(), email, fullName: username.trim() } : { ...st.user, username: username.trim() },
    }))
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
        <label className="field">
          <span>Username</span>
          <input id="auth-username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
        </label>
        {mode === 'signup' && (
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
        <button className="btn primary block" type="submit">
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <p className="fine">Demo mode: any username and a 6+ character password will work.</p>
      </form>
    </div>
  )
}
