/**
 * El negocio opera en Miami, pero el servidor (Vercel) corre en UTC. Si las
 * horas de `BOOKING_POLICY.operatingHours` se interpretaran con la zona del
 * servidor, la validación del margen mínimo de anticipación se desviaría entre
 * 4 y 5 horas según la época del año.
 *
 * Estas funciones convierten un hueco "8:00 en Miami" al instante real (UTC)
 * que le corresponde, respetando el horario de verano.
 */
export const BUSINESS_TIME_ZONE = "America/New_York";

/** Desfase de la zona respecto a UTC, en milisegundos, en un instante dado. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // `Intl` con hour12:false puede devolver 24 por medianoche.
  const hour = get("hour") % 24;

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );

  return asIfUtc - at.getTime();
}

/**
 * Instante (epoch ms) de un hueco `YYYY-MM-DD` + hora local del negocio.
 * Los huecos van de 8 a 18 h, lejos del salto de horario de verano (2 a.m.),
 * así que la corrección en dos pasos es exacta para este caso.
 */
export function businessSlotInstant(dateKey: string, hour: number): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour);
  const offset = zoneOffsetMs(BUSINESS_TIME_ZONE, new Date(naive));
  return naive - offset;
}
