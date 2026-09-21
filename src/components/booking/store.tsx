"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  ADDONS,
  FLOW_RULES,
  FREQUENCY_AVAILABLE_FOR,
  type AddonId,
  type CleaningLevel,
  type Frequency,
  type PetsOption,
  type ServiceType,
  type SizeTier,
  type SqftTier,
} from "@/config/pricing.config";
import {
  calculatePrice,
  getAvailableAddons,
  getStepsFor,
  type BookingSelection,
  type PriceBreakdown,
  type StepId,
} from "@/config/pricing";

import {
  EMPTY_CONTACT,
  contactErrors,
  isContactValid,
  type ContactInfo,
} from "@/lib/contact";

// La validación de contacto vive en `@/lib/contact` porque el servidor la
// repite antes de cobrar. Se re-exporta para que los pasos no tengan que
// saberlo.
export { contactErrors, isContactValid, type ContactInfo };

// ─────────────────────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────────────────────

export interface BookingState {
  serviceType?: ServiceType;
  sizeTier?: SizeTier;
  sqftTier?: SqftTier;
  /** Contadores informativos: no entran en el cálculo de precio. */
  bedrooms: number;
  fullBaths: number;
  halfBaths: number;
  cleaningLevel?: CleaningLevel;
  pets?: PetsOption;
  addons: AddonId[];
  frequency?: Frequency;
  /** `YYYY-MM-DD` en hora local. */
  date?: string;
  /** `HH:mm` en 24 h. */
  time?: string;
  contact: ContactInfo;
  stepIndex: number;
}

export type RoomField = "bedrooms" | "fullBaths" | "halfBaths";

const INITIAL_STATE: BookingState = {
  bedrooms: 1,
  fullBaths: 1,
  halfBaths: 0,
  addons: [],
  contact: EMPTY_CONTACT,
  stepIndex: 0,
};

/** Habitaciones implícitas en cada tramo, para precargar los contadores. */
const BEDROOMS_BY_TIER: Record<SizeTier, number> = {
  studio_1: 1,
  hab_2: 2,
  hab_3: 3,
  hab_4: 4,
  hab_5: 5,
};

export const ROOM_LIMITS: Record<RoomField, { min: number; max: number }> = {
  bedrooms: { min: 0, max: 10 },
  fullBaths: { min: 0, max: 10 },
  halfBaths: { min: 0, max: 5 },
};

// ─────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────

type Action =
  | { type: "setService"; value: ServiceType }
  | { type: "setSizeTier"; value: SizeTier }
  | { type: "setSqftTier"; value: SqftTier }
  | { type: "setRoom"; field: RoomField; delta: number }
  | { type: "setLevel"; value: CleaningLevel }
  | { type: "setPets"; value: PetsOption }
  | { type: "toggleAddon"; value: AddonId }
  | { type: "setFrequency"; value: Frequency }
  | { type: "setDate"; value: string }
  | { type: "setTime"; value: string }
  | { type: "setContactField"; field: keyof ContactInfo; value: string }
  | { type: "next" }
  | { type: "back" }
  | { type: "goToStep"; value: StepId };

/**
 * Al cambiar de servicio se limpia todo lo que ya no aplica: si pasas de
 * residencial a comercial, el tramo de habitaciones y la pregunta de mascotas
 * dejan de tener sentido y se descartan, y los adicionales se filtran a los
 * que el nuevo servicio sí ofrece.
 */
function applyServiceChange(
  state: BookingState,
  serviceType: ServiceType,
): BookingState {
  if (state.serviceType === serviceType) return state;

  const usesBedrooms = FLOW_RULES.usesBedroomTiers.includes(serviceType);
  const available = new Set(getAvailableAddons(serviceType).map((a) => a.id));

  return {
    ...state,
    serviceType,
    sizeTier: usesBedrooms ? state.sizeTier : undefined,
    sqftTier: usesBedrooms ? undefined : state.sqftTier,
    bedrooms: FLOW_RULES.asksRoomCounts.includes(serviceType)
      ? state.bedrooms
      : INITIAL_STATE.bedrooms,
    fullBaths: FLOW_RULES.asksRoomCounts.includes(serviceType)
      ? state.fullBaths
      : INITIAL_STATE.fullBaths,
    halfBaths: FLOW_RULES.asksRoomCounts.includes(serviceType)
      ? state.halfBaths
      : INITIAL_STATE.halfBaths,
    cleaningLevel: FLOW_RULES.hasCleaningLevel.includes(serviceType)
      ? state.cleaningLevel
      : undefined,
    pets: FLOW_RULES.asksAboutPets.includes(serviceType)
      ? state.pets
      : undefined,
    addons: state.addons.filter((id) => available.has(id)),
    frequency: FREQUENCY_AVAILABLE_FOR.includes(serviceType)
      ? state.frequency
      : undefined,
  };
}

/** Los grupos excluyentes (ej. organización) admiten una sola opción. */
function applyAddonToggle(state: BookingState, id: AddonId): BookingState {
  if (state.addons.includes(id)) {
    return { ...state, addons: state.addons.filter((a) => a !== id) };
  }

  const group = ADDONS.find((a) => a.id === id)?.exclusiveGroup;
  const kept = group
    ? state.addons.filter(
        (a) => ADDONS.find((x) => x.id === a)?.exclusiveGroup !== group,
      )
    : state.addons;

  return { ...state, addons: [...kept, id] };
}

function reducer(state: BookingState, action: Action): BookingState {
  switch (action.type) {
    case "setService":
      return applyServiceChange(state, action.value);

    case "setSizeTier":
      // Precargar los contadores con lo implícito en el tramo elegido.
      return {
        ...state,
        sizeTier: action.value,
        bedrooms: BEDROOMS_BY_TIER[action.value],
      };

    case "setSqftTier":
      return { ...state, sqftTier: action.value };

    case "setRoom": {
      const { min, max } = ROOM_LIMITS[action.field];
      const next = Math.min(max, Math.max(min, state[action.field] + action.delta));
      return { ...state, [action.field]: next };
    }

    case "setLevel":
      return { ...state, cleaningLevel: action.value };

    case "setPets":
      return { ...state, pets: action.value };

    case "toggleAddon":
      return applyAddonToggle(state, action.value);

    case "setFrequency":
      return { ...state, frequency: action.value };

    case "setDate":
      // Cambiar de día invalida la hora: puede no existir o quedar fuera del
      // margen mínimo de anticipación.
      return { ...state, date: action.value, time: undefined };

    case "setTime":
      return { ...state, time: action.value };

    case "setContactField":
      return {
        ...state,
        contact: { ...state.contact, [action.field]: action.value },
      };

    case "next": {
      const total = stepsOf(state).length;
      return { ...state, stepIndex: Math.min(state.stepIndex + 1, total - 1) };
    }

    case "back":
      return { ...state, stepIndex: Math.max(state.stepIndex - 1, 0) };

    case "goToStep": {
      const index = stepsOf(state).indexOf(action.value);
      return index === -1 ? state : { ...state, stepIndex: index };
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────
// DERIVADOS
// ─────────────────────────────────────────────────────────────

/**
 * Los pasos los decide el motor, no la UI. Antes de elegir servicio solo
 * existe el primero, por eso no se muestra un total todavía.
 */
function stepsOf(state: BookingState): StepId[] {
  return state.serviceType ? getStepsFor(state.serviceType) : ["service"];
}

/**
 * Exportada para que los pasos puedan recalcular el precio bajo una
 * selección hipotética (ej. FrequencyStep mostrando el precio de cada
 * frecuencia) sin reconstruir a mano la forma de `BookingSelection` ni
 * duplicar qué campos importan — la sola fuente de verdad sigue siendo
 * `calculatePrice()` en pricing.ts.
 */
export function selectionOf(state: BookingState): BookingSelection | null {
  if (!state.serviceType) return null;
  return {
    serviceType: state.serviceType,
    sizeTier: state.sizeTier,
    sqftTier: state.sqftTier,
    cleaningLevel: state.cleaningLevel,
    pets: state.pets,
    addons: state.addons,
    frequency: state.frequency,
  };
}

/** ¿Está respondido el paso actual? */
function canAdvanceFrom(step: StepId, state: BookingState): boolean {
  switch (step) {
    case "service":
      return Boolean(state.serviceType);
    case "size":
      return state.serviceType &&
        FLOW_RULES.usesBedroomTiers.includes(state.serviceType)
        ? Boolean(state.sizeTier)
        : Boolean(state.sqftTier);
    case "level":
      return Boolean(state.cleaningLevel);
    case "pets":
      return Boolean(state.pets);
    case "frequency":
      return Boolean(state.frequency);
    case "schedule":
      return Boolean(state.date && state.time);
    case "contact":
      return isContactValid(state.contact);
    // `rooms` trae valores por defecto y `addons` es opcional.
    case "rooms":
    case "addons":
    case "payment":
      return true;
  }
}

// ─────────────────────────────────────────────────────────────
// CONTEXTO
// ─────────────────────────────────────────────────────────────

interface BookingContextValue {
  state: BookingState;
  dispatch: Dispatch<Action>;
  steps: StepId[];
  step: StepId;
  /** 1-indexado, para "Paso 3 de 8". */
  stepNumber: number;
  totalSteps: number;
  /** Falso mientras no se elija servicio: aún no se sabe cuántos pasos hay. */
  totalKnown: boolean;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  price: PriceBreakdown | null;
  /** El precio se muestra desde el paso 2 en adelante. */
  showPrice: boolean;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const value = useMemo<BookingContextValue>(() => {
    const steps = stepsOf(state);
    const stepIndex = Math.min(state.stepIndex, steps.length - 1);
    const step = steps[stepIndex];
    const selection = selectionOf(state);

    return {
      state,
      dispatch,
      steps,
      step,
      stepNumber: stepIndex + 1,
      totalSteps: steps.length,
      totalKnown: Boolean(state.serviceType),
      isFirst: stepIndex === 0,
      isLast: stepIndex === steps.length - 1,
      canAdvance: canAdvanceFrom(step, state),
      price: selection ? calculatePrice(selection) : null,
      showPrice: stepIndex >= 1,
    };
  }, [state]);

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBooking debe usarse dentro de <BookingProvider>");
  }
  return ctx;
}
