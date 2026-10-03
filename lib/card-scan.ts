import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

export interface ScannedCardCandidate {
  id: string;
  name: string;
  dex_num: number | null;
  image_small: string;
  image_large: string | null;
  set_id: string;
  set_name: string;
  region: string;
  card_number: string;
  rarity: string | null;
}

// null = user cancelled the picker or denied permission (quietly do nothing,
// not an error toast) — distinct from a resolved-but-empty candidate list,
// which the caller should show as "aucune carte reconnue", not silently drop.
async function pickAndCompressImage(source: 'camera' | 'library'): Promise<string | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;

  // Downscale before sending to the scan-card Edge Function — printed card
  // text doesn't need more than ~1200px on the long edge for Vision OCR to
  // read it, and a full-resolution photo only adds upload time/latency (and,
  // depending on Vision's own size-based processing, possibly cost) for no
  // accuracy gain. base64:true here returns the raw base64 string with no
  // data-URI prefix — exactly what the Vision API's image.content field wants.
  const manipulated = await manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: SaveFormat.JPEG, base64: true },
  );
  return manipulated.base64 ?? null;
}

// One round trip: capture/pick a photo, compress it, hand it to the
// scan-card Edge Function (lib/supabase.ts's client already carries the
// project's anon key — no auth required, this works for a signed-out
// visitor on a public profile too), get back up to 3 candidate cards.
export function useCardScan() {
  return useMutation({
    mutationFn: async (source: 'camera' | 'library'): Promise<ScannedCardCandidate[] | null> => {
      const imageBase64 = await pickAndCompressImage(source);
      if (!imageBase64) return null;
      const { data, error } = await supabase.functions.invoke('scan-card', {
        body: { imageBase64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.candidates ?? []) as ScannedCardCandidate[];
    },
  });
}
