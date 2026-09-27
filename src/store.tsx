import { createContext, useContext, type ReactNode } from 'react'
import { useDemoBackend } from './backend/demo'
import { liveConfigured, useLiveBackend } from './backend/live'
import type { Api, State } from './backend/types'

export type { Bank, Notice, State, Tx, TxStatus, TxType } from './backend/types'

type Store = { s: State; api: Api }
const Ctx = createContext<Store | null>(null)

// With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set the app talks to Supabase;
// without them it runs the in-browser demo backend.
function LiveProvider({ children }: { children: ReactNode }) {
  const { s, api, ready } = useLiveBackend()
  if (!ready) return <div className="boot">Yadex</div>
  return <Ctx.Provider value={{ s, api }}>{children}</Ctx.Provider>
}

function DemoProvider({ children }: { children: ReactNode }) {
  const value = useDemoBackend()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const StoreProvider = liveConfigured ? LiveProvider : DemoProvider

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside provider')
  return v
}
