import type { NigerianState, SolarSite } from '../engine/types'

// Peak sun hours per day (kWh/m²/day of ALLSKY_SFC_SW_DWN) at each state capital.
// Source: NASA POWER Climatology API v2.10.1, 2001–2025 average, pulled 2026-10-30.
// pshWorstMonth is the lowest monthly value; PV is sized against it.
// Reproduce a row (fill in the capital's lon and lat):
// https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON
export const SOLAR_SITES: Record<NigerianState, SolarSite> = {
  Abia: { state: 'Abia', capital: 'Umuahia', lat: 5.53, lon: 7.49, pshAnnual: 4.54, pshWorstMonth: 3.75, worstMonth: 'AUG' },
  Adamawa: { state: 'Adamawa', capital: 'Yola', lat: 9.21, lon: 12.48, pshAnnual: 5.73, pshWorstMonth: 4.73, worstMonth: 'AUG' },
  'Akwa Ibom': { state: 'Akwa Ibom', capital: 'Uyo', lat: 5.04, lon: 7.91, pshAnnual: 4.54, pshWorstMonth: 3.75, worstMonth: 'AUG' },
  Anambra: { state: 'Anambra', capital: 'Awka', lat: 6.21, lon: 7.07, pshAnnual: 4.72, pshWorstMonth: 3.91, worstMonth: 'AUG' },
  Bauchi: { state: 'Bauchi', capital: 'Bauchi', lat: 10.31, lon: 9.84, pshAnnual: 5.81, pshWorstMonth: 5.11, worstMonth: 'AUG' },
  Bayelsa: { state: 'Bayelsa', capital: 'Yenagoa', lat: 4.92, lon: 6.26, pshAnnual: 4.19, pshWorstMonth: 3.29, worstMonth: 'JUL' },
  Benue: { state: 'Benue', capital: 'Makurdi', lat: 7.73, lon: 8.54, pshAnnual: 5.04, pshWorstMonth: 4.08, worstMonth: 'AUG' },
  Borno: { state: 'Borno', capital: 'Maiduguri', lat: 11.85, lon: 13.16, pshAnnual: 5.96, pshWorstMonth: 5.08, worstMonth: 'AUG' },
  'Cross River': { state: 'Cross River', capital: 'Calabar', lat: 4.95, lon: 8.32, pshAnnual: 4.19, pshWorstMonth: 3.12, worstMonth: 'AUG' },
  Delta: { state: 'Delta', capital: 'Asaba', lat: 6.2, lon: 6.73, pshAnnual: 4.57, pshWorstMonth: 3.85, worstMonth: 'AUG' },
  Ebonyi: { state: 'Ebonyi', capital: 'Abakaliki', lat: 6.32, lon: 8.11, pshAnnual: 4.89, pshWorstMonth: 3.95, worstMonth: 'AUG' },
  Edo: { state: 'Edo', capital: 'Benin City', lat: 6.34, lon: 5.63, pshAnnual: 4.45, pshWorstMonth: 3.69, worstMonth: 'AUG' },
  Ekiti: { state: 'Ekiti', capital: 'Ado-Ekiti', lat: 7.62, lon: 5.22, pshAnnual: 4.72, pshWorstMonth: 3.82, worstMonth: 'AUG' },
  Enugu: { state: 'Enugu', capital: 'Enugu', lat: 6.46, lon: 7.55, pshAnnual: 4.72, pshWorstMonth: 3.91, worstMonth: 'AUG' },
  FCT: { state: 'FCT', capital: 'Abuja', lat: 9.08, lon: 7.4, pshAnnual: 5.29, pshWorstMonth: 4.08, worstMonth: 'AUG' },
  Gombe: { state: 'Gombe', capital: 'Gombe', lat: 10.29, lon: 11.17, pshAnnual: 5.83, pshWorstMonth: 4.93, worstMonth: 'AUG' },
  Imo: { state: 'Imo', capital: 'Owerri', lat: 5.48, lon: 7.03, pshAnnual: 4.54, pshWorstMonth: 3.75, worstMonth: 'AUG' },
  Jigawa: { state: 'Jigawa', capital: 'Dutse', lat: 11.76, lon: 9.34, pshAnnual: 5.86, pshWorstMonth: 5.35, worstMonth: 'AUG' },
  Kaduna: { state: 'Kaduna', capital: 'Kaduna', lat: 10.52, lon: 7.44, pshAnnual: 5.63, pshWorstMonth: 4.56, worstMonth: 'AUG' },
  Kano: { state: 'Kano', capital: 'Kano', lat: 12, lon: 8.52, pshAnnual: 6, pshWorstMonth: 5.5, worstMonth: 'DEC' },
  Katsina: { state: 'Katsina', capital: 'Katsina', lat: 12.99, lon: 7.6, pshAnnual: 5.89, pshWorstMonth: 5.36, worstMonth: 'AUG' },
  Kebbi: { state: 'Kebbi', capital: 'Birnin Kebbi', lat: 12.45, lon: 4.2, pshAnnual: 5.81, pshWorstMonth: 5.25, worstMonth: 'AUG' },
  Kogi: { state: 'Kogi', capital: 'Lokoja', lat: 7.8, lon: 6.74, pshAnnual: 4.86, pshWorstMonth: 4.1, worstMonth: 'AUG' },
  Kwara: { state: 'Kwara', capital: 'Ilorin', lat: 8.5, lon: 4.55, pshAnnual: 5.03, pshWorstMonth: 3.98, worstMonth: 'AUG' },
  Lagos: { state: 'Lagos', capital: 'Ikeja', lat: 6.6, lon: 3.35, pshAnnual: 4.59, pshWorstMonth: 3.82, worstMonth: 'JUL' },
  Nasarawa: { state: 'Nasarawa', capital: 'Lafia', lat: 8.49, lon: 8.52, pshAnnual: 5.24, pshWorstMonth: 4.2, worstMonth: 'AUG' },
  Niger: { state: 'Niger', capital: 'Minna', lat: 9.61, lon: 6.56, pshAnnual: 5.23, pshWorstMonth: 4.14, worstMonth: 'AUG' },
  Ogun: { state: 'Ogun', capital: 'Abeokuta', lat: 7.16, lon: 3.35, pshAnnual: 4.63, pshWorstMonth: 3.58, worstMonth: 'AUG' },
  Ondo: { state: 'Ondo', capital: 'Akure', lat: 7.25, lon: 5.19, pshAnnual: 4.72, pshWorstMonth: 3.82, worstMonth: 'AUG' },
  Osun: { state: 'Osun', capital: 'Osogbo', lat: 7.77, lon: 4.56, pshAnnual: 4.58, pshWorstMonth: 3.53, worstMonth: 'AUG' },
  Oyo: { state: 'Oyo', capital: 'Ibadan', lat: 7.38, lon: 3.95, pshAnnual: 4.63, pshWorstMonth: 3.58, worstMonth: 'AUG' },
  Plateau: { state: 'Plateau', capital: 'Jos', lat: 9.9, lon: 8.86, pshAnnual: 5.33, pshWorstMonth: 4.13, worstMonth: 'AUG' },
  Rivers: { state: 'Rivers', capital: 'Port Harcourt', lat: 4.82, lon: 7.03, pshAnnual: 4.12, pshWorstMonth: 3.2, worstMonth: 'JUL' },
  Sokoto: { state: 'Sokoto', capital: 'Sokoto', lat: 13.06, lon: 5.24, pshAnnual: 5.99, pshWorstMonth: 5.5, worstMonth: 'DEC' },
  Taraba: { state: 'Taraba', capital: 'Jalingo', lat: 8.89, lon: 11.36, pshAnnual: 5.42, pshWorstMonth: 4.26, worstMonth: 'AUG' },
  Yobe: { state: 'Yobe', capital: 'Damaturu', lat: 11.75, lon: 11.96, pshAnnual: 5.97, pshWorstMonth: 5.3, worstMonth: 'AUG' },
  Zamfara: { state: 'Zamfara', capital: 'Gusau', lat: 12.16, lon: 6.66, pshAnnual: 5.85, pshWorstMonth: 5.26, worstMonth: 'AUG' },
}
