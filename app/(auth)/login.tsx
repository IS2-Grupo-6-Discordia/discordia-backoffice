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
import { login } from "@/api/auth"
import { friendlyError } from "@/api/client"
import AuthBrand from "@/components/AuthBrand"
import AuthField from "@/components/AuthField"
import PressableScale from "@/components/PressableScale"

export default function LoginScreen() {
  const { setUser, isLoggedIn } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  if (isLoggedIn) return <Redirect href="/(main)/users" />

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    try {
      const user = await login(email.trim(), password)
      setUser(user)
      router.replace("/(main)/users")
    } catch (err) {
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
                <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 14 }}>Ingresando...</Text>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
