import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';
import { isValidUsername } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/locale';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  const { colors } = useTheme();
  const t = useT();
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
    legalText: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, textAlign: 'center' as const, marginTop: spacing.sm },
    legalLink: { fontFamily: fonts.bodyBold, color: colors.textDim, textDecorationLine: 'underline' as const },
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
    if (!isValidUsername(u)) return setError(t('auth.signup.usernameInvalidMsg'));
    setPending(true);
    try {
      const { confirmed } = await signUp(email.trim(), password, u, displayName.trim() || u);
      // If confirmed, a session now exists and the (auth) layout's Redirect
      // will take over automatically — nothing else to do here. Otherwise the
      // account exists but is waiting on the confirmation email, which the
      // user would otherwise have no way of knowing from a blank screen.
      if (!confirmed) setNeedsConfirmation(true);
    } catch (e: any) {
      if (e?.message === 'USERNAME_TAKEN') setError(t('auth.signup.usernameTakenErr'));
      else setError(e?.message ?? t('auth.signup.genericErr'));
    } finally { setPending(false); }
  };

  if (needsConfirmation) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>{t('auth.signup.checkEmailTitle')}</Text>
        <Text style={styles.hint}>
          {t('auth.signup.checkEmailBody', { email: email.trim() })}
        </Text>
        <Link href="/login" style={styles.link}>{t('auth.signup.backToLogin')}</Link>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{t('auth.signup.title')}</Text>
      <TextInput placeholder={t('common.email')} placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder={t('auth.signup.passwordPlaceholder')} placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      <TextInput placeholder={t('auth.signup.usernamePlaceholder')} placeholderTextColor={colors.textMuted} value={username}
        onChangeText={setUsername} onBlur={onUsernameBlur}
        autoCapitalize="none" style={styles.input} />
      {usernameCheck === 'checking' && <Text style={styles.hint}>{t('auth.signup.checking')}</Text>}
      {usernameCheck === 'ok'       && <Text style={[styles.hint, { color: colors.success }]}>{t('auth.signup.available')}</Text>}
      {usernameCheck === 'taken'    && <Text style={styles.err}>{t('auth.signup.taken')}</Text>}
      {usernameCheck === 'invalid'  && <Text style={styles.err}>{t('auth.signup.invalidFormat')}</Text>}
      <TextInput placeholder={t('auth.signup.displayNamePlaceholder')} placeholderTextColor={colors.textMuted} value={displayName}
        onChangeText={setDisplayName} style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : t('auth.signup.submit')}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>{t('auth.signup.haveAccount')}</Link>
      <Text style={styles.legalText}>
        {t('auth.signup.legalPrefix')}{' '}
        <Link href="/legal/terms" style={styles.legalLink}>{t('auth.signup.legalTerms')}</Link>
        {' '}{t('auth.signup.legalAnd')}{' '}
        <Link href="/legal/privacy" style={styles.legalLink}>{t('auth.signup.legalPrivacy')}</Link>
      </Text>
    </View>
  );
}
