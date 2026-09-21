/**
 * pricing.ts
 *
 * Motor de cálculo de precios. Funciones puras, sin UI.
 *
 * NO EDITAR PRECIOS AQUÍ. Todos los números viven en pricing.config.ts
 * Este archivo solo contiene la lógica que los combina.
 */

import {
  ADDONS,
  BASE_PRICES,
  DEPOSIT_AMOUNT,
  FLOW_RULES,
  FREQUENCY_AVAILABLE_FOR,
  FREQUENCY_DISCOUNT,
  GLOBAL_MINIMUM,
  PET_SURCHARGE,
  SQFT_PRICING,
  SQFT_TIER_MIDPOINT,
  type AddonId,
  type CleaningLevel,
  type Frequency,
  type PetsOption,
  type ServiceType,
  type SizeTier,
  type SqftTier,
} from './pricing.config';

// ─────────────────────────────────────────────────────────────
// ENTRADA / SALIDA
// ─────────────────────────────────────────────────────────────

export interface BookingSelection {
  serviceType: ServiceType;
  sizeTier?: SizeTier;
  sqftTier?: SqftTier;
  cleaningLevel?: CleaningLevel;
  pets?: PetsOption;
  addons?: AddonId[];
  frequency?: Frequency;
}

export interface PriceBreakdown {
  basePrice: number;
  petSurcharge: number;
  addonTotal: number;
  addonDetail: { id: AddonId; price: number }[];
  subtotal: number;
  discountRate: number;
  discountAmount: number;
  total: number;
  minimumApplied: boolean;
  deposit: number;
  balanceDue: number;
}

// ─────────────────────────────────────────────────────────────
// PRECIO BASE
// ─────────────────────────────────────────────────────────────

function getBasePrice(sel: BookingSelection): number {
  const { serviceType, sizeTier, sqftTier, cleaningLevel } = sel;

  // Servicios por habitaciones
  if (FLOW_RULES.usesBedroomTiers.includes(serviceType)) {
    if (!sizeTier) return 0;

    if (serviceType === 'residencial') {
      const level = cleaningLevel ?? 'estandar';
      return BASE_PRICES[`residencial_${level}`][sizeTier];
    }

    return BASE_PRICES[serviceType][sizeTier];
  }

  // Servicios por pie cuadrado
  if (!sqftTier) return 0;
  const sqft = SQFT_TIER_MIDPOINT[sqftTier];

  if (serviceType === 'comercial') {
    const level = cleaningLevel ?? 'estandar';
    const rate = SQFT_PRICING.comercial[level];
    return Math.max(sqft * rate, SQFT_PRICING.comercial.minimum);
  }

  if (serviceType === 'postconstruccion') {
    const rate = SQFT_PRICING.postconstruccion.rate;
    return Math.max(sqft * rate, SQFT_PRICING.postconstruccion.minimum);
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────
// ADD-ONS
// ─────────────────────────────────────────────────────────────

/** Add-ons disponibles para un tipo de servicio (para renderizar el paso 6) */
export function getAvailableAddons(serviceType: ServiceType) {
  return ADDONS.filter((a) => a.availableFor.includes(serviceType));
}

function getAddonDetail(serviceType: ServiceType, selected: AddonId[] = []) {
  const available = getAvailableAddons(serviceType);
  const seenGroups = new Set<string>();

  return selected.reduce<{ id: AddonId; price: number }[]>((acc, id) => {
    const addon = available.find((a) => a.id === id);
    if (!addon) return acc;

    // Respetar grupos excluyentes (ej. solo una opción de organización)
    if (addon.exclusiveGroup) {
      if (seenGroups.has(addon.exclusiveGroup)) return acc;
      seenGroups.add(addon.exclusiveGroup);
    }

    acc.push({ id: addon.id, price: addon.price });
    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────
// CÁLCULO PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function calculatePrice(sel: BookingSelection): PriceBreakdown {
  const basePrice = getBasePrice(sel);

  const petSurcharge = FLOW_RULES.asksAboutPets.includes(sel.serviceType)
    ? PET_SURCHARGE[sel.pets ?? 'none']
    : 0;

  const addonDetail = getAddonDetail(sel.serviceType, sel.addons);
  const addonTotal = addonDetail.reduce((sum, a) => sum + a.price, 0);

  const subtotal = basePrice + petSurcharge + addonTotal;

  const frequencyAllowed = FREQUENCY_AVAILABLE_FOR.includes(sel.serviceType);
  const discountRate = frequencyAllowed
    ? FREQUENCY_DISCOUNT[sel.frequency ?? 'once']
    : 0;

  const discountAmount = subtotal * discountRate;
  const afterDiscount = subtotal - discountAmount;

  const total = Math.max(afterDiscount, GLOBAL_MINIMUM);
  const minimumApplied = afterDiscount < GLOBAL_MINIMUM;

  return {
    basePrice: round(basePrice),
    petSurcharge: round(petSurcharge),
    addonTotal: round(addonTotal),
    addonDetail,
    subtotal: round(subtotal),
    discountRate,
    discountAmount: round(discountAmount),
    total: round(total),
    minimumApplied,
    deposit: DEPOSIT_AMOUNT,
    balanceDue: round(total - DEPOSIT_AMOUNT),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────
// PASOS DEL FLUJO
// ─────────────────────────────────────────────────────────────

export type StepId =
  | 'service'
  | 'size'
  | 'rooms'
  | 'level'
  | 'pets'
  | 'addons'
  | 'frequency'
  | 'schedule'
  | 'contact'
  | 'payment';

/**
 * Devuelve los pasos que aplican a un tipo de servicio.
 * La UI usa esto para saber cuántos pasos mostrar ("Paso 3 de 8")
 * y cuál sigue después de cada uno.
 */
export function getStepsFor(serviceType: ServiceType): StepId[] {
  const steps: StepId[] = ['service', 'size'];

  if (FLOW_RULES.asksRoomCounts.includes(serviceType)) steps.push('rooms');
  if (FLOW_RULES.hasCleaningLevel.includes(serviceType)) steps.push('level');
  if (FLOW_RULES.asksAboutPets.includes(serviceType)) steps.push('pets');

  steps.push('addons');

  if (FREQUENCY_AVAILABLE_FOR.includes(serviceType)) steps.push('frequency');

  steps.push('schedule', 'contact', 'payment');
  return steps;
}
