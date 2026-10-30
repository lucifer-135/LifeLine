import type { CostAssumptions, HospitalProfile } from '../engine/types'
import { DEFAULT_COSTS } from './costs'
import { EQUIPMENT_LIBRARY, equipmentId } from './equipment'
import { PRESETS } from './presets'
import { SOLAR_SITES } from './solarSites'

// Every default number the UI shows has a row here. `url: ''` means no link;
// `date: '—'` means undated. Engine model parameters (depth of discharge,
// round-trip efficiency, performance ratio...) are not listed: the Method page
// explains them. Cost labels double as the names in validation messages.
export interface Source {
  id: string
  label: string
  value: number
  unit: string
  source: string
  url: string
  date: string
  isEstimate: boolean
}

const LEGIT_DIESEL_URL =
  'https://www.legit.ng/business-economy/energy/1716140-nbs-diesel-price-rises-8640-n3277litre-2026/'
const SURGEPV_URL = 'https://www.surgepv.com/solar-compliance/nigeria/guides/ci-solar-nigeria'
const SEFORALL_URL =
  'https://www.seforall.org/system/files/2025-07/SEforALL%20report-medical-appliances-resource-constrained-settings.pdf'

function costSource(
  key: keyof CostAssumptions,
  label: string,
  unit: string,
  source: string,
  url: string,
  date: string,
  isEstimate: boolean,
): Source {
  return { id: `cost.${key}`, label, value: DEFAULT_COSTS[key], unit, source, url, date, isEstimate }
}

const COST_SOURCES: Source[] = [
  costSource(
    'dieselNgnPerLitre',
    'Diesel price',
    '₦/L',
    'NBS Diesel Price Watch, May 2026 avg retail (N3,277.47), reported by Legit.ng',
    LEGIT_DIESEL_URL,
    '2026-06-24',
    false,
  ),
  costSource(
    'gridNgnPerKwh',
    'Grid tariff',
    '₦/kWh',
    'NERC Band A tariff, Leadership. It was ₦225 in Apr 2024 (Nairametrics)',
    'https://leadership.ng/?p=484864',
    '2026',
    false,
  ),
  costSource(
    'pvNgnPerKwp',
    'Solar panel cost',
    '₦/kWp',
    "Calibrated so that a 300 kWp + 200 kWh system costs about ₦200M, the top of SurgePV's ₦150–200M commercial benchmark",
    SURGEPV_URL,
    '2026',
    true,
  ),
  costSource(
    'batteryNgnPerKwh',
    'Battery cost',
    '₦/kWh',
    'LFP ₦183,000–221,000 per kWh, PowMr Nigeria 2026',
    'https://af.powmr.com/blogs/news/how-much-is-solar-battery-in-nigeria',
    '2026',
    true,
  ),
  costSource('inverterNgnPerKw', 'Inverter cost', '₦/kW', 'About $150/kW × ₦1,600', '', '2026', true),
  costSource(
    'bosFraction',
    'Balance of system',
    'of capex',
    'Wiring, protection, engineering',
    '',
    '—',
    true,
  ),
  costSource(
    'omFractionPerYear',
    'Operations and maintenance',
    'of capex per year',
    'Typical 1–2% for PV and battery',
    '',
    '—',
    true,
  ),
  costSource('generatorMaintNgnPerYear', 'Generator maintenance', '₦/yr', '60 kVA servicing', '', '—', true),
  costSource('ngnPerUsd', 'Exchange rate', '₦/$', 'Q2 2026 rate, SurgePV', SURGEPV_URL, '2026', false),
  costSource(
    'feeFraction',
    'Monthly fee',
    "of today's spend",
    'Design choice; slider range 70–85%',
    '',
    '—',
    false,
  ),
  costSource(
    'contractYears',
    'Contract length',
    'years',
    'Design choice; LFP life is about 10 years',
    '',
    '—',
    false,
  ),
  costSource(
    'dieselLitresPerKwh',
    'Diesel use per kWh',
    'L/kWh',
    'Small generators at part load use 0.28–0.4',
    '',
    '—',
    true,
  ),
  costSource(
    'co2KgPerLitreDiesel',
    'Diesel CO₂ factor',
    'kg/L',
    'Standard diesel combustion factor (DEFRA/EPA)',
    '',
    '—',
    false,
  ),
  costSource(
    'gridCo2KgPerKwh',
    'Grid CO₂ factor',
    'kg/kWh',
    "Nigeria's gas-dominated grid, approximate",
    '',
    '—',
    true,
  ),
]

const SOLAR_SOURCES: Source[] = [
  {
    id: 'solar.nasaPower',
    label: 'Solar resource, Kano annual',
    value: SOLAR_SITES.Kano.pshAnnual,
    unit: 'kWh/m²/day',
    source:
      'NASA POWER Climatology API v2.10.1, ALLSKY_SFC_SW_DWN, averaged 2001–2025 at each state capital (Kano shown)',
    url: 'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=8.52&latitude=12.00&format=JSON',
    date: '2026-10-30',
    isEstimate: false,
  },
]

// Field-tested by SEforALL (July 2025, 15-day logging in Kisumu, Kenya).
const SEFORALL_REPORT = 'SEforALL, Medical appliances for resource-constrained settings, July 2025'
const FIELD_TESTED: Record<string, string> = {
  'Oxygen concentrator': `${SEFORALL_REPORT}. Tested at 477.5 W against a rated 880 W; modelled at 480 W, 0.8 duty`,
  'Infant warmer': `${SEFORALL_REPORT}. Rated 700–800 W, tested up to 1,090.1 W; modelled at 800 W, 0.5 duty`,
  Autoclave: `${SEFORALL_REPORT}. All American 75X rated 1,650 W; modelled at 1,650 W, 0.25 duty`,
}

const EQUIPMENT_SOURCES: Source[] = EQUIPMENT_LIBRARY.map((item) => {
  const id = `equip.${equipmentId(item.name)}`
  const label = `${item.name} rated power`
  const fieldTested = FIELD_TESTED[item.name]
  if (fieldTested !== undefined) {
    return {
      id,
      label,
      value: item.ratedW,
      unit: 'W',
      source: fieldTested,
      url: SEFORALL_URL,
      date: '2025-07',
      isEstimate: false,
    }
  }
  return {
    id,
    label,
    value: item.ratedW,
    unit: 'W',
    source: 'Typical manufacturer rating',
    url: '',
    date: '—',
    isEstimate: true,
  }
})

interface SiteNotes {
  label: string
  gridHours: string
  diesel: string
  generator: string
}

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset for sources: ${id}`)
  return preset
}

function siteSources(preset: HospitalProfile, notes: SiteNotes): Source[] {
  const base = { url: '', date: '—', isEstimate: true }
  return [
    {
      ...base,
      id: `site.${preset.id}.gridHoursPerDay`,
      label: `${notes.label} grid supply`,
      value: preset.gridHoursPerDay,
      unit: 'h/day',
      source: notes.gridHours,
    },
    {
      ...base,
      id: `site.${preset.id}.dieselLitresPerMonth`,
      label: `${notes.label} diesel budget`,
      value: preset.dieselLitresPerMonth,
      unit: 'L/month',
      source: notes.diesel,
    },
    {
      ...base,
      id: `site.${preset.id}.generatorKva`,
      label: `${notes.label} generator size`,
      value: preset.generatorKva,
      unit: 'kVA',
      source: notes.generator,
    },
  ]
}

const SITE_SOURCES: Source[] = [
  ...siteSources(presetById('kano-50'), {
    label: 'Kano hospital',
    gridHours: 'Planning estimate, inside the 8–20 hour outage band',
    diesel: "Planning estimate: a rationed budget, so today's generator runs dry",
    generator: 'Planning estimate',
  }),
  ...siteSources(presetById('phc'), {
    label: 'Primary health centre',
    gridHours: 'Planning estimate',
    diesel: 'Planning estimate',
    generator: 'Planning estimate',
  }),
]

const FACT_SOURCES: Source[] = [
  {
    id: 'stat.outageHours',
    label: 'Hospital grid outage, hours per day (upper end of 8 to 20)',
    value: 20,
    unit: 'h/day',
    source: 'Hackathon problem statement (hackathon.anneru.com)',
    url: 'https://hackathon.anneru.com',
    date: '—',
    isEstimate: false,
  },
  {
    id: 'stat.phcNoPower',
    label: 'Primary health centres with no electricity',
    value: 40,
    unit: '%',
    source: 'Nigeria Health Watch, citing a 2022 report',
    url: 'https://nigeriahealthwatch.com/articles/torchlight/a-solar-power-project-is-keeping-primary-healthcare-centres-running-in-abuja/',
    date: '2022',
    isEstimate: false,
  },
  {
    id: 'stat.whoSolar',
    label: 'Cut in service interruptions from solar at two Nigerian centres',
    value: 80,
    unit: '%',
    source: 'WHO AFRO',
    url: 'https://www.afro.who.int/pt/node/23032',
    date: '—',
    isEstimate: false,
  },
  {
    id: 'stat.kanoIcu',
    label: 'Aminu Kano Teaching Hospital outage linked to ICU deaths, followed by a solar project',
    value: 2025,
    unit: 'year',
    source: 'SolarQuarter',
    url: 'https://solarquarter.com/2025/09/20/nigerias-energy-commission-launches-7mw-solar-project-at-aminu-kano-teaching-hospital/',
    date: '2025-09-20',
    isEstimate: false,
  },
  {
    id: 'context.nphi',
    label: 'Nigeria Power for Health Initiative: an EaaS model for health facilities',
    value: 2025,
    unit: 'year',
    source: 'Guardian NG; Nairametrics, 2025-09-09',
    url: 'https://guardian.ng/?p=2861639',
    date: '2025-09-09',
    isEstimate: false,
  },
]

export const SOURCES: Source[] = [
  ...COST_SOURCES,
  ...SOLAR_SOURCES,
  ...EQUIPMENT_SOURCES,
  ...SITE_SOURCES,
  ...FACT_SOURCES,
]
