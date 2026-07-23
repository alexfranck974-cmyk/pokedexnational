import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

// Thin wrapper marking "entering the Pokémon detail screen from outside the
// Pokédex tab" call sites — kept distinct from a bare router.push so it's easy
// to grep for every place that does this.
export function enterPokemonDetail(router: Router, href: string) {
  router.push(href as Parameters<Router['push']>[0]);
}
