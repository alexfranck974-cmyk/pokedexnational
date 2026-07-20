# Pokedexnational — Design V1

**Date:** 2026-07-20
**Statut:** Design validé, en attente de plan d'implémentation.

## 1. Objectif

Application permettant à un collectionneur de suivre sa progression sur le Pokédex National (1025 Pokémon). Chaque utilisateur possède son propre Pokédex, marque les Pokémon possédés d'un tap, et peut partager sa progression via un lien public en lecture seule.

## 2. Portée V1

**Inclus :**

- Grille des 1025 Pokémon (numéro, nom localisé FR par défaut / EN en fallback, sprite, types)
- Toggle possédé / manquant, avec optimistic UI
- Persistance backend (Supabase Postgres)
- Authentification email + mot de passe
- Compte utilisateur avec username choisi au signup, immutable
- Lien public de partage `/u/{username}` en lecture seule (aucun compte requis pour consulter)
- Sync entre appareils au chargement / pull-to-refresh (pas de push temps réel)
- Recherche par nom ou numéro
- Filtres : tous / possédés / manquants
- Tri : numéro ↑↓, nom A→Z / Z→A
- Écran détail d'un Pokémon (grand sprite, nom, numéro, types, toggle)
- Responsive : phone (3 col), tablet (5 col), desktop (8 col)
- Support des trois plateformes (iOS, Android, Web) via Expo
- Light mode uniquement
- Compteur de progression `possédés / 1025 (%)`

**Exclus V1 (backlog V2+) :**

- Filtres par type Pokémon
- Toggle multi-langue depuis les settings (FR forcé en V1)
- Dark mode
- Sync temps réel via WebSocket
- Système d'amis interne, comparaisons
- Notifications push
- Support des formes alternatives (Rotom, Deoxys, mega, gigamax, etc.)
- Statistiques historiques (`caught_at` est stocké dès V1 pour préparer la V2)
- Mode hors-ligne complet (les toggles nécessitent une connexion)

## 3. Architecture

```
┌──────────────────────────────────┐        ┌─────────────────────────┐
│   Expo App (iOS / Android / Web) │        │       Supabase          │
│                                  │        │                         │
│  ┌────────────────────────────┐  │        │   ┌─────────────────┐   │
│  │ UI (React Native)          │  │        │   │ Auth (email/pw) │   │
│  │  - PokedexGrid             │  │  HTTPS │   └─────────────────┘   │
│  │  - PokemonTile             │  │◄──────►│   ┌─────────────────┐   │
│  │  - SearchFilterBar         │  │  REST  │   │ Postgres        │   │
│  │  - PublicView              │  │        │   │  - profiles     │   │
│  └────────────────────────────┘  │        │   │  - collections  │   │
│  ┌────────────────────────────┐  │        │   └─────────────────┘   │
│  │ Data layer                 │  │        │   ┌─────────────────┐   │
│  │  - supabase client         │  │        │   │ RLS policies    │   │
│  │  - React Query cache       │  │        │   │ (privé + public)│   │
│  │  - baked pokedex.json      │  │        │   └─────────────────┘   │
│  └────────────────────────────┘  │        └─────────────────────────┘
└──────────────────────────────────┘

  Build-time asset:
  data/pokedex.json (~500 KB, 1025 entries)
  produit par scripts/build-pokemon-data.ts (fetch PokéAPI)
```

### 3.1 Stack technique

- **Client** : Expo SDK 57, React Native 0.86, React 19, TypeScript. Cible iOS / Android / Web depuis un unique codebase.
- **Navigation** : Expo Router (file-based, URLs propres nécessaires pour les liens `/u/{username}`).
- **State serveur** : `@tanstack/react-query` — cache, invalidation, optimistic mutations.
- **State local** : hooks React natifs (`useState`, `useMemo`). Pas de Redux / Zustand — pas de besoin justifié à V1.
- **Liste virtualisée** : `@shopify/flash-list` pour les 1025 tuiles (perf > FlatList).
- **Client Supabase** : `@supabase/supabase-js` avec session persistée via `expo-secure-store` (natif) / `localStorage` (web).
- **Backend** : Supabase (Postgres managé + Auth + REST auto + RLS). Free tier suffit pour V1.
- **Source de données** : PokéAPI (`pokeapi.co`) — utilisé uniquement au build via un script one-shot.

### 3.2 Justifications des choix

- **Supabase vs Firebase / custom backend** : Postgres est un match naturel pour représenter les 1025 flags par utilisateur. Les Row Level Security policies gèrent élégamment la logique de partage public/privé. Free tier généreux (500 MB DB, 50k MAU). Firebase serait payant plus vite et NoSQL moins adapté ; un backend custom est du sur-scope pour la V1.
- **Baked JSON vs table `pokemon` en base** : 1025 entrées sont assez petites (~500 KB minifiées) pour être embarquées. Zéro requête réseau pour hydrater la grille, résilient à une panne PokéAPI, plus simple à raisonner.
- **Sprites via URL PokéAPI vs bundle** : les URLs GitHub officielles de PokéAPI sont stables. React Native `<Image>` cache automatiquement. Bundler 2 MB de PNG n'apporte que le bénéfice offline, pas prioritaire V1.
- **Sync au refresh vs temps réel** : validé avec l'utilisateur. Économise WebSocket / Supabase Realtime channels, simplifie le code, suffit pour l'usage cible (collectionneur qui met à jour sa collection ponctuellement).

## 4. Modèle de données

### 4.1 Table `profiles`

Créée automatiquement à l'inscription via un trigger sur `auth.users`.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK, référence `auth.users(id)` |
| `username` | `text` | UNIQUE, NOT NULL, immutable après création (contrainte via policy UPDATE) |
| `display_name` | `text` | NOT NULL, modifiable |
| `is_public` | `boolean` | NOT NULL DEFAULT `true` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

Le `username` doit matcher un slug URL-safe (regex `^[a-z0-9][a-z0-9_-]{2,29}$`) — validé par un CHECK constraint.

### 4.2 Table `collections`

Une ligne = un Pokémon possédé. Absence de ligne = non possédé.

| Colonne | Type | Contraintes |
|---|---|---|
| `user_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `dex_num` | `int2` | NOT NULL, CHECK entre 1 et 1025 |
| `caught_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| PRIMARY KEY | `(user_id, dex_num)` | |

Index implicite sur `user_id` via la PK — suffit pour les requêtes typiques.

### 4.3 Row Level Security

**Sur `profiles` :**

- `SELECT` autorisé si `is_public = true` OU si `id = auth.uid()`
- `UPDATE` autorisé uniquement si `id = auth.uid()`, ET la colonne `username` reste inchangée (immutabilité)
- `INSERT` uniquement via le trigger d'onboarding (pas d'insert direct)
- `DELETE` interdit (suppression compte = géré séparément)

**Sur `collections` :**

- `SELECT` autorisé si `user_id = auth.uid()` OU si le profil correspondant a `is_public = true`
- `INSERT`, `UPDATE`, `DELETE` autorisés uniquement si `user_id = auth.uid()`

### 4.4 Trigger d'onboarding

Fonction Postgres `handle_new_user()` déclenchée `AFTER INSERT ON auth.users`. Elle prend le `username` fourni via `raw_user_meta_data.username` (envoyé au signup depuis le client) et insère la ligne `profiles`. Si le username est déjà pris, le trigger échoue et l'inscription rollback — le client affiche l'erreur.

## 5. Structure de l'application

```
Pokedexnational/
├── app/                              (Expo Router)
│   ├── _layout.tsx                   Providers (React Query, Auth), theme
│   ├── (auth)/
│   │   ├── _layout.tsx               Guard "unauthenticated only"
│   │   ├── login.tsx
│   │   └── signup.tsx                email + password + username
│   ├── (app)/
│   │   ├── _layout.tsx               Guard authenticated, tab bar / sidebar responsive
│   │   ├── pokedex.tsx               Grille principale
│   │   ├── pokemon/[num].tsx         Détail Pokémon
│   │   └── settings.tsx              display_name, is_public, copier share URL, logout
│   └── u/[username].tsx              Vue publique (no auth requis)
├── components/
│   ├── PokedexGrid.tsx               FlashList responsive
│   ├── PokemonTile.tsx               Tuile individuelle
│   ├── SearchFilterBar.tsx           Search input + filter chips + sort dropdown
│   ├── ProgressCounter.tsx           "342 / 1025 (33%)"
│   └── TypeBadge.tsx                 Badge coloré pour la page détail
├── lib/
│   ├── supabase.ts                   Client singleton + session storage
│   ├── auth.ts                       Hooks useSession, useSignIn, useSignUp
│   ├── collection.ts                 Hooks useCollection, useTogglePokemon
│   ├── pokedex-list.ts               Pipeline search/filter/sort (usePokedexList)
│   ├── types-colors.ts               type → HEX
│   └── i18n.ts                       getName(pokemon, locale='fr')
├── data/
│   └── pokedex.json                  Généré par le script, commité
├── scripts/
│   └── build-pokemon-data.ts         Fetch PokéAPI, écrit data/pokedex.json
├── supabase/
│   └── migrations/                   SQL versionné (tables, RLS, trigger)
└── docs/
    └── superpowers/specs/            Ce document
```

## 6. Flux utilisateurs clés

### 6.1 Signup

1. Utilisateur saisit email, mot de passe, username souhaité
2. Le client appelle une fonction RPC Postgres `check_username_available(candidate text) RETURNS boolean` déclarée `SECURITY DEFINER` (contourne le RLS pour un check exhaustif y compris sur les profils privés). Affichage instantané "disponible / déjà pris".
3. `supabase.auth.signUp({ email, password, options: { data: { username, display_name } } })`
4. Le trigger `handle_new_user` crée la ligne `profiles`. Contrainte UNIQUE sur `username` : si course avec un autre signup simultané, l'insert échoue, la transaction rollback, et le signup renvoie une erreur que le client affiche.
5. Session locale persistée, redirection vers `/pokedex`

### 6.2 Toggle d'un Pokémon (optimistic)

1. Utilisateur tap une tuile
2. `useTogglePokemon.mutate(dexNum)` déclenche :
   - `onMutate` : update immédiat du cache React Query (Set local des `dex_num` possédés)
   - Requête : `UPSERT` si `owned=true`, `DELETE` si `owned=false`
   - `onError` : rollback du cache, toast d'erreur
3. La tuile change d'état visuellement en < 16 ms (frame budget)

### 6.3 Vue publique `/u/{username}`

1. Route non authentifiée résolue par Expo Router
2. Client Supabase anon requête `profiles` par `username` (RLS autorise si `is_public = true`)
3. Si profil trouvé : requête `collections` (RLS autorise via `is_public`)
4. Rendu identique à la vue authentifiée mais tuiles non-interactives + bandeau "Pokédex de {display_name}"
5. Si profil introuvable ou privé : écran dédié avec CTA "Créer mon Pokédex" → `/signup`

### 6.4 Sync entre appareils

1. Utilisateur ouvre l'app sur un autre appareil (session déjà persistée)
2. React Query considère la query `['collection', userId]` stale au bout de 5 min
3. Focus de la fenêtre ou pull-to-refresh → `invalidateQueries` → refetch
4. La nouvelle collection remplace l'ancienne, la grille re-render

## 7. Pipeline search / filter / sort

Tout en mémoire côté client. Hook `usePokedexList(searchTerm, filter, sort)` :

```
data/pokedex.json ─┐
                   ├─► merge → [{ num, name_fr, name_en, types, sprite_url, owned }]
Set<dex_num> ──────┘
                            │
                            ▼
              filter (all / owned / missing)
                            │
                            ▼
     search (num "025" ou "25" ; nom substring, case-insensitive,
             accent-insensitive via normalize NFD + strip diacritics)
                            │
                            ▼
              sort (num asc/desc, name asc/desc)
                            │
                            ▼
                       FlashList
```

Enveloppé dans un `useMemo(..., [pokedexJson, ownedSet, searchTerm, filter, sort])`. À 1025 items, l'ensemble du pipeline s'exécute en < 5 ms — pas de virtualisation nécessaire au-delà de FlashList.

## 8. UI et responsive

### 8.1 Grille

- Colonnes calculées depuis `useWindowDimensions()` :
  - `< 600px` : 3 colonnes
  - `600–1024px` : 5 colonnes
  - `≥ 1024px` : 8 colonnes
- `FlashList` avec `numColumns` dynamique + `estimatedItemSize` fixe pour perf

### 8.2 Tuile Pokémon (`PokemonTile`)

- Layout carré. Sprite occupe ~70% de la hauteur, texte en dessous
- État "possédé" : sprite en couleur, léger halo, coche verte en overlay coin haut-droit
- État "manquant" : sprite désaturé (`opacity: 0.35` + tint blanc-gris), numéro et nom estompés
- Feedback tap : `Animated.spring` scale 0.95

### 8.3 Barre supérieure

Sticky en haut de la grille. Contient :

- `SearchInput` (recherche live sans bouton)
- Chips `Tous` / `Possédés` / `Manquants`
- Dropdown de tri (4 options)
- `ProgressCounter` affiché à droite (aligné avec les autres contrôles sur desktop, en dessous sur mobile)

Sur mobile, la barre se collapse au scroll vers le bas et réapparaît au scroll vers le haut.

### 8.4 Navigation

- Mobile (`< 768px`) : tab bar bottom `Pokédex` / `Settings`
- Tablet/Desktop (`≥ 768px`) : sidebar gauche fixe avec le même contenu

### 8.5 Écran détail Pokémon

- Header : bouton retour + `#0025 · Pikachu` centré
- Grand sprite au centre (2× la taille de la tuile grille)
- Badges de types sous le sprite (via `TypeBadge`, couleurs de `lib/types-colors.ts`)
- Bouton d'action large en bas : `Je possède` (vert) / `Je ne l'ai pas` (gris)

## 9. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Login échoue | Message inline sous le formulaire (traduit) |
| Signup avec email déjà utilisé | Message inline |
| Signup avec username déjà pris | Message inline sous le champ username |
| Toggle Pokémon échoue | Rollback optimistic, toast discret "Impossible de sauvegarder" |
| Pull-to-refresh échoue | Toast, l'ancienne data reste visible |
| Vue publique introuvable | Écran dédié "Ce Pokédex n'existe pas ou est privé" + CTA signup |
| Offline complet | Grille lisible (data locale), toggles échouent proprement avec toast |

## 10. Stratégie de tests V1

### 10.1 Tests unitaires

- Pipeline `usePokedexList` : search accent-insensitive, filtre owned/missing, tris — logique pure, facile à couvrir
- `lib/i18n.ts` : fallback FR → EN quand `name_fr` absent
- Slug validator du username

### 10.2 Tests d'intégration

- Flux login → toggle → refresh → toggle persisté (React Native Testing Library + mock du client Supabase)
- Flux signup avec username déjà pris → erreur affichée
- Vue publique avec profil privé → écran d'erreur affiché

### 10.3 Pas de E2E V1

Coûteux à mettre en place sur Expo cross-platform. Ajout de Maestro envisageable en V1.x si besoin.

## 11. Déploiement

### 11.1 Backend (Supabase)

- Un projet Supabase créé manuellement (free tier)
- Migrations SQL versionnées dans `supabase/migrations/`
- Variables d'environnement dans `.env` local (non commité) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### 11.2 Web

- `npx expo export --platform web` produit un dossier statique
- Hébergement : **TBD** — décision reportée au moment du deploy (candidats : Vercel, Netlify, Cloudflare Pages)

### 11.3 Mobile

- Expo Go pendant le développement
- EAS Build pour distribution TestFlight / Play Store — non nécessaire pour la V1 fonctionnelle, envisagé en V1.x

## 12. Roadmap V2+ (indicatif, hors scope V1)

- Filtre par type Pokémon (les types sont déjà dans le JSON baké dès V1)
- Toggle multi-langue dans les settings
- Dark mode
- Sync temps réel (Supabase Realtime channels sur `collections`)
- Système d'amis interne : ajouter des amis par username, écran "mes amis" pour parcourir plusieurs Pokédex partagés
- Statistiques : évolution de la progression dans le temps, dernière capture, etc.
- Formes alternatives (Rotom, Deoxys, méga-évolutions, etc.)
- Mode offline complet avec queue de sync
- Notifications push : "un nouveau Pokémon dans le Pokédex National !"
- Comparaison A / B entre deux Pokédex publics
