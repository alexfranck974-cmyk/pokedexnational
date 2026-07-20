import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';
import { isValidUsername } from '@/lib/slug';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

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
      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder="Mot de passe (min 6)" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      <TextInput placeholder="Username (immutable, ex: tristan-42)" value={username}
        onChangeText={setUsername} onBlur={onUsernameBlur}
        autoCapitalize="none" style={styles.input} />
      {usernameCheck === 'checking' && <Text style={styles.hint}>Vérification…</Text>}
      {usernameCheck === 'ok'       && <Text style={[styles.hint, { color: 'green' }]}>Disponible ✓</Text>}
      {usernameCheck === 'taken'    && <Text style={styles.err}>Déjà pris</Text>}
      {usernameCheck === 'invalid'  && <Text style={styles.err}>Format invalide</Text>}
      <TextInput placeholder="Nom affiché (public)" value={displayName}
        onChangeText={setDisplayName} style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : "S'inscrire"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>Déjà un compte ? Se connecter</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  h1: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { color: '#555', fontSize: 12 },
  err: { color: '#c00' },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 12, color: '#555' },
});
