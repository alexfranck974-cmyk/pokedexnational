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

export default function TermsOfUse() {
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
        <Text style={styles.headerTitle}>Conditions d'utilisation</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.updated}>Dernière mise à jour : juillet 2026</Text>

        <Section title="Objet du site">
          <Text style={styles.p}>
            Pokédex National est un outil personnel et gratuit pour suivre sa collection de cartes Pokémon TCG face
            au Pokédex national. C'est un projet de fan, non commercial.
          </Text>
        </Section>

        <Section title="Projet non officiel">
          <Text style={styles.p}>
            Ce site n'est ni affilié, ni approuvé, ni sponsorisé par Nintendo, Game Freak, Creatures Inc. ou The
            Pokémon Company. Pokémon et les noms des personnages sont des marques déposées de leurs propriétaires
            respectifs. Les données et images de cartes affichées proviennent de la base ouverte tierce{' '}
            <Text style={styles.bold}>pokemontcg.io</Text>.
          </Text>
        </Section>

        <Section title="Ton compte">
          <Text style={styles.p}>
            Un compte est nécessaire pour suivre sa collection. Ton nom d'utilisateur est définitif une fois choisi.
            Tu es responsable de la confidentialité de ton mot de passe et de l'activité sur ton compte.
          </Text>
        </Section>

        <Section title="Utilisation acceptable">
          <Text style={styles.p}>En utilisant le site, tu t'engages à ne pas :</Text>
          <Text style={styles.li}>• Créer un compte pour usurper l'identité d'un tiers</Text>
          <Text style={styles.li}>• Tenter d'extraire massivement les données d'autres utilisateurs</Text>
          <Text style={styles.li}>• Perturber le fonctionnement du service (attaques, abus automatisés)</Text>
        </Section>

        <Section title="Disponibilité du service">
          <Text style={styles.p}>
            Le site est fourni « en l'état », sans garantie de disponibilité continue. C'est un projet personnel
            maintenu sur le temps libre — des interruptions ou évolutions peuvent survenir sans préavis.
          </Text>
        </Section>

        <Section title="Suppression de compte">
          <Text style={styles.p}>
            Tu peux demander la suppression de ton compte et de toutes tes données à tout moment en écrivant à{' '}
            <Text style={styles.bold}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>

        <Section title="Contact">
          <Text style={styles.p}>
            Pour toute question sur ces conditions : <Text style={styles.bold}>{CONTACT_EMAIL}</Text>.
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
