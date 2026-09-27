import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CARDS, CRYPTO, type CardBrand, type CountryCode, type CryptoAsset } from '../data'
import type { Api, State, Tx } from './types'

// Supabase-backed implementation. All money moves happen in the database functions
// (supabase/migrations/*_init.sql); this file only calls them and reads back the results.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const liveConfigured = !!(url && key)

let client: SupabaseClient | null = null
const sb = () => (client ??= createClient(url!, key!))

const BUCKET = 'card-images'
const PROFILE_COLUMNS = 'id, username, full_name, email, phone, referral_code, is_admin, balance, lifetime_volume, hide_balance, two_factor, push_notifications'

const empty: State = {
  loggedIn: false, isAdmin: false, hasPin: false, balance: 0, lifetimeVolume: 0,
  hideBalance: false, twoFactor: false, pushNotifications: true,
  user: { username: '', fullName: '', email: '', phone: '', referral: '' },
  banks: [], txs: [], notices: [],
}

/** Supabase errors carry the message raised by the database function; surface it as-is. */
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

type TradeRow = {
  id: string; type: Tx['type']; status: Tx['status']; title: string; subtitle: string; amount_ngn: number
  details: Record<string, string>; image_paths: string[]; note: string | null; created_at: string
  trade_events: { label: string; created_at: string }[]
  owner: { username: string } | null
}

const toTx = (r: TradeRow, image?: string): Tx => ({
  id: r.id, type: r.type, status: r.status, title: r.title, subtitle: r.subtitle, amountNgn: Number(r.amount_ngn),
  details: r.details, note: r.note ?? undefined, createdAt: Date.parse(r.created_at), image, username: r.owner?.username,
  timeline: [...(r.trade_events ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(e => ({ label: e.label, at: Date.parse(e.created_at) })),
})

/** Replaces the bundled demo catalogue with the live rate sheet, in place, so every screen sees it. */
async function loadCatalogue() {
  const [brands, cats, rates, coins] = await Promise.all([
    sb().from('card_brands').select('*').eq('active', true).order('sort'),
    sb().from('card_categories').select('*').eq('active', true).order('sort'),
    sb().from('card_rates').select('*'),
    sb().from('crypto_assets').select('*').eq('active', true).order('sort'),
  ])
  const b = check(brands) as { id: string; name: string; mono: string; color: string; ink: string; hot: boolean; min_value: number; max_value: number }[]
  const c = check(cats) as { id: string; brand_id: string; name: string }[]
  const r = check(rates) as { category_id: string; country: CountryCode; rate: number }[]
  const k = check(coins) as { id: string; symbol: string; name: string; color: string; network: string; buy_rate: number; sell_rate: number; deposit_address: string; decimals: number }[]
  if (!b.length) return
  const cards: CardBrand[] = b.map(x => ({
    id: x.id, name: x.name, mono: x.mono, color: x.color, ink: x.ink, hot: x.hot, min: Number(x.min_value), max: Number(x.max_value),
    categories: c.filter(y => y.brand_id === x.id).map(y => ({
      id: y.id, name: y.name, rates: Object.fromEntries(r.filter(z => z.category_id === y.id).map(z => [z.country, Number(z.rate)])),
    })),
  })).filter(x => x.categories.length)
  const crypto: CryptoAsset[] = k.map(x => ({
    id: x.id, symbol: x.symbol, name: x.name, color: x.color, network: x.network, buyRate: Number(x.buy_rate), sellRate: Number(x.sell_rate),
    depositAddress: x.deposit_address, decimals: x.decimals,
  }))
  CARDS.splice(0, CARDS.length, ...cards)
  if (crypto.length) CRYPTO.splice(0, CRYPTO.length, ...crypto)
}

async function dataUrlToBlob(src: string) {
  return (await fetch(src)).blob()
}

export function useLiveBackend(): { s: State; api: Api; ready: boolean } {
  const [s, setS] = useState<State>(empty)
  const [ready, setReady] = useState(false)
  const uid = useRef<string | null>(null)

  const load = useCallback(async () => {
    const id = uid.current
    if (!id) return setS(empty)
    const TRADE_SELECT = '*, trade_events(label, created_at), owner:profiles!trades_user_id_fkey(username)'
    const p = check(await sb().from('profiles').select(PROFILE_COLUMNS).eq('id', id).single()) as Record<string, never>
    const [banks, trades, notes, pin, review] = await Promise.all([
      sb().from('bank_accounts').select('id, bank, number, name').eq('user_id', id).order('created_at'),
      sb().from('trades').select(TRADE_SELECT).eq('user_id', id).order('created_at', { ascending: false }).limit(200),
      sb().from('notifications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
      sb().rpc('has_pin'),
      // admins also get every user's recent trades for the review queue
      p.is_admin ? sb().from('trades').select(TRADE_SELECT).order('created_at', { ascending: false }).limit(300) : Promise.resolve({ data: null, error: null }),
    ])
    const rows = check(trades) as unknown as TradeRow[]
    const reviewRows = (check(review) ?? null) as unknown as TradeRow[] | null
    const paths = [...rows, ...(reviewRows ?? [])].map(r => r.image_paths?.[0]).filter(Boolean) as string[]
    const signed = paths.length ? (await sb().storage.from(BUCKET).createSignedUrls([...new Set(paths)], 3600)).data ?? [] : []
    const urlFor = new Map(signed.map(x => [x.path, x.signedUrl]))
    const mapRow = (r: TradeRow) => toTx(r, r.image_paths?.[0] ? urlFor.get(r.image_paths[0]) ?? undefined : undefined)
    setS({
      loggedIn: true,
      isAdmin: p.is_admin,
      hasPin: !!check(pin),
      balance: Number(p.balance),
      lifetimeVolume: Number(p.lifetime_volume),
      hideBalance: p.hide_balance,
      twoFactor: p.two_factor,
      pushNotifications: p.push_notifications,
      user: { username: p.username, fullName: p.full_name, email: p.email, phone: p.phone, referral: p.referral_code },
      banks: check(banks) as State['banks'],
      txs: rows.map(mapRow),
      reviewTxs: reviewRows ? reviewRows.map(mapRow) : undefined,
      notices: (check(notes) as { id: string; title: string; body: string; read: boolean; created_at: string }[]).map(n => ({ id: n.id, title: n.title, body: n.body, read: n.read, at: Date.parse(n.created_at) })),
    })
  }, [])

  useEffect(() => {
    let alive = true
    loadCatalogue().catch(() => { /* keep the bundled rates if the catalogue can't load */ })
    sb().auth.getSession().then(async ({ data }) => {
      uid.current = data.session?.user.id ?? null
      await load().catch(() => setS(empty))
      if (alive) setReady(true)
    })
    const { data: sub } = sb().auth.onAuthStateChange((_e, session) => {
      const next = session?.user.id ?? null
      if (next === uid.current) return
      uid.current = next
      load().catch(() => setS(empty))
    })
    // pick up approvals made by the admin while the app was in the background
    const onFocus = () => document.visibilityState === 'visible' && load().catch(() => {})
    document.addEventListener('visibilitychange', onFocus)
    const timer = window.setInterval(onFocus, 30_000)
    return () => {
      alive = false
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(timer)
    }
  }, [load])

  const api = useMemo<Api>(() => {
    const run = async <T,>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => {
      const data = check(await p)
      await load()
      return data
    }
    const txById = async (id: string) => {
      await load()
      const r = check(await sb().from('trades').select('*, trade_events(label, created_at)').eq('id', id).single()) as unknown as TradeRow
      return toTx(r)
    }

    return {
      mode: 'live',
      async signIn(email, password) {
        const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message)
        uid.current = data.user.id
        await load()
      },
      async signUp(email, username, password) {
        const { data, error } = await sb().auth.signUp({ email: email.trim(), password, options: { data: { username, full_name: username } } })
        if (error) throw new Error(error.message)
        if (!data.session) return 'Check your email and tap the link to confirm your account, then log in.'
        uid.current = data.user!.id
        await load()
      },
      async signOut() {
        await sb().auth.signOut()
        uid.current = null
        setS(empty)
      },
      refresh: load,

      async sellCard(i) {
        const paths: string[] = []
        for (const img of i.images) {
          const path = `${uid.current}/${crypto.randomUUID()}.jpg`
          check(await sb().storage.from(BUCKET).upload(path, await dataUrlToBlob(img), { contentType: 'image/jpeg' }))
          paths.push(path)
        }
        const row = check(await sb().rpc('submit_giftcard_trade', {
          p_category_id: i.categoryId, p_country: i.country, p_value: i.value, p_kind: i.kind,
          p_code: i.code || null, p_image_paths: paths, p_coupon: i.coupon || null,
        })) as { id: string }
        return txById(row.id)
      },
      async openCryptoSell(assetId, amount) {
        const row = check(await sb().rpc('open_crypto_sell', { p_asset_id: assetId, p_amount: amount })) as { id: string }
        return txById(row.id)
      },
      async markSent(id, hash) {
        await run(sb().rpc('mark_crypto_sent', { p_trade_id: id, p_hash: hash || null }))
      },
      async openCryptoBuy(assetId, amount, wallet) {
        const row = check(await sb().rpc('open_crypto_buy', { p_asset_id: assetId, p_amount: amount, p_wallet: wallet })) as { id: string }
        return txById(row.id)
      },
      async withdraw(bankId, amount, pin) {
        const row = check(await sb().rpc('request_withdrawal', { p_bank_id: bankId, p_amount: amount, p_pin: pin })) as { id: string | null } | null
        // the database returns an empty row for a wrong PIN so the failed-attempt counter is kept
        if (!row?.id) throw new Error('Wrong PIN. Try again. After 5 wrong tries, withdrawals lock for 15 minutes.')
        return txById(row.id)
      },
      async setPin(cur, next) {
        await run(sb().rpc('set_pin', { p_current: cur || null, p_new: next }))
      },
      async addBank(bank, number, name) {
        await run(sb().from('bank_accounts').insert({ bank, number, name }))
      },
      async removeBank(id) {
        await run(sb().from('bank_accounts').delete().eq('id', id))
      },
      async updateProfile(u) {
        await run(sb().from('profiles').update({ full_name: u.fullName, username: u.username.toLowerCase(), phone: u.phone }).eq('id', uid.current!))
      },
      async setPrefs(p) {
        setS(st => ({ ...st, ...p }))
        const cols: Record<string, boolean> = {}
        if (p.hideBalance !== undefined) cols.hide_balance = p.hideBalance
        if (p.twoFactor !== undefined) cols.two_factor = p.twoFactor
        if (p.pushNotifications !== undefined) cols.push_notifications = p.pushNotifications
        await run(sb().from('profiles').update(cols).eq('id', uid.current!))
      },
      async markAllRead() {
        await run(sb().rpc('mark_notifications_read'))
      },
      async approve(id, finalAmount) {
        await run(sb().rpc('admin_approve', { p_trade_id: id, p_final_amount: finalAmount ?? null }))
      },
      async reject(id, reason) {
        await run(sb().rpc('admin_reject', { p_trade_id: id, p_reason: reason }))
      },
    }
  }, [load])

  return { s, api, ready }
}
