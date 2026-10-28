/**
 * pricing.config.ts
 *
 * ÚNICA FUENTE DE VERDAD PARA TODOS LOS PRECIOS.
 *
 * Para cambiar cualquier precio, edita SOLO este archivo.
 * Ningún componente de UI debe contener números de precio.
 *
 * Todos los valores están en dólares (USD).
 */

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type ServiceType =
  | 'residencial'
  | 'airbnb'
  | 'mudanza'
  | 'comercial'
  | 'postconstruccion';

export type SizeTier = 'studio_1' | 'hab_2' | 'hab_3' | 'hab_4' | 'hab_5';

export type SqftTier = 'sqft_0_1500' | 'sqft_1501_3000' | 'sqft_3001_5000' | 'sqft_5000_plus';

export type CleaningLevel = 'estandar' | 'profunda';

export type PetsOption = 'none' | 'one' | 'multiple';

export type Frequency = 'once' | 'weekly' | 'biweekly' | 'monthly';

export type AddonId =
  | 'refrigerador'
  | 'horno'
  | 'ventanas'
  | 'lavanderia'
  | 'gabinetes'
  | 'zocalos'
  | 'organizacion_1h'
  | 'organizacion_2h'
  | 'organizacion_3h'
  | 'sabanas'
  | 'amenities';

// ─────────────────────────────────────────────────────────────
// REGLAS GLOBALES
// ─────────────────────────────────────────────────────────────

export const GLOBAL_MINIMUM = 90;    // ningún trabajo baja de aquí
export const DEPOSIT_AMOUNT = 0;     // no se cobra nada al reservar

// ─────────────────────────────────────────────────────────────
// PRECIOS BASE — RESIDENCIAL / AIRBNB / MUDANZA
// ─────────────────────────────────────────────────────────────

export const BASE_PRICES: Record<string, Record<SizeTier, number>> = {
  // Residencial, limpieza estándar
  residencial_estandar: {
    studio_1: 165,
    hab_2: 195,
    hab_3: 255,
    hab_4: 325,
    hab_5: 395,
  },

  // Residencial, limpieza profunda
  residencial_profunda: {
    studio_1: 215,
    hab_2: 260,
    hab_3: 335,
    hab_4: 420,
    hab_5: 510,
  },

  // Mudanza (entrada/salida) — siempre profunda, sin nivel a elegir
  mudanza: {
    studio_1: 225,
    hab_2: 290,
    hab_3: 375,
    hab_4: 480,
    hab_5: 585,
  },

  // Airbnb — rotación entre huéspedes
  airbnb: {
    studio_1: 120,
    hab_2: 145,
    hab_3: 185,
    hab_4: 230,
    hab_5: 275,
  },
};

// ─────────────────────────────────────────────────────────────
// PRECIOS POR PIE CUADRADO — COMERCIAL / POST-CONSTRUCCIÓN
// ─────────────────────────────────────────────────────────────

export const SQFT_PRICING = {
  comercial: {
    estandar: 0.15,   // por sqft
    profunda: 0.22,   // por sqft
    minimum: 200,
  },
  postconstruccion: {
    rate: 0.35,       // por sqft (siempre profunda)
    minimum: 350,
  },
};

/** Punto medio usado para calcular el precio de cada tramo de sqft */
export const SQFT_TIER_MIDPOINT: Record<SqftTier, number> = {
  sqft_0_1500: 1000,
  sqft_1501_3000: 2250,
  sqft_3001_5000: 4000,
  sqft_5000_plus: 6000,
};

// ─────────────────────────────────────────────────────────────
// RECARGO POR MASCOTAS
// ─────────────────────────────────────────────────────────────

export const PET_SURCHARGE: Record<PetsOption, number> = {
  none: 0,
  one: 25,
  multiple: 40,
};

// ─────────────────────────────────────────────────────────────
// SERVICIOS ADICIONALES
// ─────────────────────────────────────────────────────────────

export interface Addon {
  id: AddonId;
  price: number;
  /** En qué tipos de servicio se ofrece este add-on */
  availableFor: ServiceType[];
  /** Grupo excluyente: solo se puede elegir uno del mismo grupo */
  exclusiveGroup?: string;
}

export const ADDONS: Addon[] = [
  {
    id: 'refrigerador',
    price: 35,
    availableFor: ['residencial', 'mudanza', 'airbnb'],
  },
  {
    id: 'horno',
    price: 35,
    availableFor: ['residencial', 'mudanza', 'airbnb'],
  },
  {
    id: 'ventanas',
    price: 28,
    availableFor: ['residencial', 'mudanza', 'airbnb', 'comercial', 'postconstruccion'],
  },
  {
    id: 'lavanderia',
    price: 30,
    availableFor: ['residencial', 'airbnb'],
  },
  {
    id: 'gabinetes',
    price: 35,
    availableFor: ['residencial', 'mudanza'],
  },
  {
    id: 'zocalos',
    price: 40,
    availableFor: ['residencial', 'comercial'],
  },
  {
    id: 'organizacion_1h',
    price: 30,
    availableFor: ['residencial'],
    exclusiveGroup: 'organizacion',
  },
  {
    id: 'organizacion_2h',
    price: 60,
    availableFor: ['residencial'],
    exclusiveGroup: 'organizacion',
  },
  {
    id: 'organizacion_3h',
    price: 90,
    availableFor: ['residencial'],
    exclusiveGroup: 'organizacion',
  },
  {
    id: 'sabanas',
    price: 15,
    availableFor: ['airbnb'],
  },
  {
    id: 'amenities',
    price: 20,
    availableFor: ['airbnb'],
  },
];

// ─────────────────────────────────────────────────────────────
// DESCUENTOS POR FRECUENCIA
// ─────────────────────────────────────────────────────────────

// La escalera tiene que premiar al cliente recurrente: cada frecuencia más
// seguida descuenta más que la siguiente, y todas descuentan más que "una
// sola vez". Antes no era así (once y weekly empataban en 20%, y quincenal y
// mensual daban MENOS que no comprometerse a nada), así que comprometerse
// salía más caro.
export const FREQUENCY_DISCOUNT: Record<Frequency, number> = {
  // Promoción de lanzamiento. Cuando termine, este valor baja a 0 y la
  // escalera de abajo sigue funcionando sola. Ojo: la insignia "-20%" del
  // hero anuncia justamente este número (ver PrimaryCtaWithDiscount.tsx y
  // la clave `discountBadge`), así que si se toca, hay que tocar las dos.
  once: 0.20,       // −20%
  weekly: 0.25,     // −25%
  biweekly: 0.20,   // −20%
  monthly: 0.15,    // −15%
};

/** Frecuencia recurrente solo disponible en estos servicios */
export const FREQUENCY_AVAILABLE_FOR: ServiceType[] = [
  'residencial',
  'airbnb',
  'comercial',
];

// ─────────────────────────────────────────────────────────────
// REGLAS DE FLUJO (qué pasos aplican a qué servicio)
// ─────────────────────────────────────────────────────────────

export const FLOW_RULES = {
  /** Servicios que usan habitaciones; el resto usa sqft */
  usesBedroomTiers: ['residencial', 'airbnb', 'mudanza'] as ServiceType[],

  /** Servicios donde el cliente elige estándar vs. profunda */
  hasCleaningLevel: ['residencial', 'comercial'] as ServiceType[],

  /** Servicios que preguntan por mascotas */
  asksAboutPets: ['residencial', 'airbnb', 'mudanza'] as ServiceType[],

  /** Servicios que preguntan habitaciones y baños con contadores */
  asksRoomCounts: ['residencial', 'airbnb', 'mudanza'] as ServiceType[],
};

// ─────────────────────────────────────────────────────────────
// POLÍTICA DE RESERVA Y CANCELACIÓN
// ─────────────────────────────────────────────────────────────

export const BOOKING_POLICY = {
  /** Horas mínimas de anticipación para reservar */
  minimumNoticeHours: 12,

  /** Reembolso completo si cancela con esta anticipación o más */
  fullRefundHoursBefore: 24,

  /** Reembolso completo si cancela dentro de esta ventana tras reservar */
  graceWindowMinutes: 60,

  /** Horario de servicio */
  operatingHours: { start: 8, end: 19 },  // 8 AM – 7 PM

  /** Se trabaja fines de semana */
  weekendsAvailable: true,
};
