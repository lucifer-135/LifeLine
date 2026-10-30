# HANDOFF.md

Use this file to resume after compaction or a session limit. **Update it after each completed PLAN task and before compaction.** The newest state goes at the top of "Status".

---

## Status

- **Last updated:** 2026-10-30, Task 7 complete; engine done (cloud build session, subagent-driven).
- **Phase:** Building PLAN.md tasks in order on branch `claude/modest-gauss-c677cd`. Next: Task 8 (app shell, state, router, tokens).
- **Repo:** GitHub `lucifer-135/LifeLine` (private). Work branch `claude/modest-gauss-c677cd`, draft PR to `main`. Original local clone: `C:\Shivansh\Projects\Global-Energy-Hackathon`.
- **Files present:**
  - `CLAUDE.md`
  - `PLAN.md`, `DESIGN.md`, `HANDOFF.md` (tracked in git so cloud sessions can read them)
  - Vite react-ts app scaffold (Task 1)
  - **Missing:** `docs/superpowers/specs/2026-10-30-lifeline-design.md` is not in the repo (not tracked, not on `main`). The cloud build treats PLAN.md + DESIGN.md + HANDOFF.md as the authority. Please commit the spec if it should be the tie-breaker.
  - `example ps.jpeg` is local only (git-ignored).
- **Deployed URL:** none yet. Needs the user (see "Needs user").
- **Toolchain in the cloud build:** Node v22.22, npm 10.9. Installed: vite 8.3.5, react 19.3.1, typescript 7.0.2, vitest 5.0.5, recharts 3.10.1, motion 14.8.0, lucide-react 1.65.0.
- **Lint:** the current create-vite react-ts template ships **oxlint** (`npm run lint` = `oxlint`), not ESLint. We kept the template default rather than add ESLint as a new dependency.
- **Original environment (local):**
  - Windows 11
  - Node v24.12.0, npm 11.6.2
  - Python 3.14 with pypdf and PyMuPDF
  - `pdftotext` available in Git Bash

### Needs user

- **Vercel deploy (PLAN Task 1 Step 7, every "redeploy" step, Task 15 Step 5).** Claude cannot log in. Run `npx vercel` once to log in and link the project, then `npx vercel --prod`. Record the URL here.

### Task tracker

Keep this in sync with PLAN.md.

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Scaffold, git, test runner, deploy | done | Vercel deploy skipped: needs the user. oxlint is the template linter. |
| 2 | Engine types, data, validation | done | 53 SOURCES rows (cost, stat, solar, equip, site). Engine constants have no source rows; the Method page explains them. |
| 3 | Loads, solar shape, grid pattern | done | kano-50: life-critical 109.8, essential 90.3, can wait 98.1 kWh/day (298 total). |
| 4 | Sizing | done | kano-50, seed 2026: battery 85 kWh, PV 41 kWp, inverter 12 kW (longest outage 7.5 h). |
| 5 | Twin: Lifeline | done | kano-50 seed 2026: life-critical 0 min dark, essential 0 min, 0 L diesel, 109.9 kWh grid, ₦23,017/day. Fuzz-checked energy balance. |
| 6 | Twin: baseline, comparison, event copy | done | kano-50 seed 2026: today 315 min life-critical dark, 50 L, ₦179K/day; Lifeline 0 min, 0 L, ₦23K. Baseline runway divides fuel by the whole load (it never sheds). |
| 7 | Finance and formatters | done | kano-50: capex ₦44.1M, fee ₦4.6M/mo, hospital saves ₦13.7M/yr, payback 1.0 yrs, IRR 103%, CO₂ avoided 43 t/yr. |
| 8 | App shell, state, router, tokens | todo | |
| 9 | Shared components | todo | |
| 10 | Home | todo | |
| 11 | Hospital profile | todo | |
| 12 | Outage day | todo | demo money shot |
| 13 | Plan & finance, proposal | todo | |
| 14 | Method & sources | todo | |
| 15 | Polish, a11y, README, deploy | todo | |
| — | Demo video and submission | todo | not code |

---

## Event facts (hackathon.anneru.com, read 2026-10-30)

- **Event:** Global Energy Hackathon 2026, hosted by Anneru Solutions Inc. (Texas). Anneru works in smart metering, energy management and infrastructure advisory, and runs a "Powering Africa" strategy and matchmaking program. The person shown publicly is Urenna Onyewuchi, Ph.D.
- **Format:** Oct 30 – Nov 1, 2026, 100% virtual, free. Solo or teams of up to 4. Over $10,000 in cash and in-kind prizes.
- **Rules:**
  - The entry must be a "working concept, not just a discussion of ideas".
  - Submit the project, a demo video and details.
  - Solutions must be realistic to implement in 6–18 months.
  - Entrants choose a residential or non-residential track.
  - Pitching happens later, at a 2027 summit.
- **Mission pillars:** Access, Affordability, Availability.
- **Tracks:**
  - Hardware
  - Digital/AI
  - Business models & financing
  - Clean energy & sustainability
  - Policy & community
- **Unknown, so ask a mentor:** the six judging categories and their weights, the exact submission deadline, and the per-track prize split.

### The problem statement we chose (Availability pillar, verbatim)

> "Design a scalable, low-maintenance energy system that guarantees uninterrupted 24-hour power for Nigerian hospitals experiencing 8–20 hours of daily grid outages, ensuring critical medical equipment, refrigeration, lighting, and life-support systems never fail due to electricity unavailability."

We entered the non-residential (healthcare) track.

### Other pillar statements we did not choose

- **Access:** a connection model for unelectrified Nigerian households earning under ₦50,000 a month.
- **Affordability:** reduce the energy burden of low-income Minnesota households, which currently exceeds 10% of income, with no upfront cost.

---

## Decisions log (idea phase)

1. **Problem: hospital availability, as approach A "Lifeline".** We chose it over approach B (household mini-grid planner, a crowded idea space) and approach C (Minnesota energy burden, weaker fit with the host). Reasons:
   - The stakes are life-critical.
   - It fits Nigerian policy now: the Nigeria Power for Health Initiative is pushing an EaaS model for public health facilities.
   - It suits the host's metering business.
   - It can be fully demonstrated as software.
2. **The team is software only (web/AI).** So there is no hardware, and smart-meter integration is the 6–18 month roadmap item.
3. **The user asked for a home page.** UI = Home, Hospital profile, Outage day, Plan & finance, Method.
4. **Stack:** React, Vite, TypeScript, Recharts, `motion`, `lucide-react`, Vitest, and Vercel. There is no backend, and every calculation runs in the browser.
5. **Engine refinements beyond the spec, all made during planning:**
   - The battery is sized to night energy × min(1, longest outage ÷ night hours).
   - PV is sized for the **worst month** of irradiance.
   - The twin runs a warm-up day, so the starting battery charge is realistic.
   - The controller sheds loads based on battery energy only and keeps diesel for emergencies.
   - The baseline has a 15-minute generator start gap at each outage.
6. **Design direction: "Light stays on".**
   - Background is ward-night indigo, and lamp amber appears only where power is delivered.
   - Fonts are Archivo (variable width) and Atkinson Hyperlegible Next.
   - The standout element is the living hospital floor plan.
   - Rejected: ui-ux-pro-max's slate-and-green palette (a generic look), Cinzel (no link to the subject), and glassmorphism.
   - Full detail is in DESIGN.md §1.
7. **The UI never shows tier codes.** It says "life-critical", "essential" and "can wait".
8. **Added `motion` and `lucide-react` (user-approved, 2026-10-30).** `motion` handles state-driven and user-triggered animation. CSS keyframes stay for the infinite loops. Lucide icons replace the hand-drawn `Icon` component. See DESIGN.md §4 and §7.
9. **Optional Claude equipment-list parser.** Build it only if we are ahead of schedule at hour 28. It needs user approval for the dependency and an API key.

---

## Model numbers

These are the source of truth for `src/data/costs.ts` and `src/data/sources.ts`. "Estimate" means `isEstimate: true` in the app.

### Costs (`DEFAULT_COSTS`)

| key | value | unit | source | date | estimate? |
|---|---|---|---|---|---|
| dieselNgnPerLitre | 3277 | ₦/L | NBS Diesel Price Watch, May 2026 avg retail (N3,277.47), reported by [Legit.ng](https://www.legit.ng/business-economy/energy/1716140-nbs-diesel-price-rises-8640-n3277litre-2026/) | 2026-06-24 | no |
| gridNgnPerKwh | 209.5 | ₦/kWh | NERC Band A tariff, [Leadership](https://leadership.ng/?p=484864). It was ₦225 in Apr 2024 ([Nairametrics](https://nairametrics.com/2024/04/03/nerc-increases-electricity-tariffs-for-band-a-customers-to-n225-kwh/)) | 2026 | no |
| pvNgnPerKwp | 450000 | ₦/kWp | Calibrated so that a 300 kWp + 200 kWh system costs about ₦200M, the top of [SurgePV](https://www.surgepv.com/solar-compliance/nigeria/guides/ci-solar-nigeria)'s ₦150–200M commercial benchmark | 2026 | yes |
| batteryNgnPerKwh | 200000 | ₦/kWh | LFP ₦183,000–221,000 per kWh, [PowMr Nigeria 2026](https://af.powmr.com/blogs/news/how-much-is-solar-battery-in-nigeria) | 2026 | yes |
| inverterNgnPerKw | 240000 | ₦/kW | About $150/kW × ₦1,600 | 2026 | yes |
| bosFraction | 0.15 | of capex | Wiring, protection, engineering | — | yes |
| omFractionPerYear | 0.02 | of capex per year | Typical 1–2% for PV and battery | — | yes |
| generatorMaintNgnPerYear | 3000000 | ₦/yr | 60 kVA servicing | — | yes |
| ngnPerUsd | 1600 | ₦/$ | Q2 2026 rate, [SurgePV](https://www.surgepv.com/solar-compliance/nigeria/guides/ci-solar-nigeria) | 2026 | no |
| feeFraction | 0.8 | of today's spend | Design choice; slider range 70–85% | — | n/a |
| contractYears | 10 | years | Design choice; LFP life is about 10 years | — | n/a |
| dieselLitresPerKwh | 0.3 | L/kWh | Small generators at part load use 0.28–0.4 | — | yes |
| co2KgPerLitreDiesel | 2.68 | kg/L | Standard diesel combustion factor (DEFRA/EPA) | — | no |
| gridCo2KgPerKwh | 0.43 | kg/kWh | Nigeria's gas-dominated grid, approximate | — | yes |

### Caveats

- **Diesel is volatile.** NBS reported ₦1,420 in Feb 2026, ₦1,648 in Mar, ₦2,475 in Apr and ₦3,277 in May. We found no NBS figure for Aug or Sep 2026. Say in the pitch: "at May 2026 prices; edit on the plan page".
- **Band A tariff.** Sources give either ₦209.5 or ₦225 depending on date and DisCo.

### Solar (`src/data/solarSites.ts`)

- The full table of 37 rows is in PLAN.md Task 2, step 4.
- **Source:** NASA POWER Climatology API v2.10.1, parameter `ALLSKY_SFC_SW_DWN` (kWh/m²/day), averaged 2001–2025, at each state capital, pulled 2026-10-30.
- **Reproduce:**

```
https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON
```

- Kano: annual 6.00, worst month December at 5.50.
- Rivers (Port Harcourt): annual 4.12, worst month July at 3.20.
- August is the worst month in most states, because of the rainy season.

### Equipment ratings (`kano-50` preset)

**Field-tested values.** These come from [SEforALL, *Medical appliances for resource-constrained settings*, July 2025](https://www.seforall.org/system/files/2025-07/SEforALL%20report-medical-appliances-resource-constrained-settings.pdf), from 15-day logging in Kisumu, Kenya:
- **Oxygen concentrator:** tested at 477.5 W against a rated 880 W, and about 7.3 kWh/day. This is the most energy-hungry appliance. We use 480 W at 0.8 duty.
- **Infant warmer:** rated 700–800 W, tested up to 1,090.1 W. We use 800 W at 0.5 duty.
- **Autoclave (All American 75X):** rated 1,650 W. We use 1,650 W at 0.25 duty.
- Real power draw differed from the rated value by between −45% and +56%. This is quoted on the Method page.

All other ratings are typical manufacturer figures marked "Estimate": ventilator 250 W, monitor 60 W, vaccine fridge 100 W at 0.5 duty, and so on. See PLAN.md Task 2, step 5.

**Kano preset site inputs, all estimates:**
- 6 grid hours a day, inside the 8–20 hour outage band.
- 1,500 L of diesel a month. This is a rationed budget, so today's generator runs dry.
- 60 kVA generator.

The Kano preset should land at roughly 300 kWh/day in total, with a T1 base of about 4.2 kW running 24 hours. This is a sanity range; the test asserts 200–400 kWh.

### Home-page facts (`HOME_STATS` and the Kano sentence)

| id | text | source |
|---|---|---|
| stat.outageHours | Lose grid power 8 to 20 hours a day | Hackathon problem statement (hackathon.anneru.com) |
| stat.phcNoPower | About 40% of primary health centres have no electricity | [Nigeria Health Watch](https://nigeriahealthwatch.com/articles/torchlight/a-solar-power-project-is-keeping-primary-healthcare-centres-running-in-abuja/), citing a 2022 report |
| stat.whoSolar | Solar cut service interruptions by over 80% at two Nigerian centres | [WHO AFRO](https://www.afro.who.int/pt/node/23032) |
| stat.kanoIcu | 2025 Aminu Kano Teaching Hospital outage linked to ICU deaths, followed by a solar project | [SolarQuarter, 2025-09-20](https://solarquarter.com/2025/09/20/nigerias-energy-commission-launches-7mw-solar-project-at-aminu-kano-teaching-hospital/) |
| context.nphi | Nigeria Power for Health Initiative: an EaaS model for health facilities | [Guardian NG](https://guardian.ng/?p=2861639), [Nairametrics, 2025-09-09](https://nairametrics.com/2025/09/09/tinubu-unveils-energy-reform-plans-set-to-end-power-supply-crisis-in-nigerian-hospitals/) |

Do not cite the Kano hospital's system size: one source says a 7 MW solar project and another says a 4 MW hybrid.

---

## Next steps

1. Get the user's choice of execution method: subagent-driven or native.
2. Start PLAN.md Task 1. Ask the user to run `npx vercel` to log in, because Claude cannot log in.
3. Remind the user to ask a mentor about the deadline and the judging categories.

## Open risks

- **Controller sheds on battery charge only (HANDOFF decision 5).** On some seeds (1–20) Lifeline pauses essential loads for up to 405 min/day while using under 3 L of the 50 L/day diesel. The demo seed 2026 sheds nothing. If judges try "New day", the essential-load comparison can favour the diesel-only baseline. A possible change: let diesel cover essential load before shedding it. That needs a decision and test updates.

- **Fonts.** If "Atkinson Hyperlegible Next" is not on Google Fonts, fall back to "Atkinson Hyperlegible" (DESIGN.md §3).
- **Judging criteria are unknown.** The design covers the likely axes: impact, feasibility, innovation, the demo, business model and scalability.
- **Provider return looks very rich.** At ₦3,277/L the kano-50 case pays back in 1.0 years with a 103% IRR. Judges may question it; the diesel price sensitivity below is the answer.
- **Diesel price spike.** The finance case is very strong at ₦3,277/L, and judges may question it. Show it as editable, and mention the February price of ₦1,420 as a sensitivity case.
