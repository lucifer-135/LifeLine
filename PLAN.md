# Lifeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Lifeline, a static web app that sizes a solar + battery + diesel hybrid system for a Nigerian hospital. It simulates an outage day that keeps life-critical loads powered, and it proves the Energy-as-a-Service (EaaS) finance case.

**Architecture:** The app is a single-page React app with no backend. A pure TypeScript engine lives in `src/engine/` with no React imports, and every rule is unit-tested there. The UI in `src/pages/` and `src/components/` only calls the engine through `runComparison` and `computeFinance`. App state is a React context with a reducer. Routing is hash-based and needs no router dependency.

**Tech Stack:**
- Node 24
- Vite (react-ts template)
- React 18+
- TypeScript (strict)
- Recharts
- Vitest
- jsdom
- @testing-library/react
- ESLint from the Vite template
- Vercel for hosting

**Spec:** `docs/superpowers/specs/2026-10-30-lifeline-design.md`. Visual direction, tokens, copy and motion live in `DESIGN.md`. Model numbers and sources live in `HANDOFF.md`.

## Global Constraints

- Runtime dependencies are limited to `react`, `react-dom`, `recharts`, `motion` (animation, imported from `motion/react`) and `lucide-react` (icons). Dev dependencies are the Vite template defaults plus `vitest`, `jsdom`, `@testing-library/react` and `@testing-library/jest-dom`. Ask the user before adding anything else (CLAUDE.md rule 2), so there is no router and no state library.
- `motion` is used for state-driven and user-triggered animation. CSS keyframes are used for the infinite loops (alarm pulse, flowing power lines). The split is described in DESIGN.md §4.
- Import each icon by name, for example `import { Play } from 'lucide-react'`. Never import the whole set.
- TypeScript runs in `strict` mode. Do not use `any`, `@ts-ignore` or `eslint-disable`.
- Fonts load from Google Fonts with a `<link>` in `index.html`.
- The engine (`src/engine/**`) must not import React or browser APIs.
- Time resolution is 96 steps of 15 minutes. `STEP_HOURS = 0.25`. Step `s` has midpoint hour `(s + 0.5) / 4`.
- Tiers have fixed meanings:
  - `T1`: life-critical. It is never shed.
  - `T2`: essential.
  - `T3`: deferrable.
- Money is in Naira. The format is `₦68.7M` in compact form and `₦68,700,000` in full. USD is shown as a secondary value, converted at `costs.ngnPerUsd`.
- Every default number shown in the UI has an entry in `src/data/sources.ts`. Each entry has `label`, `value`, `unit`, `source`, `url`, `date` and `isEstimate`.
- The demo seed is `DEMO_SEED = 2026`. The demo preset is `kano-50` (50-bed General Hospital, Kano).
- Routes are hash-based: `#/`, `#/profile`, `#/outage`, `#/plan` and `#/method`. Unknown routes fall back to `#/`.
- Solutions must be implementable in 6–18 months. Copy never promises hardware that we have not modelled.

## Review Focus

These cases are not obvious from the spec. Each one is tested in the task named.

1. **The user sets grid hours to 24 or 0.** The twin must not divide by zero, sizing must still return finite values, and the outage pattern must be all up or all down (Task 3).
2. **The user deletes every T1 item, or sets every quantity to 0.** Validation must block the run with a clear message, and charts must not render NaN (Task 2, Task 11).
3. **The user sets diesel to 0 L/month or the generator to 0 kVA.** The baseline shows life-critical (T1) loads dark for the whole outage. Lifeline must not crash, and it reports any T1 shortfall honestly (Task 6).
4. **The user edits costs to extreme values** (fee 0%, capex 0). Payback and IRR must return `null` and the UI must show "n/a". It must never show `Infinity` or `NaN` (Task 7).
5. **The user leaves Outage Day mid-playback and comes back.** No timers may leak or double-run. Changing the seed or the preset resets playback to 00:00 (Task 12).

---

## File Structure

```
index.html                       Google Fonts link, root div
vite.config.ts                   Vite + Vitest config (jsdom, setupFiles)
src/main.tsx                     mounts <AppProvider><App/></AppProvider>
src/App.tsx                      shell: <Nav/>, route switch, page transition wrapper
src/setupTests.ts                jest-dom matchers
src/styles/tokens.css            DESIGN.md §2 tokens (CSS custom properties)
src/styles/global.css            reset, base type, layout utilities, motion keyframes
src/styles/print.css             proposal print layout (DESIGN.md §11)
src/engine/constants.ts          step + physics constants
src/engine/types.ts              all shared types
src/engine/rng.ts                mulberry32 seeded RNG
src/engine/solar.ts              solar shape + PV output
src/engine/loads.ts              equipment -> 96-step tier load profile
src/engine/grid.ts               seeded outage pattern + longest outage
src/engine/sizing.ts             PV / battery / inverter sizing
src/engine/twin.ts               24h simulation, both scenarios
src/engine/compare.ts            runComparison: one call the UI uses
src/engine/finance.ts            EaaS finance + IRR
src/engine/validate.ts           profile + cost validation
src/engine/events.ts             event -> display string
src/data/solarSites.ts           NASA POWER table, 36 states + FCT
src/data/equipment.ts            equipment library (rated W, tier defaults)
src/data/presets.ts              kano-50, phc presets
src/data/costs.ts                DEFAULT_COSTS
src/data/sources.ts              citation table
src/data/stats.ts                home-page stat strip
src/lib/format.ts                Naira/USD/duration/time formatters
src/state/AppState.tsx           context, reducer, useApp()
src/state/useHashRoute.ts        hash router hook
src/state/usePlayback.ts         play/pause/speed/step hook
src/components/*.tsx             shared UI (DESIGN.md §7)
src/pages/Home.tsx, Profile.tsx, OutageDay.tsx, Plan.tsx, Method.tsx
src/pages/outage/*.tsx           LoadChart, EventLog, RunwayGauge, ComparisonPanel, PlaybackBar
src/pages/plan/*.tsx             SizeCards, FinancePanel, AssumptionsEditor, Proposal
```

Tests sit next to the code as `*.test.ts` or `*.test.tsx`.

---

### Task 1: Scaffold, git, test runner, deploy pipeline

**Files:**
- Create: everything the Vite template creates.
- Create: `.gitignore` additions, `vite.config.ts`, `src/setupTests.ts`, `src/smoke.test.ts`.

**Interfaces:**
- Produces: `npm run dev`, `npm test` (`vitest run`), `npm run lint` and `npm run build` (`tsc -b && vite build`).

- [ ] **Step 1: Initialise.** Git is already initialised, and the repo is pushed to GitHub as `lucifer-135/LifeLine` (private) on `main`. The root holds `CLAUDE.md`, `docs/`, the project docs and a `.gitignore`. Scaffold the template into a temporary folder and copy it in, so nothing gets overwritten and no interactive prompt appears:

```bash
npm create vite@latest .scaffold -- --template react-ts
# copy everything from .scaffold into the root except .gitignore; merge its .gitignore lines into ours; delete .scaffold
npm install
npm install recharts motion lucide-react
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Check `.gitignore`.** It must contain `node_modules`, `dist`, `.vercel` and `example ps.jpeg`. PLAN.md, DESIGN.md and HANDOFF.md are tracked in git, so do not ignore them.
- [ ] **Step 3: Configure Vitest.** In `vite.config.ts`, add `test: { environment: 'jsdom', setupFiles: './src/setupTests.ts', globals: false }` and reference `/// <reference types="vitest/config" />`. `src/setupTests.ts` imports `@testing-library/jest-dom/vitest`. It also stubs `window.matchMedia` (default `matches: false`; tests override it for reduced motion), `IntersectionObserver` and `ResizeObserver`. jsdom lacks all three, and `motion` (`useInView`) and Recharts (`ResponsiveContainer`) need them. Add the script `"test": "vitest run"`.
- [ ] **Step 4: Write the smoke test.** `src/smoke.test.ts` contains `expect(1 + 1).toBe(2)`.
- [ ] **Step 5: Verify.** Run `npm test && npm run lint && npm run build`. All three must pass.
- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "chore: scaffold vite react-ts app with vitest"
```

- [ ] **Step 7: Deploy (needs the user).** Ask the user to run `npx vercel` once to log in and link the project, then `npx vercel --prod`. Record the URL in HANDOFF.md. Redeploy after every UI task.

---

### Task 2: Engine types, data tables, validation

**Files:**
- Create: `src/engine/constants.ts`, `src/engine/types.ts`, `src/engine/rng.ts`, `src/engine/validate.ts`.
- Create: `src/data/solarSites.ts`, `src/data/equipment.ts`, `src/data/presets.ts`, `src/data/costs.ts`, `src/data/sources.ts`, `src/data/stats.ts`.
- Test: `src/engine/rng.test.ts`, `src/engine/validate.test.ts`, `src/data/data.test.ts`.

**Interfaces:**
- Produces, in `constants.ts`:

```ts
export const STEPS_PER_DAY = 96;
export const STEP_HOURS = 0.25;
export const DEMO_SEED = 2026;
export const BATTERY_DOD = 0.8;            // usable fraction for sizing
export const BATTERY_ROUND_TRIP = 0.9;     // charge*discharge efficiency
export const BATTERY_ONE_WAY = Math.sqrt(0.9);
export const BATTERY_RESERVE_SOC = 0.2;    // diesel starts below this
export const PV_PERFORMANCE_RATIO = 0.75;
export const INVERTER_HEADROOM = 1.25;
export const GENERATOR_POWER_FACTOR = 0.8; // kW = kVA * 0.8
export const SUNRISE_HOUR = 6.5;
export const SUNSET_HOUR = 18.5;
export const PV_STRONG_START_HOUR = 8;     // controller "relief" window
export const PV_STRONG_END_HOUR = 16;
```

- Produces, in `types.ts`:

```ts
export type Tier = 'T1' | 'T2' | 'T3';
export type TierKw = Record<Tier, number>;
export type Ward = 'ICU' | 'Theatre' | 'Maternity' | 'ColdChain' | 'Lab' | 'Wards' | 'Utilities' | 'Admin';
export type Season = 'typical' | 'worst';
export type Scenario = 'baseline' | 'lifeline';
export interface Equipment { id: string; name: string; ward: Ward; ratedW: number; dutyCycle: number; scheduleMask: boolean[]; tier: Tier; qty: number; }
export interface HospitalProfile { id: string; name: string; state: NigerianState; beds: number; equipment: Equipment[]; gridHoursPerDay: number; dieselLitresPerMonth: number; generatorKva: number; }
export interface SolarSite { state: NigerianState; capital: string; lat: number; lon: number; pshAnnual: number; pshWorstMonth: number; worstMonth: string; }
export interface LoadProfile { kw: Record<Tier, number[]>; dailyKwh: TierKw; peakKw: TierKw; }
export interface GridPattern { up: boolean[]; }
export interface SystemSize { pvKwp: number; batteryKwh: number; inverterKw: number; }
export interface CostAssumptions { dieselNgnPerLitre: number; gridNgnPerKwh: number; pvNgnPerKwp: number; batteryNgnPerKwh: number; inverterNgnPerKw: number; bosFraction: number; omFractionPerYear: number; generatorMaintNgnPerYear: number; ngnPerUsd: number; feeFraction: number; contractYears: number; dieselLitresPerKwh: number; co2KgPerLitreDiesel: number; gridCo2KgPerKwh: number; }
export interface TwinStep { t: number; gridUp: boolean; loadKw: TierKw; servedKw: TierKw; shedT2: boolean; shedT3: boolean; pvKw: number; pvUsedKw: number; curtailedKw: number; gridKw: number; chargeKw: number; dischargeKw: number; dieselKw: number; soc: number; fuelLitresLeft: number; t1RunwayMin: number; }
export type TwinEventKind = 'grid_lost' | 'grid_restored' | 'shed_t3' | 'shed_t2' | 'restore_t2' | 'restore_t3' | 'diesel_on' | 'diesel_off' | 'fuel_out' | 't1_unpowered' | 't1_restored';
export interface TwinEvent { step: number; kind: TwinEventKind; t1RunwayMin: number; }
export interface TwinMetrics { t1MinutesUnpowered: number; t2MinutesUnpowered: number; dieselLitres: number; gridKwh: number; energyCostNgn: number; co2Kg: number; }
export interface TwinResult { scenario: Scenario; steps: TwinStep[]; events: TwinEvent[]; metrics: TwinMetrics; }
export interface FinanceResult { baselineAnnualNgn: number; lifelineOperatingAnnualNgn: number; capexNgn: number; monthlyFeeNgn: number; hospitalSavingsAnnualNgn: number; providerAnnualCashflowNgn: number; paybackYears: number | null; irr: number | null; co2AvoidedTonnesYear: number; }
export type NigerianState = 'Abia' | 'Adamawa' | /* …all 36 + 'FCT', exactly the keys of SOLAR_SITES… */ 'Zamfara';
```

- Produces: `mulberry32(seed: number): () => number`, which returns values in [0, 1).
- Produces: `validateProfile(p: HospitalProfile): string[]` and `validateCosts(c: CostAssumptions): string[]`. An empty array means the input is valid.
- Produces data exports: `SOLAR_SITES: Record<NigerianState, SolarSite>`, `EQUIPMENT_LIBRARY: Omit<Equipment, 'qty' | 'id'>[]`, `PRESETS: HospitalProfile[]`, `DEFAULT_COSTS: CostAssumptions`, `SOURCES: Source[]` and `HOME_STATS: Stat[]`.
  - `Source`: `{ id, label, value, unit, source, url, date, isEstimate }`.
  - `Stat`: `{ before: string; value: number; after: string; sourceId: string }`. It renders as `before` + CountUp(`value`) + `after`. The three stats are in DESIGN.md §6.0: outage 20 h/day, PHCs without power 40%, WHO solar result 80%.

- [ ] **Step 1: Write the failing tests.**

```ts
// rng.test.ts
test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(2026), b = mulberry32(2026);
  const xs = Array.from({ length: 1000 }, a);
  expect(xs).toEqual(Array.from({ length: 1000 }, b));
  expect(xs.every(x => x >= 0 && x < 1)).toBe(true);
  expect(mulberry32(1)()).not.toBe(mulberry32(2)());
});
// data.test.ts
test('solar table covers 36 states + FCT', () => expect(Object.keys(SOLAR_SITES)).toHaveLength(37));
test('Kano values match NASA POWER pull', () => expect(SOLAR_SITES.Kano).toMatchObject({ pshAnnual: 6.00, pshWorstMonth: 5.50, worstMonth: 'DEC' }));
test('every preset is valid', () => PRESETS.forEach(p => expect(validateProfile(p)).toEqual([])));
test('default costs are valid', () => expect(validateCosts(DEFAULT_COSTS)).toEqual([]));
test('every DEFAULT_COSTS key has a source', () => Object.keys(DEFAULT_COSTS).forEach(k => expect(SOURCES.some(s => s.id === `cost.${k}`)).toBe(true)));
test('every HOME_STATS sourceId resolves', () => HOME_STATS.forEach(s => expect(SOURCES.some(x => x.id === s.sourceId)).toBe(true)));
// validate.test.ts
test('rejects profile with no T1 load', () => expect(validateProfile({ ...kano, equipment: kano.equipment.filter(e => e.tier !== 'T1') })).toContain('Add at least one life-critical item.'));
test('rejects all-zero quantities', () => expect(validateProfile({ ...kano, equipment: kano.equipment.map(e => ({ ...e, qty: 0 })) })).toContain('Add at least one life-critical item.'));
test('rejects grid hours outside 0–24', () => expect(validateProfile({ ...kano, gridHoursPerDay: 25 })).toContain('Grid hours must be between 0 and 24.'));
test('rejects bad duty cycle', () => expect(validateProfile({ ...kano, equipment: [{ ...kano.equipment[0], dutyCycle: 1.5 }] })).toContain(`${kano.equipment[0].name}: duty cycle must be between 0 and 1.`));
test('rejects negative cost', () => expect(validateCosts({ ...DEFAULT_COSTS, dieselNgnPerLitre: -1 })).toContain('Diesel price must be zero or more.'));
test('rejects fee fraction above 1', () => expect(validateCosts({ ...DEFAULT_COSTS, feeFraction: 1.2 })).toContain('Fee must be between 0% and 100% of today\'s spend.'));
```

The full list of validation rules and their messages is fixed. The UI shows these messages verbatim.
- `beds` must be an integer of 1 or more: "Beds must be a whole number of 1 or more."
- `gridHoursPerDay` must be in [0, 24]: "Grid hours must be between 0 and 24."
- `dieselLitresPerMonth` must be 0 or more: "Diesel must be zero or more litres per month."
- `generatorKva` must be 0 or more: "Generator size must be zero or more kVA."
- At least one item must have `tier === 'T1' && qty > 0`: "Add at least one life-critical item."
- For each item, `ratedW > 0`: "`{name}`: rated power must be more than 0 W."
- For each item, `dutyCycle` in [0, 1]: "`{name}`: duty cycle must be between 0 and 1."
- For each item, `qty` is an integer of 0 or more: "`{name}`: quantity must be a whole number."
- For each item, `scheduleMask.length === 24`: "`{name}`: schedule must have 24 hours."
- Every cost except `feeFraction` must be 0 or more: "`{Label}` must be zero or more." Labels come from `SOURCES`, for example "Diesel price".
- `feeFraction` must be in [0, 1]: "Fee must be between 0% and 100% of today's spend."
- `contractYears` must be an integer from 1 to 30: "Contract length must be 1–30 years."

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run src/engine src/data`. Expected: FAIL, because the modules are not found.
- [ ] **Step 3: Implement `constants.ts`, `types.ts`, `rng.ts` (standard mulberry32) and `validate.ts`.**
- [ ] **Step 4: Write `src/data/solarSites.ts`.** The values below come from NASA POWER climatology, `ALLSKY_SFC_SW_DWN`, 2001–2025, pulled on 2026-10-30 at each state capital. Columns: `state|capital|lat|lon|pshAnnual|pshWorstMonth|worstMonth`.

```
Abia|Umuahia|5.53|7.49|4.54|3.75|AUG        Kaduna|Kaduna|10.52|7.44|5.63|4.56|AUG
Adamawa|Yola|9.21|12.48|5.73|4.73|AUG       Kano|Kano|12.00|8.52|6.00|5.50|DEC
Akwa Ibom|Uyo|5.04|7.91|4.54|3.75|AUG       Katsina|Katsina|12.99|7.60|5.89|5.36|AUG
Anambra|Awka|6.21|7.07|4.72|3.91|AUG        Kebbi|Birnin Kebbi|12.45|4.20|5.81|5.25|AUG
Bauchi|Bauchi|10.31|9.84|5.81|5.11|AUG      Kogi|Lokoja|7.80|6.74|4.86|4.10|AUG
Bayelsa|Yenagoa|4.92|6.26|4.19|3.29|JUL     Kwara|Ilorin|8.50|4.55|5.03|3.98|AUG
Benue|Makurdi|7.73|8.54|5.04|4.08|AUG       Lagos|Ikeja|6.60|3.35|4.59|3.82|JUL
Borno|Maiduguri|11.85|13.16|5.96|5.08|AUG   Nasarawa|Lafia|8.49|8.52|5.24|4.20|AUG
Cross River|Calabar|4.95|8.32|4.19|3.12|AUG Niger|Minna|9.61|6.56|5.23|4.14|AUG
Delta|Asaba|6.20|6.73|4.57|3.85|AUG         Ogun|Abeokuta|7.16|3.35|4.63|3.58|AUG
Ebonyi|Abakaliki|6.32|8.11|4.89|3.95|AUG    Ondo|Akure|7.25|5.19|4.72|3.82|AUG
Edo|Benin City|6.34|5.63|4.45|3.69|AUG      Osun|Osogbo|7.77|4.56|4.58|3.53|AUG
Ekiti|Ado-Ekiti|7.62|5.22|4.72|3.82|AUG     Oyo|Ibadan|7.38|3.95|4.63|3.58|AUG
Enugu|Enugu|6.46|7.55|4.72|3.91|AUG         Plateau|Jos|9.90|8.86|5.33|4.13|AUG
FCT|Abuja|9.08|7.40|5.29|4.08|AUG           Rivers|Port Harcourt|4.82|7.03|4.12|3.20|JUL
Gombe|Gombe|10.29|11.17|5.83|4.93|AUG       Sokoto|Sokoto|13.06|5.24|5.99|5.50|DEC
Imo|Owerri|5.48|7.03|4.54|3.75|AUG          Taraba|Jalingo|8.89|11.36|5.42|4.26|AUG
Jigawa|Dutse|11.76|9.34|5.86|5.35|AUG       Yobe|Damaturu|11.75|11.96|5.97|5.30|AUG
                                            Zamfara|Gusau|12.16|6.66|5.85|5.26|AUG
```

- [ ] **Step 5: Write `src/data/presets.ts`.** Preset `kano-50` has these fields:
  - name "General Hospital, Kano (50 beds)"
  - state `Kano`
  - beds 50
  - `gridHoursPerDay: 6`
  - `dieselLitresPerMonth: 1500`
  - `generatorKva: 60`

  The equipment rows are listed in the table below. Hours use 0–23, and `a–b` means hours a through b−1. The rows marked † carry SEforALL 2025 field-tested values; the rest are typical ratings with `isEstimate: true` in sources. Equipment ids are kebab-case names.

| name | ward | ratedW | duty | hours | tier | qty |
|---|---|---|---|---|---|---|
| ICU ventilator | ICU | 250 | 1.0 | 0–24 | T1 | 4 |
| Patient monitor | ICU | 60 | 1.0 | 0–24 | T1 | 6 |
| Infusion pump | ICU | 20 | 1.0 | 0–24 | T1 | 8 |
| Oxygen concentrator† | ICU | 480 | 0.8 | 0–24 | T1 | 4 |
| Suction pump | ICU | 150 | 0.2 | 0–24 | T1 | 2 |
| ICU air conditioner | ICU | 1500 | 0.6 | 0–24 | T2 | 2 |
| Theatre light | Theatre | 150 | 1.0 | 8–17 | T1 | 2 |
| Anaesthesia machine | Theatre | 300 | 1.0 | 8–17 | T1 | 1 |
| Electrosurgical unit | Theatre | 400 | 0.2 | 8–17 | T1 | 1 |
| Theatre air conditioner | Theatre | 2000 | 0.6 | 8–17 | T2 | 1 |
| Autoclave† | Theatre | 1650 | 0.25 | 8–16 | T2 | 1 |
| Infant warmer† | Maternity | 800 | 0.5 | 0–24 | T1 | 2 |
| Fetal monitor | Maternity | 40 | 1.0 | 0–24 | T1 | 2 |
| Delivery lamp | Maternity | 100 | 0.5 | 0–24 | T1 | 2 |
| Phototherapy unit | Maternity | 150 | 0.7 | 0–24 | T2 | 2 |
| Vaccine refrigerator | ColdChain | 100 | 0.5 | 0–24 | T1 | 2 |
| Blood bank refrigerator | ColdChain | 250 | 0.5 | 0–24 | T1 | 1 |
| Lab refrigerator | Lab | 150 | 0.5 | 0–24 | T2 | 1 |
| Chemistry analyser | Lab | 400 | 0.5 | 8–17 | T2 | 1 |
| Centrifuge | Lab | 300 | 0.3 | 8–17 | T2 | 1 |
| Microscope | Lab | 30 | 1.0 | 8–17 | T2 | 2 |
| Ward LED lighting | Wards | 10 | 1.0 | 18–24, 0–6 | T2 | 120 |
| Security lighting | Utilities | 20 | 1.0 | 18–24, 0–6 | T2 | 20 |
| Water pump | Utilities | 1100 | 0.25 | 6–20 | T2 | 1 |
| Ward ceiling fan | Wards | 75 | 1.0 | 0–24 | T3 | 40 |
| Admin air conditioner | Admin | 1500 | 0.6 | 9–17 | T3 | 3 |
| Office laptop | Admin | 50 | 1.0 | 8–17 | T3 | 10 |

  Preset `phc` has these fields:
  - name "Primary Health Centre, FCT"
  - state `FCT`
  - beds 10
  - `gridHoursPerDay: 8`
  - `dieselLitresPerMonth: 200`
  - `generatorKva: 10`

  Its rows are taken from the library: vaccine refrigerator ×1, oxygen concentrator ×1, infant warmer ×1, delivery lamp ×1, fetal monitor ×1, suction pump ×1, ward LED lighting ×20, security lighting ×4, ward ceiling fan ×6 and office laptop ×2. Each row keeps the same W, duty, hours and tier as in `kano-50`.

  `EQUIPMENT_LIBRARY` is the union of the `kano-50` rows without `qty` and `id`.

- [ ] **Step 6: Write `src/data/costs.ts`, `src/data/sources.ts` and `src/data/stats.ts`.** Take the values and citations from HANDOFF.md §"Model numbers". Copy them exactly.

`DEFAULT_COSTS` has these values:

```
dieselNgnPerLitre 3277
gridNgnPerKwh 209.5
pvNgnPerKwp 450000
batteryNgnPerKwh 200000
inverterNgnPerKw 240000
bosFraction 0.15
omFractionPerYear 0.02
generatorMaintNgnPerYear 3000000
ngnPerUsd 1600
feeFraction 0.8
contractYears 10
dieselLitresPerKwh 0.3
co2KgPerLitreDiesel 2.68
gridCo2KgPerKwh 0.43
```

Source ids follow the pattern `cost.<key>`, `stat.<name>` and `equip.<id>`.

- [ ] **Step 7: Run the tests and confirm they pass.** Run `npx vitest run src/engine src/data`. Expected: PASS.
- [ ] **Step 8: Commit.** Use the message `feat(engine): types, data tables, validation`.

---

### Task 3: Load profile, solar shape, grid pattern

**Files:**
- Create: `src/engine/loads.ts`, `src/engine/solar.ts`, `src/engine/grid.ts`.
- Test: `loads.test.ts`, `solar.test.ts`, `grid.test.ts`.

**Interfaces:**
- Consumes: types and constants from Task 2.
- Produces:
  - `buildLoadProfile(equipment: Equipment[]): LoadProfile`. For each step and tier, kW = Σ `ratedW × dutyCycle × qty / 1000` over items whose `scheduleMask[floor(s/4)]` is true.
  - `solarShape(step: number): number`. It returns a normalised half-sine. For midpoint hour h in [6.5, 18.5], `(π / 24) · sin(π (h − 6.5) / 12)`; otherwise 0. The sum of `solarShape × 0.25` over the day is ≈ 1.
  - `pvOutputKw(pvKwp: number, psh: number, step: number): number` returns `pvKwp × psh × PV_PERFORMANCE_RATIO × solarShape(step)`.
  - `generateGridPattern(gridHoursPerDay: number, seed: number): GridPattern`.
  - `longestOutageHours(grid: GridPattern): number`. It treats the day as circular, so an outage that crosses midnight counts as one window.

- [ ] **Step 1: Write the failing tests.**

```ts
test('single 1 kW T1 item all day', () => {
  const p = buildLoadProfile([{ id: 'x', name: 'x', ward: 'ICU', ratedW: 1000, dutyCycle: 1, scheduleMask: Array(24).fill(true), tier: 'T1', qty: 1 }]);
  expect(p.kw.T1).toHaveLength(96); expect(p.kw.T1.every(v => v === 1)).toBe(true);
  expect(p.dailyKwh).toEqual({ T1: 24, T2: 0, T3: 0 }); expect(p.peakKw.T1).toBe(1);
});
test('schedule mask hour 8 covers steps 32..35 only', () => { /* mask only hour 8 → kw.T1[31]===0, [32..35]===1, [36]===0 */ });
test('kano-50 daily energy is in a plausible hospital range', () => { const p = buildLoadProfile(kano.equipment); const total = p.dailyKwh.T1 + p.dailyKwh.T2 + p.dailyKwh.T3; expect(total).toBeGreaterThan(200); expect(total).toBeLessThan(400); });
test('solar shape integrates to 1 and is zero at night', () => {
  const sum = Array.from({ length: 96 }, (_, s) => solarShape(s) * 0.25).reduce((a, b) => a + b);
  expect(sum).toBeCloseTo(1, 2); expect(solarShape(0)).toBe(0); expect(solarShape(95)).toBe(0); expect(solarShape(50)).toBeGreaterThan(0);
});
test('grid pattern has exact up-step count', () => [0, 4, 6, 12.5, 20, 24].forEach(h => expect(generateGridPattern(h, 2026).up.filter(Boolean)).toHaveLength(Math.round(h * 4))));
test('grid pattern deterministic per seed', () => { expect(generateGridPattern(6, 7)).toEqual(generateGridPattern(6, 7)); expect(generateGridPattern(6, 7)).not.toEqual(generateGridPattern(6, 8)); });
test('longest outage: all up = 0, all down = 24, wraps midnight', () => {
  expect(longestOutageHours({ up: Array(96).fill(true) })).toBe(0);
  expect(longestOutageHours({ up: Array(96).fill(false) })).toBe(24);
  const up = Array(96).fill(true); for (let s = 88; s < 96; s++) up[s] = false; for (let s = 0; s < 8; s++) up[s] = false;
  expect(longestOutageHours({ up })).toBe(4);
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run src/engine/loads src/engine/solar src/engine/grid`. Expected: FAIL.
- [ ] **Step 3: Implement.** `generateGridPattern` uses this algorithm, because Nigerian outages come in blocks rather than as scattered steps:

```
upTotal = round(h*4); downTotal = 96 - upTotal
if downTotal === 0 → all true; if upTotal === 0 → all false
rng = mulberry32(seed); n = min(3, upTotal, downTotal)
split(total, n): weights w_i = 0.5 + rng(); parts = floor(total * w_i / Σw), each ≥1; give remainder to the last part
seq = [down_1, up_1, down_2, up_2, …, down_n, up_n] as runs
offset = floor(rng() * 96); rotate seq right by offset
```

- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Use the message `feat(engine): load profile, solar shape, grid pattern`.

---

### Task 4: Sizing

**Files:**
- Create: `src/engine/sizing.ts`.
- Test: `src/engine/sizing.test.ts`.

**Interfaces:**
- Consumes: `LoadProfile`, `GridPattern`, `longestOutageHours`, `solarShape` and `SolarSite`.
- Produces: `sizeSystem(load: LoadProfile, grid: GridPattern, gridHoursPerDay: number, site: SolarSite): SystemSize`.

The rules below refine spec §4. Battery size depends on night energy because PV covers the daytime part of an outage. PV is sized for the worst month, so the system still holds in the August rains.
- `nightKwh` is the sum of `(kw.T1 + kw.T2) × 0.25` over steps where `solarShape(s) === 0`.
- `nightHours` is the count of those steps × 0.25.
- `batteryKwh = ceilTo5( nightKwh × min(1, longestOutageHours / nightHours) / (BATTERY_DOD × BATTERY_ROUND_TRIP) )`.
- `pvKwp = ceilTo1( (dailyKwh.T1 + dailyKwh.T2) × (1 − gridHoursPerDay/24) / BATTERY_ROUND_TRIP / (site.pshWorstMonth × PV_PERFORMANCE_RATIO) )`.
- `inverterKw = ceilTo1( INVERTER_HEADROOM × max_s(kw.T1[s] + kw.T2[s]) )`.
- If an intermediate value is 0, the result is 0. For example, an outage of 0 hours gives a battery of 0.

- [ ] **Step 1: Write the failing tests.**

```ts
const flat1kw = buildLoadProfile([{ /* 1000 W, duty 1, 24h, T1, qty 1 */ }]);
const twelveHourOutage = { up: Array.from({ length: 96 }, (_, s) => s < 48) };
test('1 kW flat T1, 12h outage, Kano', () => {
  expect(sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Kano)).toEqual({ batteryKwh: 20, pvKwp: 4, inverterKw: 2 });
  // night 12h → 12 kWh / 0.72 = 16.67 → 20 ; pv 24*0.5/0.9/(5.50*0.75)=3.23 → 4 ; inv 1.25 → 2
});
test('24h grid needs no battery or PV', () => expect(sizeSystem(flat1kw, { up: Array(96).fill(true) }, 24, SOLAR_SITES.Kano)).toMatchObject({ batteryKwh: 0, pvKwp: 0 }));
test('southern state needs more PV than Kano', () => {
  const k = sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Kano).pvKwp;
  const r = sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Rivers).pvKwp;
  expect(r).toBeGreaterThan(k);
});
test('T3 does not affect sizing', () => { /* add a 5 kW T3 item → identical SystemSize */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement `sizeSystem`.**
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Use the message `feat(engine): system sizing`.

---

### Task 5: Twin, Lifeline scenario

**Files:**
- Create: `src/engine/twin.ts`.
- Test: `src/engine/twin.test.ts`.

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:

```ts
export interface TwinInput { scenario: Scenario; load: LoadProfile; grid: GridPattern; size: SystemSize; psh: number; generatorKw: number; fuelLitresPerDay: number; costs: CostAssumptions; }
export function runTwin(input: TwinInput): TwinResult;
```

**Simulation rules.** The day runs twice with the same inputs, and only the second pass is returned. This warm-up makes the starting state of charge (SoC) realistic. Pass 1 starts with SoC 0.5. Fuel resets to `fuelLitresPerDay` at the start of each pass. Let `cap = size.batteryKwh` and `inv = size.inverterKw`. Battery power is limited to `inv` in both directions. SoC is the stored-energy fraction:

`soc += (chargeKw × 0.25 × BATTERY_ONE_WAY − dischargeKw × 0.25 / BATTERY_ONE_WAY) / cap`

When `cap === 0`, the battery does nothing.

**Lifeline step, grid up:**
- Serve all tiers.
- `pvUsed = min(pv, load)`.
- Charge from the PV surplus first, then from the grid, up to `inv` and up to full capacity.
- `gridKw = served − pvUsed + gridCharge`.
- Curtail any PV that is left over.

**Lifeline step, grid down:**
1. **Relief.** Find the first future step (circular, within this day) where the grid is up or the midpoint hour is in [8, 16). `need(tiers)` is the sum, over steps from now to relief, of `max(0, Σtiers load − pv) × 0.25`. `avail = max(0, soc − 0.2) × cap × BATTERY_ONE_WAY`.
2. **Shed.**
   - If T3 is on and `need(T1+T2+T3) > avail`, shed T3.
   - If T2 is on and `need(T1+T2) > avail`, shed T2.
   - Restore T2 if `need(T1+T2) < 0.8 × avail`. Restore T3 if `need(all) < 0.8 × avail`. The 0.8 factor is hysteresis that stops flapping.
   - When the grid returns, restore everything.
   - T1 is never shed.
3. **Dispatch.** Let D be the demand of the unshed tiers.
   - `pvUsed = min(pv, D)`. Surplus PV charges the battery; the rest is curtailed.
   - Discharge the battery down to the 0.2 reserve.
   - Run diesel: `min(R, generatorKw, fuelLeft / (dieselLitresPerKwh × 0.25))`.
   - Discharge the battery below the reserve, down to 0.
   - Any demand still left is unserved. Allocate it against T3 first, then T2, then T1.
4. **Runway.** `t1RunwayMin = Infinity` if the grid is up. Otherwise it is `((soc × cap × BATTERY_ONE_WAY) + fuelLeft / dieselLitresPerKwh) / max(load.T1, 1e-9) × 60`.
5. **Events.** Emit an event on each state transition: grid up/down, T3/T2 shed or restored, diesel on/off, fuel reaching 0, T1 becoming unserved or served again. Use the `TwinEventKind` names.

**Metrics:**
- `t1MinutesUnpowered` = 15 × the number of steps with `served.T1 < load.T1 − 1e-9`. T2 is counted the same way, so shed T2 counts as unpowered.
- `dieselLitres = Σ dieselKw × 0.25 × dieselLitresPerKwh`.
- `gridKwh = Σ gridKw × 0.25`.
- `energyCostNgn = gridKwh × gridNgnPerKwh + dieselLitres × dieselNgnPerLitre`.
- `co2Kg = dieselLitres × co2KgPerLitreDiesel + gridKwh × gridCo2KgPerKwh`.

- [ ] **Step 1: Write the failing tests.**

```ts
const kanoLoad = buildLoadProfile(kano.equipment);
const mk = (seed: number, over: Partial<TwinInput> = {}): TwinResult => {
  const grid = generateGridPattern(kano.gridHoursPerDay, seed);
  const size = sizeSystem(kanoLoad, grid, kano.gridHoursPerDay, SOLAR_SITES.Kano);
  return runTwin({ scenario: 'lifeline', load: kanoLoad, grid, size, psh: SOLAR_SITES.Kano.pshAnnual, generatorKw: kano.generatorKva * 0.8, fuelLitresPerDay: kano.dieselLitresPerMonth / 30, costs: DEFAULT_COSTS, ...over });
};
test('returns 96 steps, deterministic', () => { expect(mk(2026).steps).toHaveLength(96); expect(mk(2026)).toEqual(mk(2026)); });
test('energy balance every step', () => mk(2026).steps.forEach(s =>
  expect(s.gridKw + s.pvKw + s.dischargeKw + s.dieselKw).toBeCloseTo(s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3 + s.chargeKw + s.curtailedKw, 9)));
test('soc within [0,1]', () => mk(2026).steps.forEach(s => { expect(s.soc).toBeGreaterThanOrEqual(0); expect(s.soc).toBeLessThanOrEqual(1); }));
test('T1 only unserved when every source is exhausted', () => { for (let seed = 1; seed <= 50; seed++) mk(seed, { size: { pvKwp: 5, batteryKwh: 10, inverterKw: 8 }, fuelLitresPerDay: 5 }).steps.forEach(s => {
  if (s.servedKw.T1 < s.loadKw.T1 - 1e-9) { expect(s.gridUp).toBe(false); expect(s.soc).toBeLessThan(1e-9); expect(s.fuelLitresLeft < 1e-9 || s.dieselKw >= kano.generatorKva * 0.8 - 1e-9).toBe(true); }
}); });
test('sized Lifeline keeps T1 powered for kano-50 across seeds', () => { for (let seed = 1; seed <= 20; seed++) expect(mk(seed).metrics.t1MinutesUnpowered).toBe(0); });
test('all-up grid: no diesel, no shedding', () => { const r = mk(2026, { grid: { up: Array(96).fill(true) } }); expect(r.metrics.dieselLitres).toBe(0); expect(r.steps.some(s => s.shedT2 || s.shedT3)).toBe(false); });
test('emits grid_lost event when outage starts', () => expect(mk(2026).events.some(e => e.kind === 'grid_lost')).toBe(true));
test('zero battery and zero generator does not crash', () => expect(() => mk(2026, { size: { pvKwp: 0, batteryKwh: 0, inverterKw: 0 }, generatorKw: 0 })).not.toThrow());
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement `runTwin` for `scenario: 'lifeline'`.** Split the code into small helpers in the same file: `findReliefStep`, `energyNeeded`, `decideShedding`, `dispatchOutageStep`, `dispatchGridStep`, `diffEvents` and `computeMetrics`.
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Use the message `feat(engine): digital twin lifeline controller`.

---

### Task 6: Twin baseline scenario and `runComparison`

**Files:**
- Modify: `src/engine/twin.ts`.
- Create: `src/engine/compare.ts`, `src/engine/events.ts`.
- Test: `src/engine/twin.baseline.test.ts`, `src/engine/compare.test.ts`, `src/engine/events.test.ts`.

**Interfaces:**
- Produces:

```ts
export interface ComparisonInput { profile: HospitalProfile; costs: CostAssumptions; seed: number; season: Season; }
export interface Comparison { load: LoadProfile; grid: GridPattern; size: SystemSize; site: SolarSite; baseline: TwinResult; lifeline: TwinResult; }
export function runComparison(input: ComparisonInput): Comparison;
export function formatEvent(e: TwinEvent): string; // events.ts
export function stepToClock(step: number): string; // "HH:MM", step 58 → "14:30"
```

**Baseline rules.** The baseline is today's setup: no PV, no battery, and no shedding logic.
- When the grid is up, the grid serves all loads.
- On the first step of each outage, nothing is served (`servedKw` is all 0). This models the manual generator start gap. `t1_unpowered` fires on this step.
- On later outage steps, the generator serves up to `min(generatorKw, fuelLeft / (L/kWh × 0.25))` in priority order T1, then T2, then T3.
- When fuel runs out, nothing is served and `fuel_out` fires.

`runComparison` builds the inputs in this order:
1. `load = buildLoadProfile(profile.equipment)`.
2. `grid = generateGridPattern(profile.gridHoursPerDay, seed)`.
3. `size = sizeSystem(…)`.
4. `psh = season === 'worst' ? site.pshWorstMonth : site.pshAnnual`.
5. `generatorKw = generatorKva × 0.8` and `fuelLitresPerDay = dieselLitresPerMonth / 30`.
6. Run the twin for both scenarios.

`formatEvent` returns the copy below exactly (DESIGN.md §8 owns it). `{rw}` is `formatDuration(t1RunwayMin)`, or "—" if the value is not finite.

| kind | text |
|---|---|
| grid_lost | Grid lost. ICU covered for {rw}. |
| grid_restored | Grid power is back. |
| shed_t3 | Paused loads that can wait (fans, office AC). |
| shed_t2 | Paused essential loads to protect life-critical care. |
| restore_t3 | Loads that can wait are back on. |
| restore_t2 | Essential loads are back on. |
| diesel_on | Generator started. |
| diesel_off | Generator stopped. |
| fuel_out | Diesel ran out. |
| t1_unpowered | Life-critical equipment has no power. |
| t1_restored | Life-critical power restored. |

- [ ] **Step 1: Write the failing tests.**

```ts
test('baseline: T1 dark at least 15 min per outage start', () => { const c = runComparison({ profile: kano, costs: DEFAULT_COSTS, seed: DEMO_SEED, season: 'typical' }); expect(c.baseline.metrics.t1MinutesUnpowered).toBeGreaterThanOrEqual(15); expect(c.lifeline.metrics.t1MinutesUnpowered).toBe(0); });
test('baseline uses more diesel than lifeline for kano-50', () => { /* c.baseline.metrics.dieselLitres > c.lifeline.metrics.dieselLitres */ });
test('no generator: baseline T1 dark for whole outage', () => { const p = { ...kano, generatorKva: 0 }; const c = runComparison({ profile: p, costs: DEFAULT_COSTS, seed: DEMO_SEED, season: 'typical' }); const downSteps = c.grid.up.filter(u => !u).length; expect(c.baseline.metrics.t1MinutesUnpowered).toBe(downSteps * 15); });
test('zero diesel does not crash lifeline', () => expect(() => runComparison({ profile: { ...kano, dieselLitresPerMonth: 0 }, costs: DEFAULT_COSTS, seed: 1, season: 'worst' })).not.toThrow());
test('worst season uses lower psh → less PV energy', () => { /* Σ lifeline.steps.pvKw worst < typical */ });
test('baseline energy balance holds', () => { /* same balance assertion as Task 5 on c.baseline.steps */ });
test('stepToClock', () => { expect(stepToClock(0)).toBe('00:00'); expect(stepToClock(58)).toBe('14:30'); expect(stepToClock(95)).toBe('23:45'); });
test('formatEvent grid_lost', () => expect(formatEvent({ step: 0, kind: 'grid_lost', t1RunwayMin: 680 })).toBe('Grid lost. ICU covered for 11h 20m.'));
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement the baseline branch in `runTwin`, plus `compare.ts` and `events.ts`.** `formatDuration` comes from Task 7's `src/lib/format.ts`. Create that file now with `formatDuration(min: number): string`, which returns `"11h 20m"`, `"45m"` for under an hour, and `"0m"` for 0.
- [ ] **Step 4: Run the tests and confirm they pass.** Expected: PASS.
- [ ] **Step 5: Commit.** Use the message `feat(engine): baseline scenario, comparison, event copy`.

---

### Task 7: Finance and formatters

**Files:**
- Create: `src/engine/finance.ts`.
- Modify: `src/lib/format.ts`.
- Test: `src/engine/finance.test.ts`, `src/lib/format.test.ts`.

**Interfaces:**
- Produces:
  - `computeFinance(args: { baseline: TwinMetrics; lifeline: TwinMetrics; size: SystemSize; costs: CostAssumptions }): FinanceResult`.
  - `irr(cashflows: number[]): number | null`. It finds the rate by bisection on [−0.99, 10] with tolerance 1e-7, and returns `null` when there is no sign change.
- Produces, in `src/lib/format.ts`:
  - `formatNgn(n: number, mode?: 'compact' | 'full'): string`
  - `formatUsd(ngn: number, ngnPerUsd: number): string`
  - `formatPct(x: number): string`
  - `formatYears(y: number | null): string`
  - `formatDuration(min: number): string`

**Finance rules:**
- `baselineAnnualNgn = baseline.energyCostNgn × 365 + generatorMaintNgnPerYear`.
- `capexNgn = (pvKwp × pvNgnPerKwp + batteryKwh × batteryNgnPerKwh + inverterKw × inverterNgnPerKw) × (1 + bosFraction)`.
- `monthlyFeeNgn = feeFraction × baselineAnnualNgn / 12`.
- `lifelineOperatingAnnualNgn = lifeline.energyCostNgn × 365 + omFractionPerYear × capexNgn`. The provider pays the leftover grid and diesel cost and O&M; that is the EaaS guarantee.
- `providerAnnualCashflowNgn = 12 × monthlyFeeNgn − lifelineOperatingAnnualNgn`.
- `hospitalSavingsAnnualNgn = baselineAnnualNgn − 12 × monthlyFeeNgn`.
- `paybackYears = cashflow > 0 && capex > 0 ? capex / cashflow : null`.
- `irr = capex > 0 ? irr([−capex, …contractYears × cashflow]) : null`.
- `co2AvoidedTonnesYear = (baseline.co2Kg − lifeline.co2Kg) × 365 / 1000`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('irr of -1000 then 10×200 ≈ 15.10%', () => expect(irr([-1000, ...Array(10).fill(200)])!).toBeCloseTo(0.1510, 3));
test('irr null without sign change', () => expect(irr([100, 100])).toBeNull());
test('hand-computed finance case', () => {
  const m = (cost: number): TwinMetrics => ({ t1MinutesUnpowered: 0, t2MinutesUnpowered: 0, dieselLitres: 0, gridKwh: 0, energyCostNgn: cost, co2Kg: 0 });
  const c = { ...DEFAULT_COSTS, pvNgnPerKwp: 100_000, batteryNgnPerKwh: 50_000, inverterNgnPerKw: 20_000, bosFraction: 0.1, omFractionPerYear: 0.02, generatorMaintNgnPerYear: 1_000_000, feeFraction: 0.8, contractYears: 10 };
  const f = computeFinance({ baseline: m(100_000), lifeline: m(10_000), size: { pvKwp: 10, batteryKwh: 20, inverterKw: 5 }, costs: c });
  expect(f.baselineAnnualNgn).toBe(37_500_000); expect(f.capexNgn).toBeCloseTo(2_310_000, 6);
  expect(f.monthlyFeeNgn).toBe(2_500_000); expect(f.hospitalSavingsAnnualNgn).toBe(7_500_000);
  expect(f.providerAnnualCashflowNgn).toBeCloseTo(26_303_800, 6); expect(f.paybackYears!).toBeCloseTo(0.0878, 3);
});
test('fee 0 → payback and irr null', () => { /* feeFraction 0 → cashflow < 0 → both null */ });
test('capex 0 → payback and irr null', () => { /* size all 0 */ });
test('formatters', () => {
  expect(formatNgn(68_700_000)).toBe('₦68.7M'); expect(formatNgn(950_000)).toBe('₦950K'); expect(formatNgn(68_700_000, 'full')).toBe('₦68,700,000');
  expect(formatUsd(1_600_000, 1600)).toBe('$1.0K'); expect(formatPct(0.151)).toBe('15.1%');
  expect(formatYears(null)).toBe('n/a'); expect(formatYears(1.94)).toBe('1.9 yrs');
  expect(formatDuration(680)).toBe('11h 20m'); expect(formatDuration(45)).toBe('45m'); expect(formatDuration(0)).toBe('0m');
});
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** Use the message `feat(engine): EaaS finance and formatters`.

---

### Task 8: App shell, state, router, design tokens

**Files:**
- Create: `src/state/AppState.tsx`, `src/state/useHashRoute.ts`, `src/styles/tokens.css`, `src/styles/global.css`, `src/components/Nav.tsx`, `src/components/PageTransition.tsx`.
- `App.tsx` wraps everything in `<MotionConfig reducedMotion="user">`, so every `motion` animation respects the OS setting. `PageTransition` uses `AnimatePresence mode="wait"`, keyed by route.
- Modify: `src/main.tsx`, `src/App.tsx`, `index.html`.
- Delete: template demo files (`App.css`, `assets/react.svg`, `src/smoke.test.ts`).
- Test: `src/state/AppState.test.tsx`, `src/App.test.tsx`.

**Interfaces:**
- Consumes: `runComparison`, `computeFinance`, `validateProfile`, `validateCosts`, `PRESETS`, `DEFAULT_COSTS` and `DEMO_SEED`.
- Produces:

```ts
export type Route = 'home' | 'profile' | 'outage' | 'plan' | 'method';
export interface AppStateShape { profile: HospitalProfile; costs: CostAssumptions; seed: number; season: Season; }
export type Action =
  | { type: 'loadPreset'; presetId: string }
  | { type: 'updateProfile'; patch: Partial<Omit<HospitalProfile, 'equipment'>> }
  | { type: 'updateEquipment'; id: string; patch: Partial<Equipment> }
  | { type: 'addEquipment'; item: Equipment }
  | { type: 'removeEquipment'; id: string }
  | { type: 'updateCosts'; patch: Partial<CostAssumptions> }
  | { type: 'setSeed'; seed: number }
  | { type: 'setSeason'; season: Season };
export function reducer(s: AppStateShape, a: Action): AppStateShape;
export function useApp(): { state: AppStateShape; dispatch: Dispatch<Action>; errors: string[]; comparison: Comparison | null; finance: FinanceResult | null };
// comparison/finance are useMemo'd; null when errors.length > 0
export function useHashRoute(): { route: Route; params: URLSearchParams; anchor: string | null; navigate(r: Route, query?: string): void };
// Hash grammar: '#/' + route + optional '?query' + optional '#anchor' (e.g. '#/outage?autoplay=1', '#/method#src-cost.dieselNgnPerLitre').
// Listens to 'hashchange'; scrolls to anchor element when present.
```

- [ ] **Step 1: Write the failing tests.**

```ts
test('initial state is kano-50, DEMO_SEED, typical', () => { /* reducer init */ });
test('loadPreset phc swaps profile and keeps costs', () => { /* … */ });
test('updateEquipment changes qty immutably', () => { /* original preset object unchanged */ });
test('invalid profile → comparison null, errors listed', () => { /* render hook with removeEquipment for all T1 → errors contains T1 message, comparison null */ });
test('hash route: unknown hash falls back to home', () => { window.location.hash = '#/nope'; /* render App → home heading visible */ });
test('nav switches route', () => { /* click "Outage day" in nav → location.hash === '#/outage' */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement.** Take the tokens, fonts, nav layout and page transition from DESIGN.md §2–§5. `index.html` sets `<title>Lifeline — Hospital Power Continuity</title>` and loads the Google Fonts link exactly as given in DESIGN.md §3.
- [ ] **Step 4: Run the tests and lint.** Run `npm test && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit.** Use the message `feat(ui): app shell, state, router, tokens`.

---

### Task 9: Shared components

**Files:**
- Create the components in DESIGN.md §7: `src/components/CountUp.tsx`, `TierBadge.tsx`, `Card.tsx`, `Slider.tsx`, `NumberField.tsx`, `SegmentedControl.tsx`, `SourceRef.tsx`. There is no icon wrapper; use `lucide-react` directly, as mapped in DESIGN.md §7.
- Test: `src/components/components.test.tsx`.

**Interfaces:**
- Produces the props listed in DESIGN.md §7, exactly as given. Key ones:
  - `CountUp { value: number; format: (n: number) => string; durationMs?: number; startOnView?: boolean }`. It animates from the previous value using `motion`'s `animate()` on a `useMotionValue`, and `useInView` for `startOnView`. When `useReducedMotion()` is true, it renders the final value at once.
  - `Slider { label: string; min: number; max: number; step: number; value: number; onChange(v: number): void; format?(v: number): string }`. It uses a native `<input type="range">` with the label wired up.
  - `NumberField { label; value; onChange; min?; max?; step?; suffix? }`. It shows an inline error when the value is out of range.
  - `SourceRef { id: string }`. It renders a superscript link to `#/method#src-{id}`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('CountUp renders final value with reduced motion', () => { /* mock matchMedia reduce → text === format(value) immediately */ });
test('Slider is labelled and reports changes', () => { /* getByLabelText(label); fireEvent.change → onChange called with number */ });
test('NumberField shows error when out of range', () => { /* value 30, max 24 → role="alert" visible */ });
test('TierBadge text', () => { /* T1 → "Life-critical", T2 → "Essential", T3 → "Can wait" */ });
```

- [ ] **Step 2: Run, implement, run.** Run the tests and confirm they fail, implement the components, then run again. Expected: PASS.
- [ ] **Step 3: Commit.** Use the message `feat(ui): shared components`.

---

### Task 10: Home page

**Files:**
- Create: `src/pages/Home.tsx`.
- Test: `src/pages/Home.test.tsx`.

**Interfaces:**
- Consumes: `HOME_STATS`, `CountUp`, `useApp` and `useHashRoute`.

**Behavior** (layout and copy follow DESIGN.md §6.0):
- The hero contains a live mini-twin preview. This is an animated SVG of a hospital silhouette whose lights stay on while a grid line flickers.
- A stat strip shows `HOME_STATS` with `CountUp`.
- A 3-step "How it works" row.
- A primary call to action, "Simulate an outage". Clicking it dispatches `loadPreset('kano-50')` and `setSeed(DEMO_SEED)`, then navigates to `#/outage` with `?autoplay=1`.
- A secondary call to action, "Size my hospital", goes to `#/profile`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('hero heading', () => { /* getByRole('heading', { level: 1, name: 'No hospital should go dark.' }) */ });
test('primary CTA goes to outage with autoplay', () => { /* click → location.hash === '#/outage?autoplay=1' */ });
test('stat strip shows 3 stats with sources', () => { /* 3 SourceRef links */ });
```

- [ ] **Step 2: Run, implement, run.** Expected: PASS.
- [ ] **Step 3: Commit, then redeploy.** Use the message `feat(ui): home page`.

---

### Task 11: Profile page

**Files:**
- Create: `src/pages/Profile.tsx`.
- Test: `src/pages/Profile.test.tsx`.

**Behavior** (DESIGN.md §6.1):
- A preset picker (`SegmentedControl`).
- Fields: state select (37 options), beds, grid hours (Slider 0–24, step 0.5), diesel L/month and generator kVA.
- An equipment table grouped by ward. Each row has a tier badge, editable qty, W and duty, and remove.
- An "Add equipment" select drawn from `EQUIPMENT_LIBRARY`.
- A live summary bar showing daily kWh per tier and peak kW.
- Validation errors show in a `role="alert"` list. While errors exist, the "Run outage day" button is disabled.

- [ ] **Step 1: Write the failing tests.**

```ts
test('changing ventilator qty updates daily kWh summary', () => { /* qty 4→8 → T1 kWh text increases by 24.0 (250W×4×24h) */ });
test('removing all T1 shows error and disables run', () => { /* alert contains 'Add at least one life-critical item.'; button disabled */ });
test('state select lists 37 states', () => { /* options length 37 */ });
```

- [ ] **Step 2: Run, implement, run.** Expected: PASS.
- [ ] **Step 3: Commit, then redeploy.** Use the message `feat(ui): profile page`.

---

### Task 12: Outage Day page (the demo money shot)

**Files:**
- Create: `src/state/usePlayback.ts`, `src/pages/OutageDay.tsx`, `src/pages/outage/PlaybackBar.tsx`, `src/pages/outage/LoadChart.tsx`, `src/pages/outage/EventLog.tsx`, `src/pages/outage/RunwayGauge.tsx`, `src/pages/outage/ComparisonPanel.tsx`, `src/pages/outage/HospitalMap.tsx`, `src/pages/outage/roomState.ts`.
- Test: `src/state/usePlayback.test.ts`, `src/pages/OutageDay.test.tsx`, `src/pages/outage/roomState.test.ts`.

**Interfaces:**

```ts
export function usePlayback(opts: { totalSteps: number; resetKey: string; autoplay: boolean }): {
  step: number; playing: boolean; speed: 1 | 4 | 16; play(): void; pause(): void; toggle(): void; setSpeed(s: 1 | 4 | 16): void; seek(step: number): void;
};
// 1× = 1 step per 400 ms; 4× = 100 ms; 16× = 25 ms. Stops at totalSteps-1.
// resetKey change → step 0, paused (autoplay re-applies). Uses one setInterval, cleared on unmount/pause.
```

**Behavior** (DESIGN.md §6.2):
- Header strip: a `RunwayGauge` with a large count-up value. While the grid is up it reads "On grid power". It turns to the warning colour when the runway is under 2 hours.
- Also in the header: the clock `stepToClock(step)`, the season toggle ("Typical day" / "Rainy season") and a "New day" button that sets a random seed.
- Scenario toggle ("With Lifeline" / "Today: diesel only") is local page state, default Lifeline. It switches the map, runway and chart. The comparison panel always shows both.
- `HospitalMap`: an SVG floor plan with one room per ward, plus a battery room, generator, roof array and grid cable. Each room has a state: lit, dim, dark or no-power (DESIGN.md §6.2). The room state is derived by `roomState(ward, step, result, profile)` in `src/pages/outage/roomState.ts`, which needs its own unit test:
  - `'alarm'` if any T1 item in the ward is unserved.
  - `'dark'` if every item in the ward has its tier shed.
  - `'dim'` if some are shed.
  - `'lit'` otherwise.
  - Wards with no equipment are not drawn.
- `LoadChart`: a Recharts `ComposedChart` with stacked areas for T1/T2/T3 served, a PV line, an SoC line on the right axis, and grid-down bands as `ReferenceArea`. A cursor line marks the current step. The chart is revealed progressively up to `step`.
- `EventLog`: events up to the current step, newest first, each with `stepToClock` and `formatEvent`. It is an `aria-live="polite"` region.
- `ComparisonPanel`: two columns, "Today: diesel only" and "With Lifeline", each showing T1 minutes dark, diesel litres, ₦ cost and kg CO₂. The numbers count up live as playback advances, using metrics computed from steps `0..step`. At the end, a verdict banner appears, with the copy from DESIGN.md §6.2.
- Reading `?autoplay=1` starts playback.

- [ ] **Step 1: Write the failing tests.**

```ts
test('usePlayback advances at 1× every 400ms and stops at end', () => { vi.useFakeTimers(); /* renderHook autoplay true; advance 400 → step 1; advance 400*200 → step 95, playing false */ });
test('resetKey change resets to 0', () => { /* rerender with new resetKey → step 0 */ });
test('no interval leaks after unmount', () => { /* unmount; vi.getTimerCount() === 0 */ });
test('outage page shows runway and both comparison columns', () => { /* getByRole('heading', { name: 'Today: diesel only' }), getByRole('heading', { name: 'With Lifeline' }) */ });
test('roomState: ICU alarm when T1 unserved; dark when all shed; lit otherwise', () => { /* hand-built TwinResult steps */ });
test('seek to end shows verdict with baseline T1 minutes > 0 and lifeline 0', () => { /* seek(95) → verdict text contains '0 min' for Lifeline */ });
test('invalid profile shows link back to profile instead of charts', () => { /* errors → link 'Fix hospital profile' */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.** Expected: FAIL.
- [ ] **Step 3: Implement the page.** Running metrics up to `step` come from a helper, `partialMetrics(result: TwinResult, uptoStep: number, costs: CostAssumptions): TwinMetrics`. Add it to `src/engine/twin.ts`, with a unit test that `partialMetrics(r, 95, costs)` equals `r.metrics`.
- [ ] **Step 4: Run all the tests and lint.** Run `npm test && npm run lint`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.** Open `npm run dev` at `#/outage?autoplay=1`. Check that it plays smoothly at 16× and that the 2-hour warning colour appears.
- [ ] **Step 6: Commit, then redeploy.** Use the message `feat(ui): outage day twin`.

---

### Task 13: Plan & Finance page and proposal export

**Files:**
- Create: `src/pages/Plan.tsx`, `src/pages/plan/SizeCards.tsx`, `src/pages/plan/FinancePanel.tsx`, `src/pages/plan/AssumptionsEditor.tsx`, `src/pages/plan/Proposal.tsx`, `src/styles/print.css`.
- Test: `src/pages/Plan.test.tsx`.

**Behavior** (DESIGN.md §6.3, §11):
- `SizeCards`: PV kWp, battery kWh and inverter kW, each with a one-line plain explanation.
- `FinancePanel`:
  - A hero number, "Hospital saves {formatNgn(savings)}/yr".
  - A side-by-side bar: today's monthly spend against the Lifeline fee.
  - An investor block with capex, payback and IRR.
  - A CO₂ avoided figure.
  - A fee Slider from 70% to 85%, step 1%, bound to `costs.feeFraction`.
- `AssumptionsEditor`: a collapsible list of `NumberField`s, one for every `DEFAULT_COSTS` key, each with a `SourceRef` and an "Estimate" tag when `isEstimate` is true. A "Reset to defaults" button sits at the end.
- Red warning: if `lifeline.metrics.t1MinutesUnpowered > 0`, show a `role="alert"` with "This design leaves life-critical equipment without power for {formatDuration(m)}. Increase battery or generator size."
- "Download proposal" calls `window.print()`. `print.css` hides the app chrome and shows only `<Proposal/>`, a one-page A4 summary.

- [ ] **Step 1: Write the failing tests.**

```ts
test('fee slider changes monthly fee', () => { /* 80%→70% → fee text decreases */ });
test('payback n/a when fee is 0 via editor', () => { /* set fee NumberField 0 → 'n/a' visible, no 'Infinity'/'NaN' in document */ });
test('download proposal calls window.print', () => { const spy = vi.spyOn(window, 'print').mockImplementation(() => {}); /* click → spy called */ });
test('T1 shortfall warning when generator 0 and battery forced small', () => { /* dispatch updateProfile generatorKva 0, gridHours 0 → alert visible if t1 minutes > 0 */ });
```

- [ ] **Step 2: Run, implement, run.** Expected: PASS.
- [ ] **Step 3: Print preview.** Use the browser print preview to check that the proposal fits one A4 page.
- [ ] **Step 4: Commit, then redeploy.** Use the message `feat(ui): plan, finance, proposal export`.

---

### Task 14: Method & Sources page

**Files:**
- Create: `src/pages/Method.tsx`.
- Test: `src/pages/Method.test.tsx`.

**Behavior** (DESIGN.md §6.4):
- The sizing formulas from Task 4, the controller rules from Task 5 in plain language, and the finance formulas from Task 7.
- A source table generated from `SOURCES`. Each row gets the anchor `id="src-{id}"` and an Estimate tag.
- An honest "Limits" list:
  - one-day simulation
  - typical ratings, not a site audit
  - prices dated Oct 2026

- [ ] **Step 1: Write the failing test.** Check that every `SOURCES` entry renders a row with `id="src-<id>"`, and that the `#/method#src-cost.dieselNgnPerLitre` anchor exists.
- [ ] **Step 2: Run, implement, run.** Expected: PASS.
- [ ] **Step 3: Commit, then redeploy.** Use the message `feat(ui): method and sources page`.

---

### Task 15: Polish, accessibility, README, final deploy

**Files:**
- Create: `README.md`.
- Modify: as needed, for the accessibility and responsive fixes only.

- [ ] **Step 1: Check responsive widths.** Check 375, 768 and 1440 px widths in the browser. There must be no horizontal scroll, and the Outage Day page must stack per DESIGN.md §5.
- [ ] **Step 2: Check accessibility against DESIGN.md §10.** Check focus rings, colour contrast of at least 4.5:1, and reduced motion (playback still works and CountUp is instant). Tier colours are always paired with a text label.
- [ ] **Step 3: Write the README.** It covers the problem statement, what it does, a screenshot, how to run (`npm i`, `npm run dev`, `npm test`), the method summary, sources and the team.
- [ ] **Step 4: Run all checks.** Run `npm test && npm run lint && npm run build`. All must pass.
- [ ] **Step 5: Deploy.** Run `npx vercel --prod`. Then walk the live URL manually: Home → Simulate → it plays to the end → Plan → Download proposal.
- [ ] **Step 6: Commit.** Use the message `docs: README; polish`.

**Optional, only if ahead of schedule at hour 28:** the Claude equipment-list parser from spec §10. It needs a new dependency and an API key, so ask the user first. It is not planned here.

---

## Submission checklist (not code)

- [ ] Record the demo video (about 3 minutes) following spec §11. Use the live URL and the `?autoplay=1` link, at 16× speed for the full day.
- [ ] Submit the project link, video and description before the deadline. Confirm the deadline with a mentor.
- [ ] Update HANDOFF.md with the live URL, the video link and the submission status.
