# Pokedexnational — Handoff for Claude Code

**What this is:** an Expo app (iOS / Android / Web) for tracking a Pokémon **TCG card collection** with the objective of completing the National Pokédex (1025 Pokémon). One owned card per Pokémon, unlimited wishlisted cards. Public share URL. Dark theme.

**Source of truth for design:** `docs/superpowers/specs/2026-07-20-pokedexnational-design.md`
**Implementation plan history:** `docs/superpowers/plans/2026-07-20-pokedexnational-v1.md` (initial V1 plan — many features were added after V1; the spec is authoritative)

## Environment

- **Node** v22+
- **Expo SDK 54** (downgraded from 57 because Expo Go on iOS App Store lags behind — see `AGENTS.md`)
- **React 19.2.3, React Native 0.85.3, TypeScript**
- **Windows-first repo** (dev on Windows 11, PowerShell + bash). `.npmrc` sets `legacy-peer-deps=true` to resolve React 19 patch mismatch.
- **Package scripts of note:** `npm run web` (dev), `npm test` (Jest), `npm run build:pokedex` (fetch PokéAPI, only re-run if the 1025 changes), `npm run sync:tcg` (fetch pokemontcg.io, only re-run if new sets released)
- **ts-node runs script/*.ts with `tsconfig.scripts.json`** (Expo's tsconfig.base uses `module=preserve` which is incompatible with ts-node CJS).

## Required env vars (`.env` at project root, NOT committed)

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon jwt or sb_publishable_*>
EXPO_PUBLIC_APP_URL=http://localhost:8081     # replace when web is deployed
SUPABASE_SERVICE_ROLE_KEY=<service_role jwt>  # only used by the sync scripts
POKEMON_TCG_API_KEY=<from dev.pokemontcg.io>
```

If the anon key gets rejected with `401 Invalid API key`, re-copy it from the current Supabase dashboard (Supabase may have rotated to `sb_publishable_*` format).

## Backend (Supabase)

Postgres + Auth + RLS. 12 migrations in `supabase/migrations/` (001–012). They must be applied in order to a fresh project. **No Supabase CLI is required in dev on this machine** — the user has been deploying migrations manually via the Supabase Dashboard SQL Editor by copy-pasting the file contents.

Tables:
- `profiles` (id=uuid PK, username unique+immutable, display_name, is_public, created_at)
- `tcg_cards` (canonical TCG cards from pokemontcg.io, ~17 000 rows across 173 sets from Base 1999 to Pitch Black 2026-07)
- `user_cards` (owned cards; **PK is `(user_id, dex_num)` since migration 010 — one owned card per Pokémon**)
- `user_wishlist` (wished cards; multi allowed per Pokémon)

Views: `user_dex`, `pokemon_tcg_index`, `tcg_sets`, `tcg_rarities`.

Triggers/RPCs: `handle_new_user` (auto-create profile at signup), `enforce_username_immutable`, `set_user_card_dex_num` (auto-populate dex_num on insert/update), `check_username_available(candidate)`.

RLS gotchas already fixed but worth knowing:
- `user_cards` needs an UPDATE policy (migration 012) for the UPSERT-on-conflict swap logic in `useToggleCard`.
- `tcg_cards`/`tcg_sets`/`tcg_rarities` are public read (needed for anonymous users on `/u/{username}` public view).

## Client architecture

- **Routing:** Expo Router (`app/` folder). Groups: `(auth)` unauth-only, `(app)` auth-required with tab bar (Pokédex / Wishlist / Settings + hidden `pokemon/[num]`). Public route: `u/[username]`.
- **State (server):** `@tanstack/react-query`. `staleTime: 5 min` default, per-hook overrides for lookups (`staleTime: Infinity` on TCG indexes since they only change when we re-sync).
- **Optimistic mutations:** `useToggleCard` and `useToggleWish` implement optimistic set updates + rollback on error. Card ownership uses upsert with `onConflict: 'user_id,dex_num'` to enforce single-card-per-Pokémon (row is replaced automatically on conflict).
- **Theme:** `lib/theme.ts` centralizes colors, spacing, radius, shadow — currently dark palette. Any new UI should reference these tokens.
- **Icons:** custom `<Pokeball />` component (no image asset), plus `Ionicons` from `@expo/vector-icons` for heart/gear (already bundled with Expo, no dep to add).

## Directory map

```
app/                     Expo Router screens
  (auth)/                login, signup, group layout guard
  (app)/                 pokedex, wishlist, settings, pokemon/[num]
  u/[username].tsx       public share view
components/              PokemonTile, CardTile/ListRow/Gallery, CardFilterTree, CardZoomModal, SearchFilterBar, ProgressCounter, TypeBadge, Pokeball
lib/                     auth, collection, tcg, tcg-index, pokedex-list, wishlist-list, generations, i18n, slug, supabase, theme, toast, types, types-colors
data/                    pokedex.json (baked from PokéAPI, 1025 entries)
scripts/                 build-pokemon-data.ts, sync-tcg-cards.ts (uses service_role — server-side only)
supabase/migrations/     001..012 SQL migrations
__tests__/               Jest tests for slug, i18n, pokedex-list pipeline (18 tests total)
docs/superpowers/        specs/ and plans/ (design docs)
```

## Feature summary (in the app right now)

- Signup/login with immutable username, magic URL `/u/{username}` for public view
- Pokédex tab: 1025-tile grid, responsive columns, showing owned card's image instead of sprite when owned, Pokéball icon overlay, wish heart overlay (tap → detail with `?wishes=1`)
- Filters: status (all/owned/missing), generation (Gen 1–9), type (18 Pokémon types), TCG set (173), rarity (33) — combinable, all via modal picker
- Sort: num asc/desc, name asc/desc
- Search: accent-insensitive by name or number
- Progress bar + counter reflect active filters
- Pokemon detail: compact sprite header, TCG cards accordion filter (by series → set), grid/list toggle, long-press card to zoom HD, wishlist first
- Wishlist tab: search, status (all/à acheter/déjà possédée), gen/type/set/rarity cycle chips, 6 sort options, Pokéball indicator when a wished card is already owned
- Settings: display name, public toggle, share URL copy, logout

## Working with the user

- Prefers French for UI copy, English for code and technical explanations
- Wants tight iteration, doesn't want long summaries at the end of turns
- Dispatches to subagents (via superpowers skill workflow) when the change touches >2 files
- Migrations are deployed by the user via the Supabase Dashboard SQL Editor (no CLI installed). Provide the copy-paste-ready SQL block after committing migration files.
- Any SDK/breaking-change decision: check `AGENTS.md` first.

## What is NOT done

- **Web deploy**: pending choice of host (Vercel / Netlify / Cloudflare Pages). `EXPO_PUBLIC_APP_URL` is still `localhost:8081`.
- **EAS Build / TestFlight**: not set up yet. iOS testing goes through Expo Go SDK 54.
- **Real-time sync** (spec V2), **multi-lang cards** (spec V2), **JP/CN region cards** (would require TCGdex crossing — currently only pokemontcg.io).

## Continuity across machines

To pick this up on a new machine:

1. `git clone <repo-url>` and `cd Pokedexnational`
2. Create local `.env` with the 5 vars above (get from Supabase Dashboard + dev.pokemontcg.io)
3. `npm install`
4. `npm run web` to check everything boots
5. If starting from a fresh Supabase project: deploy migrations 001..012 in order via Dashboard, then `npm run sync:tcg` to populate 17k cards

For history and rationale: run `git log --oneline` — every feature has a `feat: …` commit, RLS fixes are `fix(rls): …`, database schema changes are `feat(db): …`. The full narrative of design decisions lives in `docs/superpowers/specs/2026-07-20-pokedexnational-design.md`.
