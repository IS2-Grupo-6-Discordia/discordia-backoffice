import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { Redirect, useRouter } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { TwoFactorRequired, completeTwoFactorLogin, login } from "@/api/auth"
import type { StaffUser } from "@/api/types"
import { useWakeState, wakeBackends } from "@/api/wake"
import { ApiError, friendlyError } from "@/api/client"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"
import PressableScale from "@/components/PressableScale"

export default function LoginScreen() {
  const { setUser, isLoggedIn } = useAuth()
  const wake = useWakeState()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [challenge, setChallenge] = useState<string | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState("")
  const [recoveryNotice, setRecoveryNotice] = useState<{ user: StaffUser; remaining: number } | null>(null)

  if (isLoggedIn) return <Redirect href="/(main)/users" />

  const enter = (user: StaffUser) => {
    setUser(user)
    router.replace("/(main)/users")
  }

  const codeReady = useRecovery ? code.replace(/[^a-z0-9]/gi, "").length >= 10 : code.length === 6

  const handleSecondFactor = async () => {
    if (!challenge || !codeReady) return
    setLoading(true)
    setError("")
    try {
      const result = await completeTwoFactorLogin(challenge, useRecovery ? { recoveryCode: code } : { code })
      if (result.recoveryCodeUsed) setRecoveryNotice({ user: result.user, remaining: result.recoveryCodesRemaining })
      else enter(result.user)
    } catch (err) {
      const expired = err instanceof ApiError && err.status === 401 && /Volvé a iniciar sesión/.test(err.message)
      if (expired) {
        setChallenge(null)
        setPassword("")
      }
      setError(err instanceof ApiError && err.status === 401 && !expired ? "El código no es correcto o ya venció." : friendlyError(err))
      setCode("")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      await wakeBackends()
      const user = await login(email.trim(), password)
      enter(user)
    } catch (err) {
      if (err instanceof TwoFactorRequired) {
        setChallenge(err.challengeToken)
        setUseRecovery(false)
        setCode("")
        return
      }
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 340,
            alignSelf: "center",
            borderRadius: 16,
            padding: 24,
            backgroundColor: "rgba(255,255,255,0.055)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.13)",
          }}
        >
          <AuthBrand
            title="Backoffice"
            subtitle="Acceso exclusivo para el staff de la plataforma."
          />

          {wake === "waking" || wake === "failed" ? (
            <View
              accessibilityRole={wake === "failed" ? "alert" : undefined}
              accessibilityLiveRegion="polite"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                padding: 10,
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: "rgba(55,214,192,0.08)",
                borderWidth: 1,
                borderColor: "rgba(55,214,192,0.30)",
              }}
            >
              {wake === "waking" ? <ActivityIndicator size="small" color="#37D6C0" /> : null}
              <Text style={{ color: "#BFE6E1", fontSize: 12, flex: 1, lineHeight: 17 }}>
                {wake === "waking"
                  ? "Estamos despertando el servidor. La primera vez puede tardar hasta un minuto; podés ir completando tus datos."
                  : "No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo."}
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: "rgba(255,127,114,0.15)",
                borderWidth: 1,
                borderColor: "#FF7F72",
              }}
            >
              <Text style={{ color: "#FF7F72", fontWeight: "700" }}>!</Text>
              <Text style={{ color: "#FF7F72", fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {recoveryNotice ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: "#F0C24B", fontSize: 13.5, fontWeight: "700" }}>Usaste un código de recuperación</Text>
              <Text style={{ color: "#C9DADB", fontSize: 12.5, lineHeight: 18 }}>
                Ese código ya no sirve. {recoveryNotice.remaining === 1 ? "Te queda 1" : `Te quedan ${recoveryNotice.remaining}`}. Te
                recomendamos generar una lista nueva desde Discordia, en Mi cuenta → Verificación en dos pasos.
              </Text>
              <PressableScale
                onPress={() => enter(recoveryNotice.user)}
                style={{ borderRadius: 10, paddingVertical: 13, alignItems: "center", backgroundColor: "#37D6C0" }}
              >
                <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>Entendido</Text>
              </PressableScale>
            </View>
          ) : challenge ? (
            <View>
              <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "800", marginBottom: 4 }}>Verificación en dos pasos</Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
                {useRecovery ? "Ingresá uno de tus códigos de recuperación." : "Ingresá el código de 6 dígitos de tu app autenticadora."}
              </Text>
              <AuthField
                label={useRecovery ? "Código de recuperación" : "Código de la app"}
                value={code}
                onChangeText={(t) => {
                  setCode(useRecovery ? t.toUpperCase().slice(0, 20) : t.replace(/\D/g, "").slice(0, 6))
                  setError("")
                }}
                placeholder={useRecovery ? "ABCDE-FGHJK" : "123456"}
                keyboardType={useRecovery ? "default" : "number-pad"}
                autoCapitalize="characters"
                autoComplete={useRecovery ? "off" : "one-time-code"}
                autoFocus
                error={!!error}
                onSubmitEditing={handleSecondFactor}
                containerStyle={{ marginBottom: 14 }}
              />
              <PressableScale
                onPress={handleSecondFactor}
                disabled={loading || !codeReady}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  paddingVertical: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                  backgroundColor: loading || !codeReady ? "rgba(255,255,255,0.15)" : "#37D6C0",
                }}
              >
                {loading ? <ActivityIndicator size="small" color="#8DA8AC" /> : null}
                <Text style={{ color: loading || !codeReady ? "#8DA8AC" : "#04211D", fontWeight: "700", fontSize: 14 }}>
                  Verificar
                </Text>
              </PressableScale>
              <TouchableOpacity
                onPress={() => {
                  setUseRecovery((v) => !v)
                  setCode("")
                  setError("")
                }}
                style={{ alignItems: "center", paddingTop: 14 }}
              >
                <Text style={{ color: "#37D6C0", fontSize: 12.5, fontWeight: "600" }}>
                  {useRecovery ? "Usar el código de la app" : "Usar un código de recuperación"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setChallenge(null)
                  setError("")
                }}
                style={{ alignItems: "center", paddingTop: 10 }}
              >
                <Text style={{ color: "#8DA8AC", fontSize: 12.5, fontWeight: "600" }}>← Volver</Text>
              </TouchableOpacity>
            </View>
          ) : (
          <>
          <AuthField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="staff@discordia.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={!!error}
            containerStyle={{ marginBottom: 14 }}
          />
          <AuthField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            error={!!error}
            onSubmitEditing={handleLogin}
            containerStyle={{ marginBottom: 12 }}
          />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/recovery")}
            style={{ alignSelf: "flex-end", marginBottom: 18 }}
          >
            <Text style={{ color: "#37D6C0", fontSize: 12, fontWeight: "600" }}>
              ¿Olvidaste tu contraseña?
            </Text>
          </TouchableOpacity>

          <PressableScale
            onPress={handleLogin}
            disabled={loading || !email || !password}
            style={{
              width: "100%",
              borderRadius: 10,
              paddingVertical: 13,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              backgroundColor: loading || !email || !password ? "rgba(255,255,255,0.15)" : "#37D6C0",
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#8DA8AC" />
                <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 14 }}>
                  {wake === "waking" ? "Esperando al servidor..." : "Ingresando..."}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  color: !email || !password ? "#8DA8AC" : "#04211D",
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Iniciar sesión
              </Text>
            )}
          </PressableScale>
          </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
