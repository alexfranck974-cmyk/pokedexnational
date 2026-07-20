# Pokedexnational V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V1 of Pokedexnational — an Expo app (iOS / Android / Web) that lets a Pokémon TCG collector track their progression toward completing the National Pokédex (1025 Pokémon), with individual card tracking, public share links, and Supabase-backed sync.

**Architecture:** Expo Router app + Supabase (Postgres + Auth + RLS) backend. Static Pokédex JSON baked at build time. Pokémon TCG API data mirrored into Supabase via a one-shot admin script.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, TypeScript, Expo Router, React Query, Supabase (`@supabase/supabase-js`), FlashList (`@shopify/flash-list`), `expo-secure-store`.

**IMPORTANT — Expo SDK 57 docs:** Per `AGENTS.md`, consult `https://docs.expo.dev/versions/v57.0.0/` for any Expo-specific API. Prefer `npx expo install <pkg>` over `npm install` for Expo-compatible packages: it picks versions compatible with SDK 57.

**Spec reference:** `docs/superpowers/specs/2026-07-20-pokedexnational-design.md`

---

## File Structure Overview

```
Pokedexnational/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx                            (redirect to /pokedex or /login)
│   ├── (auth)/
│   │   ├── _layout.tsx                      (guard: redirect authed → /pokedex)
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (app)/
│   │   ├── _layout.tsx                      (guard: redirect unauthed → /login, tab bar/sidebar)
│   │   ├── pokedex.tsx
│   │   ├── pokemon/[num].tsx
│   │   └── settings.tsx
│   └── u/
│       └── [username].tsx
├── components/
│   ├── PokedexGrid.tsx
│   ├── PokemonTile.tsx
│   ├── CardGallery.tsx
│   ├── CardTile.tsx
│   ├── SearchFilterBar.tsx
│   ├── ProgressCounter.tsx
│   └── TypeBadge.tsx
├── lib/
│   ├── supabase.ts
│   ├── auth.ts
│   ├── collection.ts
│   ├── tcg.ts
│   ├── tcg-index.ts
│   ├── pokedex-list.ts
│   ├── types-colors.ts
│   ├── i18n.ts
│   └── slug.ts
├── data/
│   └── pokedex.json                         (generated, committed)
├── scripts/
│   ├── build-pokemon-data.ts
│   └── sync-tcg-cards.ts
├── supabase/
│   └── migrations/
│       ├── 001_profiles.sql
│       ├── 002_tcg_cards.sql
│       ├── 003_user_cards.sql
│       ├── 004_views.sql
│       ├── 005_rls.sql
│       ├── 006_trigger_onboarding.sql
│       └── 007_rpc_check_username.sql
├── __tests__/
│   ├── pokedex-list.test.ts
│   ├── slug.test.ts
│   └── i18n.test.ts
├── .env.example
└── tsconfig.json                            (add path aliases)
```

---

## Phase 0 — Human prerequisite

Some setup can't be automated. Complete these first, they unblock later tasks.

### Task 0.1: Create Supabase project

**Files:** none (external action)

- [ ] **Step 1: Create the project**

Visit `https://supabase.com/dashboard`, sign in, click "New Project". Name it `pokedexnational` (or any name — irrelevant technically). Choose the region closest to expected users. Set a database password (save it in a password manager). Free tier.

- [ ] **Step 2: Collect credentials**

From the project's `Settings → API` page, note down:

- `URL` → this is `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` key → this is `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` key → this is `SUPABASE_SERVICE_ROLE_KEY` (server-side / admin scripts ONLY, never embed in the app)

- [ ] **Step 3: Create local `.env` file**

Create `Pokedexnational/.env` (NOT committed — check `.gitignore` first):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
EXPO_PUBLIC_APP_URL=http://localhost:8081
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
POKEMON_TCG_API_KEY=<see Task 0.2>
```

### Task 0.2: Get a Pokémon TCG API key

- [ ] **Step 1: Register**

Visit `https://dev.pokemontcg.io/`, sign in with GitHub / email, generate an API key.

- [ ] **Step 2: Add to `.env`**

Add the key as `POKEMON_TCG_API_KEY=<your-key>` in `Pokedexnational/.env`.

The key raises the rate limit from 30 req/min (anonymous) to 20 000 req/day (authenticated) — needed to sync ~15 000 cards.

---

## Phase 1 — Project setup & dependencies

### Task 1.1: Verify `.gitignore` covers env files

**Files:**
- Modify: `Pokedexnational/.gitignore`

- [ ] **Step 1: Check current contents**

Run: `type .gitignore` (PowerShell) in `Pokedexnational/`. Confirm the following patterns appear (Expo default `.gitignore` should already contain most):

```
.env
.env.local
node_modules/
.expo/
dist/
```

If any is missing, append it. Commit.

```
git add .gitignore
git commit -m "chore: ensure .env is gitignored"
```

### Task 1.2: Install runtime dependencies

**Files:**
- Modify: `Pokedexnational/package.json` (via `expo install`)

- [ ] **Step 1: Install Expo-managed deps**

Run in `Pokedexnational/`:

```
npx expo install expo-router expo-linking expo-constants react-native-safe-area-context react-native-screens expo-secure-store
```

- [ ] **Step 2: Install non-Expo deps**

```
npm install @supabase/supabase-js @tanstack/react-query @shopify/flash-list
```

- [ ] **Step 3: Commit**

```
git add package.json package-lock.json
git commit -m "chore: install runtime dependencies"
```

### Task 1.3: Install dev dependencies

**Files:**
- Modify: `Pokedexnational/package.json`

- [ ] **Step 1: Install**

```
npm install --save-dev jest @types/jest ts-node dotenv @testing-library/react-native @testing-library/jest-native jest-expo
```

- [ ] **Step 2: Add scripts to `package.json`**

Merge into the `scripts` section:

```json
"test": "jest",
"build:pokedex": "ts-node scripts/build-pokemon-data.ts",
"sync:tcg": "ts-node scripts/sync-tcg-cards.ts"
```

- [ ] **Step 3: Add jest config to `package.json`**

Merge at the root of `package.json`:

```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!(jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|@shopify/flash-list)"
  ]
}
```

- [ ] **Step 4: Commit**

```
git add package.json package-lock.json
git commit -m "chore: add dev dependencies and test config"
```

### Task 1.4: Configure Expo Router entry point

**Files:**
- Modify: `Pokedexnational/package.json`
- Modify: `Pokedexnational/app.json`
- Delete: `Pokedexnational/App.tsx`, `Pokedexnational/index.ts`

- [ ] **Step 1: Change entry to Expo Router**

In `package.json`, replace `"main": "index.ts"` with:

```json
"main": "expo-router/entry"
```

- [ ] **Step 2: Update `app.json` for Expo Router**

Merge into `app.json` under `expo`:

```json
"scheme": "pokedexnational",
"plugins": ["expo-router"],
"web": { "bundler": "metro" }
```

- [ ] **Step 3: Remove legacy entry files**

```
git rm App.tsx index.ts
```

- [ ] **Step 4: Commit**

```
git add package.json app.json
git commit -m "chore: switch entry to expo-router"
```

### Task 1.5: Set up TypeScript path aliases

**Files:**
- Modify: `Pokedexnational/tsconfig.json`

- [ ] **Step 1: Add `paths` to `compilerOptions`**

Replace `tsconfig.json` content with:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 2: Commit**

```
git add tsconfig.json
git commit -m "chore: enable @/ path alias"
```

### Task 1.6: Create `.env.example`

**Files:**
- Create: `Pokedexnational/.env.example`

- [ ] **Step 1: Write**

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_APP_URL=http://localhost:8081
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
POKEMON_TCG_API_KEY=your-pokemontcg-api-key
```

`EXPO_PUBLIC_APP_URL` is used to build public share URLs in the Settings screen. Update to the real hosted domain once the web app is deployed.

- [ ] **Step 2: Commit**

```
git add .env.example
git commit -m "chore: add .env.example"
```

---

## Phase 2 — Static Pokédex data

### Task 2.1: Write the PokéAPI fetch script

**Files:**
- Create: `Pokedexnational/scripts/build-pokemon-data.ts`
- Create: `Pokedexnational/lib/types.ts` (shared type)

- [ ] **Step 1: Define the shared `Pokemon` type**

Create `lib/types.ts`:

```ts
export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export interface Pokemon {
  num: number;
  name_fr: string | null;
  name_en: string;
  types: PokemonType[];
  sprite_url: string;
}
```

- [ ] **Step 2: Write the script**

Create `scripts/build-pokemon-data.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import type { Pokemon, PokemonType } from '../lib/types';

const OUT = path.resolve(__dirname, '../data/pokedex.json');
const RATE_LIMIT_MS = 100;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

interface SpeciesResponse {
  names: { name: string; language: { name: string } }[];
}
interface PokemonResponse {
  types: { type: { name: PokemonType } }[];
  sprites: { other?: { 'official-artwork'?: { front_default: string | null } } };
}

async function buildOne(num: number): Promise<Pokemon> {
  const species = await fetchJson<SpeciesResponse>(
    `https://pokeapi.co/api/v2/pokemon-species/${num}`,
  );
  const pokemon = await fetchJson<PokemonResponse>(
    `https://pokeapi.co/api/v2/pokemon/${num}`,
  );
  const nameFr = species.names.find(n => n.language.name === 'fr')?.name ?? null;
  const nameEn = species.names.find(n => n.language.name === 'en')?.name ?? `#${num}`;
  const types = pokemon.types.map(t => t.type.name);
  const sprite =
    pokemon.sprites.other?.['official-artwork']?.front_default ??
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${num}.png`;
  return { num, name_fr: nameFr, name_en: nameEn, types, sprite_url: sprite };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const all: Pokemon[] = [];
  for (let num = 1; num <= 1025; num++) {
    try {
      const p = await buildOne(num);
      all.push(p);
      if (num % 50 === 0) console.log(`Fetched ${num}/1025`);
    } catch (err) {
      console.error(`Failed at ${num}:`, err);
      throw err;
    }
    await sleep(RATE_LIMIT_MS);
  }
  fs.writeFileSync(OUT, JSON.stringify(all));
  console.log(`Wrote ${all.length} entries to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Commit (script only, JSON in next task)**

```
git add lib/types.ts scripts/build-pokemon-data.ts
git commit -m "feat: add script to build baked pokedex data from PokéAPI"
```

### Task 2.2: Run the script and commit the generated JSON

**Files:**
- Create: `Pokedexnational/data/pokedex.json` (generated, ~500 KB)

- [ ] **Step 1: Run**

```
npm run build:pokedex
```

Expected: takes ~3 min (1025 × ~100 ms rate limit + fetch time). Ends with `Wrote 1025 entries to .../data/pokedex.json`. No errors.

- [ ] **Step 2: Sanity check the output**

```
node -e "const p=require('./data/pokedex.json'); console.log(p.length, p[0], p[24])"
```

Expected: `1025 { num: 1, name_fr: 'Bulbizarre', ... } { num: 25, name_fr: 'Pikachu', ... }`.

- [ ] **Step 3: Commit**

```
git add data/pokedex.json
git commit -m "data: bake 1025 Pokémon from PokéAPI"
```

---

## Phase 3 — Supabase schema & admin sync script

### Task 3.1: Initialize Supabase CLI config

**Files:**
- Create: `Pokedexnational/supabase/config.toml` (via CLI)
- Create: `Pokedexnational/supabase/migrations/` (via CLI)

- [ ] **Step 1: Install Supabase CLI**

If not already installed globally, on Windows via Scoop or manually:

```
scoop install supabase
```

Or download from `https://github.com/supabase/cli/releases`.

Verify: `supabase --version`.

- [ ] **Step 2: Init**

Run in `Pokedexnational/`:

```
supabase init
```

Accept defaults. This creates `supabase/config.toml` and `supabase/migrations/`.

- [ ] **Step 3: Link the local dir to your remote project**

```
supabase link --project-ref <your-project-ref>
```

Get `<your-project-ref>` from the Supabase dashboard URL (`https://supabase.com/dashboard/project/<REF>`). It will ask for the DB password (from Task 0.1).

- [ ] **Step 4: Commit**

```
git add supabase/config.toml supabase/.gitignore
git commit -m "chore: init supabase CLI project"
```

### Task 3.2: Write the `profiles` migration

**Files:**
- Create: `Pokedexnational/supabase/migrations/001_profiles.sql`

- [ ] **Step 1: Write**

```sql
CREATE TABLE public.profiles (
  id            uuid          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text          NOT NULL UNIQUE
                              CHECK (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  display_name  text          NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 60),
  is_public     boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX profiles_username_idx ON public.profiles (username);
```

- [ ] **Step 2: Commit (deploy in Task 3.9)**

```
git add supabase/migrations/001_profiles.sql
git commit -m "feat(db): add profiles table"
```

### Task 3.3: Write the `tcg_cards` migration

**Files:**
- Create: `Pokedexnational/supabase/migrations/002_tcg_cards.sql`

- [ ] **Step 1: Write**

```sql
CREATE TABLE public.tcg_cards (
  id            text          PRIMARY KEY,
  name          text          NOT NULL,
  dex_num       int2          NOT NULL CHECK (dex_num BETWEEN 1 AND 1025),
  set_id        text          NOT NULL,
  set_name      text          NOT NULL,
  card_number   text          NOT NULL,
  rarity        text,
  image_small   text          NOT NULL,
  image_large   text,
  release_date  date,
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX tcg_cards_dex_num_idx  ON public.tcg_cards (dex_num);
CREATE INDEX tcg_cards_set_id_idx   ON public.tcg_cards (set_id);
CREATE INDEX tcg_cards_rarity_idx   ON public.tcg_cards (rarity);
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/002_tcg_cards.sql
git commit -m "feat(db): add tcg_cards table"
```

### Task 3.4: Write the `user_cards` migration

**Files:**
- Create: `Pokedexnational/supabase/migrations/003_user_cards.sql`

- [ ] **Step 1: Write**

```sql
CREATE TABLE public.user_cards (
  user_id      uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id      text         NOT NULL REFERENCES public.tcg_cards(id) ON DELETE CASCADE,
  acquired_at  timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);

CREATE INDEX user_cards_user_id_idx ON public.user_cards (user_id);
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/003_user_cards.sql
git commit -m "feat(db): add user_cards table"
```

### Task 3.5: Write the views migration

**Files:**
- Create: `Pokedexnational/supabase/migrations/004_views.sql`

- [ ] **Step 1: Write**

```sql
CREATE VIEW public.user_dex WITH (security_invoker = on) AS
SELECT DISTINCT uc.user_id, tc.dex_num
FROM public.user_cards uc
JOIN public.tcg_cards tc ON tc.id = uc.card_id
WHERE tc.dex_num BETWEEN 1 AND 1025;

CREATE VIEW public.pokemon_tcg_index WITH (security_invoker = on) AS
SELECT
  dex_num,
  array_agg(DISTINCT set_id)                                     AS set_ids,
  array_agg(DISTINCT rarity) FILTER (WHERE rarity IS NOT NULL)   AS rarities
FROM public.tcg_cards
WHERE dex_num BETWEEN 1 AND 1025
GROUP BY dex_num;
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/004_views.sql
git commit -m "feat(db): add user_dex and pokemon_tcg_index views"
```

### Task 3.6: Write the RLS policies

**Files:**
- Create: `Pokedexnational/supabase/migrations/005_rls.sql`

- [ ] **Step 1: Write**

```sql
-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_self_or_public" ON public.profiles
FOR SELECT USING (auth.uid() = id OR is_public = true);

-- Username immutability is enforced by a BEFORE UPDATE trigger in 006 (RLS cannot reference OLD in WITH CHECK cleanly).
CREATE POLICY "profiles_update_self" ON public.profiles
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- tcg_cards
ALTER TABLE public.tcg_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tcg_cards_select_all" ON public.tcg_cards
FOR SELECT USING (true);

-- user_cards
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cards_select_self_or_public_profile" ON public.user_cards
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.is_public = true)
);

CREATE POLICY "user_cards_insert_self" ON public.user_cards
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_cards_delete_self" ON public.user_cards
FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/005_rls.sql
git commit -m "feat(db): enable RLS policies"
```

### Task 3.7: Write the onboarding trigger + username immutability trigger

**Files:**
- Create: `Pokedexnational/supabase/migrations/006_trigger_onboarding.sql`

- [ ] **Step 1: Write**

```sql
-- Onboarding: create the profile row when a new auth.users is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Username immutability: reject any UPDATE that changes username.
CREATE OR REPLACE FUNCTION public.enforce_username_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'username is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_immutable_username
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_username_immutable();
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/006_trigger_onboarding.sql
git commit -m "feat(db): auto-create profile + enforce username immutability"
```

### Task 3.8: Write the username availability RPC

**Files:**
- Create: `Pokedexnational/supabase/migrations/007_rpc_check_username.sql`

- [ ] **Step 1: Write**

```sql
CREATE OR REPLACE FUNCTION public.check_username_available(candidate text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(candidate));
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/007_rpc_check_username.sql
git commit -m "feat(db): add check_username_available RPC"
```

### Task 3.9: Deploy all migrations to the remote project

**Files:** none (deployment command)

- [ ] **Step 1: Push**

```
supabase db push
```

Expected: applies all 7 migrations in order, prints `Finished supabase db push.`.

- [ ] **Step 2: Verify via SQL editor**

In the Supabase dashboard SQL editor, run:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT view_name FROM information_schema.views WHERE table_schema = 'public';
```

Expected: tables `profiles`, `tcg_cards`, `user_cards`; views `user_dex`, `pokemon_tcg_index`.

- [ ] **Step 3: Verify RPC**

```sql
SELECT public.check_username_available('foo');
```

Expected: `true`.

### Task 3.10: Write the TCG sync script

**Files:**
- Create: `Pokedexnational/scripts/sync-tcg-cards.ts`

- [ ] **Step 1: Write**

```ts
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  POKEMON_TCG_API_KEY,
} = process.env;

const url = SUPABASE_URL ?? EXPO_PUBLIC_SUPABASE_URL;
if (!url || !SUPABASE_SERVICE_ROLE_KEY || !POKEMON_TCG_API_KEY) {
  throw new Error('Missing env vars — see .env.example');
}

const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface TcgCard {
  id: string;
  name: string;
  nationalPokedexNumbers?: number[];
  set: { id: string; name: string; releaseDate: string };
  number: string;
  rarity?: string;
  images: { small: string; large?: string };
}

const PAGE_SIZE = 250;

async function fetchPage(page: number): Promise<{ data: TcgCard[]; totalCount: number }> {
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=nationalPokedexNumbers:[1 TO 1025]&pageSize=${PAGE_SIZE}&page=${page}`,
    { headers: { 'X-Api-Key': POKEMON_TCG_API_KEY! } },
  );
  if (!res.ok) throw new Error(`Fetch page ${page} → ${res.status}`);
  return res.json();
}

function toRow(c: TcgCard) {
  const dex = c.nationalPokedexNumbers?.find(n => n >= 1 && n <= 1025);
  if (!dex) return null;
  return {
    id: c.id,
    name: c.name,
    dex_num: dex,
    set_id: c.set.id,
    set_name: c.set.name,
    card_number: c.number,
    rarity: c.rarity ?? null,
    image_small: c.images.small,
    image_large: c.images.large ?? null,
    release_date: c.set.releaseDate ?? null,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  let page = 1;
  let total = 0;
  let done = 0;
  do {
    const { data, totalCount } = await fetchPage(page);
    total = totalCount;
    const rows = data.map(toRow).filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length) {
      const { error } = await supabase.from('tcg_cards').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    done += data.length;
    console.log(`Page ${page}: ${data.length} cards processed (${done}/${total})`);
    page++;
  } while (done < total);
  console.log(`Done. Total processed: ${done}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Commit**

```
git add scripts/sync-tcg-cards.ts
git commit -m "feat: add tcg cards sync script"
```

### Task 3.11: Run the initial TCG sync

**Files:** none (runs the script)

- [ ] **Step 1: Run**

```
npm run sync:tcg
```

Expected: prints pages of ~250 cards each, total ~15 000 depending on the state of pokemontcg.io. Duration: ~1–2 min. No errors.

- [ ] **Step 2: Verify row count**

In Supabase SQL editor:

```sql
SELECT count(*) FROM public.tcg_cards;
SELECT count(DISTINCT dex_num) FROM public.tcg_cards;
```

Expected: `count(*)` around 15 000+, `count(DISTINCT dex_num)` between 800 and 1025 (very recent Pokémon may not have cards yet).

---

## Phase 4 — Supabase client, providers, and auth

### Task 4.1: Slug validator (TDD)

**Files:**
- Create: `Pokedexnational/lib/slug.ts`
- Create: `Pokedexnational/__tests__/slug.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/slug.test.ts`:

```ts
import { isValidUsername } from '../lib/slug';

describe('isValidUsername', () => {
  it('accepts lowercase, digits, underscore, hyphen (3–30 chars)', () => {
    expect(isValidUsername('tristan')).toBe(true);
    expect(isValidUsername('tristan-123')).toBe(true);
    expect(isValidUsername('t_r_s_t')).toBe(true);
    expect(isValidUsername('abc')).toBe(true);
  });
  it('rejects too short / too long', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });
  it('rejects uppercase, spaces, dots', () => {
    expect(isValidUsername('Tristan')).toBe(false);
    expect(isValidUsername('tristan.dev')).toBe(false);
    expect(isValidUsername('tri stan')).toBe(false);
  });
  it('rejects leading hyphen or underscore', () => {
    expect(isValidUsername('-tristan')).toBe(false);
    expect(isValidUsername('_tristan')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -- slug
```

Expected: `Cannot find module '../lib/slug'`.

- [ ] **Step 3: Implement**

Create `lib/slug.ts`:

```ts
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;
export function isValidUsername(candidate: string): boolean {
  return SLUG_RE.test(candidate);
}
```

- [ ] **Step 4: Run — expect PASS**

```
npm test -- slug
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```
git add lib/slug.ts __tests__/slug.test.ts
git commit -m "feat: add username slug validator"
```

### Task 4.2: `lib/i18n.ts` name resolver (TDD)

**Files:**
- Create: `Pokedexnational/lib/i18n.ts`
- Create: `Pokedexnational/__tests__/i18n.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { getName } from '../lib/i18n';

describe('getName', () => {
  it('prefers FR when present', () => {
    expect(getName({ name_fr: 'Pikachu', name_en: 'Pikachu' })).toBe('Pikachu');
    expect(getName({ name_fr: 'Bulbizarre', name_en: 'Bulbasaur' })).toBe('Bulbizarre');
  });
  it('falls back to EN when FR is null', () => {
    expect(getName({ name_fr: null, name_en: 'Sprigatito' })).toBe('Sprigatito');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -- i18n
```

- [ ] **Step 3: Implement**

```ts
export function getName(p: { name_fr: string | null; name_en: string }): string {
  return p.name_fr ?? p.name_en;
}
```

- [ ] **Step 4: Run — expect PASS**

```
npm test -- i18n
```

- [ ] **Step 5: Commit**

```
git add lib/i18n.ts __tests__/i18n.test.ts
git commit -m "feat: add FR/EN name resolver"
```

### Task 4.3: Supabase client singleton

**Files:**
- Create: `Pokedexnational/lib/supabase.ts`

- [ ] **Step 1: Write**

```ts
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore on native, localStorage on web (default in @supabase/supabase-js)
const nativeStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(url, anon, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : nativeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
```

- [ ] **Step 2: Commit**

```
git add lib/supabase.ts
git commit -m "feat: add Supabase client singleton"
```

### Task 4.4: Auth hooks

**Files:**
- Create: `Pokedexnational/lib/auth.ts`

- [ ] **Step 1: Write**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, username: string, displayName: string) {
  const { data: avail, error: rpcErr } = await supabase.rpc('check_username_available', { candidate: username });
  if (rpcErr) throw rpcErr;
  if (!avail) throw new Error('USERNAME_TAKEN');

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName } },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
```

- [ ] **Step 2: Commit**

```
git add lib/auth.ts
git commit -m "feat: add auth hooks and helpers"
```

### Task 4.5: Root layout with providers

**Files:**
- Create: `Pokedexnational/app/_layout.tsx`

- [ ] **Step 1: Write**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMemo } from 'react';

export default function RootLayout() {
  const queryClient = useMemo(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: true, retry: 1 },
      },
    }),
    [],
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Commit**

```
git add app/_layout.tsx
git commit -m "feat: root layout with QueryClient + SafeArea"
```

### Task 4.6: Root index redirect

**Files:**
- Create: `Pokedexnational/app/index.tsx`

- [ ] **Step 1: Write**

```tsx
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useSession } from '@/lib/auth';

export default function Index() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={session ? '/pokedex' : '/login'} />;
}
```

- [ ] **Step 2: Commit**

```
git add app/index.tsx
git commit -m "feat: root redirect based on session"
```

### Task 4.7: Auth group guards

**Files:**
- Create: `Pokedexnational/app/(auth)/_layout.tsx`
- Create: `Pokedexnational/app/(app)/_layout.tsx`

- [ ] **Step 1: Write `(auth)/_layout.tsx` (blocks authed users)**

```tsx
import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/lib/auth';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (session) return <Redirect href="/pokedex" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write `(app)/_layout.tsx` (blocks unauthed users)**

```tsx
import { Redirect, Tabs } from 'expo-router';
import { useSession } from '@/lib/auth';
import { View, ActivityIndicator, useWindowDimensions } from 'react-native';

export default function AppLayout() {
  const { session, loading } = useSession();
  const { width } = useWindowDimensions();

  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/login" />;

  // V1: keep tabs on all sizes; sidebar polish comes in Task 10.1
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="pokedex" options={{ title: 'Pokédex' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="pokemon/[num]" options={{ href: null }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```
git add app/(auth)/_layout.tsx app/(app)/_layout.tsx
git commit -m "feat: route group guards for auth and app"
```

### Task 4.8: Login screen

**Files:**
- Create: `Pokedexnational/app/(auth)/login.tsx`

- [ ] **Step 1: Write**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { signIn } from '@/lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setPending(true);
    try { await signIn(email.trim(), password); }
    catch (e: any) { setError(e?.message ?? 'Login failed'); }
    finally { setPending(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Connexion</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder="Mot de passe" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : 'Se connecter'}</Text>
      </Pressable>
      <Link href="/signup" style={styles.link}>Pas de compte ? S'inscrire</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  h1: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  err: { color: '#c00' },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 12, color: '#555' },
});
```

- [ ] **Step 2: Manual verify**

Run `npm run web`. Navigate to `/login`. Enter garbage credentials → error is shown. (Real login tested after signup works, in the next task.)

- [ ] **Step 3: Commit**

```
git add app/(auth)/login.tsx
git commit -m "feat: login screen"
```

### Task 4.9: Signup screen

**Files:**
- Create: `Pokedexnational/app/(auth)/signup.tsx`

- [ ] **Step 1: Write**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { signUp } from '@/lib/auth';
import { isValidUsername } from '@/lib/slug';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');

  const onUsernameBlur = async () => {
    const u = username.trim().toLowerCase();
    if (!u) return setUsernameCheck('idle');
    if (!isValidUsername(u)) return setUsernameCheck('invalid');
    setUsernameCheck('checking');
    const { data, error } = await supabase.rpc('check_username_available', { candidate: u });
    if (error) return setUsernameCheck('idle');
    setUsernameCheck(data ? 'ok' : 'taken');
  };

  const submit = async () => {
    setError(null);
    const u = username.trim().toLowerCase();
    if (!isValidUsername(u)) return setError("Username invalide (3–30 caractères, a-z 0-9 _ - uniquement, doit commencer par a-z ou 0-9)");
    setPending(true);
    try {
      await signUp(email.trim(), password, u, displayName.trim() || u);
    } catch (e: any) {
      if (e?.message === 'USERNAME_TAKEN') setError('Ce username est déjà pris');
      else setError(e?.message ?? 'Inscription échouée');
    } finally { setPending(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Créer un compte</Text>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput placeholder="Mot de passe (min 6)" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      <TextInput placeholder="Username (immutable, ex: tristan-42)" value={username}
        onChangeText={setUsername} onBlur={onUsernameBlur}
        autoCapitalize="none" style={styles.input} />
      {usernameCheck === 'checking' && <Text style={styles.hint}>Vérification…</Text>}
      {usernameCheck === 'ok'       && <Text style={[styles.hint, { color: 'green' }]}>Disponible ✓</Text>}
      {usernameCheck === 'taken'    && <Text style={styles.err}>Déjà pris</Text>}
      {usernameCheck === 'invalid'  && <Text style={styles.err}>Format invalide</Text>}
      <TextInput placeholder="Nom affiché (public)" value={displayName}
        onChangeText={setDisplayName} style={styles.input} />
      {error && <Text style={styles.err}>{error}</Text>}
      <Pressable onPress={submit} disabled={pending} style={styles.btn}>
        <Text style={styles.btnText}>{pending ? '…' : "S'inscrire"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>Déjà un compte ? Se connecter</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  h1: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { color: '#555', fontSize: 12 },
  err: { color: '#c00' },
  btn: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 12, color: '#555' },
});
```

- [ ] **Step 2: Manual verify**

Run `npm run web`. Navigate to `/signup`. Create a test account. Confirm redirect to `/pokedex` (which will be empty for now — expected).

- [ ] **Step 3: Commit**

```
git add app/(auth)/signup.tsx
git commit -m "feat: signup screen with username availability check"
```

---

## Phase 5 — National grid, filters, search, sort

### Task 5.1: Types colors mapping

**Files:**
- Create: `Pokedexnational/lib/types-colors.ts`

- [ ] **Step 1: Write**

```ts
import type { PokemonType } from './types';

export const TYPE_COLORS: Record<PokemonType, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

export const TYPE_LABEL_FR: Record<PokemonType, string> = {
  normal: 'Normal', fire: 'Feu', water: 'Eau', electric: 'Électrik',
  grass: 'Plante', ice: 'Glace', fighting: 'Combat', poison: 'Poison',
  ground: 'Sol', flying: 'Vol', psychic: 'Psy', bug: 'Insecte',
  rock: 'Roche', ghost: 'Spectre', dragon: 'Dragon', dark: 'Ténèbres',
  steel: 'Acier', fairy: 'Fée',
};
```

- [ ] **Step 2: Commit**

```
git add lib/types-colors.ts
git commit -m "feat: add Pokemon type colors and FR labels"
```

### Task 5.2: `usePokedexList` pipeline (TDD)

**Files:**
- Create: `Pokedexnational/lib/pokedex-list.ts`
- Create: `Pokedexnational/__tests__/pokedex-list.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { applyPokedexPipeline } from '../lib/pokedex-list';
import type { Pokemon } from '../lib/types';

const sample: Pokemon[] = [
  { num: 1, name_fr: 'Bulbizarre', name_en: 'Bulbasaur', types: ['grass', 'poison'], sprite_url: '' },
  { num: 4, name_fr: 'Salamèche', name_en: 'Charmander', types: ['fire'], sprite_url: '' },
  { num: 7, name_fr: 'Carapuce', name_en: 'Squirtle', types: ['water'], sprite_url: '' },
  { num: 25, name_fr: 'Pikachu', name_en: 'Pikachu', types: ['electric'], sprite_url: '' },
];

const index = new Map<number, { set_ids: string[]; rarities: string[] }>([
  [1, { set_ids: ['base1'], rarities: ['Rare Holo'] }],
  [4, { set_ids: ['base1'], rarities: ['Rare Holo'] }],
  [25, { set_ids: ['base1', 'jungle'], rarities: ['Common'] }],
]);

describe('applyPokedexPipeline', () => {
  const owned = new Set([1, 25]);

  it('filters by status=owned', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'owned', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([1, 25]);
  });

  it('filters by status=missing', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'missing', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([4, 7]);
  });

  it('filters by type (mono and bi-type)', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: 'poison', setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([1]);
  });

  it('filters by set', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: 'jungle', rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('filters by rarity', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: 'Common', sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('combines filters (AND)', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'owned', typeFilter: 'electric', setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search by number substring', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '025', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search by short number', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: '25', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([25]);
  });

  it('search accent-insensitive on FR name', () => {
    const r = applyPokedexPipeline(sample, owned, index, {
      search: 'salameche', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'num-asc',
    });
    expect(r.map(x => x.num)).toEqual([4]);
  });

  it('sort name asc/desc, insensitive to accents', () => {
    const asc = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'name-asc',
    });
    expect(asc.map(x => x.num)).toEqual([1, 7, 25, 4]); // Bulbizarre, Carapuce, Pikachu, Salamèche
    const desc = applyPokedexPipeline(sample, owned, index, {
      search: '', statusFilter: 'all', typeFilter: null, setFilter: null, rarityFilter: null, sort: 'name-desc',
    });
    expect(desc.map(x => x.num)).toEqual([4, 25, 7, 1]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -- pokedex-list
```

- [ ] **Step 3: Implement**

Create `lib/pokedex-list.ts`:

```ts
import type { Pokemon, PokemonType } from './types';
import { getName } from './i18n';

export type StatusFilter = 'all' | 'owned' | 'missing';
export type SortKey = 'num-asc' | 'num-desc' | 'name-asc' | 'name-desc';

export interface PipelineOptions {
  search: string;
  statusFilter: StatusFilter;
  typeFilter: PokemonType | null;
  setFilter: string | null;
  rarityFilter: string | null;
  sort: SortKey;
}

export interface PokemonWithState extends Pokemon { owned: boolean }

export type TcgIndex = Map<number, { set_ids: string[]; rarities: string[] }>;

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function applyPokedexPipeline(
  pokemons: Pokemon[],
  owned: Set<number>,
  tcgIndex: TcgIndex,
  opts: PipelineOptions,
): PokemonWithState[] {
  const searchN = normalize(opts.search.trim());
  const searchDigits = /^\d+$/.test(searchN) ? String(parseInt(searchN, 10)) : null;

  const merged: PokemonWithState[] = pokemons.map(p => ({ ...p, owned: owned.has(p.num) }));

  const filtered = merged.filter(p => {
    if (opts.statusFilter === 'owned' && !p.owned) return false;
    if (opts.statusFilter === 'missing' && p.owned) return false;

    if (opts.typeFilter && !p.types.includes(opts.typeFilter)) return false;

    if (opts.setFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.set_ids.includes(opts.setFilter)) return false;
    }
    if (opts.rarityFilter) {
      const idx = tcgIndex.get(p.num);
      if (!idx || !idx.rarities.includes(opts.rarityFilter)) return false;
    }

    if (searchN) {
      if (searchDigits && String(p.num) === searchDigits) return true;
      const paddedMatch = String(p.num).padStart(3, '0').includes(searchN);
      if (paddedMatch) return true;
      const nameMatches =
        (p.name_fr && normalize(p.name_fr).includes(searchN)) ||
        normalize(p.name_en).includes(searchN);
      if (!nameMatches) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  const cmpName = (a: PokemonWithState, b: PokemonWithState) =>
    normalize(getName(a)).localeCompare(normalize(getName(b)));
  switch (opts.sort) {
    case 'num-asc':  sorted.sort((a, b) => a.num - b.num); break;
    case 'num-desc': sorted.sort((a, b) => b.num - a.num); break;
    case 'name-asc':  sorted.sort(cmpName); break;
    case 'name-desc': sorted.sort((a, b) => cmpName(b, a)); break;
  }
  return sorted;
}
```

- [ ] **Step 4: Run — expect PASS**

```
npm test -- pokedex-list
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```
git add lib/pokedex-list.ts __tests__/pokedex-list.test.ts
git commit -m "feat: search/filter/sort pipeline for pokedex"
```

### Task 5.3: Collection hooks (user_dex + toggle)

**Files:**
- Create: `Pokedexnational/lib/collection.ts`

- [ ] **Step 1: Write**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useSession } from './auth';

export function useUserDex(userId?: string) {
  return useQuery({
    queryKey: ['user_dex', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_dex').select('dex_num').eq('user_id', userId!);
      if (error) throw error;
      return new Set<number>((data ?? []).map(r => r.dex_num as number));
    },
  });
}

export function useUserCards(userId: string | undefined, dexNum: number | undefined) {
  return useQuery({
    queryKey: ['user_cards', userId, dexNum],
    enabled: !!userId && !!dexNum,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_id, tcg_cards!inner(dex_num)')
        .eq('user_id', userId!)
        .eq('tcg_cards.dex_num', dexNum!);
      if (error) throw error;
      return new Set<string>((data ?? []).map(r => r.card_id as string));
    },
  });
}

export function useToggleCard() {
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async ({ cardId, currentlyOwned }: { cardId: string; currentlyOwned: boolean; dexNum: number }) => {
      if (!userId) throw new Error('Not signed in');
      if (currentlyOwned) {
        const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_cards').insert({ user_id: userId, card_id: cardId });
        if (error) throw error;
      }
    },
    onMutate: async ({ cardId, currentlyOwned, dexNum }) => {
      await qc.cancelQueries({ queryKey: ['user_cards', userId, dexNum] });
      await qc.cancelQueries({ queryKey: ['user_dex', userId] });

      const prevCards = qc.getQueryData<Set<string>>(['user_cards', userId, dexNum]);
      const prevDex   = qc.getQueryData<Set<number>>(['user_dex', userId]);

      const nextCards = new Set(prevCards ?? []);
      if (currentlyOwned) nextCards.delete(cardId); else nextCards.add(cardId);
      qc.setQueryData(['user_cards', userId, dexNum], nextCards);

      const nextDex = new Set(prevDex ?? []);
      if (nextCards.size > 0) nextDex.add(dexNum); else nextDex.delete(dexNum);
      qc.setQueryData(['user_dex', userId], nextDex);

      return { prevCards, prevDex };
    },
    onError: (_e, { dexNum }, ctx) => {
      if (ctx?.prevCards) qc.setQueryData(['user_cards', userId, dexNum], ctx.prevCards);
      if (ctx?.prevDex)   qc.setQueryData(['user_dex', userId], ctx.prevDex);
    },
    onSettled: (_r, _e, { dexNum }) => {
      qc.invalidateQueries({ queryKey: ['user_cards', userId, dexNum] });
      qc.invalidateQueries({ queryKey: ['user_dex', userId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```
git add lib/collection.ts
git commit -m "feat: collection hooks (user_dex, user_cards, toggle)"
```

### Task 5.4: TCG index hook (for filters)

**Files:**
- Create: `Pokedexnational/lib/tcg-index.ts`

- [ ] **Step 1: Write**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { TcgIndex } from './pokedex-list';

export function useTcgIndex() {
  return useQuery({
    queryKey: ['pokemon_tcg_index'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('pokemon_tcg_index').select('dex_num, set_ids, rarities');
      if (error) throw error;
      const map: TcgIndex = new Map();
      for (const row of data ?? []) {
        map.set(row.dex_num as number, {
          set_ids: (row.set_ids ?? []) as string[],
          rarities: (row.rarities ?? []) as string[],
        });
      }
      return map;
    },
  });
}

export function useTcgSets() {
  return useQuery({
    queryKey: ['tcg_sets'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('set_id, set_name, release_date')
        .order('release_date', { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      const out: { id: string; name: string }[] = [];
      for (const row of data ?? []) {
        if (seen.has(row.set_id as string)) continue;
        seen.add(row.set_id as string);
        out.push({ id: row.set_id as string, name: row.set_name as string });
      }
      return out;
    },
  });
}

export function useTcgRarities() {
  return useQuery({
    queryKey: ['tcg_rarities'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('rarity')
        .not('rarity', 'is', null);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of data ?? []) if (row.rarity) set.add(row.rarity as string);
      return Array.from(set).sort();
    },
  });
}
```

- [ ] **Step 2: Commit**

```
git add lib/tcg-index.ts
git commit -m "feat: hooks for TCG index, sets, rarities"
```

### Task 5.5: `PokemonTile` component

**Files:**
- Create: `Pokedexnational/components/PokemonTile.tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';

interface Props {
  pokemon: Pokemon;
  owned: boolean;
  cardCount?: number;
  onPress: () => void;
}

export function PokemonTile({ pokemon, owned, cardCount, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.spriteWrap, !owned && styles.spriteMissing]}>
        <Image source={{ uri: pokemon.sprite_url }} style={styles.sprite} resizeMode="contain" />
        {owned && <View style={styles.checkBadge}><Text style={styles.checkText}>✓</Text></View>}
      </View>
      <Text style={[styles.num, !owned && styles.textDim]}>
        #{String(pokemon.num).padStart(4, '0')}
      </Text>
      <Text style={[styles.name, !owned && styles.textDim]} numberOfLines={1}>
        {getName(pokemon)}
      </Text>
      {owned && cardCount !== undefined && cardCount > 0 && (
        <Text style={styles.cardCount}>×{cardCount}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, aspectRatio: 0.85, padding: 6, alignItems: 'center', justifyContent: 'flex-start' },
  pressed: { transform: [{ scale: 0.95 }] },
  spriteWrap: { width: '100%', aspectRatio: 1, position: 'relative' },
  spriteMissing: { opacity: 0.35 },
  sprite: { width: '100%', height: '100%' },
  checkBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: '#22c55e',
    borderRadius: 999, width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { color: 'white', fontSize: 12, fontWeight: '700' },
  num: { fontSize: 10, color: '#666', marginTop: 4 },
  name: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  textDim: { color: '#999' },
  cardCount: { fontSize: 10, color: '#22c55e', fontWeight: '600' },
});
```

- [ ] **Step 2: Commit**

```
git add components/PokemonTile.tsx
git commit -m "feat: PokemonTile component"
```

### Task 5.6: `ProgressCounter` component

**Files:**
- Create: `Pokedexnational/components/ProgressCounter.tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  owned: number;
  total: number;
  cardCount?: number;
  filterHint?: string;
}

export function ProgressCounter({ owned, total, cardCount, filterHint }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  return (
    <View style={styles.wrap}>
      <Text style={styles.main}>
        {owned} / {total} <Text style={styles.pct}>({pct}%)</Text>
      </Text>
      {cardCount !== undefined && <Text style={styles.sub}>· {cardCount} cartes</Text>}
      {filterHint && <Text style={styles.hint}>— filtre : {filterHint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  main: { fontSize: 14, fontWeight: '600' },
  pct: { color: '#666', fontWeight: '400' },
  sub: { fontSize: 14, color: '#444' },
  hint: { fontSize: 12, color: '#888' },
});
```

- [ ] **Step 2: Commit**

```
git add components/ProgressCounter.tsx
git commit -m "feat: ProgressCounter component"
```

### Task 5.7: `SearchFilterBar` component

**Files:**
- Create: `Pokedexnational/components/SearchFilterBar.tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from 'react-native';
import type { PokemonType } from '@/lib/types';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { TYPE_LABEL_FR } from '@/lib/types-colors';

interface Props {
  search: string;                       onSearch: (v: string) => void;
  statusFilter: StatusFilter;           onStatus: (v: StatusFilter) => void;
  typeFilter: PokemonType | null;       onType: (v: PokemonType | null) => void;
  setFilter: string | null;             onSet: (v: string | null) => void;
  rarityFilter: string | null;          onRarity: (v: string | null) => void;
  sort: SortKey;                        onSort: (v: SortKey) => void;
  sets: { id: string; name: string }[];
  rarities: string[];
  onReset: () => void;
}

const CHIP = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>
);

export function SearchFilterBar(p: Props) {
  const hasFilters = p.statusFilter !== 'all' || p.typeFilter || p.setFilter || p.rarityFilter;

  return (
    <View style={styles.wrap}>
      <TextInput placeholder="Rechercher (nom ou n°)" value={p.search} onChangeText={p.onSearch}
        style={styles.search} autoCapitalize="none" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="Tous" active={p.statusFilter === 'all'} onPress={() => p.onStatus('all')} />
        <CHIP label="Possédés" active={p.statusFilter === 'owned'} onPress={() => p.onStatus('owned')} />
        <CHIP label="Manquants" active={p.statusFilter === 'missing'} onPress={() => p.onStatus('missing')} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="Type" active={p.typeFilter !== null}
          onPress={() => {
            const types = Object.keys(TYPE_LABEL_FR) as PokemonType[];
            const idx = p.typeFilter ? types.indexOf(p.typeFilter) : -1;
            const next = idx === types.length - 1 ? null : types[idx + 1];
            p.onType(next);
          }} />
        {p.typeFilter && <Text style={styles.pill}>{TYPE_LABEL_FR[p.typeFilter]}</Text>}

        <CHIP label="Set" active={p.setFilter !== null}
          onPress={() => {
            const idx = p.setFilter ? p.sets.findIndex(s => s.id === p.setFilter) : -1;
            const next = idx === p.sets.length - 1 ? null : p.sets[idx + 1]?.id ?? null;
            p.onSet(next);
          }} />
        {p.setFilter && <Text style={styles.pill}>{p.sets.find(s => s.id === p.setFilter)?.name ?? p.setFilter}</Text>}

        <CHIP label="Rareté" active={p.rarityFilter !== null}
          onPress={() => {
            const idx = p.rarityFilter ? p.rarities.indexOf(p.rarityFilter) : -1;
            const next = idx === p.rarities.length - 1 ? null : p.rarities[idx + 1] ?? null;
            p.onRarity(next);
          }} />
        {p.rarityFilter && <Text style={styles.pill}>{p.rarityFilter}</Text>}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <CHIP label="N° ↑"   active={p.sort === 'num-asc'}   onPress={() => p.onSort('num-asc')} />
        <CHIP label="N° ↓"   active={p.sort === 'num-desc'}  onPress={() => p.onSort('num-desc')} />
        <CHIP label="A → Z"  active={p.sort === 'name-asc'}  onPress={() => p.onSort('name-asc')} />
        <CHIP label="Z → A"  active={p.sort === 'name-desc'} onPress={() => p.onSort('name-desc')} />
      </ScrollView>

      {hasFilters && (
        <Pressable onPress={p.onReset} style={styles.reset}>
          <Text style={styles.resetText}>Réinitialiser les filtres</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 8, gap: 6, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  chipRow: { gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#111' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: 'white', fontWeight: '600' },
  pill: { fontSize: 12, color: '#555', marginLeft: 4 },
  reset: { alignSelf: 'flex-end', padding: 4 },
  resetText: { fontSize: 12, color: '#c00' },
});
```

V1 note: for time-to-value, the dropdowns are implemented as **cycling chips** (tap the "Type" chip to advance to next type, tap while at last to reset to null). A proper multi-option picker is a V1.x polish item.

- [ ] **Step 2: Commit**

```
git add components/SearchFilterBar.tsx
git commit -m "feat: SearchFilterBar component with cycling filter chips"
```

### Task 5.8: `PokedexGrid` component

**Files:**
- Create: `Pokedexnational/components/PokedexGrid.tsx`

- [ ] **Step 1: Write**

```tsx
import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { PokemonTile } from './PokemonTile';
import type { PokemonWithState } from '@/lib/pokedex-list';

interface Props {
  items: PokemonWithState[];
  onSelect: (num: number) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 3;
  if (width < 1024) return 5;
  return 8;
}

export function PokedexGrid({ items, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const cols = numColsFor(width);
  return (
    <FlashList
      data={items}
      numColumns={cols}
      estimatedItemSize={120}
      keyExtractor={item => String(item.num)}
      renderItem={({ item }) => (
        <PokemonTile pokemon={item} owned={item.owned} onPress={() => onSelect(item.num)} />
      )}
    />
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/PokedexGrid.tsx
git commit -m "feat: PokedexGrid with responsive columns"
```

### Task 5.9: Wire the National screen `/pokedex`

**Files:**
- Create: `Pokedexnational/app/(app)/pokedex.tsx`

- [ ] **Step 1: Write**

```tsx
import { useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { useSession } from '@/lib/auth';
import { useUserDex } from '@/lib/collection';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressCounter } from '@/components/ProgressCounter';
import { TYPE_LABEL_FR } from '@/lib/types-colors';

const POKEDEX = pokedexData as Pokemon[];

export default function PokedexScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { data: owned = new Set<number>() } = useUserDex(session?.user.id);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();

  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState<StatusFilter>('all');
  const [typeFilter, setType]       = useState<PokemonType | null>(null);
  const [setFilter, setSet]         = useState<string | null>(null);
  const [rarityFilter, setRarity]   = useState<string | null>(null);
  const [sort, setSort]             = useState<SortKey>('num-asc');

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, sort],
  );

  const filterHintParts: string[] = [];
  if (typeFilter) filterHintParts.push(TYPE_LABEL_FR[typeFilter]);
  if (setFilter)  filterHintParts.push(sets.find(s => s.id === setFilter)?.name ?? setFilter);
  if (rarityFilter) filterHintParts.push(rarityFilter);
  const filterHint = filterHintParts.length ? filterHintParts.join(' + ') : undefined;

  const ownedCount = items.filter(p => p.owned).length;

  const reset = () => { setStatus('all'); setType(null); setSet(null); setRarity(null); };

  return (
    <SafeAreaView style={styles.screen}>
      <SearchFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        sort={sort} onSort={setSort}
        sets={sets} rarities={rarities}
        onReset={reset}
      />
      <View style={styles.counter}>
        <ProgressCounter owned={ownedCount} total={items.length} filterHint={filterHint} />
      </View>
      <PokedexGrid items={items} onSelect={num => router.push(`/pokemon/${num}`)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  counter: { padding: 8, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
});
```

- [ ] **Step 2: Manual verify**

Run `npm run web`. Login with the account created in Task 4.9. Confirm you see all 1025 tiles, all marked "missing" (opaque). Try search "pikachu" → only Pikachu appears. Tap "Possédés" filter → empty grid (no cards owned yet). Reset filters.

- [ ] **Step 3: Commit**

```
git add app/(app)/pokedex.tsx
git commit -m "feat: National pokedex screen with filters and search"
```

---

## Phase 6 — Pokemon detail + card gallery

### Task 6.1: `TypeBadge` component

**Files:**
- Create: `Pokedexnational/components/TypeBadge.tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import type { PokemonType } from '@/lib/types';
import { TYPE_COLORS, TYPE_LABEL_FR } from '@/lib/types-colors';

export function TypeBadge({ type }: { type: PokemonType }) {
  return (
    <View style={[styles.badge, { backgroundColor: TYPE_COLORS[type] }]}>
      <Text style={styles.text}>{TYPE_LABEL_FR[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  text: { color: 'white', fontSize: 12, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```
git add components/TypeBadge.tsx
git commit -m "feat: TypeBadge component"
```

### Task 6.2: TCG cards hook

**Files:**
- Create: `Pokedexnational/lib/tcg.ts`

- [ ] **Step 1: Write**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface TcgCardRow {
  id: string;
  name: string;
  set_id: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_small: string;
  image_large: string | null;
  release_date: string | null;
}

export function useCardsForPokemon(dexNum: number | undefined) {
  return useQuery({
    queryKey: ['tcg_cards_by_dex', dexNum],
    enabled: !!dexNum,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tcg_cards')
        .select('id, name, set_id, set_name, card_number, rarity, image_small, image_large, release_date')
        .eq('dex_num', dexNum!)
        .order('release_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TcgCardRow[];
    },
  });
}
```

- [ ] **Step 2: Commit**

```
git add lib/tcg.ts
git commit -m "feat: hook to fetch TCG cards for a Pokemon"
```

### Task 6.3: `CardTile` component

**Files:**
- Create: `Pokedexnational/components/CardTile.tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { TcgCardRow } from '@/lib/tcg';

interface Props {
  card: TcgCardRow;
  owned: boolean;
  readOnly?: boolean;
  onToggle: () => void;
}

export function CardTile({ card, owned, readOnly, onToggle }: Props) {
  return (
    <Pressable onPress={readOnly ? undefined : onToggle}
      style={({ pressed }) => [
        styles.tile,
        owned && styles.owned,
        !owned && styles.missing,
        pressed && !readOnly && { transform: [{ scale: 0.97 }] },
      ]}>
      <Image source={{ uri: card.image_small }} style={styles.img} resizeMode="contain" />
      <Text style={styles.set} numberOfLines={1}>{card.set_name} · {card.card_number}</Text>
      {card.rarity && <Text style={styles.rarity} numberOfLines={1}>{card.rarity}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 6, borderRadius: 8, borderWidth: 2 },
  owned:   { borderColor: '#22c55e', backgroundColor: '#f0fdf4' },
  missing: { borderColor: 'transparent', opacity: 0.55 },
  img: { width: '100%', aspectRatio: 0.72 },
  set: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  rarity: { fontSize: 10, color: '#666' },
});
```

- [ ] **Step 2: Commit**

```
git add components/CardTile.tsx
git commit -m "feat: CardTile component"
```

### Task 6.4: `CardGallery` component

**Files:**
- Create: `Pokedexnational/components/CardGallery.tsx`

- [ ] **Step 1: Write**

```tsx
import { FlashList } from '@shopify/flash-list';
import { useWindowDimensions } from 'react-native';
import { CardTile } from './CardTile';
import type { TcgCardRow } from '@/lib/tcg';

interface Props {
  cards: TcgCardRow[];
  ownedSet: Set<string>;
  readOnly?: boolean;
  onToggle: (card: TcgCardRow) => void;
}

function numColsFor(width: number): number {
  if (width < 600) return 2;
  if (width < 1024) return 4;
  return 6;
}

export function CardGallery({ cards, ownedSet, readOnly, onToggle }: Props) {
  const { width } = useWindowDimensions();
  return (
    <FlashList
      data={cards}
      numColumns={numColsFor(width)}
      estimatedItemSize={200}
      keyExtractor={c => c.id}
      renderItem={({ item }) => (
        <CardTile card={item} owned={ownedSet.has(item.id)} readOnly={readOnly}
          onToggle={() => onToggle(item)} />
      )}
    />
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/CardGallery.tsx
git commit -m "feat: CardGallery component"
```

### Task 6.5: Pokemon detail screen `/pokemon/[num]`

**Files:**
- Create: `Pokedexnational/app/(app)/pokemon/[num].tsx`

- [ ] **Step 1: Write**

```tsx
import { View, Text, Image, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon } from '@/lib/types';
import { getName } from '@/lib/i18n';
import { TypeBadge } from '@/components/TypeBadge';
import { CardGallery } from '@/components/CardGallery';
import { useCardsForPokemon } from '@/lib/tcg';
import { useSession } from '@/lib/auth';
import { useUserCards, useToggleCard } from '@/lib/collection';

const POKEDEX = pokedexData as Pokemon[];

export default function PokemonDetail() {
  const { num: numStr } = useLocalSearchParams<{ num: string }>();
  const router = useRouter();
  const num = parseInt(numStr as string, 10);
  const p = POKEDEX.find(x => x.num === num);
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: cards = [], isLoading: cardsLoading } = useCardsForPokemon(num);
  const { data: ownedSet = new Set<string>() } = useUserCards(userId, num);
  const toggle = useToggleCard();

  if (!p) return <SafeAreaView><Text>Pokémon inconnu</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Retour</Text>
        </Pressable>
        <Text style={styles.title}>#{String(p.num).padStart(4, '0')} · {getName(p)}</Text>
        <Text style={styles.count}>{ownedSet.size} / {cards.length} cartes</Text>
      </View>

      <View style={styles.hero}>
        <Image source={{ uri: p.sprite_url }} style={styles.sprite} resizeMode="contain" />
        <View style={styles.types}>
          {p.types.map(t => <TypeBadge key={t} type={t} />)}
        </View>
      </View>

      {cardsLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : cards.length === 0 ? (
        <Text style={styles.empty}>Aucune carte TCG connue pour ce Pokémon dans la base.</Text>
      ) : (
        <CardGallery
          cards={cards}
          ownedSet={ownedSet}
          onToggle={c => toggle.mutate({ cardId: c.id, currentlyOwned: ownedSet.has(c.id), dexNum: num })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  header: { padding: 12, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  back: { padding: 4 },
  backText: { color: '#3b82f6' },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  count: { fontSize: 12, color: '#666' },
  hero: { alignItems: 'center', padding: 16, gap: 12 },
  sprite: { width: 200, height: 200 },
  types: { flexDirection: 'row', gap: 8 },
  empty: { textAlign: 'center', color: '#666', padding: 24 },
});
```

- [ ] **Step 2: Manual verify**

From `/pokedex`, tap Pikachu → detail page opens showing sprite, types (`Électrik`), and a gallery of Pikachu cards. Tap one card → borderline changes to green, tile in previous grid changes state (verify by hitting back).

- [ ] **Step 3: Commit**

```
git add app/(app)/pokemon/[num].tsx
git commit -m "feat: Pokemon detail screen with card gallery and toggle"
```

---

## Phase 7 — Public share view

### Task 7.1: Public profile fetch hook

**Files:**
- Modify: `Pokedexnational/lib/auth.ts`

- [ ] **Step 1: Append to `lib/auth.ts`**

Add at the end of the file:

```ts
export async function fetchPublicProfile(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, is_public')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_public) return null;
  return data as { id: string; username: string; display_name: string; is_public: boolean };
}
```

- [ ] **Step 2: Commit**

```
git add lib/auth.ts
git commit -m "feat: helper to fetch a public profile by username"
```

### Task 7.2: Public view `/u/[username]`

**Files:**
- Create: `Pokedexnational/app/u/[username].tsx`

- [ ] **Step 1: Write**

```tsx
import { useMemo, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import pokedexData from '@/data/pokedex.json';
import type { Pokemon, PokemonType } from '@/lib/types';
import { fetchPublicProfile } from '@/lib/auth';
import { useUserDex } from '@/lib/collection';
import { useTcgIndex, useTcgSets, useTcgRarities } from '@/lib/tcg-index';
import { applyPokedexPipeline } from '@/lib/pokedex-list';
import type { StatusFilter, SortKey } from '@/lib/pokedex-list';
import { PokedexGrid } from '@/components/PokedexGrid';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { ProgressCounter } from '@/components/ProgressCounter';

const POKEDEX = pokedexData as Pokemon[];

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<{ id: string; display_name: string; username: string } | null | 'notfound'>('notfound');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchPublicProfile(username as string)
      .then(p => { if (alive) { setProfile(p ?? 'notfound'); setChecking(false); } })
      .catch(() => { if (alive) { setProfile('notfound'); setChecking(false); } });
    return () => { alive = false; };
  }, [username]);

  const userId = typeof profile === 'object' && profile !== null ? profile.id : undefined;
  const { data: owned = new Set<number>() } = useUserDex(userId);
  const { data: tcgIndex = new Map() } = useTcgIndex();
  const { data: sets = [] } = useTcgSets();
  const { data: rarities = [] } = useTcgRarities();

  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState<StatusFilter>('all');
  const [typeFilter, setType]     = useState<PokemonType | null>(null);
  const [setFilter, setSet]       = useState<string | null>(null);
  const [rarityFilter, setRarity] = useState<string | null>(null);
  const [sort, setSort]           = useState<SortKey>('num-asc');

  const items = useMemo(
    () => applyPokedexPipeline(POKEDEX, owned, tcgIndex, {
      search, statusFilter, typeFilter, setFilter, rarityFilter, sort,
    }),
    [owned, tcgIndex, search, statusFilter, typeFilter, setFilter, rarityFilter, sort],
  );

  if (checking) return <SafeAreaView style={styles.center}><ActivityIndicator /></SafeAreaView>;

  if (profile === 'notfound') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Ce Pokédex n'existe pas ou est privé</Text>
        <Pressable style={styles.cta} onPress={() => router.push('/signup')}>
          <Text style={styles.ctaText}>Créer mon Pokédex TCG</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const ownedCount = items.filter(p => p.owned).length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Pokédex TCG de {profile.display_name}</Text>
        <ProgressCounter owned={ownedCount} total={items.length} />
      </View>
      <SearchFilterBar
        search={search} onSearch={setSearch}
        statusFilter={statusFilter} onStatus={setStatus}
        typeFilter={typeFilter} onType={setType}
        setFilter={setFilter} onSet={setSet}
        rarityFilter={rarityFilter} onRarity={setRarity}
        sort={sort} onSort={setSort}
        sets={sets} rarities={rarities}
        onReset={() => { setStatus('all'); setType(null); setSet(null); setRarity(null); }}
      />
      <PokedexGrid items={items} onSelect={() => { /* V1: no detail from public view */ }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafafa' },
  banner: { padding: 12, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  bannerTitle: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  title: { fontSize: 18, textAlign: 'center' },
  cta: { backgroundColor: '#111', padding: 12, borderRadius: 8 },
  ctaText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: Manual verify**

- On web, log out (Task 8.1 will implement logout; before then, just navigate directly to `/u/<your-username>` — session doesn't affect anon read via RLS).
- URL `/u/<your-username>` shows the grid, mostly missing, some owned if you toggled cards in Phase 6.
- URL `/u/nonexistent` shows the "profile not found" screen.

- [ ] **Step 3: Commit**

```
git add app/u/[username].tsx
git commit -m "feat: public read-only share view"
```

---

## Phase 8 — Settings

### Task 8.1: Settings screen

**Files:**
- Create: `Pokedexnational/app/(app)/settings.tsx`

- [ ] **Step 1: Write**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';

export default function Settings() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('username, display_name, is_public').eq('id', userId).single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username);
          setDisplayName(data.display_name);
          setIsPublic(data.is_public);
        }
      });
  }, [userId]);

  const shareBase = process.env.EXPO_PUBLIC_APP_URL ?? '';
  const shareUrl = username ? `${shareBase}/u/${username}` : '';

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from('profiles')
      .update({ display_name: displayName, is_public: isPublic })
      .eq('id', userId);
    setSaving(false);
    if (error) Alert.alert('Erreur', error.message);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Copié', shareUrl);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.h1}>Paramètres</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Username (immuable)</Text>
        <Text style={styles.readonly}>{username}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Nom affiché</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} />
      </View>

      <View style={styles.rowInline}>
        <Text style={styles.label}>Profil public</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Lien de partage</Text>
        <Text style={styles.readonly}>{shareUrl}</Text>
        <Pressable onPress={copy} style={styles.btnSecondary}>
          <Text>Copier</Text>
        </Pressable>
      </View>

      <Pressable onPress={save} disabled={saving} style={styles.btn}>
        <Text style={styles.btnText}>{saving ? '…' : 'Enregistrer'}</Text>
      </Pressable>

      <Pressable onPress={() => signOut()} style={styles.btnDanger}>
        <Text style={styles.btnText}>Se déconnecter</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 16, backgroundColor: '#fafafa' },
  h1: { fontSize: 24, fontWeight: '700' },
  row: { gap: 4 },
  rowInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, color: '#555' },
  readonly: { fontSize: 16, color: '#111' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  btn: { backgroundColor: '#111', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#eee', padding: 8, borderRadius: 6, alignSelf: 'flex-start' },
  btnDanger: { backgroundColor: '#c00', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: Install `expo-clipboard`**

```
npx expo install expo-clipboard
git add package.json package-lock.json
git commit -m "chore: add expo-clipboard for share URL copy"
```

- [ ] **Step 3: Manual verify**

Open the Settings tab. Change display name, toggle public → Save. Confirm the changes persist by reloading. Copy button copies the share URL. Sign out redirects to `/login`.

- [ ] **Step 4: Commit**

```
git add app/(app)/settings.tsx
git commit -m "feat: settings screen (display name, public toggle, share URL, logout)"
```

---

## Phase 9 — Tests catch-up and error handling

### Task 9.1: Toast for mutation errors

**Files:**
- Create: `Pokedexnational/lib/toast.ts`
- Modify: `Pokedexnational/lib/collection.ts`

- [ ] **Step 1: Install `react-native-root-toast`**

```
npm install react-native-root-toast
```

- [ ] **Step 2: Wrapper**

Create `lib/toast.ts`:

```ts
import Toast from 'react-native-root-toast';

export function toast(message: string) {
  Toast.show(message, { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
}
```

- [ ] **Step 3: Wire into `useToggleCard`**

In `lib/collection.ts`, replace the `onError` body with:

```ts
onError: (_e, { dexNum }, ctx) => {
  if (ctx?.prevCards) qc.setQueryData(['user_cards', userId, dexNum], ctx.prevCards);
  if (ctx?.prevDex)   qc.setQueryData(['user_dex', userId], ctx.prevDex);
  toast('Impossible de sauvegarder, réessaie.');
},
```

Add at the top of `lib/collection.ts`:

```ts
import { toast } from './toast';
```

- [ ] **Step 4: Wrap the app with `RootSiblingParent`**

In `app/_layout.tsx`, wrap children:

```tsx
import { RootSiblingParent } from 'react-native-root-siblings';
```

Then wrap `<Stack>`:

```tsx
<RootSiblingParent>
  <Stack screenOptions={{ headerShown: false }} />
</RootSiblingParent>
```

Install the required peer dep:

```
npm install react-native-root-siblings
```

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json lib/toast.ts lib/collection.ts app/_layout.tsx
git commit -m "feat: toast for mutation errors"
```

### Task 9.2: Verify tests still green

- [ ] **Step 1: Run**

```
npm test
```

Expected: all previously-added tests still pass. If jest can't resolve any `@/` alias, add to `jest` section in `package.json`:

```json
"moduleNameMapper": {
  "^@/(.*)$": "<rootDir>/$1"
}
```

Commit if this was needed:

```
git add package.json
git commit -m "chore(test): add module alias to jest config"
```

---

## Phase 10 — Polish

### Task 10.1: Responsive sidebar on tablet/desktop (optional V1)

**Files:**
- Modify: `Pokedexnational/app/(app)/_layout.tsx`

- [ ] **Step 1: Modify layout to swap Tabs for Drawer on wide screens**

Note: for V1 we ship with Tabs everywhere (they work on all sizes). If time permits, add responsive sidebar by conditionally rendering `Drawer` from `expo-router/drawer` on `width >= 768`. This is intentionally optional in the V1 plan.

If shipping V1 as tabs-only, skip this task.

- [ ] **Step 2: Commit if changes**

```
git add app/(app)/_layout.tsx
git commit -m "feat: responsive sidebar on wide screens"
```

### Task 10.2: Web build sanity check

- [ ] **Step 1: Build for web**

```
npx expo export --platform web
```

Expected: succeeds, output in `dist/`.

- [ ] **Step 2: Serve locally to verify**

```
npx serve dist
```

Open `http://localhost:3000`. Confirm the app loads, the `/u/<username>` route works when hit directly (public route, no auth required).

- [ ] **Step 3: No commit needed (build artifact ignored)**

---

## Done

At this point:

- Backend is deployed with all tables, views, RLS, trigger, RPC
- 15 000+ TCG cards are populated in the DB
- App runs on iOS / Android / Web via Expo
- Users can sign up, sign in, toggle individual cards, see their National auto-derived, and share a public URL
- Search, filters (status, type, set, rarity), and sort all work
- Basic error handling via toast

Any V1 gap discovered during manual verification should be filed as a follow-up task, not fixed inline.

For deployment of the web build, choose a host (Vercel / Netlify / Cloudflare Pages) — this decision is deferred per the spec.
