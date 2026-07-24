import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, useThemedStyles, spacing, fonts } from '@/lib/theme';

const CONTACT_EMAIL = 'alex.franck974@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles((colors) => ({
    title: { fontSize: 17, fontFamily: fonts.display, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.xs },
  }));
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export default function PrivacyPolicy() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles((colors) => ({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, padding: spacing.md },
    headerTitle: { fontSize: 20, fontFamily: fonts.display, color: colors.text },
    scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
    p: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 21 },
    li: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, lineHeight: 21, marginLeft: spacing.sm },
    bold: { fontFamily: fonts.bodyBold, color: colors.text },
    updated: { fontSize: 12, fontFamily: fonts.mono, color: colors.textDim, marginTop: spacing.xs },
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Politique de confidentialité</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>Dernière mise à jour : juillet 2026</Text>

        <Section title="Qui exploite ce site ?">
          <Text style={styles.p}>
            Pokédex National est un projet personnel, non commercial, exploité par une personne physique.
            Pour toute question ou demande liée à tes données, écris à{' '}
            <Text style={styles.bold}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>

        <Section title="Quelles données sont collectées ?">
          <Text style={styles.p}>À la création de ton compte :</Text>
          <Text style={styles.li}>• Adresse email et mot de passe (le mot de passe n'est jamais stocké en clair, il est géré par notre prestataire d'authentification)</Text>
          <Text style={styles.li}>• Nom d'utilisateur (immuable) et nom affiché</Text>
          <Text style={styles.p}>En utilisant l'application :</Text>
          <Text style={styles.li}>• Les cartes que tu marques comme possédées, en wishlist, en favori ou en vitrine</Text>
          <Text style={styles.li}>• Les équipes et collections personnalisées que tu crées</Text>
          <Text style={styles.li}>• Des données techniques en cas d'erreur (message d'erreur, navigateur, appareil) via notre outil de suivi d'erreurs</Text>
        </Section>

        <Section title="Pourquoi ces données ?">
          <Text style={styles.p}>
            Uniquement pour faire fonctionner le service : afficher ta progression, ta collection, et te permettre de
            la partager si tu le souhaites. Aucune donnée n'est vendue, louée, ni utilisée à des fins publicitaires.
          </Text>
        </Section>

        <Section title="Ton profil public">
          <Text style={styles.p}>
            Si tu actives l'option <Text style={styles.bold}>« Profil public »</Text> dans les réglages, ton nom
            d'utilisateur, ton nom affiché, ta progression et ta collection deviennent visibles par toute personne
            disposant du lien — y compris sans compte. Cette option est désactivable à tout moment.
          </Text>
        </Section>

        <Section title="Qui a accès à ces données ?">
          <Text style={styles.p}>Seuls les prestataires techniques nécessaires au fonctionnement du site :</Text>
          <Text style={styles.li}>• <Text style={styles.bold}>Supabase</Text> — base de données et authentification</Text>
          <Text style={styles.li}>• <Text style={styles.bold}>Vercel</Text> — hébergement du site</Text>
          <Text style={styles.li}>• <Text style={styles.bold}>Sentry</Text> — suivi des erreurs techniques</Text>
          <Text style={styles.p}>
            Ces prestataires n'utilisent tes données que pour fournir leur service technique, pas pour leur propre
            compte.
          </Text>
        </Section>

        <Section title="Combien de temps sont-elles conservées ?">
          <Text style={styles.p}>
            Tant que ton compte existe. Tu peux demander la suppression complète de ton compte et de tes données à
            tout moment en écrivant à <Text style={styles.bold}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>

        <Section title="Tes droits">
          <Text style={styles.p}>
            Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, d'effacement, de portabilité et
            d'opposition sur tes données. Pour les exercer, écris à <Text style={styles.bold}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>

        <Section title="Cookies et stockage local">
          <Text style={styles.p}>
            Aucun cookie publicitaire ou de traçage. L'application utilise uniquement le stockage nécessaire à son
            fonctionnement (garder ta session connectée, mémoriser ton thème clair/sombre).
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
