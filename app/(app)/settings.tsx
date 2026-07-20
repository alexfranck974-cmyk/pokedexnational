import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';

export default function Settings() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('username, display_name, is_public').eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username);
          setDisplayName(data.display_name);
          setIsPublic(data.is_public);
        }
      });
  }, [userId]);

  const shareBase = process.env.EXPO_PUBLIC_APP_URL ?? '';
  const shareUrl = username ? `${shareBase}/u/${username}` : '';

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ display_name: displayName, is_public: isPublic })
      .eq('id', userId);
    setSaving(false);
    if (error) Alert.alert('Erreur', error.message);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Copié', shareUrl);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.h1}>Paramètres</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Username (immuable)</Text>
        <Text style={styles.readonly}>{username}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Nom affiché</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} />
      </View>

      <View style={styles.rowInline}>
        <Text style={styles.label}>Profil public</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Lien de partage</Text>
        <Text style={styles.readonly}>{shareUrl}</Text>
        <Pressable onPress={copy} style={styles.btnSecondary}>
          <Text>Copier</Text>
        </Pressable>
      </View>

      <Pressable onPress={save} disabled={saving} style={styles.btn}>
        <Text style={styles.btnText}>{saving ? '…' : 'Enregistrer'}</Text>
      </Pressable>

      <Pressable onPress={() => signOut()} style={styles.btnDanger}>
        <Text style={styles.btnText}>Se déconnecter</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16, backgroundColor: '#fafafa' },
  h1: { fontSize: 24, fontWeight: '700' },
  row: { gap: 4 },
  rowInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, color: '#555' },
  readonly: { fontSize: 16, color: '#111' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  btn: { backgroundColor: '#111', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#eee', padding: 8, borderRadius: 6, alignSelf: 'flex-start' },
  btnDanger: { backgroundColor: '#c00', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
});
