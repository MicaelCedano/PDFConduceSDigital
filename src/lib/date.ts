// Helpers de zona horaria — America/Santo_Domingo (UTC-4, sin DST).
// Vercel corre en UTC, sin esto el día cambia a las 8pm RD.

const TZ = "America/Santo_Domingo";

/** "2026-06-18" — fecha de hoy en RD (formato ISO YYYY-MM-DD) */
export function todayRD(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** "2026-06-18T14:30:00" — hora local RD para guardar en DB */
export function nowRD(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T");
}
