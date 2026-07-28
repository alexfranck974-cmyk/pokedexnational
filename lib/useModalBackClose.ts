import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// On web, make the browser/Android back gesture close the modal instead of
// navigating the underlying page away: push a throwaway history entry while
// open, and treat popping it as a close request. Keyed on isOpen so browsing
// between items within an open modal doesn't push/pop per item.
export function useModalBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (Platform.OS !== 'web' || !isOpen) return;
    let closedViaPopState = false;
    window.history.pushState({ modalOpen: true }, '');
    const handlePopState = () => {
      closedViaPopState = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // Closed via tap/swipe rather than the back button — consume the entry
      // we pushed so a later real "back" press isn't silently swallowed by it.
      if (!closedViaPopState) window.history.back();
    };
  }, [isOpen]);
}
