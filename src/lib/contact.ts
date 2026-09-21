/**
 * Validación de los datos de contacto.
 *
 * Vive fuera del store (que es `"use client"`) porque el servidor la vuelve a
 * ejecutar antes de crear el cobro: cliente y servidor deben coincidir en qué
 * es un contacto válido, y una sola implementación garantiza que no se separen.
 */

export interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export const EMPTY_CONTACT: ContactInfo = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Clave del mensaje de error por campo, o `null` si el campo está bien. */
export function contactErrors(contact: ContactInfo) {
  const digits = contact.phone.replace(/\D/g, "");
  return {
    name: contact.name.trim().length < 2 ? "errorRequired" : null,
    phone:
      digits.length === 0
        ? "errorRequired"
        : digits.length < 10
          ? "errorPhone"
          : null,
    email:
      contact.email.trim().length === 0
        ? "errorRequired"
        : !EMAIL_RE.test(contact.email.trim())
          ? "errorEmail"
          : null,
    address: contact.address.trim().length < 6 ? "errorRequired" : null,
  } as const;
}

export function isContactValid(contact: ContactInfo): boolean {
  return Object.values(contactErrors(contact)).every((e) => e === null);
}
