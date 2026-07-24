import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import { IconBubble } from '@/components/IconBubble';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

export default function Settings() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors, mode, toggleMode } = useTheme();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, gap: spacing.lg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg, ...shadow.sm,
    },
    heroAvatar: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heroAvatarText: { fontSize: 24, fontFamily: fonts.display, color: 'white' },
    heroName: { fontSize: 19, fontFamily: fonts.display, color: 'white' },
    heroUsername: { fontSize: 12, fontFamily: fonts.mono, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    row: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    rowInline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    rowHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    label: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    readonly: { fontSize: 16, fontFamily: fonts.body, color: colors.text },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },
    btn: { flexDirection: 'row' as const, gap: 6, backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSecondary: { flexDirection: 'row' as const, gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, alignSelf: 'flex-start' as const, alignItems: 'center' as const },
    btnSecondaryText: { fontFamily: fonts.body, color: colors.text, fontSize: 13 },
    btnDanger: { flexDirection: 'row' as const, gap: 6, backgroundColor: colors.danger, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnText: { fontFamily: fonts.bodyBold, color: 'white' },
    legalRow: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: spacing.md, marginTop: spacing.xs },
    legalLink: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, textDecorationLine: 'underline' as const },
  }));
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{(displayName || username || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.heroName}>{displayName || 'Dresseur'}</Text>
            <Text style={styles.heroUsername}>@{username || '…'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="at" size={15} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>Username (immuable)</Text>
          </View>
          <Text style={styles.readonly}>{username}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>Nom affiché</Text>
          </View>
          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} />
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="globe" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>Profil public</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>Thème sombre</Text>
          </View>
          <Switch value={mode === 'dark'} onValueChange={toggleMode} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="link" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>Lien de partage</Text>
          </View>
          <Text style={styles.readonly}>{shareUrl}</Text>
          <Pressable onPress={copy} style={styles.btnSecondary}>
            <Ionicons name="copy-outline" size={14} color={colors.text} />
            <Text style={styles.btnSecondaryText}>Copier</Text>
          </Pressable>
        </View>

        <Pressable onPress={save} disabled={saving} style={styles.btn}>
          {!saving && <Ionicons name="checkmark" size={18} color="white" />}
          <Text style={styles.btnText}>{saving ? '…' : 'Enregistrer'}</Text>
        </Pressable>

        <Pressable onPress={() => signOut()} style={styles.btnDanger}>
          <Ionicons name="log-out-outline" size={18} color="white" />
          <Text style={styles.btnText}>Se déconnecter</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push('/legal/terms')}>
            <Text style={styles.legalLink}>Conditions d'utilisation</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.legalLink}>Confidentialité</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
