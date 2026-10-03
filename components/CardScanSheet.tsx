import { useState } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BubbleSheet } from './BubbleSheet';
import { useCardScan, type ScannedCardCandidate } from '@/lib/card-scan';
import { useSession } from '@/lib/auth';
import { useAllOwnedCardIds, useAllWishedCards, useToggleOwnedCard, useToggleWish } from '@/lib/collection';
import { setFlagLabel } from '@/lib/tcg-set-labels';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { toast } from '@/lib/toast';
import { useT } from '@/lib/locale';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 'self' reuses the signed-in user's own collection (mark owned/wish
   * directly from the scan). 'readonly' shows someone else's status instead
   * — no mutation, just "does this person already have/want this card",
   * for a visitor deciding what to buy them (works signed out too, see
   * app/u/[username].tsx). */
  mode: 'self' | 'readonly';
  /** readonly mode only — whose collection this is, for the status copy. */
  ownerDisplayName?: string;
  /** readonly mode only — the profile owner's already-loaded state (that
   * screen fetches these regardless of scanning, so no extra query here). */
  ownedCardIds?: Set<string>;
  wishedCardIds?: Set<string>;
}

type Step = 'intro' | 'candidates' | 'detail';

export function CardScanSheet({ visible, onClose, mode, ownerDisplayName, ownedCardIds, wishedCardIds }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const { session } = useSession();
  const myUserId = mode === 'self' ? session?.user.id : undefined;
  const { data: myOwnedCardIds = new Set<string>() } = useAllOwnedCardIds(myUserId);
  const { data: myWishedCards = [] } = useAllWishedCards(myUserId);
  const myWishedCardIds = new Set(myWishedCards.map(c => c.id as string));

  const scan = useCardScan();
  const toggleOwned = useToggleOwnedCard();
  const toggleWish = useToggleWish();

  const [step, setStep] = useState<Step>('intro');
  const [candidates, setCandidates] = useState<ScannedCardCandidate[]>([]);
  const [selected, setSelected] = useState<ScannedCardCandidate | null>(null);

  const reset = () => { setStep('intro'); setCandidates([]); setSelected(null); };
  const handleClose = () => { reset(); onClose(); };

  const runScan = (source: 'camera' | 'library') => {
    scan.mutate(source, {
      onSuccess: (result) => {
        if (result === null) return; // cancelled the picker or denied permission — stay put
        if (result.length === 0) { toast(t('cardScan.noneFound')); return; }
        setCandidates(result);
        setStep('candidates');
      },
      onError: () => toast(t('cardScan.error')),
    });
  };

  const pickCandidate = (card: ScannedCardCandidate) => { setSelected(card); setStep('detail'); };

  const isOwned = selected ? (mode === 'self' ? myOwnedCardIds.has(selected.id) : (ownedCardIds?.has(selected.id) ?? false)) : false;
  const isWished = selected ? (mode === 'self' ? myWishedCardIds.has(selected.id) : (wishedCardIds?.has(selected.id) ?? false)) : false;

  const styles = useThemedStyles((colors, shadow) => ({
    body: { padding: spacing.md, gap: spacing.md, alignItems: 'center' as const, minHeight: 220 },
    intro: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' as const, paddingHorizontal: spacing.md },
    actionsRow: { flexDirection: 'row' as const, gap: spacing.md, marginTop: spacing.sm },
    actionBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    actionBtnText: { fontFamily: fonts.bodyBold, color: 'white', fontSize: 14 },
    candidateList: { width: '100%' as const, gap: spacing.sm },
    candidateRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, width: '100%' as const,
      backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm,
    },
    candidateImg: { width: 40, height: 56, borderRadius: radius.sm },
    candidateInfo: { flex: 1 },
    candidateName: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    candidateSet: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim },
    retryLink: { padding: spacing.sm },
    retryLinkText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 13 },
    selectedCard: { width: 150, aspectRatio: 0.72, borderRadius: radius.lg, ...shadow.md },
    selectedName: { fontSize: 16, fontFamily: fonts.display, color: colors.text, textAlign: 'center' as const },
    selectedSet: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim },
    statusBanner: { borderRadius: radius.md, padding: spacing.md, alignSelf: 'stretch' as const, alignItems: 'center' as const },
    statusOwned: { backgroundColor: colors.successBg },
    statusWished: { backgroundColor: colors.primarySoft },
    statusNeither: { backgroundColor: colors.surfaceAlt },
    statusTextOwned: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.success, textAlign: 'center' as const },
    statusTextWished: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary, textAlign: 'center' as const },
    statusTextNeither: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textMuted, textAlign: 'center' as const },
  }));

  return (
    <BubbleSheet visible={visible} onClose={handleClose} tint={colors.primary} title={t('cardScan.title')} sizing="auto">
      <View style={styles.body}>
        {step === 'intro' && (
          <>
            <Ionicons name="camera-outline" size={40} color={colors.primary} />
            <Text style={styles.intro}>{t('cardScan.intro')}</Text>
            {scan.isPending ? (
              <ActivityIndicator />
            ) : (
              <View style={styles.actionsRow}>
                <Pressable onPress={() => runScan('camera')} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={t('cardScan.a11yTakePhoto')}>
                  <Ionicons name="camera" size={16} color="white" />
                  <Text style={styles.actionBtnText}>{t('cardScan.takePhoto')}</Text>
                </Pressable>
                <Pressable onPress={() => runScan('library')} style={styles.actionBtn} accessibilityRole="button" accessibilityLabel={t('cardScan.a11yChoosePhoto')}>
                  <Ionicons name="image" size={16} color="white" />
                  <Text style={styles.actionBtnText}>{t('cardScan.choosePhoto')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {step === 'candidates' && (
          <>
            <Text style={styles.intro}>{t('cardScan.pickCandidate')}</Text>
            <View style={styles.candidateList}>
              {candidates.map(c => (
                <Pressable key={c.id} onPress={() => pickCandidate(c)} style={styles.candidateRow}>
                  <Image source={{ uri: c.image_small }} style={styles.candidateImg} resizeMode="contain" />
                  <View style={styles.candidateInfo}>
                    <Text style={styles.candidateName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.candidateSet} numberOfLines={1}>{setFlagLabel(c.set_name, c.region, c.set_id)} · {c.card_number}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setStep('intro')} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>{t('cardScan.noneOfThese')}</Text>
            </Pressable>
          </>
        )}

        {step === 'detail' && selected && (
          <>
            <Image source={{ uri: selected.image_large ?? selected.image_small }} style={styles.selectedCard} resizeMode="contain" />
            <Text style={styles.selectedName}>{selected.name}</Text>
            <Text style={styles.selectedSet}>{setFlagLabel(selected.set_name, selected.region, selected.set_id)} · {selected.card_number}</Text>

            {mode === 'readonly' ? (
              <View style={[styles.statusBanner, isOwned ? styles.statusOwned : isWished ? styles.statusWished : styles.statusNeither]}>
                <Text style={isOwned ? styles.statusTextOwned : isWished ? styles.statusTextWished : styles.statusTextNeither}>
                  {isOwned
                    ? t('cardScan.statusOwned', { name: ownerDisplayName ?? '' })
                    : isWished
                    ? t('cardScan.statusWished', { name: ownerDisplayName ?? '' })
                    : t('cardScan.statusNeither', { name: ownerDisplayName ?? '' })}
                </Text>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => toggleOwned.mutate({ cardId: selected.id, currentlyOwned: isOwned, rarity: selected.rarity })}
                  style={styles.actionBtn}
                  accessibilityRole="button">
                  <Ionicons name={isOwned ? 'close' : 'checkmark'} size={16} color="white" />
                  <Text style={styles.actionBtnText}>{isOwned ? t('cardScan.removeOwned') : t('cardScan.markOwned')}</Text>
                </Pressable>
                {selected.dex_num != null && (
                  <Pressable
                    onPress={() => toggleWish.mutate({ cardId: selected.id, currentlyWished: isWished, dexNum: selected.dex_num! })}
                    style={styles.actionBtn}
                    accessibilityRole="button">
                    <Ionicons name={isWished ? 'heart-dislike' : 'heart'} size={16} color="white" />
                    <Text style={styles.actionBtnText}>{isWished ? t('cardScan.removeWish') : t('cardScan.addToWishlist')}</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Pressable onPress={() => setStep(candidates.length > 1 ? 'candidates' : 'intro')} style={styles.retryLink}>
              <Text style={styles.retryLinkText}>{t('cardScan.scanAnother')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </BubbleSheet>
  );
}
