"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import ManualReviewInvites from "@/components/admin/ManualReviewInvites";
import ReviewInviteBlock from "@/components/admin/ReviewInviteBlock";
import ReviewsModeration from "@/components/admin/ReviewsModeration";
import type {
  AdminReview,
  BookingReviewState,
  ManualInviteSummary,
} from "@/lib/review-types";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useAdminToken } from "@/lib/useAdminToken";

interface Booking {
  id: string;
  status: "reservado" | "completado" | "link_enviado" | "pagado";
  cliente: string;
  telefono: string;
  email: string;
  direccion: string;
  servicio: string;
  addons: string[];
  cuando: string;
  total: number;
  paymentLinkUrl: string | null;
  resena: BookingReviewState | null;
}

/** Estados en los que el servicio ya se hizo y tiene sentido pedir reseña. */
const INVITABLE: Booking["status"][] = ["completado", "link_enviado", "pagado"];

const STATUS_LABEL: Record<Booking["status"], string> = {
  reservado: "Reservado",
  completado: "Completado — falta el link",
  link_enviado: "Link enviado",
  pagado: "Pagado ✅",
};

export default function AdminBookingsView() {
  const [token, setToken] = useAdminToken();
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [manualInvites, setManualInvites] = useState<ManualInviteSummary[]>([]);
  const [reviews, setReviews] = useState<{
    pendientes: AdminReview[];
    publicadas: AdminReview[];
  }>({ pendientes: [], publicadas: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(
    async (activeToken: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        // Las dos listas en paralelo: así "Actualizar" refresca ambas de una
        // y no hace falta un segundo `useEffect` para las invitaciones
        // manuales (que la regla de lint del proyecto complicaría).
        const [bookingsRes, invitesRes, reviewsRes] = await Promise.all([
          fetch("/api/admin/bookings", {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch("/api/admin/review-invites", {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch("/api/admin/reviews", {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);

        if (
          bookingsRes.status === 401 ||
          invitesRes.status === 401 ||
          reviewsRes.status === 401
        ) {
          setToken(null);
          return;
        }

        const data = await bookingsRes.json().catch(() => ({}));
        if (!bookingsRes.ok) {
          setLoadError(
            data.error === "notConfigured" ? "notConfigured" : "loadFailed",
          );
          return;
        }

        setBookings(data.bookings ?? []);

        // Las invitaciones manuales no son críticas: si su consulta falla, la
        // lista de reservas se muestra igual. Sería absurdo dejar al dueño sin
        // poder cobrar porque la sección de reseñas no cargó.
        const invitesData = await invitesRes.json().catch(() => ({}));
        setManualInvites(invitesRes.ok ? (invitesData.invites ?? []) : []);

        // Mismo criterio que arriba: la moderación tampoco es crítica para
        // cobrar. Si su consulta falla, la sección de reseñas desaparece y la
        // lista de reservas sigue funcionando.
        const reviewsData = await reviewsRes.json().catch(() => ({}));
        setReviews(
          reviewsRes.ok
            ? {
                pendientes: reviewsData.pendientes ?? [],
                publicadas: reviewsData.publicadas ?? [],
              }
            : { pendientes: [], publicadas: [] },
        );
      } catch {
        setLoadError("network");
      } finally {
        setLoading(false);
      }
    },
    [setToken],
  );

  /** Actualiza el estado de reseña de una sola reserva, sin recargar todo. */
  const updateResena = useCallback((bookingId: string, next: BookingReviewState) => {
    setBookings((list) =>
      (list ?? []).map((b) => (b.id === bookingId ? { ...b, resena: next } : b)),
    );
  }, []);

  // Carga automática solo la primera vez que aparece un token guardado de una
  // visita anterior. El `ref` evita que se repita en cada render y es lo que
  // hace válido este `useEffect` según la regla de lint del proyecto (ver
  // CLAUDE.md): un login nuevo por formulario dispara la carga directo desde
  // `submitLogin`, no desde aquí.
  const didAutoLoad = useRef(false);
  useEffect(() => {
    if (!token || didAutoLoad.current) return;
    didAutoLoad.current = true;
    load(token);
  }, [token, load]);

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setLoginError("notConfigured");
      return;
    }

    setLoggingIn(true);
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      if (error || !data.session) {
        setLoginError("wrongLogin");
        return;
      }
      setPasswordInput("");
      setToken(data.session.access_token);
      load(data.session.access_token);
    } catch {
      setLoginError("network");
    } finally {
      setLoggingIn(false);
    }
  }

  async function markCompleted(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setToken(null);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBookings((list) =>
          (list ?? []).map((b) =>
            b.id === booking.id ? { ...b, status: "completado" } : b,
          ),
        );
        setErrors((e) => ({ ...e, [booking.id]: "" }));
      } else {
        setErrors((e) => ({ ...e, [booking.id]: describeError(data.error) }));
      }
    } catch {
      setErrors((e) => ({
        ...e,
        [booking.id]: "Se perdió la conexión. Verifica antes de reintentar.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function generateLink(booking: Booking) {
    if (!token) return;
    setBusyId(booking.id);
    try {
      const res = await fetch("/api/admin/payment-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      if (res.status === 401) {
        setToken(null);
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && typeof data.url === "string") {
        setBookings((list) =>
          (list ?? []).map((b) =>
            b.id === booking.id
              ? { ...b, paymentLinkUrl: data.url, status: "link_enviado" }
              : b,
          ),
        );
        setErrors((e) => ({ ...e, [booking.id]: "" }));
        // El parche de arriba solo sirve para que el botón responda al
        // instante. Generar el link crea TAMBIÉN la invitación de reseña en
        // el servidor, y ese dato no se puede adivinar desde aquí: sin
        // recargar, el bloque de Reseña seguiría ofreciendo "Crear link de
        // reseña" para una invitación que ya existe. Mismo patrón que el
        // `onChanged` de las invitaciones manuales.
        await load(token);
      } else {
        setErrors((e) => ({ ...e, [booking.id]: describeError(data.error) }));
      }
    } catch {
      setErrors((e) => ({
        ...e,
        [booking.id]: "Se perdió la conexión. Verifica antes de reintentar.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-6">
        <h1 className="text-h2 font-bold text-text">Acceso interno</h1>
        <p className="mt-2 text-small text-text-muted">
          Gestionar reservas y generar links de pago. Solo para el equipo.
        </p>
        <form onSubmit={submitLogin} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Correo"
            autoFocus
            className="h-12 rounded-md border-2 border-border bg-surface px-4 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Contraseña"
            className="h-12 rounded-md border-2 border-border bg-surface px-4 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loggingIn}
            className="h-12 rounded-pill bg-accent text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingIn ? "Entrando…" : "Entrar"}
          </button>
          {loginError && (
            <p role="alert" className="text-small text-error">
              {loginError === "wrongLogin"
                ? "Correo o contraseña incorrectos."
                : loginError === "notConfigured"
                  ? "Supabase no está configurado en este entorno."
                  : "Se perdió la conexión. Intenta de nuevo."}
            </p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-h2 font-bold text-text">Reservas</h1>
        <button
          type="button"
          onClick={() => load(token)}
          className="text-small font-semibold text-accent transition-colors hover:text-accent-soft"
        >
          Actualizar
        </button>
      </div>

      {loading && <p className="mt-6 text-body text-text-muted">Cargando…</p>}
      {loadError && (
        <p className="mt-6 text-body text-error">
          {loadError === "notConfigured"
            ? "Supabase no está configurado en este entorno."
            : "No se pudo cargar la lista. Intenta de nuevo."}
        </p>
      )}
      {/* Arriba del todo: lo que espera una decisión. Una reseña pendiente
          es trabajo que el cliente ya hizo y que no se ve en la web hasta
          que alguien la mire; las reservas, en cambio, siguen ahí mañana. */}
      <ReviewsModeration
        token={token}
        pendientes={reviews.pendientes}
        publicadas={reviews.publicadas}
        onChanged={() => load(token)}
        onExpired={() => setToken(null)}
      />

      {bookings && bookings.length === 0 && !loading && (
        <p className="mt-6 text-body text-text-muted">No hay reservas activas.</p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {bookings?.map((b) => {
          const isBusy = busyId === b.id;
          const error = errors[b.id];

          return (
            <li key={b.id} className="rounded-lg border-2 border-border bg-surface p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-h3 font-semibold text-text">{b.cliente}</span>
                <span className="text-h3 font-bold text-accent">
                  ${b.total.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-small text-text-muted">
                {b.servicio}
                {b.addons.length > 0 ? ` + ${b.addons.join(", ")}` : ""} · {b.cuando}
              </p>
              <p className="mt-1 text-small text-text-muted">{b.direccion}</p>
              <p className="mt-1 text-small text-text-muted">
                {b.telefono} · {b.email}
              </p>
              <p className="mt-2 text-tiny font-semibold uppercase tracking-wider text-text-faint">
                {STATUS_LABEL[b.status]}
              </p>

              {error && <p className="mt-2 text-small text-error">{error}</p>}

              {b.status === "reservado" && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => markCompleted(b)}
                  className="mt-4 h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "Marcando…" : "Marcar servicio completado"}
                </button>
              )}

              {b.status === "completado" && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => generateLink(b)}
                  className="mt-4 h-11 w-full rounded-pill bg-accent text-small font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "Generando…" : "Generar y enviar link de pago"}
                </button>
              )}

              {b.paymentLinkUrl && (
                <div className="mt-4 flex flex-col gap-2">
                  <input
                    type="text"
                    readOnly
                    value={b.paymentLinkUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    className="h-11 w-full rounded-md border-2 border-border bg-bg-alt px-3 text-tiny text-text"
                  />
                  <CopyLinkButton url={b.paymentLinkUrl} label="Copiar link de pago" />
                </div>
              )}

              {INVITABLE.includes(b.status) && (
                <ReviewInviteBlock
                  bookingId={b.id}
                  token={token}
                  resena={b.resena}
                  onChange={(next) => updateResena(b.id, next)}
                  onExpired={() => setToken(null)}
                />
              )}
            </li>
          );
        })}
      </ul>

      <ManualReviewInvites
        token={token}
        invites={manualInvites}
        onChanged={() => load(token)}
        onExpired={() => setToken(null)}
      />
    </div>
  );
}

function describeError(error?: string): string {
  switch (error) {
    case "notChargeable":
      return "Esta reserva todavía no está marcada como completada.";
    case "notPending":
      return "Esta reserva ya no está en estado 'reservado'.";
    case "invalidAmount":
      return "El importe de esta reserva no es válido.";
    case "unauthorized":
      return "Tu sesión expiró. Vuelve a entrar.";
    case "notConfigured":
      return "El sistema no está configurado en este entorno.";
    default:
      return "No se pudo completar la acción. Intenta de nuevo.";
  }
}
