import { api, ApiError, getRefreshToken, setRefreshToken, setToken } from "./client"
import type { StaffUser } from "./types"

export const STAFF_ROLE = "staff"
export const NOT_STAFF_MESSAGE = "Esta cuenta no tiene acceso al backoffice."

interface BackendUser {
  id: string
  name: string
  email: string
  role?: string
  avatar_url?: string | null
}

interface LoginApiResponse {
  user: BackendUser
  access_token: string
  refresh_token: string
}

interface TwoFactorChallengeApiResponse {
  two_factor_required: true
  challenge_token: string
}

export class TwoFactorRequired extends Error {
  challengeToken: string

  constructor(challengeToken: string) {
    super("two_factor_required")
    this.challengeToken = challengeToken
  }
}

async function openStaffSession(res: LoginApiResponse): Promise<StaffUser> {
  await setToken(res.access_token)
  await setRefreshToken(res.refresh_token)
  const user = toStaffUser(res.user)
  if (user.role !== STAFF_ROLE) {
    await logout()
    throw new ApiError(403, NOT_STAFF_MESSAGE, NOT_STAFF_MESSAGE)
  }
  return user
}

export async function completeTwoFactorLogin(
  challengeToken: string,
  secondFactor: { code: string } | { recoveryCode: string },
): Promise<{ user: StaffUser; recoveryCodeUsed: boolean; recoveryCodesRemaining: number }> {
  const res = await api<
    LoginApiResponse & { recovery_code_used: boolean; recovery_codes_remaining: number }
  >("/auth/login/2fa", {
    method: "POST",
    body: JSON.stringify({
      challenge_token: challengeToken,
      ...("code" in secondFactor
        ? { code: secondFactor.code }
        : { recovery_code: secondFactor.recoveryCode }),
    }),
  })
  const user = await openStaffSession(res)
  return {
    user,
    recoveryCodeUsed: res.recovery_code_used,
    recoveryCodesRemaining: res.recovery_codes_remaining,
  }
}

function toStaffUser(user: BackendUser): StaffUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? "user",
    avatarUrl: user.avatar_url ?? null,
  }
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    await api("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined)
  }
  await setToken(null)
  await setRefreshToken(null)
}

export async function login(email: string, password: string): Promise<StaffUser> {
  const res = await api<LoginApiResponse | TwoFactorChallengeApiResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  if ("two_factor_required" in res) throw new TwoFactorRequired(res.challenge_token)
  return openStaffSession(res)
}

export async function requestRecovery(email: string): Promise<void> {
  await api("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}
