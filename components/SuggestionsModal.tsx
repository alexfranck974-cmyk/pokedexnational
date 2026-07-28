import { View, Text, Pressable, Modal, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import type { Suggestion } from '@/lib/suggestions';
import type { OwnedCardDetail } from '@/lib/collection';
import { ShowcaseRow } from './ShowcaseRow';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useThemedStyles, radius, spacing, fonts } from '@/lib/theme';

const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

interface Props {
  visible: boolean;
  onClose: () => void;
  evolutionSuggestions: Suggestion[];
  binderSuggestions: Suggestion[];
  generationSuggestions: Suggestion[];
  dexUpgradeSuggestions: Suggestion[];
  mostValuable: OwnedCardDetail[];
  onSelectPokemon: (dexNum: number) => void;
}

export function SuggestionsModal({
  visible, onClose, evolutionSuggestions, binderSuggestions, generationSuggestions,
  dexUpgradeSuggestions, mostValuable, onSelectPokemon,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  useModalBackClose(visible, onClose);

  const styles = useThemedStyles((colors) => ({
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
    sheet: { width: '100%' as const, maxHeight: '85%' as const, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    sheetDesktop: { width: 480, maxHeight: 680, borderRadius: radius.xl, marginBottom: 40 },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    title: { fontSize: 16, fontFamily: fonts.display, color: colors.text },
    close: { fontSize: 20, color: colors.textMuted },
    body: { padding: spacing.md, gap: spacing.lg },
  }));

  const select = (dexNum: number) => {
    onClose();
    onSelectPokemon(dexNum);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, isDesktop && styles.sheetDesktop]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Prochains achats</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <ShowcaseRow
              title="Compléter une ligne évolutive"
              items={evolutionSuggestions.map(s => ({
                key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
                onPress: () => select(s.num),
              }))}
              emptyHint="Toutes tes lignes évolutives possédées sont complètes !"
            />
            <ShowcaseRow
              title="Finir une page de classeur (4×4)"
              items={binderSuggestions.map(s => ({
                key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
                onPress: () => select(s.num),
              }))}
              emptyHint="Aucune page en cours de complétion pour l’instant."
            />
            <ShowcaseRow
              title="Génération prioritaire"
              items={generationSuggestions.map(s => ({
                key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
                onPress: () => select(s.num),
              }))}
              emptyHint="Bravo, toutes les générations sont complètes !"
            />
            <ShowcaseRow
              title="Depuis tes collections"
              items={dexUpgradeSuggestions.map(s => ({
                key: String(s.num), image: s.spriteUrl, label: s.name, caption: s.reason,
                onPress: () => select(s.num),
              }))}
              emptyHint="Aucune carte possédée en attente de devenir ta carte officielle."
            />
            <ShowcaseRow
              title="Tes cartes les plus chères"
              items={mostValuable.map(c => ({
                key: c.cardId,
                image: c.imageSmall,
                label: c.name,
                caption: c.cardmarketTrendEur !== null ? eurFormatter.format(c.cardmarketTrendEur) : undefined,
                onPress: () => select(c.dexNum),
              }))}
              emptyHint="Aucune carte avec un prix connu pour l’instant."
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
