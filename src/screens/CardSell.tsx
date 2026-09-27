import { useMemo, useRef, useState } from 'react'
import { CARDS, COUNTRIES, COUPONS, type CountryCode } from '../data'
import { useNav } from '../nav'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { BrandTile, Header, Sheet, naira, readImage } from '../components/ui'

export function CardSell({ brandId }: { brandId: string }) {
  const brand = CARDS.find(c => c.id === brandId) ?? CARDS[0]
  const { api } = useStore()
  const { reset, toast } = useNav()

  const [catId, setCatId] = useState(brand.categories[0].id)
  const category = brand.categories.find(c => c.id === catId) ?? brand.categories[0]
  const countries = Object.keys(category.rates) as CountryCode[]
  const [country, setCountry] = useState<CountryCode>(countries[0])
  const cc = countries.includes(country) ? country : countries[0]
  const cur = COUNTRIES[cc]
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'physical' | 'ecode'>('physical')
  const [code, setCode] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [coupon, setCoupon] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const value = Number(amount) || 0
  const rate = category.rates[cc] ?? 0
  const couponKey = coupon.trim().toUpperCase()
  // the server re-checks the coupon (and whether it was already used) on submit
  const couponOk = !!COUPONS[couponKey]
  const bonus = couponOk ? COUPONS[couponKey].bonusPerUnit : 0
  const payout = useMemo(() => Math.round(value * (rate + bonus)), [value, rate, bonus])

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const next = await Promise.all(Array.from(files).slice(0, 4 - images.length).map(f => readImage(f)))
    setImages(imgs => [...imgs, ...next].slice(0, 4))
  }

  const validate = () => {
    if (!value) return 'Enter the card value.'
    if (value < brand.min || value > brand.max) return `${brand.name} cards must be between ${cur.symbol}${brand.min} and ${cur.symbol}${brand.max.toLocaleString()}.`
    if (kind === 'ecode' && code.trim().length < 8 && images.length === 0) return 'Enter the card code or upload a screenshot of it.'
    if (kind === 'physical' && images.length === 0) return 'Upload a clear photo of the card with the code scratched.'
    if (coupon && !couponOk) return 'That coupon code is not valid or has been used.'
    return ''
  }

  const submit = async () => {
    setBusy(true)
    try {
      const tx = await api.sellCard({ brandId: brand.id, categoryId: category.id, country: cc, value, kind, code: kind === 'ecode' ? code.trim() : '', images, coupon: couponKey })
      setConfirm(false)
      toast('Card submitted. We’ll notify you when it’s approved.')
      reset('history', [{ name: 'tx', id: tx.id }])
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen with-cta">
      <Header title={`Sell ${brand.name}`} />
      <section className="brand-hero" style={{ background: brand.color, color: brand.ink }}>
        <BrandTile brand={brand} size={52} />
        <div>
          <small>Settlement rate</small>
          <strong>
            {naira(rate)} <span>per {cur.symbol}1</span>
          </strong>
        </div>
      </section>

      <div className="form">
        <label className="field">
          <span>Category</span>
          <select id="card-category" value={catId} onChange={e => setCatId(e.target.value)}>
            {brand.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Card country</span>
          <div className="chips">
            {countries.map(k => (
              <button key={k} className={`chip ${k === cc ? 'on' : ''}`} onClick={() => setCountry(k)}>
                {COUNTRIES[k].flag} {k} <small>{naira(category.rates[k] ?? 0)}</small>
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Card value ({cur.currency})</span>
          <div className="money-input">
            <em>{cur.symbol}</em>
            <input id="card-amount" inputMode="decimal" placeholder={`${brand.min}`} value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div className="chips tight">
            {[25, 50, 100, 200, 500].filter(v => v >= brand.min && v <= brand.max).map(v => (
              <button key={v} className={`chip ${value === v ? 'on' : ''}`} onClick={() => setAmount(String(v))}>
                {cur.symbol}{v}
              </button>
            ))}
          </div>
        </label>

        <div className="field">
          <span>Card type</span>
          <div className="seg">
            <button className={kind === 'physical' ? 'on' : ''} onClick={() => setKind('physical')}>Physical card</button>
            <button className={kind === 'ecode' ? 'on' : ''} onClick={() => setKind('ecode')}>E-code</button>
          </div>
        </div>

        {kind === 'ecode' && (
          <label className="field">
            <span>Card code</span>
            <textarea id="card-code" rows={2} placeholder="e.g. X4R7-9KQL-2MWP-8TZD" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          </label>
        )}

        <div className="field">
          <span>{kind === 'physical' ? 'Card photos' : 'Screenshot or receipt (optional)'}</span>
          <div className="uploads">
            {images.map((src, i) => (
              <div key={i} className="thumb">
                <img src={src} alt={`Card upload ${i + 1}`} />
                <button aria-label="Remove photo" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <button className="upload-btn" onClick={() => fileRef.current?.click()}>
                <Icon name="upload" size={22} />
                <span>Upload</span>
              </button>
            )}
          </div>
          <input ref={fileRef} id="card-files" type="file" accept="image/*" multiple hidden onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
          <small className="hint">Show the full card and the scratched code clearly. Up to 4 photos.</small>
        </div>

        <label className="field">
          <span>Coupon code</span>
          <input id="card-coupon" placeholder="Optional, e.g. YADEX10" value={coupon} onChange={e => setCoupon(e.target.value)} />
          {coupon && <small className={couponOk ? 'hint ok' : 'hint bad'}>{couponOk ? COUPONS[couponKey].label : 'Not a valid coupon'}</small>}
        </label>
      </div>

      <div className="cta-bar">
        <div className="cta-sum">
          <small>You'll receive</small>
          <strong>{naira(payout)}</strong>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const e = validate()
            if (e) toast(e)
            else setConfirm(true)
          }}
        >
          Continue
        </button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Confirm your trade">
        <dl className="kv">
          <dt>Card</dt><dd>{brand.name}</dd>
          <dt>Category</dt><dd>{category.name}</dd>
          <dt>Country</dt><dd>{cur.flag} {cur.name}</dd>
          <dt>Value</dt><dd>{cur.symbol}{value}</dd>
          <dt>Type</dt><dd>{kind === 'physical' ? 'Physical' : 'E-code'}</dd>
          <dt>Rate</dt><dd>{naira(rate + bonus)} / {cur.symbol}1</dd>
          <dt className="big">You'll receive</dt><dd className="big">{naira(payout)}</dd>
        </dl>
        <p className="fine">Your card is held by Yadex while we verify it. Payment lands in your wallet once it's approved. If the card is invalid or already used, the trade is declined.</p>
        <button className="btn primary block" onClick={submit} disabled={busy}>{busy ? 'Uploading…' : 'Submit card'}</button>
      </Sheet>
    </div>
  )
}
