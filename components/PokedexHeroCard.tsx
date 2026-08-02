import { useMemo, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import {
  useUserDex, useAllOwnedCardIds, useAllOwnedCardsDetailed, useOwnedDexNums, useWishedDexNums,
  useAllOwnedCardsLedgerDetailed, useOwnedCardQuantities, useAllWishedCards,
} from '@/lib/collection';
import { useVariantCards } from '@/lib/tcg-index';
import {
  computeOverallProgress, computeByGeneration, computeByType,
  bucketVariantCards, computeVariantProgress, topArtists, totalCollectionValue,
} from '@/lib/dashboard-stats';
import { computeDexProgress, dexStateFor, type DexState } from '@/lib/dex-progress';
import { eurFormatter } from '@/lib/trades';
import { getGeneration, GEN_EMOJI, GEN_COLORS } from '@/lib/generations';
import { ProgressRing } from './ProgressRing';
import { StatRingTile } from './StatRingTile';
import { StatBreakdownModal, type BreakdownTarget, type BreakdownItem } from './StatBreakdownModal';
import { StatsTabsModal, type StatsTab } from './StatsTabsModal';
import { TypeIcon } from './TypeIcon';
import { IconBubble } from './IconBubble';
import { Pokeball } from './Pokeball';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';
import { useTheme, useThemedStyles, radius, spacing, fonts } from '@/lib/theme';
import { usePressSpring } from '@/lib/use-press-spring';
import { withAlpha } from '@/lib/color-utils';

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
  /** Called when tapping a non-owned breakdown item. Owner navigates to the detail page; spectator views can omit. */
  onSelectMissing?: (dexNum: number) => void;
}

export function PokedexHeroCard({ userId, onSelectMissing }: Props) {
  const { colors } = useTheme();
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: ownedCardIds = new Set<string>() } = useAllOwnedCardIds(userId);
  const { data: ownedCards = [] } = useAllOwnedCardsDetailed(userId);
  const { data: variantCards = [] } = useVariantCards();
  const { data: capturedDex = new Set<number>() } = useOwnedDexNums(userId);
  const { data: wishedDex = new Set<number>() } = useWishedDexNums(userId);
  const { data: ledgerCards = [] } = useAllOwnedCardsLedgerDetailed(userId);
  const { data: ownedQuantities = new Map<string, number>() } = useOwnedCardQuantities(userId);
  const { data: wishedCards = [] } = useAllWishedCards(userId);
  const [breakdown, setBreakdown] = useState<BreakdownTarget | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<StatsTab>('progress');
  const { scale, pressIn, pressOut } = usePressSpring();

  // "Choisi" = has a card picked to represent it in the grid (user_cards).
  // "Capturé" = owns at least one printing (user_owned_cards) but hasn't
  // picked one yet. "Vu" = only on the wishlist. Mutually exclusive, in that
  // priority order — see lib/dex-progress.ts.
  const dexProgress = useMemo(
    () => computeDexProgress(POKEDEX, owned, capturedDex, wishedDex),
    [owned, capturedDex, wishedDex],
  );
  // "Choisi" value: the single card picked per Pokémon, at most 1025 cards.
  const chosenValue = useMemo(() => ownedCards.reduce((sum, c) => sum + (c.cardmarketTrendEur ?? 0), 0), [ownedCards]);
  // Full owned ledger weighted by quantity — chosen + captured-but-not-chosen + duplicates.
  const totalOwnedValue = useMemo(() => totalCollectionValue(ledgerCards, ownedQuantities), [ledgerCards, ownedQuantities]);
  // Theoretical: what completing the wishlist would cost, deduped per card (not owned yet, so no quantity to weigh by).
  const wishlistValue = useMemo(
    () => wishedCards.reduce((sum: number, c: { cardmarket_trend_eur?: number | null }) => sum + (c.cardmarket_trend_eur ?? 0), 0),
    [wishedCards],
  );

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
  const stateItems = (state: DexState): BreakdownItem[] =>
    pokemonItems(POKEDEX.filter(p => dexStateFor(p.num, owned, capturedDex, wishedDex) === state));

  const styles = useThemedStyles((colors, shadow) => ({
    hero: {
      paddingVertical: spacing.lg, gap: spacing.sm, alignItems: 'center' as const,
    },
    // Purely a shadow carrier — round, so the glow follows the ring's circular
    // shape instead of the square bounding box a plain shadow on the ring's
    // own wrapper would produce. backgroundColor is near-invisible (2% alpha)
    // rather than fully transparent — Android's elevation shadow often doesn't
    // render on a fully transparent view, this gives it something to light.
    ringGlow: {
      width: 196, height: 196, borderRadius: 98,
      backgroundColor: withAlpha(colors.bg, 0.02),
      shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 28,
      shadowOffset: { width: 0, height: 0 }, elevation: 12,
    },
    heroTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
    heroLabel: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
    heroTeaser: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 },
    heroTeaserText: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, fontWeight: '600' as const },
    heroTeaserDot: { fontSize: 12, color: colors.textDim },
    heroHint: { fontSize: 11, fontFamily: fonts.body, color: colors.textDim, marginTop: 2 },

    card: {
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadow.sm,
    },
    empty: { fontSize: 13, fontFamily: fonts.body, color: colors.textDim, fontStyle: 'italic' as const },

    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const, gap: spacing.xs },
    bubbleEmoji: { fontSize: 22 },

    valueRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      paddingVertical: spacing.xs,
    },
    valueRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    valueLabel: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
    valueAmount: { fontSize: 13, fontFamily: fonts.monoBold, color: colors.success },

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
      <Pressable
        onPress={() => { setStatsTab('progress'); setStatsOpen(true); }}
        onPressIn={pressIn}
        onPressOut={pressOut}>
        <Animated.View style={[styles.hero, { transform: [{ scale }] }]}>
          <View style={styles.ringGlow}>
            <ProgressRing
              pct={overall.pct} size={196} strokeWidth={20} color={colors.primary} trackColor={colors.surfaceAlt}
              centerLabel={`${overall.pct}%`} centerSub={`${overall.owned}/${overall.total}`}
            />
          </View>
          <View style={styles.heroTitleRow}>
            <Ionicons name="trophy" size={16} color={colors.primary} />
            <Text style={styles.heroLabel}>Pokédex National</Text>
          </View>
          <View style={styles.heroTeaser}>
            <Text style={styles.heroTeaserText}>{typesComplete}/18 types complets</Text>
            <Text style={styles.heroTeaserDot}>·</Text>
            <Text style={styles.heroTeaserText}>{gensComplete}/9 générations complètes</Text>
          </View>
          <Text style={styles.heroHint}>Touche pour voir le détail</Text>
        </Animated.View>
      </Pressable>

      <StatsTabsModal
        visible={statsOpen}
        tab={statsTab}
        onTabChange={setStatsTab}
        tint={colors.primary}
        onClose={() => setStatsOpen(false)}>
        {statsTab === 'progress' && (
          <>
            <View style={[styles.card, styles.grid]}>
              <StatRingTile
                label="Choisi" owned={dexProgress.chosen} total={POKEDEX.length} color={colors.primary} size={76}
                icon={<IconBubble size={44} color={colors.primary}><Pokeball size={26} /></IconBubble>}
                onPress={() => setBreakdown({
                  title: 'Choisi', owned: dexProgress.chosen, total: POKEDEX.length, color: colors.primary,
                  items: stateItems('chosen'),
                })}
              />
              <StatRingTile
                label="Capturé" owned={dexProgress.captured} total={POKEDEX.length} color={colors.success} size={76}
                icon={<IconBubble size={44} color={colors.success}><Ionicons name="cube" size={22} color="white" /></IconBubble>}
                onPress={() => setBreakdown({
                  title: 'Capturé', owned: dexProgress.captured, total: POKEDEX.length, color: colors.success,
                  items: stateItems('captured'),
                })}
              />
              <StatRingTile
                label="Vu" owned={dexProgress.seen} total={POKEDEX.length} color={colors.danger} size={76}
                icon={<IconBubble size={44} color={colors.danger}><Ionicons name="heart" size={20} color="white" /></IconBubble>}
                onPress={() => setBreakdown({
                  title: 'Vu', owned: dexProgress.seen, total: POKEDEX.length, color: colors.danger,
                  items: stateItems('seen'),
                })}
              />
              <StatRingTile
                label="Restant" owned={dexProgress.remaining} total={POKEDEX.length} color={colors.textDim} size={76}
                icon={<IconBubble size={44} color={colors.textDim}><Ionicons name="help" size={22} color="white" /></IconBubble>}
                onPress={() => setBreakdown({
                  title: 'Restant à voir', owned: dexProgress.remaining, total: POKEDEX.length, color: colors.textDim,
                  items: stateItems('remaining'),
                })}
              />
            </View>
            <View style={styles.card}>
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Valeur des cartes choisies</Text>
                <Text style={styles.valueAmount}>{eurFormatter.format(chosenValue)}</Text>
              </View>
              <View style={[styles.valueRow, styles.valueRowBorder]}>
                <Text style={styles.valueLabel}>Valeur totale possédée</Text>
                <Text style={styles.valueAmount}>{eurFormatter.format(totalOwnedValue)}</Text>
              </View>
              <View style={[styles.valueRow, styles.valueRowBorder]}>
                <Text style={styles.valueLabel}>Valeur théorique de ta wishlist</Text>
                <Text style={styles.valueAmount}>{eurFormatter.format(wishlistValue)}</Text>
              </View>
            </View>
          </>
        )}
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
    </>
  );
}
