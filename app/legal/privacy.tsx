import type { ReactNode } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, spacing, fonts } from '@/lib/theme';
import { useLocale } from '@/lib/locale';
import { BackButton } from '@/components/BackButton';

const CONTACT_EMAIL = 'alex.franck974@gmail.com';

// A part is either plain text or a `{ bold }` span rendered as a styled
// nested <Text> — same idea as useTRich()'s `**...**` marker, just as plain
// data instead of a STRINGS-dictionary template, since this is prose content
// swapped wholesale per locale, not short UI strings needing interpolation.
type Part = string | { bold: string };
type Block = { kind: 'p'; parts: Part[] } | { kind: 'li'; parts: Part[] };
interface LegalSection { title: string; blocks: Block[] }

const CONTENT: Record<'fr' | 'en', LegalSection[]> = {
  fr: [
    {
      title: 'Qui exploite ce site ?',
      blocks: [
        { kind: 'p', parts: [
          'Pokédex National est un projet personnel, non commercial, exploité par une personne physique. ',
          'Pour toute question ou demande liée à tes données, écris à ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Quelles données sont collectées ?',
      blocks: [
        { kind: 'p', parts: ['À la création de ton compte :'] },
        { kind: 'li', parts: ['• Adresse email et mot de passe (le mot de passe n’est jamais stocké en clair, il est géré par notre prestataire d’authentification)'] },
        { kind: 'li', parts: ['• Nom d’utilisateur (immuable) et nom affiché'] },
        { kind: 'p', parts: ['En utilisant l’application :'] },
        { kind: 'li', parts: ['• Les cartes que tu marques comme possédées, en wishlist, en favori ou en vitrine'] },
        { kind: 'li', parts: ['• Les équipes et collections personnalisées que tu crées'] },
        { kind: 'li', parts: ['• Des données techniques en cas d’erreur (message d’erreur, navigateur, appareil) via notre outil de suivi d’erreurs'] },
      ],
    },
    {
      title: 'Pourquoi ces données ?',
      blocks: [
        { kind: 'p', parts: [
          'Uniquement pour faire fonctionner le service : afficher ta progression, ta collection, et te permettre de ',
          'la partager si tu le souhaites. Aucune donnée n’est vendue, louée, ni utilisée à des fins publicitaires.',
        ] },
      ],
    },
    {
      title: 'Ton profil public',
      blocks: [
        { kind: 'p', parts: [
          'Si tu actives l’option ', { bold: '« Profil public »' }, ' dans les réglages, ton nom ',
          'd’utilisateur, ton nom affiché, ta progression et ta collection deviennent visibles par toute personne ',
          'disposant du lien — y compris sans compte. Cette option est désactivable à tout moment.',
        ] },
      ],
    },
    {
      title: 'Qui a accès à ces données ?',
      blocks: [
        { kind: 'p', parts: ['Seuls les prestataires techniques nécessaires au fonctionnement du site :'] },
        { kind: 'li', parts: ['• ', { bold: 'Supabase' }, ' — base de données et authentification'] },
        { kind: 'li', parts: ['• ', { bold: 'Vercel' }, ' — hébergement du site'] },
        { kind: 'li', parts: ['• ', { bold: 'Sentry' }, ' — suivi des erreurs techniques'] },
        { kind: 'p', parts: ['Ces prestataires n’utilisent tes données que pour fournir leur service technique, pas pour leur propre compte.'] },
      ],
    },
    {
      title: 'Combien de temps sont-elles conservées ?',
      blocks: [
        { kind: 'p', parts: [
          'Tant que ton compte existe. Tu peux demander la suppression complète de ton compte et de tes données à ',
          'tout moment en écrivant à ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Tes droits',
      blocks: [
        { kind: 'p', parts: [
          'Conformément au RGPD, tu disposes d’un droit d’accès, de rectification, d’effacement, de portabilité et ',
          'd’opposition sur tes données. Pour les exercer, écris à ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Cookies et stockage local',
      blocks: [
        { kind: 'p', parts: [
          'Aucun cookie publicitaire ou de traçage. L’application utilise uniquement le stockage nécessaire à son ',
          'fonctionnement (garder ta session connectée, mémoriser ton thème clair/sombre).',
        ] },
      ],
    },
  ],
  en: [
    {
      title: 'Who operates this site?',
      blocks: [
        { kind: 'p', parts: [
          'Pokédex National is a personal, non-commercial project run by an individual. ',
          'For any question or request about your data, write to ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'What data is collected?',
      blocks: [
        { kind: 'p', parts: ['When you create your account:'] },
        { kind: 'li', parts: ['• Email address and password (the password is never stored in plain text — it’s handled by our authentication provider)'] },
        { kind: 'li', parts: ['• Username (immutable) and display name'] },
        { kind: 'p', parts: ['While using the app:'] },
        { kind: 'li', parts: ['• The cards you mark as owned, wishlisted, favorited, or showcased'] },
        { kind: 'li', parts: ['• The teams and custom collections you create'] },
        { kind: 'li', parts: ['• Technical data in case of an error (error message, browser, device) via our error-tracking tool'] },
      ],
    },
    {
      title: 'Why this data?',
      blocks: [
        { kind: 'p', parts: [
          'Only to make the service work: showing your progress, your collection, and letting you share it if you ',
          'choose to. No data is sold, rented, or used for advertising purposes.',
        ] },
      ],
    },
    {
      title: 'Your public profile',
      blocks: [
        { kind: 'p', parts: [
          'If you enable the ', { bold: '"Public profile"' }, ' option in settings, your username, display name, ',
          'progress, and collection become visible to anyone with the link — including people without an account. ',
          'This option can be turned off at any time.',
        ] },
      ],
    },
    {
      title: 'Who has access to this data?',
      blocks: [
        { kind: 'p', parts: ['Only the technical providers necessary to run the site:'] },
        { kind: 'li', parts: ['• ', { bold: 'Supabase' }, ' — database and authentication'] },
        { kind: 'li', parts: ['• ', { bold: 'Vercel' }, ' — site hosting'] },
        { kind: 'li', parts: ['• ', { bold: 'Sentry' }, ' — technical error tracking'] },
        { kind: 'p', parts: ['These providers only use your data to deliver their technical service, never for their own purposes.'] },
      ],
    },
    {
      title: 'How long is it kept?',
      blocks: [
        { kind: 'p', parts: [
          'For as long as your account exists. You can request full deletion of your account and data at any ',
          'time by writing to ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Your rights',
      blocks: [
        { kind: 'p', parts: [
          'Under the GDPR, you have the right to access, rectify, erase, port, and object to the processing of ',
          'your data. To exercise these rights, write to ', { bold: CONTACT_EMAIL }, '.',
        ] },
      ],
    },
    {
      title: 'Cookies and local storage',
      blocks: [
        { kind: 'p', parts: [
          'No advertising or tracking cookies. The app only uses storage necessary for it to function (keeping ',
          'you signed in, remembering your light/dark theme).',
        ] },
      ],
    },
  ],
};

const TITLES = {
  fr: { header: 'Politique de confidentialité', updated: 'Dernière mise à jour : juillet 2026' },
  en: { header: 'Privacy Policy', updated: 'Last updated: July 2026' },
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

export default function PrivacyPolicy() {
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
