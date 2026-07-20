# Pokedexnational — Design V1

**Date:** 2026-07-20
**Statut:** Design validé, en attente de plan d'implémentation.

## 1. Objectif

Application permettant à un **collectionneur de cartes TCG Pokémon** de suivre sa progression vers la complétion du Pokédex National (1025 Pokémon), via son inventaire de cartes.

L'utilisateur ne coche pas des Pokémon directement : il ajoute à sa collection les **cartes TCG individuelles** qu'il possède (par exemple *Pikachu Base Set 58/102*, *Pikachu VMAX Vivid Voltage 44*, etc.). Un Pokémon est automatiquement considéré comme "présent au National" dès que l'utilisateur possède **au moins une carte** le représentant.

La progression est individuelle par utilisateur, et partageable en lecture seule via un lien public.

## 2. Portée V1

**Inclus :**

- Vue principale "Pokédex National" : grille des 1025 Pokémon avec numéro, nom (FR si dispo, EN sinon), sprite, types
- État "possédé" du Pokémon **auto-dérivé** : vert si l'utilisateur possède ≥ 1 carte TCG le représentant
- Page détail d'un Pokémon : galerie des cartes TCG le représentant (celles connues via l'API), avec toggle possédée / non possédée par carte
- Authentification email + mot de passe
- Compte utilisateur avec username choisi au signup, immutable
- Lien public de partage `/u/{username}` en lecture seule (aucun compte requis pour consulter)
- Sync entre appareils au chargement / pull-to-refresh (pas de push temps réel)
- Recherche par nom de Pokémon ou numéro (vue National)
- Filtres sur la vue National :
  - État : tous / possédés / manquants
  - Type Pokémon (mono-sélection : `Feu`, `Eau`, etc. — matche sur type 1 OU type 2)
  - Set TCG (mono-sélection : `Base`, `Jungle`, … — restreint la grille aux Pokémon ayant au moins une carte dans ce set)
  - Rareté (mono-sélection : `Common`, `Rare Holo`, … — restreint la grille aux Pokémon ayant au moins une carte de cette rareté)
  - Les filtres se combinent (ET logique)
- Tri sur la vue National : numéro ↑↓, nom A→Z / Z→A
- Compteur global `X / 1025 (Y%)` + compteur cartes `N cartes possédées` — reflète les filtres actifs
- Responsive : phone (3 col), tablet (5 col), desktop (8 col)
- Support des trois plateformes (iOS, Android, Web) via Expo
- Light mode uniquement

**Exclus V1 (backlog V2+) :**

- Quantités par carte (V1 est binaire : possédée ou non, pas de compteur "j'en ai 3")
- Suivi de l'état de la carte (mint / near mint / played, etc.)
- Recherche / filtres sur la page détail (parcours de toutes les cartes d'un Pokémon)
- Toggle multi-langue depuis les settings (FR forcé en V1 pour les noms de Pokémon ; les noms de cartes restent en EN — c'est ce que fournit Pokemon TCG API)
- Dark mode
- Sync temps réel via WebSocket
- Système d'amis interne, comparaisons entre utilisateurs
- Notifications push
- Support des formes alternatives (Rotom, Deoxys, méga, gigamax, etc.) — hors périmètre du National standard
- Statistiques historiques (`acquired_at` est stocké dès V1 pour préparer la V2)
- Mode hors-ligne complet (les toggles nécessitent une connexion)
- Import automatique de collections depuis d'autres services (TCGplayer, Pokellector, etc.)

## 3. Architecture

```
┌──────────────────────────────────┐        ┌─────────────────────────┐
│   Expo App (iOS / Android / Web) │        │       Supabase          │
│                                  │        │                         │
│  ┌────────────────────────────┐  │        │   ┌─────────────────┐   │
│  │ UI (React Native)          │  │        │   │ Auth (email/pw) │   │
│  │  - PokedexGrid             │  │  HTTPS │   └─────────────────┘   │
│  │  - PokemonTile             │  │◄──────►│   ┌─────────────────┐   │
│  │  - PokemonDetail (cartes)  │  │  REST  │   │ Postgres        │   │
│  │  - SearchFilterBar         │  │        │   │  - profiles     │   │
│  │  - PublicView              │  │        │   │  - tcg_cards    │   │
│  └────────────────────────────┘  │        │   │  - user_cards   │   │
│  ┌────────────────────────────┐  │        │   │  - user_dex     │   │
│  │ Data layer                 │  │        │   │       (vue)     │   │
│  │  - supabase client         │  │        │   └─────────────────┘   │
│  │  - React Query cache       │  │        │   ┌─────────────────┐   │
│  │  - baked pokedex.json      │  │        │   │ RLS policies    │   │
│  └────────────────────────────┘  │        │   └─────────────────┘   │
└──────────────────────────────────┘        └─────────────────────────┘

Build-time assets (commités dans le repo) :
  data/pokedex.json    ~500 KB, 1025 Pokémon (produit par scripts/build-pokemon-data.ts, source PokéAPI)

One-shot admin scripts (exécutés à l'écart de l'app, écrivent en base) :
  scripts/sync-tcg-cards.ts   Peuple / met à jour la table `tcg_cards` depuis pokemontcg.io
```

### 3.1 Stack technique

- **Client** : Expo SDK 57, React Native 0.86, React 19, TypeScript. Cible iOS / Android / Web depuis un unique codebase.
- **Navigation** : Expo Router (file-based, URLs propres nécessaires pour les liens `/u/{username}` et `/pokemon/{num}`).
- **State serveur** : `@tanstack/react-query` — cache, invalidation, optimistic mutations.
- **State local** : hooks React natifs. Pas de Redux / Zustand — pas de besoin justifié à V1.
- **Liste virtualisée** : `@shopify/flash-list` pour les 1025 tuiles.
- **Client Supabase** : `@supabase/supabase-js` avec session persistée via `expo-secure-store` (natif) / `localStorage` (web).
- **Backend** : Supabase (Postgres managé + Auth + REST auto + RLS). Free tier suffit pour V1.
- **Sources de données** :
  - **PokéAPI** (`pokeapi.co`) — pour les 1025 entrées du National (noms FR/EN, types, sprites). Utilisée **uniquement au build** via un script one-shot, résultat commité en JSON.
  - **Pokemon TCG API** (`pokemontcg.io`) — pour les cartes TCG. Utilisée **uniquement par un script admin de sync** qui peuple la table `tcg_cards` de Supabase. Le client applicatif ne l'appelle jamais.

### 3.2 Justifications des choix

- **Supabase vs Firebase / custom** : Postgres est adapté aux relations (1 Pokémon → N cartes, 1 user → N user_cards) et aux RLS pour le partage public/privé. Free tier généreux. NoSQL serait plus lourd à modéliser ici.
- **Pokemon TCG API mirroré dans Supabase** : au lieu d'appeler pokemontcg.io depuis le client (rate limits, dépendance, absence côté serveur pour l'auto-dérivation du Pokédex), on mirror leur base dans une table `tcg_cards` de notre projet Supabase. Un script `sync-tcg-cards.ts` est lancé à la main quand un nouveau set sort (~une fois par trimestre). Runtime : zéro dépendance externe.
- **Pokedex baké vs table Supabase pour les 1025** : les 1025 sont stables et légères, autant les embarquer statiquement pour zéro requête au démarrage.
- **Sync au refresh vs temps réel** : validé avec l'utilisateur, économise WebSocket / Supabase Realtime.

## 4. Modèle de données

### 4.1 Table `profiles`

Créée automatiquement à l'inscription via un trigger sur `auth.users`.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK, référence `auth.users(id)` |
| `username` | `text` | UNIQUE, NOT NULL, immutable (CHECK slug URL-safe `^[a-z0-9][a-z0-9_-]{2,29}$`) |
| `display_name` | `text` | NOT NULL, modifiable |
| `is_public` | `boolean` | NOT NULL DEFAULT `true` |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` |

### 4.2 Table `tcg_cards`

Cache local de la base Pokemon TCG API. Peuplée par le script `sync-tcg-cards.ts`. Aucune écriture depuis l'app.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `text` | PK, ex: `base1-58` (format pokemontcg.io) |
| `name` | `text` | NOT NULL, ex: `"Pikachu"` |
| `dex_num` | `int2` | INDEX, la valeur principale du `nationalPokedexNumbers[]` de l'API |
| `set_id` | `text` | NOT NULL, ex: `base1` |
| `set_name` | `text` | NOT NULL, ex: `"Base"` |
| `card_number` | `text` | NOT NULL, ex: `"58"` ou `"58/102"` |
| `rarity` | `text` | NULL, ex: `"Common"`, `"Rare Holo"` |
| `image_small` | `text` | NOT NULL, URL |
| `image_large` | `text` | NULL, URL |
| `release_date` | `date` | pour tri chronologique optionnel |
| `updated_at` | `timestamptz` | dernière sync |

Certaines cartes n'ont pas de `nationalPokedexNumbers` non nul (cartes objet, énergies, cartes multi-Pokémon). Le script les ignore : seules les cartes avec au moins un `dex_num` entre 1 et 1025 sont importées en V1. Pour les cartes multi-Pokémon (ex: *Tag Team*), on stocke une ligne par carte et on choisit `dex_num` = le premier de la liste — un compromis simple pour V1 (la carte apparaîtra sur la page détail du premier Pokémon uniquement).

**Lecture publique** : la table est en lecture ouverte à tous (anon inclus) — c'est une base publique dérivée de pokemontcg.io, aucune donnée sensible.

### 4.3 Table `user_cards`

Le vrai stockage de la collection. Une ligne = une carte que l'utilisateur possède.

| Colonne | Type | Contraintes |
|---|---|---|
| `user_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `card_id` | `text` | NOT NULL, FK → `tcg_cards(id)` |
| `acquired_at` | `timestamptz` | NOT NULL DEFAULT `now()` |
| PRIMARY KEY | `(user_id, card_id)` | |

V1 : binaire (ligne présente = possédée). Pas de quantité — préparé pour V2 en ajoutant plus tard une colonne `qty int2 DEFAULT 1`.

### 4.4 Vue `user_dex` (dérivée)

Vue Postgres qui expose "les `dex_num` possédés" pour chaque user :

```sql
CREATE VIEW user_dex AS
SELECT DISTINCT uc.user_id, tc.dex_num
FROM user_cards uc
JOIN tcg_cards tc ON tc.id = uc.card_id
WHERE tc.dex_num BETWEEN 1 AND 1025;
```

Le client interroge `user_dex` pour hydrater la grille National. Rapide car indexée via les PK/FK sous-jacents.

### 4.5 Vue `pokemon_tcg_index` (dérivée)

Index compact pour les filtres set / rareté de la vue National :

```sql
CREATE VIEW pokemon_tcg_index AS
SELECT
  dex_num,
  array_agg(DISTINCT set_id) AS set_ids,
  array_agg(DISTINCT rarity) FILTER (WHERE rarity IS NOT NULL) AS rarities
FROM tcg_cards
WHERE dex_num BETWEEN 1 AND 1025
GROUP BY dex_num;
```

Lecture publique (RLS ouvert). Rafraîchie automatiquement quand `tcg_cards` est mis à jour par le script de sync.

### 4.6 Row Level Security

**Sur `profiles`** :

- `SELECT` autorisé si `is_public = true` OU si `id = auth.uid()`
- `UPDATE` uniquement si `id = auth.uid()`, et `username` reste inchangé (immutabilité forcée)
- `INSERT` uniquement via le trigger d'onboarding
- `DELETE` interdit

**Sur `tcg_cards`** :

- `SELECT` ouvert à tous (y compris anon)
- Aucune écriture depuis les clients (le script utilise la service role key)

**Sur `user_cards`** :

- `SELECT` autorisé si `user_id = auth.uid()` OU si le profil correspondant a `is_public = true`
- `INSERT`, `DELETE` uniquement si `user_id = auth.uid()`
- `UPDATE` non nécessaire (le toggle = INSERT ou DELETE)

**Sur `user_dex`** (vue) :

- Hérite des permissions de `user_cards` (RLS des tables sous-jacentes s'applique via `security_invoker = on`)

**Sur `pokemon_tcg_index`** (vue) :

- Lecture ouverte à tous (hérite de `tcg_cards` via `security_invoker = on`)

### 4.7 Trigger d'onboarding

Fonction `handle_new_user()` déclenchée `AFTER INSERT ON auth.users`. Elle lit `raw_user_meta_data.username` et `raw_user_meta_data.display_name` (envoyés au signup) et insère la ligne `profiles`. Contrainte UNIQUE + CHECK sur `username` = la validation ultime. Si course avec un signup concurrent qui gagnerait le username, la transaction rollback et le client affiche l'erreur.

### 4.8 RPC `check_username_available(candidate text) RETURNS boolean`

`SECURITY DEFINER`, permet au client de vérifier avant signup si le username est disponible, y compris contre des profils privés (que le RLS `SELECT` ne verrait pas depuis anon).

## 5. Structure de l'application

```
Pokedexnational/
├── app/                              (Expo Router)
│   ├── _layout.tsx                   Providers (React Query, Auth)
│   ├── (auth)/
│   │   ├── _layout.tsx               Guard "unauthenticated only"
│   │   ├── login.tsx
│   │   └── signup.tsx                email + password + username + display_name
│   ├── (app)/
│   │   ├── _layout.tsx               Guard authenticated, tab bar / sidebar responsive
│   │   ├── pokedex.tsx               Grille National (1025)
│   │   ├── pokemon/[num].tsx         Détail Pokémon + galerie cartes TCG
│   │   └── settings.tsx              display_name, is_public, copier share URL, logout
│   └── u/[username].tsx              Vue publique (no auth requis) — grille + navigation vers détails en lecture seule
├── components/
│   ├── PokedexGrid.tsx               FlashList responsive des 1025
│   ├── PokemonTile.tsx               Tuile individuelle (National)
│   ├── CardGallery.tsx               Galerie des cartes TCG d'un Pokémon
│   ├── CardTile.tsx                  Tuile d'une carte TCG (image, set, num, toggle)
│   ├── SearchFilterBar.tsx           Search + filter chips + sort dropdown
│   ├── ProgressCounter.tsx           "342 / 1025 (33%) · 812 cartes"
│   └── TypeBadge.tsx                 Badges de types sur la page détail
├── lib/
│   ├── supabase.ts                   Client singleton + session storage
│   ├── auth.ts                       Hooks useSession, useSignIn, useSignUp
│   ├── collection.ts                 Hooks useUserDex, useUserCards, useToggleCard
│   ├── tcg.ts                        Hook useCardsForPokemon(dexNum)
│   ├── tcg-index.ts                  Hooks useTcgIndex, useTcgSets (pour les filtres)
│   ├── pokedex-list.ts               Pipeline search/filter/sort (usePokedexList)
│   ├── types-colors.ts               type → HEX
│   └── i18n.ts                       getName(pokemon, locale='fr')
├── data/
│   └── pokedex.json                  Produit par le script, commité
├── scripts/
│   ├── build-pokemon-data.ts         Fetch PokéAPI → data/pokedex.json
│   └── sync-tcg-cards.ts             Fetch pokemontcg.io → INSERT/UPDATE tcg_cards (via service role)
├── supabase/
│   └── migrations/                   SQL versionné (tables, view, RLS, trigger, RPC)
└── docs/
    └── superpowers/specs/            Ce document
```

## 6. Flux utilisateurs clés

### 6.1 Signup

1. Utilisateur saisit email, mot de passe, username souhaité, display name
2. Le client appelle la RPC `check_username_available` (feedback immédiat)
3. `supabase.auth.signUp({ email, password, options: { data: { username, display_name } } })`
4. Le trigger `handle_new_user` crée la ligne `profiles`. Contrainte UNIQUE = filet de sécurité contre les courses ; en cas de rollback, le client affiche l'erreur.
5. Session locale persistée, redirection vers `/pokedex`

### 6.2 Ajouter une carte à sa collection (le geste principal)

1. Utilisateur ouvre le détail d'un Pokémon depuis la grille National
2. `useCardsForPokemon(num)` liste toutes les cartes de `tcg_cards WHERE dex_num = num`
3. Utilisateur tap une carte pour toggle
4. `useToggleCard.mutate(cardId)` :
   - `onMutate` : update immédiat du cache local (`user_cards` set + `user_dex` set)
   - Requête : `INSERT` si non possédée, `DELETE` si possédée
   - `onError` : rollback + toast
5. La tuile de la carte change d'état ; **si c'était la première carte du Pokémon**, la tuile correspondante de la grille National passe automatiquement en vert (rendu depuis `user_dex` en cache).

### 6.3 Vue publique `/u/{username}`

1. Route non authentifiée résolue par Expo Router
2. Client Supabase anon requête `profiles` par `username` (RLS autorise si `is_public = true`)
3. Si profil trouvé : requête `user_dex` pour la grille + `user_cards` pour les détails (RLS autorise via `is_public`)
4. Rendu identique à la vue authentifiée mais tuiles + cartes en mode lecture seule + bandeau "Pokédex TCG de {display_name}"
5. Si profil introuvable ou privé : écran dédié avec CTA "Créer mon Pokédex TCG" → `/signup`

### 6.4 Sync entre appareils

1. Session persistée sur chaque appareil
2. React Query considère les queries `['user_dex', userId]` et `['user_cards', userId, dexNum]` stale au bout de 5 min
3. Focus fenêtre ou pull-to-refresh → `invalidateQueries` → refetch
4. Nouvelle collection remplace l'ancienne, UI re-render

### 6.5 Sync périodique de la base TCG (admin, hors app)

1. Ordinateur d'admin lance `npm run sync:tcg` (script `sync-tcg-cards.ts`)
2. Le script utilise la `SUPABASE_SERVICE_ROLE_KEY` (jamais embarquée dans l'app) et la clé d'API Pokemon TCG
3. Pagine sur `https://api.pokemontcg.io/v2/cards`, filtre les cartes avec `nationalPokedexNumbers` non vide, écrit chaque carte via `UPSERT` sur `tcg_cards`
4. Fréquence attendue : ~1 fois par trimestre (sortie de nouveaux sets)

## 7. Pipeline search / filter / sort (vue National)

Tout en mémoire côté client. Hook `usePokedexList({ search, statusFilter, typeFilter, setFilter, rarityFilter, sort })`.

### 7.1 Index d'appartenance TCG (chargé une fois)

Pour permettre les filtres "set" et "rareté" sans requêtes répétées, le client charge au démarrage un index compact :

```sql
CREATE VIEW pokemon_tcg_index AS
SELECT
  dex_num,
  array_agg(DISTINCT set_id) AS set_ids,
  array_agg(DISTINCT rarity) FILTER (WHERE rarity IS NOT NULL) AS rarities
FROM tcg_cards
WHERE dex_num BETWEEN 1 AND 1025
GROUP BY dex_num;
```

Lecture publique (RLS ouvert comme `tcg_cards`). ~1025 lignes, ~30 KB en JSON compact. React Query avec `staleTime: Infinity` — cet index change uniquement quand un nouveau set est sync côté admin.

Un second endpoint léger fournit la liste des sets connus (`SELECT id, name, release_date FROM tcg_cards GROUP BY id, name, release_date ORDER BY release_date DESC`) pour peupler le dropdown de filtre.

### 7.2 Pipeline

```
data/pokedex.json ────┐    Set<dex_num> owned (user_dex)
                      ├─► merge
Set<dex_num> owned ───┘    → [{ num, name_fr, name_en, types, sprite_url, owned }]
                                          │
                                          ▼
                              filter statusFilter (all / owned / missing)
                                          │
                                          ▼
                              filter typeFilter (types.includes(selected))
                                          │
                                          ▼
                              filter setFilter (pokemon_tcg_index[num].set_ids.includes(selected))
                                          │
                                          ▼
                              filter rarityFilter (pokemon_tcg_index[num].rarities.includes(selected))
                                          │
                                          ▼
                              search (num "025" ou "25" ; nom substring,
                                      case-insensitive, accent-insensitive via NFD)
                                          │
                                          ▼
                                        sort
                                          │
                                          ▼
                                     FlashList
```

Enveloppé dans un `useMemo` sur toutes les entrées. À 1025 items × 4 filtres, < 10 ms.

Le `ProgressCounter` recalcule ses totaux sur le résultat filtré : `342 / 1025 (33%)` devient `12 / 45 (26%) — filtre : Feu` quand un filtre est actif.

## 8. UI et responsive

### 8.1 Grille National

- Colonnes depuis `useWindowDimensions()` :
  - `< 600px` : 3 colonnes
  - `600–1024px` : 5 colonnes
  - `≥ 1024px` : 8 colonnes
- `FlashList` avec `numColumns` dynamique + `estimatedItemSize` fixe

### 8.2 Tuile Pokémon (`PokemonTile`)

- Layout carré. Sprite ~70% de la hauteur, texte en dessous
- État "possédé" (≥ 1 carte) : sprite en couleur + coche verte overlay + badge discret `×N` en bas montrant le nombre de cartes possédées
- État "manquant" (0 carte) : sprite désaturé, texte estompé
- Tap : navigation vers `/pokemon/{num}` (PAS de toggle direct — le toggle se fait au niveau des cartes)
- Feedback : `Animated.spring` scale 0.95

### 8.3 Barre supérieure (vue National)

Sticky. Contient sur deux lignes (une seule sur desktop) :

- Ligne 1 : `SearchInput` (live, sans bouton) + `ProgressCounter` (`342 / 1025 (33%) · 812 cartes`)
- Ligne 2 : chips `Tous` / `Possédés` / `Manquants` + dropdowns `Type` / `Set` / `Rareté` (chaque dropdown a une option "Tous" pour désactiver) + dropdown de tri

Sur mobile, les dropdowns de filtres sont regroupés derrière un bouton `Filtres (N)` qui ouvre un bottom sheet — préserve l'espace vertical. `N` = nombre de filtres actifs.

Un bouton `Réinitialiser les filtres` apparaît dès qu'au moins un filtre est actif.

Mobile : la barre collapse au scroll bas, réapparaît au scroll haut.

### 8.4 Navigation

- Mobile (`< 768px`) : tab bar bottom `Pokédex` / `Settings`
- Tablet/Desktop (`≥ 768px`) : sidebar gauche fixe

### 8.5 Écran détail Pokémon (`/pokemon/[num]`)

- Header : bouton retour + `#0025 · Pikachu` centré + `12 / N cartes possédées` à droite
- Grande carte "hero" : sprite Pokédex (grand) + badges de types + compteur cartes
- Section "Cartes TCG" : `CardGallery` — grille responsive de `CardTile`
  - Chaque `CardTile` : image de la carte, nom du set + numéro (ex: `Base · 58/102`), rareté, toggle possédée / non possédée
  - État possédée : bordure verte + coche
  - État non possédée : opacité 0.5
  - Tap : toggle optimiste
- Vue lecture seule (public) : mêmes cartes, tap inactif

### 8.6 Vue publique `/u/{username}`

- Bandeau : "Pokédex TCG de {display_name} — 342 / 1025 (33%) · 812 cartes"
- Grille identique à celle authentifiée, tap navigue vers `/u/{username}/pokemon/{num}` (variante lecture seule du détail)
- CTA "Créer mon Pokédex TCG" en flottant → `/signup`

## 9. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Login échoue | Message inline sous le formulaire (traduit) |
| Signup avec email déjà utilisé | Message inline |
| Signup avec username déjà pris | Message inline sous le champ username |
| Toggle carte échoue | Rollback optimistic, toast discret |
| Pokémon sans aucune carte connue | Page détail affichée avec état vide : "Aucune carte TCG connue pour ce Pokémon dans la base." (arrive pour certaines Gen 9 très récentes non encore sync) |
| Pull-to-refresh échoue | Toast, l'ancienne data reste visible |
| Vue publique introuvable | Écran dédié "Ce Pokédex n'existe pas ou est privé" + CTA signup |
| Offline complet | Grille lisible (data locale), toggles échouent proprement |

## 10. Stratégie de tests V1

### 10.1 Tests unitaires

- Pipeline `usePokedexList` :
  - search accent-insensitive et recherche par numéro
  - filtre `statusFilter` (owned/missing/all)
  - filtre `typeFilter` sur mono-type et bi-type
  - filtre `setFilter` (Pokémon appartenant au set sélectionné)
  - filtre `rarityFilter`
  - combinaison de filtres (ET logique)
  - tris (num asc/desc, name asc/desc, insensible aux accents)
- Logique de dérivation `user_dex` (côté client si on la calcule aussi en mémoire pour l'optimistic)
- `lib/i18n.ts` : fallback FR → EN
- Slug validator du username

### 10.2 Tests d'intégration

- Signup → toggle d'une carte → user_dex mis à jour côté serveur → grille reflète le nouvel état
- Toggle et retoggle d'une carte : idempotent, pas de duplicate
- Vue publique avec profil privé → écran d'erreur
- Course condition signup username : deux signups concurrents, un seul gagne

### 10.3 Pas de E2E V1

Ajout de Maestro envisageable en V1.x si besoin.

## 11. Déploiement

### 11.1 Backend (Supabase)

- Un projet Supabase créé manuellement (free tier)
- Migrations SQL versionnées dans `supabase/migrations/`
- Variables d'environnement dans `.env` (non commité) :
  - Côté app : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Côté script sync : `SUPABASE_SERVICE_ROLE_KEY`, `POKEMON_TCG_API_KEY`
- Sync initiale : le script `sync-tcg-cards.ts` doit tourner une première fois avant le lancement de la V1 pour peupler `tcg_cards` (~15k lignes attendues)

### 11.2 Web

- `npx expo export --platform web` produit un dossier statique
- Hébergement : **TBD** — décision reportée au moment du deploy (candidats : Vercel, Netlify, Cloudflare Pages)

### 11.3 Mobile

- Expo Go pendant le développement
- EAS Build pour distribution TestFlight / Play Store — envisagé en V1.x

## 12. Roadmap V2+ (indicatif, hors scope V1)

- Quantités par carte (`qty` sur `user_cards`)
- État de chaque carte (mint / played / etc.)
- Recherche et filtres sur la page détail (par set, par rareté)
- Filtres multi-sélection sur la vue National (ex: `Feu OU Eau`)
- Toggle multi-langue dans les settings
- Dark mode
- Sync temps réel (Supabase Realtime channels sur `user_cards`)
- Système d'amis interne (ajouter par username, écran "mes amis")
- Statistiques : évolution de la collection dans le temps, valeur estimée (avec API prix)
- Import depuis TCGplayer / Pokellector
- Support cartes multi-Pokémon (Tag Team, VMAX, etc.) apparaissant sur plusieurs détails
- Support cartes objet / stades / énergies (hors périmètre National mais pertinent pour un vrai collectionneur)
- Formes alternatives (Rotom, Deoxys, méga, etc.)
- Notifications lors de la sortie d'un nouveau set
- Comparaison A / B entre deux Pokédex publics
