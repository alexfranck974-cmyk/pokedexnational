import { PokedexHeroCard } from './PokedexHeroCard';
import { BadgesSection } from './BadgesSection';

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
  userId, wishedCardIds, wishlistCount, showValueBadges, onSelectMissing,
}: Props) {
  return (
    <>
      <PokedexHeroCard userId={userId} onSelectMissing={onSelectMissing} />
      <BadgesSection
        userId={userId}
        wishedCardIds={wishedCardIds}
        wishlistCount={wishlistCount}
        showValueBadges={showValueBadges}
      />
    </>
  );
}
