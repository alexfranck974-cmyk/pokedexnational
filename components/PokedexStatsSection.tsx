import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { useUserDex, useAllOwnedCardIds, useAllOwnedCardsDetailed } from '@/lib/collection';
import { useVariantCards } from '@/lib/tcg-index';
import {
  computeOverallProgress, computeByGeneration, computeByType,
  bucketVariantCards, computeVariantProgress, totalCollectionValue, topArtists,
} from '@/lib/dashboard-stats';
import { computeBadges, type DashboardStats } from '@/lib/badges';
import { getGeneration, GEN_EMOJI, GEN_COLORS } from '@/lib/generations';
import { ProgressRing } from './ProgressRing';
import { StatRingTile } from './StatRingTile';
import { StatBreakdownModal, type BreakdownTarget, type BreakdownItem } from './StatBreakdownModal';
import { StatsTabsModal, type StatsTab } from './StatsTabsModal';
import { AchievementBadge } from './AchievementBadge';
import { BadgeDetailModal, type BadgeDetailTarget } from './BadgeDetailModal';
import { TypeIcon } from './TypeIcon';
import { IconBubble } from './IconBubble';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const POKEDEX = pokedexData as Pokemon[];

const VARIANT_LABELS = {
  mega: '✨',
  alolan: '🌺',
  galarian: '❄️',
  hisuian: '⚔️',
  paldean: '🍇',
} as const;

const VARIANT_TITLES = {
  mega: 'Méga-Évolutions',
  alolan: 'Formes d’Alola',
  galarian: 'Formes de Galar',
  hisuian: 'Formes d’Hisui',
  paldean: 'Formes de Paldea',
} as const;

const VARIANT_COLORS = {
  mega: '#fbbf24', alolan: '#fb7185', galarian: '#60a5fa', hisuian: '#a78bfa', paldean: '#65a30d',
} as const;

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const ARTIST_PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#a78bfa', '#38bdf8', '#fb923c'];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ARTIST_PALETTE[hash % ARTIST_PALETTE.length];
}

interface Props {
  userId?: string;
  /** Wishlist-derived badge inputs — owner passes real data, spectator view can omit (defaults to empty). */
  wishedCardIds?: Set<string>;
  wishlistCount?: number;
  /** Hide the €-denominated badges (collection value tiers) for spectator views. */
  showValueBadges?: boolean;
  /** Called when tapping a non-owned breakdown item. Owner navigates to the detail page; spectator views can omit. */
  onSelectMissing?: (dexNum: number) => void;
}

export function PokedexStatsSection({
  userId, wishedCardIds = new Set(), wishlistCount = 0, showValueBadges = true, onSelectMissing,
}: Props) {
  const { colors } = useTheme();
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: variantCards = [] } = useVariantCards();
  const [breakdown, setBreakdown] = useState<BreakdownTarget | null>(null);
  const [badgeDetail, setBadgeDetail] = useState<BadgeDetailTarget | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<StatsTab>('generation');

  const overall = useMemo(() => computeOverallProgress(POKEDEX, owned), [owned]);
  const byGeneration = useMemo(() => computeByGeneration(POKEDEX, owned), [owned]);
  const byType = useMemo(() => computeByType(POKEDEX, owned), [owned]);
  const typesComplete = useMemo(() => byType.filter(t => t.pct === 100).length, [byType]);
  const gensComplete = useMemo(() => byGeneration.filter(g => g.pct === 100).length, [byGeneration]);
  const variantBuckets = useMemo(() => bucketVariantCards(variantCards), [variantCards]);
  const variants = useMemo(
    () => computeVariantProgress(variantBuckets, ownedCardIds),
    [variantBuckets, ownedCardIds],
  );
  const collectionValue = useMemo(() => totalCollectionValue(ownedCards), [ownedCards]);
  const badges = useMemo(() => {
    const stats: DashboardStats = {
      overall, byGeneration, variants, ownedCards, ownedCardIds,
      wishedCardIds, wishlistCount, collectionValue,
    };
    const all = computeBadges(stats);
    return showValueBadges ? all : all.filter(b => !b.id.startsWith('value-'));
  }, [overall, byGeneration, variants, ownedCards, ownedCardIds, wishedCardIds, wishlistCount, collectionValue, showValueBadges]);

  const favoriteArtists = useMemo(() => topArtists(ownedCards, 5), [ownedCards]);
  const ownedCardsByDex = useMemo(() => new Map(ownedCards.map(c => [c.dexNum, c])), [ownedCards]);

  const pokemonItems = (mons: Pokemon[]): BreakdownItem[] => mons.map(mon => {
    const card = ownedCardsByDex.get(mon.num);
    return {
      key: String(mon.num), dexNum: mon.num,
      image: card?.imageSmall || mon.sprite_url, imageLarge: card?.imageLarge ?? null,
      label: getName(mon), owned: owned.has(mon.num),
    };
  });
  const cardItems = (cards: { id: string; dex_num: number; name: string; imageSmall: string; imageLarge?: string | null }[]): BreakdownItem[] =>
    cards.map(c => ({
      key: c.id, dexNum: c.dex_num, image: c.imageSmall, imageLarge: c.imageLarge ?? null,
      label: c.name, owned: ownedCardIds.has(c.id),
    }));

  const styles = useThemedStyles((colors, shadow) => ({
    hero: {
      borderRadius: radius.lg, padding: spacing.xl,
      gap: spacing.sm, alignItems: 'center' as const, ...shadow.md,
    },
    heroTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
    heroLabel: { fontSize: 17, fontFamily: fonts.display, color: 'white' },
    heroTeaser: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 },
    heroTeaserText: { fontSize: 12, fontFamily: fonts.body, color: 'rgba(255,255,255,0.85)', fontWeight: '600' as const },
    heroTeaserDot: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
    heroHint: { fontSize: 11, fontFamily: fonts.body, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

    section: { gap: spacing.sm },
    sectionTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm },
    sectionTitle: { fontSize: 18, fontFamily: fonts.display, color: colors.text },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm,
    },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },

    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const, gap: spacing.xs },
    badgeGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    bubbleEmoji: { fontSize: 22 },

    artistRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, paddingVertical: spacing.sm },
    artistRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    artistRowPressed: { backgroundColor: colors.surfaceAlt },
    artistAvatarWrap: { position: 'relative' as const },
    artistInitial: { fontSize: 15, fontFamily: fonts.display, color: 'white' },
    artistMedal: { position: 'absolute' as const, bottom: -4, right: -6, fontSize: 14 },
    artistName: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold, color: colors.text },
    artistCount: { fontSize: 13, fontFamily: fonts.mono, color: colors.textMuted },
  }));

  return (
    <>
      <Pressable onPress={() => { setStatsTab('generation'); setStatsOpen(true); }}>
        <LinearGradient
          colors={[colors.primaryBg, colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <ProgressRing
            pct={overall.pct} size={196} strokeWidth={20} color="white" trackColor="rgba(255,255,255,0.25)"
            centerLabel={`${overall.pct}%`} centerSub={`${overall.owned}/${overall.total}`}
          />
          <View style={styles.heroTitleRow}>
            <Ionicons name="trophy" size={16} color="white" />
            <Text style={styles.heroLabel}>Pokédex National</Text>
          </View>
          <View style={styles.heroTeaser}>
            <Text style={styles.heroTeaserText}>{typesComplete}/18 types complets</Text>
            <Text style={styles.heroTeaserDot}>·</Text>
            <Text style={styles.heroTeaserText}>{gensComplete}/9 générations complètes</Text>
          </View>
          <Text style={styles.heroHint}>Touche pour voir le détail</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <IconBubble size={28} color={colors.dangerBg}>
            <Ionicons name="ribbon" size={15} color={colors.danger} />
          </IconBubble>
          <Text style={styles.sectionTitle}>Badges</Text>
        </View>
        <View style={styles.badgeGrid}>
          {badges.map(b => (
            <AchievementBadge
              key={b.id}
              icon={b.icon}
              label={b.label}
              unlocked={b.unlockedNow}
              onPress={() => setBadgeDetail({ icon: b.icon, label: b.label, description: b.description, unlocked: b.unlockedNow })}
            />
          ))}
        </View>
      </View>

      <StatsTabsModal
        visible={statsOpen}
        tab={statsTab}
        onTabChange={setStatsTab}
        onClose={() => setStatsOpen(false)}>
        {statsTab === 'generation' && (
          <View style={[styles.card, styles.grid]}>
            {byGeneration.map(g => (
              <StatRingTile
                key={g.gen}
                label={g.label}
                owned={g.owned}
                total={g.total}
                color={GEN_COLORS[g.gen] ?? colors.primary}
                size={76}
                icon={(
                  <IconBubble size={44} color={GEN_COLORS[g.gen] ?? colors.primary}>
                    <Text style={styles.bubbleEmoji}>{GEN_EMOJI[g.gen] ?? '❔'}</Text>
                  </IconBubble>
                )}
                hideCaption
                onPress={() => setBreakdown({
                  title: g.label, owned: g.owned, total: g.total, color: GEN_COLORS[g.gen] ?? colors.primary,
                  items: pokemonItems(POKEDEX.filter(p => getGeneration(p.num) === g.gen)),
                })}
              />
            ))}
          </View>
        )}
        {statsTab === 'type' && (
          <View style={[styles.card, styles.grid]}>
            {byType.map(t => (
              <StatRingTile
                key={t.type}
                label={TYPE_LABEL_FR[t.type]}
                owned={t.owned}
                total={t.total}
                color={TYPE_COLORS[t.type]}
                size={76}
                icon={<TypeIcon type={t.type} size={44} />}
                hideCaption
                onPress={() => setBreakdown({
                  title: `Type ${TYPE_LABEL_FR[t.type]}`, owned: t.owned, total: t.total, color: TYPE_COLORS[t.type],
                  items: pokemonItems(POKEDEX.filter(p => p.types.includes(t.type))),
                })}
              />
            ))}
          </View>
        )}
        {statsTab === 'variants' && (
          <View style={[styles.card, styles.grid]}>
            {(Object.keys(VARIANT_LABELS) as (keyof typeof VARIANT_LABELS)[]).map(key => (
              <StatRingTile
                key={key}
                label={VARIANT_TITLES[key]}
                owned={variants[key].owned}
                total={variants[key].total}
                color={VARIANT_COLORS[key]}
                size={76}
                icon={(
                  <IconBubble size={44} color={VARIANT_COLORS[key]}>
                    <Text style={styles.bubbleEmoji}>{VARIANT_LABELS[key]}</Text>
                  </IconBubble>
                )}
                hideCaption
                onPress={() => setBreakdown({
                  title: VARIANT_TITLES[key], owned: variants[key].owned, total: variants[key].total, color: VARIANT_COLORS[key],
                  items: cardItems(variantBuckets[key]),
                })}
              />
            ))}
          </View>
        )}
        {statsTab === 'artists' && (
          <View style={styles.card}>
            {favoriteArtists.length === 0 ? (
              <Text style={styles.empty}>Aucune carte avec un artiste connu pour l’instant.</Text>
            ) : (
              favoriteArtists.map((a, i) => (
                <Pressable
                  key={a.artist}
                  style={({ pressed }) => [styles.artistRow, i > 0 && styles.artistRowBorder, pressed && styles.artistRowPressed]}
                  onPress={() => setBreakdown({
                    title: a.artist, owned: a.count, total: a.count, color: '#a78bfa', ringless: true,
                    items: ownedCards
                      .filter(c => c.artist === a.artist)
                      .map(c => ({
                        key: c.cardId, dexNum: c.dexNum, image: c.imageSmall, imageLarge: c.imageLarge,
                        label: c.name, owned: true,
                      })),
                  })}>
                  <View style={styles.artistAvatarWrap}>
                    <IconBubble size={36} color={colorForName(a.artist)}>
                      <Text style={styles.artistInitial}>{a.artist.charAt(0).toUpperCase()}</Text>
                    </IconBubble>
                    {RANK_MEDALS[i] && <Text style={styles.artistMedal}>{RANK_MEDALS[i]}</Text>}
                  </View>
                  <Text style={styles.artistName} numberOfLines={1}>{a.artist}</Text>
                  <Text style={styles.artistCount}>{a.count} carte{a.count > 1 ? 's' : ''}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </StatsTabsModal>

      <StatBreakdownModal
        target={breakdown}
        onClose={() => setBreakdown(null)}
        onSelectItem={(dexNum) => onSelectMissing?.(dexNum)}
      />
      <BadgeDetailModal target={badgeDetail} onClose={() => setBadgeDetail(null)} />
    </>
  );
}
