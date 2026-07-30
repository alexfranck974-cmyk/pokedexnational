import { ScrollView } from 'react-native';
import type { Suggestion } from '@/lib/suggestions';
import type { OwnedCardDetail } from '@/lib/collection';
import { ShowcaseRow } from './ShowcaseRow';
import { BubbleSheet } from './BubbleSheet';
import { useModalBackClose } from '@/lib/useModalBackClose';
import { useThemedStyles, spacing } from '@/lib/theme';

const eurFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

interface Props {
  visible: boolean;
  onClose: () => void;
  tint: string;
  evolutionSuggestions: Suggestion[];
  binderSuggestions: Suggestion[];
  generationSuggestions: Suggestion[];
  dexUpgradeSuggestions: Suggestion[];
  mostValuable: OwnedCardDetail[];
  onSelectPokemon: (dexNum: number) => void;
}

export function SuggestionsModal({
  visible, onClose, tint, evolutionSuggestions, binderSuggestions, generationSuggestions,
  dexUpgradeSuggestions, mostValuable, onSelectPokemon,
}: Props) {
  useModalBackClose(visible, onClose);

  const styles = useThemedStyles(() => ({
    body: { padding: spacing.md, gap: spacing.lg },
  }));

  const select = (dexNum: number) => {
    onClose();
    onSelectPokemon(dexNum);
  };

  return (
    <BubbleSheet visible={visible} onClose={onClose} tint={tint} title="Prochains achats">
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
    </BubbleSheet>
  );
}
