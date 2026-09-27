import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Tab = 'home' | 'sell' | 'history'

export type Route =
  | { name: 'card'; brandId: string }
  | { name: 'crypto'; assetId?: string; side?: 'buy' | 'sell' }
  | { name: 'tx'; id: string }
  | { name: 'withdraw' }
  | { name: 'account' }
  | { name: 'profile' }
  | { name: 'banks' }
  | { name: 'pin' }
  | { name: 'notifications' }
  | { name: 'settings' }
  | { name: 'referral' }
  | { name: 'rates' }
  | { name: 'help' }
  | { name: 'admin' }

type Nav = {
  tab: Tab
  stack: Route[]
  setTab: (t: Tab) => void
  push: (r: Route) => void
  pop: () => void
  /** replace the whole stack, e.g. after finishing a flow */
  reset: (tab: Tab, stack?: Route[]) => void
  toast: (msg: string) => void
  toastMsg: string | null
}

const Ctx = createContext<Nav | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('home')
  const [stack, setStack] = useState<Route[]>([])
  const [toastMsg, setToast] = useState<string | null>(null)

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    setStack([])
    window.scrollTo(0, 0)
  }, [])
  const push = useCallback((r: Route) => {
    setStack(s => [...s, r])
    window.scrollTo(0, 0)
  }, [])
  const pop = useCallback(() => setStack(s => s.slice(0, -1)), [])
  const reset = useCallback((t: Tab, st: Route[] = []) => {
    setTabState(t)
    setStack(st)
    window.scrollTo(0, 0)
  }, [])
  const toast = useCallback((m: string) => {
    setToast(m)
    window.setTimeout(() => setToast(cur => (cur === m ? null : cur)), 2600)
  }, [])

  return <Ctx.Provider value={{ tab, stack, setTab, push, pop, reset, toast, toastMsg }}>{children}</Ctx.Provider>
}

export function useNav() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNav outside provider')
  return v
}
