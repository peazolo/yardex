import { useState } from 'react'
import { WITHDRAW_FEE } from '../data'
import { useNav } from '../nav'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Header, Sheet, naira } from '../components/ui'

export function Withdraw() {
  const { s, api } = useStore()
  const { push, reset, toast } = useNav()
  const [amount, setAmount] = useState('')
  const [bankId, setBankId] = useState(s.banks[0]?.id ?? '')
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [busy, setBusy] = useState(false)
  const value = Number(amount) || 0
  const bank = s.banks.find(b => b.id === bankId)
  const max = Math.max(0, s.balance - WITHDRAW_FEE)

  const next = () => {
    if (!bank) return toast('Add a bank account first.')
    if (value < 1000) return toast('The minimum withdrawal is ₦1,000.')
    if (value > max) return toast(`You can withdraw up to ${naira(max)} after the ${naira(WITHDRAW_FEE)} fee.`)
    if (!s.hasPin) return toast('Set a transaction PIN in Account first.')
    setPin('')
    setPinError('')
    setPinOpen(true)
  }

  const press = async (d: string) => {
    if (busy) return
    if (d === 'del') return setPin(p => p.slice(0, -1))
    const p = (pin + d).slice(0, 4)
    setPin(p)
    if (p.length < 4) return
    setBusy(true)
    try {
      const tx = await api.withdraw(bank!.id, value, p)
      setPinOpen(false)
      toast('Withdrawal requested')
      reset('history', [{ name: 'tx', id: tx.id }])
    } catch (e) {
      const msg = (e as Error).message
      if (msg.startsWith('Wrong PIN') || msg.startsWith('Too many')) {
        setPinError(msg)
        window.setTimeout(() => setPin(''), 300)
      } else {
        setPinOpen(false)
        toast(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <Header title="Withdraw" />
      <section className="panel withdraw-bal">
        <small>Available</small>
        <strong>{naira(s.balance)}</strong>
      </section>
      <div className="form">
        <label className="field">
          <span>Amount</span>
          <div className="money-input">
            <em>₦</em>
            <input id="withdraw-amount" inputMode="numeric" placeholder="0" value={amount ? Number(amount).toLocaleString() : ''} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="chips tight">
            {[5000, 20000, 50000].map(v => <button key={v} className="chip" onClick={() => setAmount(String(Math.min(v, max)))}>{naira(v)}</button>)}
            <button className="chip" onClick={() => setAmount(String(max))}>Max</button>
          </div>
        </label>

        <div className="field">
          <span>Pay to</span>
          {s.banks.map(b => (
            <button key={b.id} className={`bank-opt ${b.id === bankId ? 'on' : ''}`} onClick={() => setBankId(b.id)}>
              <Icon name="bank" />
              <span><strong>{b.bank}</strong><small>{b.number} · {b.name}</small></span>
              <span className="radio" />
            </button>
          ))}
          <button className="btn ghost block" onClick={() => push({ name: 'banks' })}>
            <Icon name="plus" size={18} /> Add bank account
          </button>
        </div>

        <dl className="kv small">
          <div className="kv-row"><dt>Fee</dt><dd>{naira(WITHDRAW_FEE)}</dd></div>
          <div className="kv-row"><dt>Total from wallet</dt><dd>{naira(value ? value + WITHDRAW_FEE : 0)}</dd></div>
          <div className="kv-row"><dt>Arrives</dt><dd>Usually within 5 minutes</dd></div>
        </dl>
        <button className="btn primary block" onClick={next}>Withdraw {value ? naira(value) : ''}</button>
      </div>

      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title="Enter your PIN">
        {api.mode === 'demo' && <p className="muted center">Demo PIN is 1234</p>}
        <div className="pin-dots" aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => <span key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        {pinError && <p className="form-error center">{pinError}</p>}
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
            k ? <button key={i} onClick={() => press(k)} aria-label={k === 'del' ? 'Delete' : k}>{k === 'del' ? '⌫' : k}</button> : <span key={i} />,
          )}
        </div>
      </Sheet>
    </div>
  )
}
