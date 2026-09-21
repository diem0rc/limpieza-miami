import type {
  CleaningLevel,
  Frequency,
  PetsOption,
  ServiceType,
  SizeTier,
  SqftTier,
} from "@/config/pricing.config";

/**
 * Listas canónicas de valores, en el orden en que se muestran.
 *
 * Se declaran como `Record<Tipo, true>` a propósito: si algún día
 * pricing.config.ts añade un servicio o un tramo y aquí se olvida, TypeScript
 * falla en vez de dejar una opción invisible en la UI o un valor que el
 * servidor rechazaría.
 *
 * El servidor las usa además para validar lo que llega del navegador antes de
 * cobrar nada.
 */

function keysOf<T extends string>(map: Record<T, true>): T[] {
  return Object.keys(map) as T[];
}

export const SERVICE_TYPES = keysOf<ServiceType>({
  residencial: true,
  airbnb: true,
  mudanza: true,
  comercial: true,
  postconstruccion: true,
});

export const SIZE_TIERS = keysOf<SizeTier>({
  studio_1: true,
  hab_2: true,
  hab_3: true,
  hab_4: true,
  hab_5: true,
});

export const SQFT_TIERS = keysOf<SqftTier>({
  sqft_0_1500: true,
  sqft_1501_3000: true,
  sqft_3001_5000: true,
  sqft_5000_plus: true,
});

export const CLEANING_LEVELS = keysOf<CleaningLevel>({
  estandar: true,
  profunda: true,
});

export const PETS_OPTIONS = keysOf<PetsOption>({
  none: true,
  one: true,
  multiple: true,
});

export const FREQUENCIES = keysOf<Frequency>({
  once: true,
  weekly: true,
  biweekly: true,
  monthly: true,
});
