import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession, signOut, deleteAccount } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import { IconBubble } from '@/components/IconBubble';
import { QRCodeModal } from '@/components/QRCodeModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTheme, useThemedStyles, radius, spacing, fonts, TAB_BAR_CLEARANCE, PALETTE_ORDER, PALETTE_META } from '@/lib/theme';
import { useMotion } from '@/lib/motion';
import { useLocale, useT } from '@/lib/locale';
import { useIsAdmin } from '@/lib/feedback';
import { toast } from '@/lib/toast';

export default function Settings() {
  const router = useRouter();
  const { session } = useSession();
  const [qrOpen, setQrOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const userId = session?.user.id;
  const { colors, mode, toggleMode, palette, setPalette, heroGradient, heroText, heroTextMuted, heroSurface } = useTheme();
  const { animationsEnabled, setAnimationsEnabled } = useMotion();
  const { locale, setLocale } = useLocale();
  const t = useT();
  const styles = useThemedStyles((colors, shadow) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.lg + TAB_BAR_CLEARANCE, gap: spacing.lg },
    hero: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg, ...shadow.sm,
    },
    heroAvatar: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: heroSurface,
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    heroAvatarText: { fontSize: 24, fontFamily: fonts.display, color: heroText },
    heroName: { fontSize: 19, fontFamily: fonts.display, color: heroText },
    heroUsername: { fontSize: 12, fontFamily: fonts.mono, color: heroTextMuted, marginTop: 2 },
    row: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    rowInline: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
    rowHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    label: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    readonly: { fontSize: 16, fontFamily: fonts.body, color: colors.text },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontFamily: fonts.body, color: colors.text, backgroundColor: colors.surfaceAlt },
    btn: { flexDirection: 'row' as const, gap: 6, backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnSecondary: { flexDirection: 'row' as const, gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, alignSelf: 'flex-start' as const, alignItems: 'center' as const },
    shareBtnRow: { flexDirection: 'row' as const, gap: spacing.sm },
    btnSecondaryText: { fontFamily: fonts.body, color: colors.text, fontSize: 13 },
    btnDanger: { flexDirection: 'row' as const, gap: 6, backgroundColor: colors.danger, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    btnText: { fontFamily: fonts.bodyBold, color: 'white' },
    // Deliberately quieter than btnDanger — irreversible and destroys every
    // bit of data, so it shouldn't read as equally "easy to tap" as sign out.
    deleteAccountLink: { alignItems: 'center' as const, padding: spacing.sm },
    deleteAccountLinkText: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
    legalRow: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: spacing.md, marginTop: spacing.xs },
    legalLink: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, textDecorationLine: 'underline' as const },
    paletteSwatches: { flexDirection: 'row' as const, gap: spacing.sm },
    paletteDot: {
      width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    paletteDotSelected: { borderColor: colors.text },
    paletteName: { fontSize: 12, fontFamily: fonts.body, color: colors.textDim, marginTop: 2 },
    langPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
    langPillSelected: { backgroundColor: colors.primary },
    langPillText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.textMuted },
    langPillTextSelected: { color: 'white' },
  }));
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: isAdmin = false } = useIsAdmin(userId);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('username, display_name, is_public').eq('id', userId).single();
        if (data) {
          setUsername(data.username);
          setDisplayName(data.display_name);
          setIsPublic(data.is_public);
        } else if (error) {
          toast(t('common.loadError'));
        }
      } catch {
        toast(t('common.loadError'));
      }
    })();
  }, [userId]);

  const shareBase = process.env.EXPO_PUBLIC_APP_URL ?? '';
  const shareUrl = username ? `${shareBase}/u/${username}` : '';

  const save = async () => {
    if (!userId) return;
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast(t('settings.displayNameEmpty'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ display_name: trimmedName, is_public: isPublic })
      .eq('id', userId);
    setSaving(false);
    if (error) toast(error.message);
    else setDisplayName(trimmedName);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    toast(t('qrCode.linkCopiedToast'));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{(displayName || username || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.heroName}>{displayName || t('settings.trainerFallback')}</Text>
            <Text style={styles.heroUsername}>@{username || '…'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="at" size={15} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.usernameLabel')}</Text>
          </View>
          <Text style={styles.readonly}>{username}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="pencil" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.displayNameLabel')}</Text>
          </View>
          <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} maxLength={60} />
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="globe" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.publicProfileLabel')}</Text>
          </View>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.darkThemeLabel')}</Text>
          </View>
          <Switch value={mode === 'dark'} onValueChange={toggleMode} />
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="language" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.languageLabel')}</Text>
          </View>
          <View style={styles.paletteSwatches}>
            <Pressable
              onPress={() => setLocale('fr')}
              style={[styles.langPill, locale === 'fr' && styles.langPillSelected]}>
              <Text style={[styles.langPillText, locale === 'fr' && styles.langPillTextSelected]}>FR</Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={[styles.langPill, locale === 'en' && styles.langPillSelected]}>
              <Text style={[styles.langPillText, locale === 'en' && styles.langPillTextSelected]}>EN</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="color-palette" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.paletteLabel')}</Text>
          </View>
          <View style={styles.paletteSwatches}>
            {PALETTE_ORDER.map(id => {
              const meta = PALETTE_META[id];
              const selected = palette === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setPalette(id)}
                  style={[styles.paletteDot, { backgroundColor: meta.swatch }, selected && styles.paletteDotSelected]}
                  accessibilityLabel={meta.label}>
                  {selected && <Ionicons name="checkmark" size={16} color="white" />}
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.paletteName}>{PALETTE_META[palette].label}</Text>
        </View>

        <View style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.animationsLabel')}</Text>
          </View>
          <Switch value={animationsEnabled} onValueChange={setAnimationsEnabled} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="link" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{t('settings.shareLinkLabel')}</Text>
          </View>
          <Text style={styles.readonly}>{shareUrl}</Text>
          <View style={styles.shareBtnRow}>
            <Pressable onPress={copy} style={styles.btnSecondary}>
              <Ionicons name="copy-outline" size={14} color={colors.text} />
              <Text style={styles.btnSecondaryText}>{t('common.copy')}</Text>
            </Pressable>
            <Pressable onPress={() => setQrOpen(true)} style={styles.btnSecondary}>
              <Ionicons name="qr-code-outline" size={14} color={colors.text} />
              <Text style={styles.btnSecondaryText}>QR code</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={save} disabled={saving} style={styles.btn}>
          {!saving && <Ionicons name="checkmark" size={18} color="white" />}
          <Text style={styles.btnText}>{saving ? '…' : t('common.save')}</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/feedback')} style={styles.rowInline}>
          <View style={styles.rowHead}>
            <IconBubble size={28} color={colors.primarySoft}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
            </IconBubble>
            <Text style={styles.label}>{isAdmin ? t('settings.feedbackAdminLabel') : t('settings.feedbackLabel')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable onPress={() => signOut()} style={styles.btnDanger}>
          <Ionicons name="log-out-outline" size={18} color="white" />
          <Text style={styles.btnText}>{t('settings.logout')}</Text>
        </Pressable>

        <Pressable onPress={() => setDeleteConfirmOpen(true)} style={styles.deleteAccountLink}>
          <Text style={styles.deleteAccountLinkText}>{t('settings.deleteAccount')}</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push('/legal/terms')}>
            <Text style={styles.legalLink}>{t('settings.terms')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/legal/privacy')}>
            <Text style={styles.legalLink}>{t('settings.privacy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <QRCodeModal visible={qrOpen} value={shareUrl} label="Mon Pokédex" onClose={() => setQrOpen(false)} />
      <ConfirmDialog
        target={deleteConfirmOpen ? { title: t('settings.deleteAccountConfirmTitle'), message: t('settings.deleteAccountConfirmMessage') } : null}
        confirmLabel={deletingAccount ? '…' : t('settings.deleteAccountConfirmCta')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={async () => {
          if (deletingAccount) return;
          setDeletingAccount(true);
          try {
            await deleteAccount();
            setDeleteConfirmOpen(false);
            router.replace('/login');
          } catch {
            toast(t('settings.deleteAccountError'));
          } finally {
            setDeletingAccount(false);
          }
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </SafeAreaView>
  );
}
