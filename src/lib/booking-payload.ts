import {
  ADDONS,
  BOOKING_POLICY,
  FLOW_RULES,
  FREQUENCY_AVAILABLE_FOR,
  type AddonId,
} from "@/config/pricing.config";
import { calculatePrice, type BookingSelection, type PriceBreakdown } from "@/config/pricing";
import {
  CLEANING_LEVELS,
  FREQUENCIES,
  PETS_OPTIONS,
  SERVICE_TYPES,
  SIZE_TIERS,
  SQFT_TIERS,
} from "@/lib/booking-options";
import { isContactValid, type ContactInfo } from "@/lib/contact";
import { businessSlotInstant } from "@/lib/timezone";

/**
 * Todo lo que llega del navegador es sospechoso. Este módulo lo valida contra
 * las mismas reglas que usa la UI y devuelve una reserva normalizada junto con
 * el precio RECALCULADO EN EL SERVIDOR — el importe que envía el cliente nunca
 * se usa para cobrar.
 */

export type BookingPayloadError =
  | "invalidSelection"
  | "invalidSchedule"
  | "invalidContact";

export interface ParsedBooking {
  selection: BookingSelection;
  price: PriceBreakdown;
  bedrooms: number;
  fullBaths: number;
  halfBaths: number;
  date: string;
  time: string;
  contact: ContactInfo;
  locale: "es" | "en";
}

type Result =
  | { ok: true; value: ParsedBooking }
  | { ok: false; error: BookingPayloadError };

const ADDON_IDS = new Set<string>(ADDONS.map((a) => a.id));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{2}):00$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const counter = (v: unknown, max: number): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : 0;

export function parseBookingPayload(raw: unknown): Result {
  if (!isRecord(raw)) return { ok: false, error: "invalidSelection" };

  // ── Servicio y tamaño ────────────────────────────────────────────
  const serviceType = SERVICE_TYPES.find((s) => s === raw.serviceType);
  if (!serviceType) return { ok: false, error: "invalidSelection" };

  const usesBedrooms = FLOW_RULES.usesBedroomTiers.includes(serviceType);
  const sizeTier = SIZE_TIERS.find((s) => s === raw.sizeTier);
  const sqftTier = SQFT_TIERS.find((s) => s === raw.sqftTier);

  if (usesBedrooms && !sizeTier) return { ok: false, error: "invalidSelection" };
  if (!usesBedrooms && !sqftTier) return { ok: false, error: "invalidSelection" };

  // ── Campos condicionales: deben existir si el flujo los pregunta ──
  const hasLevel = FLOW_RULES.hasCleaningLevel.includes(serviceType);
  const cleaningLevel = CLEANING_LEVELS.find((l) => l === raw.cleaningLevel);
  if (hasLevel && !cleaningLevel) return { ok: false, error: "invalidSelection" };

  const asksPets = FLOW_RULES.asksAboutPets.includes(serviceType);
  const pets = PETS_OPTIONS.find((p) => p === raw.pets);
  if (asksPets && !pets) return { ok: false, error: "invalidSelection" };

  const allowsFrequency = FREQUENCY_AVAILABLE_FOR.includes(serviceType);
  const frequency = FREQUENCIES.find((f) => f === raw.frequency);
  if (allowsFrequency && !frequency) {
    return { ok: false, error: "invalidSelection" };
  }

  const addons = Array.isArray(raw.addons)
    ? (raw.addons.filter(
        (a): a is AddonId => typeof a === "string" && ADDON_IDS.has(a),
      ) as AddonId[])
    : [];

  // Solo se pasan al motor los campos que este servicio admite: así un cliente
  // manipulado no puede colar, por ejemplo, un descuento por frecuencia en un
  // servicio que no lo ofrece.
  const selection: BookingSelection = {
    serviceType,
    sizeTier: usesBedrooms ? sizeTier : undefined,
    sqftTier: usesBedrooms ? undefined : sqftTier,
    cleaningLevel: hasLevel ? cleaningLevel : undefined,
    pets: asksPets ? pets : undefined,
    addons,
    frequency: allowsFrequency ? frequency : undefined,
  };

  // ── Horario ──────────────────────────────────────────────────────
  const date = str(raw.date);
  const time = str(raw.time);
  const timeMatch = TIME_RE.exec(time);
  if (!DATE_RE.test(date) || !timeMatch) {
    return { ok: false, error: "invalidSchedule" };
  }

  const hour = Number(timeMatch[1]);
  const { operatingHours, minimumNoticeHours } = BOOKING_POLICY;
  if (hour < operatingHours.start || hour >= operatingHours.end) {
    return { ok: false, error: "invalidSchedule" };
  }

  // El hueco se interpreta en la zona del negocio, no en la del servidor.
  const slot = businessSlotInstant(date, hour);
  if (!Number.isFinite(slot)) return { ok: false, error: "invalidSchedule" };
  if (slot < Date.now() + minimumNoticeHours * 60 * 60 * 1000) {
    return { ok: false, error: "invalidSchedule" };
  }

  // ── Contacto ─────────────────────────────────────────────────────
  const rawContact = isRecord(raw.contact) ? raw.contact : {};
  const contact: ContactInfo = {
    name: str(rawContact.name).trim().slice(0, 120),
    phone: str(rawContact.phone).trim().slice(0, 40),
    email: str(rawContact.email).trim().slice(0, 200),
    address: str(rawContact.address).trim().slice(0, 300),
    notes: str(rawContact.notes).trim().slice(0, 480),
  };
  if (!isContactValid(contact)) return { ok: false, error: "invalidContact" };

  return {
    ok: true,
    value: {
      selection,
      price: calculatePrice(selection),
      bedrooms: counter(raw.bedrooms, 10),
      fullBaths: counter(raw.fullBaths, 10),
      halfBaths: counter(raw.halfBaths, 5),
      date,
      time,
      contact,
      locale: raw.locale === "en" ? "en" : "es",
    },
  };
}
