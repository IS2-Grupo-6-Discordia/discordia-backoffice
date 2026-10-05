import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import type { StaffUser } from "@/api/types"
import { getToken, loadToken } from "@/api/client"
import { STAFF_ROLE, logout as apiLogout } from "@/api/auth"

const USER_STORAGE_KEY = "discordia_backoffice_user"

interface AuthState {
  user: StaffUser | null
  isLoggedIn: boolean
  isLoading: boolean
  setUser: (user: StaffUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

function readStoredUser(): StaffUser | null {
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY)
    if (!saved) return null
    const user = JSON.parse(saved) as StaffUser
    return user.role === STAFF_ROLE ? user : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<StaffUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      await loadToken()
      if (!active) return
      if (getToken()) setUserState(readStoredUser())
      setIsLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const setUser = useCallback((u: StaffUser) => {
    setUserState(u)
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u))
    } catch {}
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUserState(null)
    try {
      localStorage.removeItem(USER_STORAGE_KEY)
    } catch {}
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
