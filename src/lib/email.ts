import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { BRAND } from "@/config/brand.config";
import { FLOW_RULES } from "@/config/pricing.config";
import type { ParsedBooking } from "@/lib/booking-payload";

/**
 * Correos transaccionales: avisos internos al negocio Y, desde esta fase, los
 * tres correos automáticos al cliente que pide el flujo (reserva confirmada,
 * link de pago, recibo). `null` si no hay `RESEND_API_KEY` — el envío se
 * omite sin romper nada; un correo nunca debe poder tumbar una reserva, la
 * generación de un link o un webhook.
 */
let client: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

// Dominio propio verificado en Resend (dibasiliomaid.com, activado en esta
// fase) — antes de esto solo se podía enviar desde el remitente de pruebas
// de Resend, y solo a la misma dirección con la que se creó la cuenta, así
// que los 3 correos al cliente nunca le llegaban de verdad. Si algún día el
// dominio deja de estar verificado (dominio vencido, DNS movido), Resend
// vuelve a rechazar el envío a cualquier dirección que no sea BRAND.email —
// eso se ve como un error de Resend en los logs, no como un bug de código.
const FROM = "DiBasilio Maid <reservas@dibasiliomaid.com>";

/**
 * Envía sin lanzar: un fallo de correo (sin API key, límite de Resend,
 * dirección no verificada) nunca debe convertirse en un 500 para quien está
 * reservando o pagando, ni en que el webhook dé el pago por no procesado.
 */
async function sendSafely(to: string, subject: string, text: string) {
  const resend = getResend();
  if (!resend) {
    console.info(`[email] RESEND_API_KEY no configurada — se omite: ${subject}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, text });
    if (error) console.error(`[email] Resend rechazó el envío a ${to}:`, error);
  } catch (error) {
    console.error(`[email] no se pudo enviar a ${to}:`, error);
  }
}

/**
 * Reconstruye las mismas etiquetas legibles que ya usan `/admin/reservas` y
 * el resumen del configurador, tomándolas de los archivos de traducción en
 * vez de duplicarlas. `locale` decide en qué idioma: los correos al negocio
 * siempre se piden en español (el equipo lee español sin importar en qué
 * idioma reservó el cliente); los correos al cliente van en el idioma en que
 * reservó (`booking.locale`, guardado en la fila de `bookings`).
 */
async function describeBooking(
  booking: ParsedBooking,
  when: string,
  locale: "es" | "en",
): Promise<string> {
  const { selection, price, contact } = booking;

  const [tServices, tSizes, tSqft, tLevel, tPets, tFreq, tAddons, tLabels] =
    await Promise.all([
      getTranslations({ locale, namespace: "services.items" }),
      getTranslations({ locale, namespace: "sizeTiers" }),
      getTranslations({ locale, namespace: "sqftTiers" }),
      getTranslations({ locale, namespace: "booking.level" }),
      getTranslations({ locale, namespace: "booking.pets" }),
      getTranslations({ locale, namespace: "booking.frequency" }),
      getTranslations({ locale, namespace: "addons" }),
      getTranslations({ locale, namespace: "booking.payment" }),
    ]);

  // "Adicionales"/"Frecuencia" no tienen una etiqueta corta reutilizable en
  // los mensajes (sus namespaces solo traen títulos de pregunta, ej. "¿Cada
  // cuánto lo necesitas?"), así que van con un diccionario propio y chico,
  // igual de puntual que el resto de estas etiquetas de correo.
  const frequencyLabel = { es: "Frecuencia", en: "Frequency" }[locale];
  const addonsLabel = { es: "Adicionales", en: "Add-ons" }[locale];

  const lines = [
    `${tLabels("service")}: ${tServices(`${selection.serviceType}.name`)}`,
    selection.sizeTier
      ? `${tLabels("size")}: ${tSizes(selection.sizeTier)}`
      : selection.sqftTier
        ? `${tLabels("size")}: ${tSqft(selection.sqftTier)}`
        : null,
    selection.cleaningLevel
      ? `${tLabels("level")}: ${tLevel(`${selection.cleaningLevel}.name`)}`
      : null,
    FLOW_RULES.asksRoomCounts.includes(selection.serviceType)
      ? `${tLabels("rooms")}: ${tLabels("roomsValue", {
          bedrooms: booking.bedrooms,
          fullBaths: booking.fullBaths,
          halfBaths: booking.halfBaths,
        })}`
      : null,
    selection.pets ? `${tLabels("pets")}: ${tPets(selection.pets)}` : null,
    selection.frequency ? `${frequencyLabel}: ${tFreq(selection.frequency)}` : null,
    price.addonDetail.length
      ? `${addonsLabel}: ${price.addonDetail.map((a) => tAddons(`${a.id}.name`)).join(", ")}`
      : null,
    "",
    `${tLabels("when")}: ${when}`,
    `${tLabels("where")}: ${contact.address}`,
    "",
    `${tLabels("total")}: $${price.total.toFixed(2)}`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

/**
 * La invitación a reseñar, en una sola frase y en un solo lugar.
 *
 * Está centralizada a propósito: la usan el correo de pedido de reseña y el
 * recibo de pago, y la regla 2 de reseñas exige que el texto sea idéntico
 * para todos los clientes. Si viviera copiado en dos funciones, un cambio en
 * una de ellas rompería esa garantía sin que nadie lo notara.
 *
 * Tampoco menciona ningún beneficio por reseñar — regla 3, sin incentivos.
 */
function reviewLine(url: string, locale: "es" | "en"): string {
  return {
    es: `¿Cómo te fue? Cuéntanos en un minuto: ${url}`,
    en: `How did it go? Tell us in a minute: ${url}`,
  }[locale];
}

/** `/api/bookings` la llama justo después de guardar la reserva. Al negocio. */
export async function sendNewBookingEmail(booking: ParsedBooking, when: string) {
  const body = await describeBooking(booking, when, "es");
  await sendSafely(
    BRAND.email,
    `Nueva reserva — ${booking.contact.name} · ${when}`,
    [
      `Reserva nueva, sin cobrar todavía. Márcala como completada y genera`,
      `el link de pago desde /admin/reservas cuando el servicio esté hecho.`,
      "",
      `Cliente: ${booking.contact.name}`,
      `Teléfono: ${booking.contact.phone}`,
      `Correo: ${booking.contact.email}`,
      booking.contact.notes ? `Notas: ${booking.contact.notes}` : null,
      "",
      body,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  );
}

/** `/api/bookings` la llama justo después de guardar la reserva. Al cliente. */
export async function sendBookingConfirmedEmail(booking: ParsedBooking, when: string) {
  const { locale, contact } = booking;
  const body = await describeBooking(booking, when, locale);

  const t = {
    es: {
      subject: `Reserva confirmada — ${BRAND.name}`,
      intro: `Hola ${contact.name}, tu reserva quedó confirmada. Este es el resumen:`,
      notice:
        "No se cobra nada ahora. Cuando el servicio esté hecho te enviaremos un link para pagar el total.",
      closing: `Cualquier pregunta, respóndenos a ${BRAND.email} o llámanos al ${BRAND.phone}.`,
    },
    en: {
      subject: `Booking confirmed — ${BRAND.name}`,
      intro: `Hi ${contact.name}, your booking is confirmed. Here's the summary:`,
      notice:
        "Nothing is charged now. Once the service is done, we'll send you a link to pay the full amount.",
      closing: `Questions? Reply to ${BRAND.email} or call us at ${BRAND.phone}.`,
    },
  }[locale];

  await sendSafely(
    contact.email,
    t.subject,
    [t.intro, "", body, "", t.notice, "", t.closing].join("\n"),
  );
}

/** `/api/admin/payment-link` la llama justo después de generar el link. Al cliente. */
export async function sendPaymentLinkEmail(params: {
  cliente: string;
  email: string;
  servicio: string;
  cuando: string;
  total: number;
  url: string;
  locale: "es" | "en";
}) {
  const { cliente, email, servicio, cuando, total, url, locale } = params;

  const t = {
    es: {
      subject: `Tu link de pago — ${BRAND.name}`,
      intro: `Hola ${cliente}, tu servicio de ${servicio} (${cuando}) ya está listo. El total a pagar es $${total.toFixed(2)}.`,
      cta: `Puedes pagar de forma segura aquí: ${url}`,
      closing: `Gracias por confiar en ${BRAND.name}.`,
    },
    en: {
      subject: `Your payment link — ${BRAND.name}`,
      intro: `Hi ${cliente}, your ${servicio} service (${cuando}) is done. The total due is $${total.toFixed(2)}.`,
      cta: `You can pay securely here: ${url}`,
      closing: `Thank you for choosing ${BRAND.name}.`,
    },
  }[locale];

  await sendSafely(email, t.subject, [t.intro, "", t.cta, "", t.closing].join("\n"));
}

/**
 * El webhook la llama cuando un link de pago se cobra. Al negocio y al cliente.
 *
 * `reviewUrl` es opcional y va solo en el correo del cliente: es el respaldo
 * de la redirección de Stripe, para el cliente que cerró la pestaña antes de
 * que lo redirigieran. No es un correo extra — es una línea más en el recibo
 * que ya se manda.
 */
export async function sendPaymentReceivedEmail(params: {
  cliente: string;
  email: string;
  servicio: string;
  cuando: string;
  direccion: string;
  importe: number;
  locale: "es" | "en";
  reviewUrl?: string | null;
}) {
  const { cliente, email, servicio, cuando, direccion, importe, locale } = params;

  const businessEmail = sendSafely(
    BRAND.email,
    `Pago recibido — ${cliente} · ${cuando}`,
    [
      `Se cobró el link de pago de esta reserva.`,
      "",
      `Cliente: ${cliente}`,
      `Servicio: ${servicio}`,
      `Fecha y hora: ${cuando}`,
      `Dirección: ${direccion}`,
      `Importe cobrado: $${importe.toFixed(2)}`,
    ].join("\n"),
  );

  const t = {
    es: {
      subject: `Recibo de pago — ${BRAND.name}`,
      body: `Hola ${cliente}, confirmamos que recibimos tu pago de $${importe.toFixed(2)} por el servicio de ${servicio} (${cuando}). ¡Gracias!`,
    },
    en: {
      subject: `Payment receipt — ${BRAND.name}`,
      body: `Hi ${cliente}, we've confirmed your payment of $${importe.toFixed(2)} for the ${servicio} service (${cuando}). Thank you!`,
    },
  }[locale];

  const customerBody = params.reviewUrl
    ? [t.body, "", reviewLine(params.reviewUrl, locale)].join("\n")
    : t.body;

  const customerEmail = sendSafely(email, t.subject, customerBody);

  await Promise.all([businessEmail, customerEmail]);
}

/**
 * El panel la llama con "Enviar por correo" en el bloque de Reseña. Al
 * cliente. Mismo texto para todos, sin importar nada del servicio ni del
 * cliente (reglas 2 y 3 de reseñas).
 */
export async function sendReviewRequestEmail(params: {
  cliente: string;
  email: string;
  url: string;
  locale: "es" | "en";
}) {
  const { cliente, email, url, locale } = params;

  const t = {
    es: {
      subject: `¿Cómo te fue con nosotros? — ${BRAND.name}`,
      intro: `Hola ${cliente}, gracias por confiar en ${BRAND.name}.`,
      closing: `Si prefieres contarnos en privado, respóndenos a ${BRAND.email} o llámanos al ${BRAND.phone}.`,
    },
    en: {
      subject: `How did it go? — ${BRAND.name}`,
      intro: `Hi ${cliente}, thank you for choosing ${BRAND.name}.`,
      closing: `If you'd rather tell us privately, reply to ${BRAND.email} or call us at ${BRAND.phone}.`,
    },
  }[locale];

  await sendSafely(
    email,
    t.subject,
    [t.intro, "", reviewLine(url, locale), "", t.closing].join("\n"),
  );
}

/**
 * `/api/reviews` la llama cuando entra una reseña. Al negocio.
 *
 * Deliberadamente NO cambia según la calificación: ni el asunto, ni el
 * cuerpo, ni la urgencia. Una reseña de 1 estrella y una de 5 generan el
 * mismo aviso, porque la moderación tiene que poder ser neutral (regla 1) y
 * eso empieza por no teñir el aviso que la anuncia.
 */
export async function sendNewReviewEmail(params: {
  rating: number;
  displayName: string;
  servicio: string;
  body: string;
}) {
  const { rating, displayName, servicio, body } = params;

  await sendSafely(
    BRAND.email,
    `Nueva reseña ${rating}★ de ${displayName} — pendiente de revisar`,
    [
      `Entró una reseña nueva. Está pendiente hasta que la revises en /admin/reservas.`,
      "",
      `Calificación: ${rating} de 5`,
      `Nombre a mostrar: ${displayName}`,
      `Servicio: ${servicio}`,
      "",
      body ? `Comentario:\n${body}` : "Sin comentario escrito.",
      "",
      `Recuerda: solo se rechaza u oculta por lenguaje ofensivo, datos`,
      `personales, no hablar del servicio, o spam. Nunca por ser negativa.`,
    ].join("\n"),
  );
}
