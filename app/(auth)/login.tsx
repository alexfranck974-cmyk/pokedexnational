import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signIn } from '@/lib/auth';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    wrap: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' as const, backgroundColor: colors.bg },
    h1: { fontSize: 32, fontFamily: fonts.display, color: colors.text, marginBottom: spacing.lg },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontSize: 16,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    err: { color: colors.danger, fontFamily: fonts.bodyBold },
    btn: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md, alignItems: 'center' as const },
    btnText: { color: 'white', fontSize: 16, fontFamily: fonts.bodyBold },
    link: { textAlign: 'center' as const, marginTop: spacing.md, color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  }));

  const submit = async () => {
    setError(null);
    setPending(true);
    try { await signIn(email.trim(), password); }
    catch (e: any) { setError(e?.message ?? 'Login failed'); }
    finally { setPending(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Connexion</Text>
      <TextInput placeholder="Email" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder="Mot de passe" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : 'Se connecter'}</Text>
      </Pressable>
      <Link href="/signup" style={styles.link}>Pas de compte ? S'inscrire</Link>
    </View>
  );
}
