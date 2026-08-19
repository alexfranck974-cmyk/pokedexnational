import type { ReactNode } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, spacing, fonts } from '@/lib/theme';
import { useLocale } from '@/lib/locale';
import { BackButton } from '@/components/BackButton';

const CONTACT_EMAIL = 'alex.franck974@gmail.com';

// See app/legal/privacy.tsx for why this is plain data (a Part[] per
// paragraph/bullet, `{ bold }` spans marked explicitly) rather than STRINGS
// keys — this is prose swapped wholesale per locale, not short UI strings.
type Part = string | { bold: string };
type Block = { kind: 'p'; parts: Part[] } | { kind: 'li'; parts: Part[] };
interface LegalSection { title: string; blocks: Block[] }

const CONTENT: Record<'fr' | 'en', LegalSection[]> = {
  fr: [
    {
      title: 'Objet du site',
      blocks: [
        { kind: 'p', parts: [
          'Pokédex National est un outil personnel et gratuit pour suivre sa collection de cartes Pokémon TCG face ',
          'au Pokédex national. C’est un projet de fan, non commercial.',
        ] },
      ],
    },
    {
      title: 'Projet non officiel',
      blocks: [
        { kind: 'p', parts: [
          'Ce site n’est ni affilié, ni approuvé, ni sponsorisé par Nintendo, Game Freak, Creatures Inc. ou The ',
          'Pokémon Company. Pokémon et les noms des personnages sont des marques déposées de leurs propriétaires ',
          'respectifs. Les données et images de cartes affichées proviennent de la base ouverte tierce ',
          { bold: 'pokemontcg.io' }, '.',
        ] },
      ],
    },
    {
      title: 'Ton compte',
      blocks: [
        { kind: 'p', parts: [
          'Un compte est nécessaire pour suivre sa collection. Ton nom d’utilisateur est définitif une fois choisi. ',
          'Tu es responsable de la confidentialité de ton mot de passe et de l’activité sur ton compte.',
        ] },
      ],
    },
    {
      title: 'Utilisation acceptable',
      blocks: [
        { kind: 'p', parts: ['En utilisant le site, tu t’engages à ne pas :'] },
        { kind: 'li', parts: ['• Créer un compte pour usurper l’identité d’un tiers'] },
        { kind: 'li', parts: ['• Tenter d’extraire massivement les données d’autres utilisateurs'] },
        { kind: 'li', parts: ['• Perturber le fonctionnement du service (attaques, abus automatisés)'] },
      ],
    },
    {
      title: 'Disponibilité du service',
      blocks: [
        { kind: 'p', parts: [
          'Le site est fourni « en l’état », sans garantie de disponibilité continue. C’est un projet personnel ',
          'maintenu sur le temps libre — des interruptions ou évolutions peuvent survenir sans préavis.',
        ] },
      ],
    },
    {
      title: 'Suppression de compte',
      blocks: [
        { kind: 'p', parts: [
          'Tu peux demander la suppression de ton compte et de toutes tes données à tout moment en écrivant à ',
          { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Contact',
      blocks: [
        { kind: 'p', parts: ['Pour toute question sur ces conditions : ', { bold: CONTACT_EMAIL }, '.'] },
      ],
    },
  ],
  en: [
    {
      title: 'Purpose of the site',
      blocks: [
        { kind: 'p', parts: [
          'Pokédex National is a free, personal tool for tracking your Pokémon TCG card collection against the ',
          'National Pokédex. It’s a non-commercial fan project.',
        ] },
      ],
    },
    {
      title: 'Unofficial project',
      blocks: [
        { kind: 'p', parts: [
          'This site is not affiliated with, endorsed by, or sponsored by Nintendo, Game Freak, Creatures Inc., or ',
          'The Pokémon Company. Pokémon and character names are registered trademarks of their respective owners. ',
          'Card data and images shown come from the third-party open database ',
          { bold: 'pokemontcg.io' }, '.',
        ] },
      ],
    },
    {
      title: 'Your account',
      blocks: [
        { kind: 'p', parts: [
          'An account is required to track your collection. Your username is final once chosen. You’re ',
          'responsible for keeping your password confidential and for the activity on your account.',
        ] },
      ],
    },
    {
      title: 'Acceptable use',
      blocks: [
        { kind: 'p', parts: ['By using the site, you agree not to:'] },
        { kind: 'li', parts: ['• Create an account to impersonate someone else'] },
        { kind: 'li', parts: ['• Attempt to bulk-extract other users’ data'] },
        { kind: 'li', parts: ['• Disrupt the service (attacks, automated abuse)'] },
      ],
    },
    {
      title: 'Service availability',
      blocks: [
        { kind: 'p', parts: [
          'The site is provided "as is," with no guarantee of continuous availability. It’s a personal project ',
          'maintained in spare time — interruptions or changes may happen without notice.',
        ] },
      ],
    },
    {
      title: 'Account deletion',
      blocks: [
        { kind: 'p', parts: [
          'You can request deletion of your account and all your data at any time by writing to ',
          { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Contact',
      blocks: [
        { kind: 'p', parts: ['For any question about these terms: ', { bold: CONTACT_EMAIL }, '.'] },
      ],
    },
  ],
};

const TITLES = {
  fr: { header: 'Conditions d’utilisation', updated: 'Dernière mise à jour : juillet 2026' },
  en: { header: 'Terms of Use', updated: 'Last updated: July 2026' },
};

function renderParts(parts: Part[], boldStyle: object): ReactNode[] {
  return parts.map((part, i) => typeof part === 'string'
    ? part
    : <Text key={i} style={boldStyle}>{part.bold}</Text>);
}

function Section({ title, blocks, styles }: { title: string; blocks: Block[]; styles: any }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {blocks.map((block, i) => (
        <Text key={i} style={block.kind === 'li' ? styles.li : styles.p}>{renderParts(block.parts, styles.bold)}</Text>
      ))}
    </View>
  );
}

export default function TermsOfUse() {
  const { locale } = useLocale();
  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md },
    headerTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.text },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
    title: { fontSize: 17, fontFamily: fonts.display, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
    p: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 21 },
    li: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 21, marginLeft: spacing.sm },
    bold: { fontFamily: fonts.bodyBold, color: colors.text },
    updated: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim, marginTop: spacing.xs },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{TITLES[locale].header}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>{TITLES[locale].updated}</Text>
        {CONTENT[locale].map((section, i) => (
          <Section key={i} title={section.title} blocks={section.blocks} styles={styles} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
