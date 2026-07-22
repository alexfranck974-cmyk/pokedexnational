import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';
import { isValidUsername } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    wrap: { flex: 1, padding: spacing.xl, gap: spacing.md, justifyContent: 'center' as const, backgroundColor: colors.bg },
    h1: { fontSize: 32, fontFamily: fonts.display, color: colors.text, marginBottom: spacing.lg },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, fontSize: 16,
      fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt,
    },
    hint: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
    err: { color: colors.danger, fontFamily: fonts.bodyBold },
    btn: { backgroundColor: colors.primary, padding: 14, borderRadius: radius.md, alignItems: 'center' as const },
    btnText: { color: 'white', fontSize: 16, fontFamily: fonts.bodyBold },
    link: { textAlign: 'center' as const, marginTop: spacing.md, color: colors.textMuted, fontSize: 14, fontFamily: fonts.body },
  }));

  const onUsernameBlur = async () => {
    const u = username.trim().toLowerCase();
    if (!u) return setUsernameCheck('idle');
    if (!isValidUsername(u)) return setUsernameCheck('invalid');
    setUsernameCheck('checking');
    const { data, error } = await supabase.rpc('check_username_available', { candidate: u });
    if (error) return setUsernameCheck('idle');
    setUsernameCheck(data ? 'ok' : 'taken');
  };

  const submit = async () => {
    setError(null);
    const u = username.trim().toLowerCase();
    if (!isValidUsername(u)) return setError("Username invalide (3–30 caractères, a-z 0-9 _ - uniquement, doit commencer par a-z ou 0-9)");
    setPending(true);
    try {
      await signUp(email.trim(), password, u, displayName.trim() || u);
    } catch (e: any) {
      if (e?.message === 'USERNAME_TAKEN') setError('Ce username est déjà pris');
      else setError(e?.message ?? 'Inscription échouée');
    } finally { setPending(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Créer un compte</Text>
      <TextInput placeholder="Email" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder="Mot de passe (min 6)" placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      <TextInput placeholder="Username (immutable, ex: tristan-42)" placeholderTextColor={colors.textMuted} value={username}
        onChangeText={setUsername} onBlur={onUsernameBlur}
        autoCapitalize="none" style={styles.input} />
      {usernameCheck === 'checking' && <Text style={styles.hint}>Vérification…</Text>}
      {usernameCheck === 'ok'       && <Text style={[styles.hint, { color: colors.success }]}>Disponible ✓</Text>}
      {usernameCheck === 'taken'    && <Text style={styles.err}>Déjà pris</Text>}
      {usernameCheck === 'invalid'  && <Text style={styles.err}>Format invalide</Text>}
      <TextInput placeholder="Nom affiché (public)" placeholderTextColor={colors.textMuted} value={displayName}
        onChangeText={setDisplayName} style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : "S'inscrire"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>Déjà un compte ? Se connecter</Link>
    </View>
  );
}
