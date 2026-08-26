# Pokedexnational — Handoff for Claude Code

**What this is:** an Expo app (iOS / Android / Web) for tracking a Pokémon **TCG card collection** with the objective of completing the National Pokédex (1025 Pokémon). One owned card per Pokémon, unlimited wishlisted cards. Public share URL. Dark theme.

**Source of truth for design:** `docs/superpowers/specs/2026-07-20-pokedexnational-design.md`
**Implementation plan history:** `docs/superpowers/plans/2026-07-20-pokedexnational-v1.md` (initial V1 plan — many features were added after V1; the spec is authoritative)

## Environment

- **Node** v22+
- **Expo SDK 54** (downgraded from 57 because Expo Go on iOS App Store lags behind — see `AGENTS.md`)
- **React 19.2.3, React Native 0.85.3, TypeScript**
- **Windows-first repo** (dev on Windows 11, PowerShell + bash). `.npmrc` sets `legacy-peer-deps=true` to resolve React 19 patch mismatch.
- **Package scripts of note:** `npm run web` (dev), `npm test` (Jest), `npm run build:pokedex` (fetch PokéAPI, only re-run if the 1025 changes), `npm run sync:tcg` (full metadata sync from pokemontcg.io — name/images/set/rarity/artist — only re-run if new sets released), `npm run sync:tcg:prices` (lightweight cardmarket price-only refresh — uses the API's `select` param to skip images/set/etc, runs weekly via `.github/workflows/sync-tcg-prices.yml`; do not switch it to a naive partial-column upsert — Postgres validates NOT NULL on the proposed insert row even when `ON CONFLICT DO UPDATE` fires, so it fetches+merges full existing rows first), `npm run sync:tcgdex` (JP/CN cards from api.tcgdex.net — `tcg_cards.region` = `jp`/`cn`, ids prefixed `jp-`/`cn-`, image fallback to the Pokémon sprite when TCGdex has no art yet; sets released before 2022 are skipped; runs monthly via `.github/workflows/sync-tcgdex-cards.yml`; also captures TCGdex's own `pricing.cardmarket.updated` timestamp into `cardmarket_updated_at`, same field the price-only sync below also writes, so the monthly full sync no longer wipes it back to null; **this command always chains `npm run sync:tcgplayer-images` right after** — see that entry for why. The raw crawl alone is `npm run sync:tcgdex:cards`, only for debugging that step in isolation, never run it standalone otherwise), `npm run sync:tcgdex:prices` (lightweight JP/CN price-only refresh, same relationship to `sync:tcgdex` that `sync:tcg:prices` has to `sync:tcg` — iterates existing jp-/cn- rows directly, no series/set crawl, runs weekly via `.github/workflows/sync-tcgdex-prices.yml`; added 2026-08-19 after confirming JP/CN prices could go a full month stale with zero staleness indicator, e.g. a card's real Cardmarket trend moved 0.05€→3.30€ between the monthly full-sync cycles), `npm run sync:tcgplayer-images` (backfills real card art from TCGPlayer, via the free/no-auth tcgcsv.com mirror, for the `mep` global promo set + specific JP sets TCGdex has no image for yet — hand-mapped `set_id` → TCGPlayer group in `SET_TO_TCGPLAYER_GROUP`, matched by card number; only touches rows still on the sprite fallback, so safe to re-run; must always run right after the raw TCGdex crawl — that crawl blindly re-writes the sprite fallback for these same rows every time. Enforced by construction since 2026-08-26: `sync:tcgdex` **is** `sync:tcgdex:cards && sync:tcgplayer-images` in package.json, not two scripts a human/agent has to remember to chain — a manual `sync:tcgdex`-only run on 2026-08-24 (back when they were separate) silently wiped mep + several JP sets' real art back to sprite placeholders for two days with nothing to catch it; fixed by re-running the backfill and by this chaining change. CN cards have no TCGPlayer coverage and stay on sprite fallback), `npm run sync:tcgplayer-prices` (backfills `cardmarket_*_eur` for global-region cards pokemontcg.io has zero Cardmarket data for — confirmed 2026-08-19 via a direct API query, not a sync bug; sources TCGPlayer USD prices from tcgcsv.com, same free mirror as the image backfill, converted at a live USD→EUR rate from frankfurter.app; hand-mapped `set_id` → TCGPlayer group like the image script; only ever writes rows still null, safe to re-run, never overwrites a real Cardmarket price. JP cards have the same kind of gap but spread thin across ~30 long-running sets instead of a few new ones — not yet backfilled, would need the same per-set group mapping at much larger scope. CN cards have no TCGPlayer category at all (only "Pokemon" and "Pokemon Japan" exist on tcgcsv.com) and direct Cardmarket API access is currently closed to new applicants — both regions' price gaps stay as-is for now)
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
scripts/                 build-pokemon-data.ts, sync-tcg-cards.ts, sync-tcg-prices.ts, sync-tcgdex-cards.ts, sync-tcgplayer-images.ts (all use service_role — server-side only)
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
- ~~Real-time sync~~ done (Supabase Realtime on `friend_news`/`trade_offers`/`friendships`, see `lib/realtime.ts`). ~~JP/CN region cards~~ done (`npm run sync:tcgdex`, ~4400 cards live).

## Continuity across machines

To pick this up on a new machine:

1. `git clone <repo-url>` and `cd Pokedexnational`
2. Create local `.env` with the 5 vars above (get from Supabase Dashboard + dev.pokemontcg.io)
3. `npm install`
4. `npm run web` to check everything boots
5. If starting from a fresh Supabase project: deploy migrations 001..012 in order via Dashboard, then `npm run sync:tcg` to populate 17k cards

For history and rationale: run `git log --oneline` — every feature has a `feat: …` commit, RLS fixes are `fix(rls): …`, database schema changes are `feat(db): …`. The full narrative of design decisions lives in `docs/superpowers/specs/2026-07-20-pokedexnational-design.md`.
