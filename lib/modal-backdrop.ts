import { useLayoutEffect, useState } from 'react';

// Every component that renders its own dimming backdrop (colors.backdrop) —
// CardZoomModal, BubbleSheet, FriendSetGalleryModal, ConfirmDialog, and the
// various filter/picker sheets — is unaware another one might already be
// open underneath it (e.g. zooming a card from inside an already-open
// gallery sheet, or opening a set/rarity picker from inside the main filter
// sheet). React Native's <Modal> renders each instance as its own top-level
// portal, so nested backdrops don't replace one another, they compound —
// reproduced 2026-09-21 opening a card zoom from inside the Wishlist's
// per-Pokémon gallery sheet: dark mode's ~0.7-opacity backdrop rendered
// twice comes out to ~0.91, visibly muddier than either alone. This is
// platform-agnostic (a RN <Modal> rendering issue, not a web/history one),
// unlike history-back-guard.ts/useModalBackClose.ts's web-only stack.
let openCount = 0;

// Call with the same `isOpen` boolean already driving the component's
// <Modal visible={...}>. Returns whether some OTHER backdrop was already
// showing at the moment this one opened — true means render this one fully
// transparent instead of colors.backdrop, since the screen underneath is
// already dimmed enough.
export function useBackdropDepth(isOpen: boolean): boolean {
  const [hasBackdropBeneath, setHasBackdropBeneath] = useState(false);

  // useLayoutEffect (not useEffect): the corrected value must land before
  // the browser paints, or a nested backdrop would flash fully-dimmed for
  // one frame before correcting to transparent.
  useLayoutEffect(() => {
    if (!isOpen) return;
    setHasBackdropBeneath(openCount > 0);
    openCount += 1;
    return () => { openCount -= 1; };
  }, [isOpen]);

  return isOpen && hasBackdropBeneath;
}
