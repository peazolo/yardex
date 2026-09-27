import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { useNav } from '../nav'
import type { CardBrand, CryptoAsset } from '../data'
import type { TxStatus } from '../store'

export const naira = (n: number, opts: { sign?: boolean } = {}) => {
  const s = '₦' + Math.abs(Math.round(n)).toLocaleString('en-NG')
  if (!opts.sign) return (n < 0 ? '-' : '') + s
  return (n < 0 ? '−' : '+') + s
}

export const timeAgo = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export const fmtDate = (t: number) =>
  new Date(t).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export function Header({ title, right, sub }: { title: string; right?: ReactNode; sub?: string }) {
  const { pop } = useNav()
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={pop} aria-label="Back">
        <Icon name="back" size={22} />
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  )
}

export function BrandTile({ brand, size = 44 }: { brand: CardBrand; size?: number }) {
  return (
    <span className="brand-tile" style={{ width: size, height: size, background: brand.color, color: brand.ink, fontSize: size * 0.42 }}>
      {brand.mono}
    </span>
  )
}

export function CoinTile({ asset, size = 40 }: { asset: CryptoAsset; size?: number }) {
  return (
    <span className="coin-tile" style={{ width: size, height: size, background: asset.color, fontSize: size * 0.3 }}>
      {asset.symbol.slice(0, asset.symbol.length > 3 ? 4 : 3)}
    </span>
  )
}

const STATUS: Record<TxStatus, { label: string; cls: string }> = {
  pending: { label: 'Under review', cls: 'warn' },
  in_escrow: { label: 'In escrow', cls: 'info' },
  completed: { label: 'Completed', cls: 'ok' },
  rejected: { label: 'Declined', cls: 'bad' },
}

export function StatusPill({ status }: { status: TxStatus }) {
  const s = STATUS[status]
  return <span className={`pill ${s.cls}`}>{s.label}</span>
}

export function Row({ icon, label, hint, onClick, right, danger }: { icon: IconName; label: string; hint?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  return (
    <button className={`row ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="row-icon">
        <Icon name={icon} size={19} />
      </span>
      <span className="row-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      {right ?? <Icon name="chevron" size={18} className="muted" />}
    </button>
  )
}

export function Toggle({ id, on, onChange, label }: { id: string; on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button id={id} role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Shrinks an uploaded photo so it fits comfortably in local storage. */
export function readImage(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => resolve(String(reader.result))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.72))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
