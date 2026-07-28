import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSession, updatePassword } from '@/lib/auth';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

// Deliberately outside the (auth)/(app) route groups: both of those guard on
// session presence and would immediately redirect this page away (auth) →
// /dashboard, (app) → itself) before the user gets a chance to set a new
// password, since clicking the email link already leaves them with a live
// (recovery) session via Supabase's detectSessionInUrl.
export default function ResetPassword() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [linkExpired, setLinkExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    wrap: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' as const, backgroundColor: colors.bg },
    h1: { fontSize: 32, fontFamily: fonts.display, color: colors.text, marginBottom: spacing.lg },
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

  useEffect(() => {
    if (loading || session) return;
    // Supabase still needs a moment to pick the recovery token out of the URL
    // on load — only declare the link dead if that hasn't produced a session
    // after a grace period, rather than flashing an error immediately.
    const t = setTimeout(() => setLinkExpired(true), 2000);
    return () => clearTimeout(t);
  }, [loading, session]);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    setPending(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue');
    } finally { setPending(false); }
  };

  if (done) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Mot de passe mis à jour</Text>
        <Text style={styles.hint}>Ton mot de passe a bien été changé.</Text>
        <Pressable onPress={() => router.replace('/dashboard')} style={styles.btn}>
          <Text style={styles.btnText}>Continuer</Text>
        </Pressable>
      </View>
    );
  }

  if (linkExpired) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Lien invalide ou expiré</Text>
        <Text style={styles.hint}>Redemande un lien de réinitialisation, celui-ci n’est plus valable.</Text>
        <Link href="/forgot-password" style={styles.link}>Redemander un lien</Link>
      </View>
    );
  }

  if (loading || !session) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator />
        <Text style={[styles.hint, { textAlign: 'center' }]}>Vérification du lien…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Nouveau mot de passe</Text>
      <TextInput placeholder="Nouveau mot de passe (min 6)" placeholderTextColor={colors.textMuted} value={password}
        onChangeText={setPassword} secureTextEntry style={styles.input} />
      <TextInput placeholder="Confirme le mot de passe" placeholderTextColor={colors.textMuted} value={confirm}
        onChangeText={setConfirm} secureTextEntry style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : 'Valider'}</Text>
      </Pressable>
    </View>
  );
}
