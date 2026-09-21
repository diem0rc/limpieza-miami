/**
 * brand.config.ts
 *
 * ÚNICA FUENTE DE VERDAD PARA LA MARCA.
 *
 * Ningún componente debe tener colores hardcodeados ni el nombre escrito
 * directamente. Todo se lee desde aquí.
 */

// ─────────────────────────────────────────────────────────────
// IDENTIDAD
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  name: 'DiBasilio Maid',

  /** Tagline corto, aparece bajo el logo y en metadatos */
  tagline: {
    es: 'Velocidad y calidad',
    en: 'Speed and Quality',
  },

  domain: 'dibasiliomaid.com',

  /** Contacto. `email` es también a dónde llegan los avisos de reserva
   *  nueva y de pago recibido — ver src/lib/email.ts. */
  phone: '+1 (645) 251-4122',
  email: 'dibasiliomaid@gmail.com',

  /** Ruta del logo cuando exista; null muestra solo el nombre en texto */
  logoPath: '/logo.png' as string | null,

  city: 'Miami, FL',
};

// ─────────────────────────────────────────────────────────────
// PALETA — basada en el logo (celeste, terracota, gris, blanco)
// ─────────────────────────────────────────────────────────────

/**
 * Tema claro, derivado directamente del logo:
 * - Celeste (#A3D7F0) → superficies y fondos, transmite limpieza/frescura
 * - Terracota (#B84A2A) → acento principal, CTAs, precios, selección
 * - Gris → texto y bordes neutros
 * - Blanco → base
 */
export const COLORS = {
  // Superficies
  bg: '#FFFFFF',
  bgAlt: '#EFF8FC',        // celeste muy diluido, para secciones alternas
  surface: '#FFFFFF',      // tarjetas
  surfaceHover: '#E4F2FA', // hover sobre tarjetas, celeste suave

  // Bordes
  border: '#D7E8F0',       // borde sutil, celeste diluido
  borderStrong: '#A3D7F0', // borde marcado / estado seleccionado secundario

  // Acento (terracota del logo)
  accent: '#B84A2A',
  accentHover: '#9A3D22',
  accentSoft: '#F5DDD3',   // fondo suave para badges/destacados

  // Texto (gris, no negro puro — más cálido)
  text: '#2B2E30',
  textMuted: '#6B7378',
  textFaint: '#9AA1A6',

  // Estado
  success: '#4CAF6D',
  warning: '#E0A93A',
  error: '#C62828',

  // Promoción — insignia de descuento en el hero. Rojo puro a propósito:
  // el acento de marca (terracota) ya se usa para CTAs y precios, así que
  // esta insignia necesita su propio color para leerse como una oferta
  // aparte, no como parte del sistema de color habitual. No está en el
  // archivo de marca que llegó del cliente — se conserva de la paleta
  // anterior. Quitar cuando termine la promo.
  discount: '#e0342c',

  // Animación de intro (IntroAnimation.tsx) — el beige "sucio" de la capa
  // que se limpia al abrir el sitio por primera vez. Tampoco es parte de la
  // marca del cliente: es un color de efecto, no de identidad.
  grime: '#DDD4C8',

  // Texto sobre botones de acento
  onAccent: '#FFFFFF',

  // Texto sobre la insignia de descuento sólida (la que va pegada al botón
  // principal del hero) — mismo caso que `discount`: efecto puntual, no
  // identidad de marca.
  onDiscount: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────
// TIPOGRAFÍA
// ─────────────────────────────────────────────────────────────

export const TYPE = {
  fontFamily: 'var(--font-sans)',

  scale: {
    display: '3.5rem',
    h1: '2.5rem',
    h2: '1.875rem',
    h3: '1.375rem',
    body: '1rem',
    small: '0.875rem',
    tiny: '0.75rem',
  },

  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
};

// ─────────────────────────────────────────────────────────────
// FORMA Y ESPACIADO
// ─────────────────────────────────────────────────────────────

export const SHAPE = {
  radius: {
    sm: '0.5rem',
    md: '0.875rem',
    lg: '1.25rem',
    pill: '9999px',
  },

  cardMinHeight: '5.5rem',
  buttonHeight: '3.5rem',
};

// ─────────────────────────────────────────────────────────────
// EXPORTACIÓN A CSS VARIABLES
// ─────────────────────────────────────────────────────────────

export function cssVariables(): string {
  return Object.entries(COLORS)
    .map(([key, value]) => `--color-${kebab(key)}: ${value};`)
    .join('\n');
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
