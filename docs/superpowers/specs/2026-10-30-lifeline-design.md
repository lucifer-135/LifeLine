# Lifeline — Hospital Power-Continuity Platform

**Date:** 2026-10-30
**Event:** Global Energy Hackathon 2026 (Anneru Solutions), Oct 30 – Nov 1, 2026, virtual
**Problem statement (Availability pillar, verbatim from site):** "Design a scalable, low-maintenance energy system that guarantees uninterrupted 24-hour power for Nigerian hospitals experiencing 8–20 hours of daily grid outages, ensuring critical medical equipment, refrigeration, lighting, and life-support systems never fail due to electricity unavailability."
**Lane:** Non-residential (healthcare). Primary track: Digital Solutions, Apps & AI/ML Tools; also touches Clean Energy and Business Models & Financing.

## 1. Intent

### What the user said
- Team is software-only (web/AI).
- Goal: the project with the highest chance of winning.
- Chosen approach: A, the hospital power-continuity platform.
- The UI must include a home page.

### Assumptions
- 2–4 people and about 44 hours of build time remain.
- Submission is a public link plus a demo video ("project, demo video, and details").
- UI is in English. Money shows in Naira first, with USD alongside.

### Success criteria
- A judge opening the link understands the value in under 60 seconds.
- One click from the home page plays an outage simulation.
- The demo video shows a grid outage where life-critical loads stay powered, compared side by side with today's diesel-only setup.
- Every default number is cited and editable, so it holds up under scrutiny from power engineers.
- The solution is credible to implement in 6–18 months, as the event rules require.

### Why this problem statement
- The stakes are life-critical. Outages at Aminu Kano Teaching Hospital were linked to ICU deaths in 2025.
- The timing fits current policy. The Nigeria Power for Health Initiative is pushing an Energy-as-a-Service (EaaS) model for public health facilities.
- The host, Anneru Solutions, works in smart metering, energy management and a "Powering Africa" program. The roadmap plugs smart-meter data into the same digital twin.

## 2. Architecture

The app is a single static web app with no backend. All computation runs in the browser, so no server can fail during judging.

### Stack
- React, Vite and TypeScript.
- Recharts for charts.
- Vitest for unit tests.
- Deployed on Vercel.

### Modules
Modules are pure TypeScript and do not depend on the UI.

| Module | Purpose | Input | Output |
|---|---|---|---|
| `data` | Bundled JSON: hospital presets, equipment library, peak sun hours by Nigerian state, cost defaults, source citations | none | typed constants |
| `loads` | Builds the hourly load profile from equipment | `HospitalProfile` | 96-step (15-minute) kW series per tier |
| `sizing` | Sizes the PV, battery and inverter | load profile, state, grid hours | `SystemSize { pvKwp, batteryKwh, inverterKw }` |
| `twin` | 24-hour simulation with the dispatch controller | profile, size, outage pattern, seed | `TwinResult { steps[], events[], metrics }` |
| `finance` | Compares diesel-only with the EaaS model | metrics, size, cost assumptions | `FinanceResult` |

The UI only calls these modules. It holds no business logic.

## 3. Data model

### `Equipment`
- `id`, `name`, `ward`
- `ratedW`
- `dutyCycle` (0–1)
- `scheduleMask`: 24 booleans, one per hour
- `tier`: `T1` (life-critical), `T2` (essential) or `T3` (deferrable)
- `qty`

### `HospitalProfile`
- `name`, `state`, `beds`
- `equipment[]`
- `gridHoursPerDay`
- `dieselLitresPerMonth`
- `generatorKva`

### Presets
- **"50-bed General Hospital, Kano".** Wards: ICU, theatre, maternity, lab, cold chain, wards and admin.
- **"Primary Health Centre".**

Power ratings come from WHO and SEforALL health-facility energy guidance. Examples:
- ventilator about 200 W
- oxygen concentrator about 300 W
- vaccine fridge about 60–100 W average

### Cost defaults
- Diesel price in ₦ per litre.
- Grid tariff band.
- Capex in ₦ per kWp and ₦ per kWh.
- Operations and maintenance as % of capex per year.
- Each default carries the date "Oct 2026" and a source, and the user can edit it in the UI.

### Solar resource
- A table of peak sun hours (kWh/m²/day) for each Nigerian state, derived from NASA POWER.
- Values range from about 4.5 in the south to about 6.5 in the north.

## 4. Sizing logic

- **Battery (kWh):**
  `batteryKwh = E(T1 + T2 during longest outage window) / (DoD 0.8 × round-trip efficiency 0.9)`
- **PV (kWp):**
  `pvKwp = (daily energy not met by grid + battery recharge) / (peak sun hours × performance ratio 0.75)`
- **Inverter (kW):**
  `inverterKw = 1.25 × coincident peak (T1 + T2)`
- **Diesel:** the existing generator stays in place as the last resort.

## 5. Digital twin and controller

The twin runs 96 steps of 15 minutes. A seeded random generator produces the grid outage pattern from `gridHoursPerDay`, so the same seed always gives the same demo.

At each step, the controller does the following:
1. If the grid is up, it serves the load and charges the battery from the grid and any PV surplus.
2. If the grid is down, it serves the load from PV first, then from the battery.
3. If projected battery runway falls short of the forecast grid return or the next sunrise, it sheds T3 loads, then T2 loads. **It never sheds T1.**
4. The diesel generator starts only when battery state of charge (SoC) drops below the 20% reserve.
5. Each decision is logged as an event, for example: `14:30 Grid lost · Theatre HVAC shed · ICU runway 11h 20m`.

### Comparison mode
The same day and seed run under two scenarios:
- **Baseline:** diesel only. It is fuel-limited and has a start-up gap.
- **Lifeline:** the hybrid system above.

### Metrics reported for both scenarios
- T1 minutes unpowered
- T2 minutes unpowered
- Diesel litres used
- Energy cost in ₦
- kg of CO₂

### Invariants (unit-tested)
- T1 is never shed while any source has energy available.
- Energy balance holds at every step: supply = served load + charge + curtailment.
- A fixed seed always gives identical output.
- Battery SoC stays within [0, 1].

## 6. Finance (EaaS)

### Baseline annual cost
Diesel cost + generator maintenance + grid bill.

### Lifeline capex
PV + battery + inverter + balance of system. The provider finances, owns and maintains the system.

### Monthly fee
A slider sets the fee at 70–85% of the hospital's current monthly energy spend. The default is 80%.

### Outputs
- Hospital savings per year
- Investor simple payback
- Investor 10-year IRR
- CO₂ avoided

### Funding note
A text block describes blended DFI and green-bond finance, and how the model aligns with the Nigeria Power for Health Initiative.

## 7. UI: four screens

### 0. Home
- **Hero:** "No hospital should go dark."
- **Stat strip:**
  - 8–20 hours of daily outages
  - about 40% of primary health centres have no electricity
  - the Kano ICU outage
- **How it works:** three steps: Profile → Outage Day → Plan.
- **Primary call to action, "Simulate an outage":** loads the 50-bed Kano preset and goes straight to screen 2.
- **Footer:** links to the method and sources.

### 1. Profile
- A preset picker.
- An editable equipment table with tier colours.
- Fields for state and grid hours.

### 2. Outage Day
- Play and pause controls, plus a speed slider.
- A stacked load chart split by tier.
- A battery SoC line and a PV curve.
- A live event feed.
- A large "ICU runway" counter.
- The comparison panel, which is the headline chart of the demo.

### 3. Plan and Finance
- System size cards.
- Finance outputs, with editable assumptions.
- A **Download proposal** button: a one-page PDF made with print CSS.

### Method and Sources page
- The formulas.
- A citation table for every default value.

## 8. Error handling

- Invalid inputs (negative values, zero grid hours with no PV) show an inline validation message. Simulations never run on invalid inputs.
- If sizing produces a system that cannot cover the T1 load, the plan screen shows a red warning. It does not hide the shortfall.

## 9. Testing

- **Unit tests (Vitest):**
  - `sizing` and `twin`, including all invariants in §5
  - `finance`, checking payback and IRR against a hand-computed case
- **Manual end-to-end check before recording the video:** Home → Simulate → Plan → PDF.

## 10. Out of scope (YAGNI)

- Accounts and authentication
- A database
- Real meter integration (shown in the pitch as the 6–18-month roadmap)
- Native mobile apps
- Multi-day simulation

**Stretch goal, only if ahead of schedule at hour 28:** a Claude-powered parser that turns a free-text equipment list into the equipment table.

## 11. Demo video (about 3 minutes)

| Time | Content |
|---|---|
| 0:00–0:20 | Hook: "At 2am the grid fails…" followed by the stat strip |
| 0:20–0:50 | Home page, then pick the 50-bed Kano preset |
| 0:50–1:50 | Outage Day: the event feed and runway counter, then the comparison chart (for example 47 minutes vs 0 minutes of ICU unpowered) |
| 1:50–2:30 | Plan and Finance: monthly fee compared with diesel, and investor payback |
| 2:30–3:00 | 6–18-month path: pilot with one hospital under the Power for Health Initiative, then a smart-meter data feed into the twin, then a portfolio of hospitals |

## 12. Build timeline (48 hours)

| Hours | Work |
|---|---|
| 0–4 | Scaffold the app; write data JSON, presets and types |
| 4–16 | Engine (`loads`, `sizing`, `twin`) with tests; in parallel, the Home and Profile UI |
| 16–28 | Outage Day screen, event feed and charts; `finance` module |
| 28–36 | Plan screen, PDF export, Method page, polish and deploy |
| 36–44 | Record the video; write the README and submission text |
| 44–48 | Buffer, then submit |

## 13. Risks

| Risk | Mitigation |
|---|---|
| Judges question the numbers | Every default is cited and editable |
| Scope creep | Hard cut at hour 28; the stretch goal is dropped first |
| Deploy fails near the deadline | Deploy on Vercel from hour 4 onward and redeploy continuously |
