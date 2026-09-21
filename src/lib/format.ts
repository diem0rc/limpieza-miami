/**
 * Miami es bilingüe pero la moneda y las fechas son las mismas en ambos
 * idiomas, así que solo cambia el locale de formato.
 */
function intlLocale(locale: string) {
  return locale === "es" ? "es-US" : "en-US";
}

/** $245 — sin decimales cuando el monto es entero. */
export function formatMoney(amount: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** 8 → "8 AM" */
export function formatHour(hour24: number, locale: string): string {
  const date = new Date(2000, 0, 1, hour24, 0, 0);
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "numeric",
    hour12: true,
  }).format(date);
}

/** "sáb, 14 sep" */
export function formatDateShort(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "sábado, 14 de septiembre" */
export function formatDateLong(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Inverso de `dateKey`: interpreta `YYYY-MM-DD` en hora local, no en UTC. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Clave estable `YYYY-MM-DD` en hora local (no UTC, para no correr el día). */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
