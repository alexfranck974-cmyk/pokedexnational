import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { requestPasswordReset } from '@/lib/auth';
import { AuthBanner } from '@/components/AuthBanner';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    wrap: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' as const, backgroundColor: colors.bg },
    h1: { fontSize: 32, fontFamily: fonts.display, color: colors.text, marginBottom: spacing.lg, textAlign: 'center' as const },
    hint: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
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
    try {
      await requestPasswordReset(email.trim());
      // Always show the same confirmation regardless of whether the address is
      // registered — avoids leaking which emails have an account.
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue');
    } finally { setPending(false); }
  };

  if (sent) {
    return (
      <View style={styles.wrap}>
        <AuthBanner />
        <Text style={styles.h1}>Vérifie ta boîte mail</Text>
        <Text style={styles.hint}>
          Si un compte existe pour {email.trim()}, un lien de réinitialisation vient d’être envoyé. Clique dessus pour choisir un nouveau mot de passe.
        </Text>
        <Link href="/login" style={styles.link}>Retour à la connexion</Link>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <AuthBanner />
      <Text style={styles.h1}>Mot de passe oublié</Text>
      <Text style={styles.hint}>Entre ton email, on t’envoie un lien pour en choisir un nouveau.</Text>
      <TextInput placeholder="Email" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending || !email.trim()} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : 'Envoyer le lien'}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>Retour à la connexion</Link>
    </View>
  );
}
