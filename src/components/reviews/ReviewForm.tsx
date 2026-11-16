"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Star from "@/components/reviews/Star";

const RATINGS = [1, 2, 3, 4, 5] as const;
const MAX_BODY = 1000;
const MAX_NAME = 40;

/**
 * Formulario de reseña. Mobile-first porque casi todo el tráfico llega desde
 * el teléfono, por QR o por el link de un correo.
 *
 * Cumplimiento (regla 2): el formulario es IDÉNTICO sin importar la
 * calificación. No hay ninguna rama que mire `rating` para decidir qué
 * mostrar, a dónde mandar al cliente o qué texto usar. Si algún día alguien
 * pide "que los de 5 estrellas vayan a Google y los de 1 a un formulario
 * privado", eso es exactamente lo que la regla prohíbe.
 */
export default function ReviewForm({
  token,
  defaultDisplayName,
  heading,
}: {
  token: string;
  defaultDisplayName: string;
  heading: string;
}) {
  const t = useTranslations("review");

  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [consent, setConsent] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "already" | null>(null);

  // Mismo cerrojo que PaymentStep.tsx: con mala señal el cliente toca
  // "Enviar" dos veces antes de ver respuesta. El `ref` corta el segundo
  // intento en el mismo instante, sin esperar un re-render (un `useState`
  // solo se refleja en el render siguiente, y para entonces ya salió la
  // segunda petición). La red de seguridad real es el `unique(invite_id)` de
  // la tabla, que responde 409.
  const enviando = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (enviando.current) return;

    if (rating === null) {
      setError(t("form.ratingRequired"));
      return;
    }
    if (!displayName.trim()) {
      setError(t("form.nameRequired"));
      return;
    }
    if (!consent) {
      setError(t("form.consentRequired"));
      return;
    }

    enviando.current = true;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          body: body.trim(),
          displayName: displayName.trim(),
          consent: true,
        }),
      });

      if (res.ok) {
        setOutcome("sent");
        return;
      }

      const data = await res.json().catch(() => ({}));

      // 409 no es un error que haya que reintentar: la reseña SÍ quedó
      // guardada, solo llegó dos veces. Mostrarlo como fallo haría que el
      // cliente creyera que se perdió lo que escribió.
      if (res.status === 409 || data.error === "alreadyReviewed") {
        setOutcome("already");
        return;
      }

      enviando.current = false;
      setError(t("form.genericError"));
    } catch {
      enviando.current = false;
      setError(t("form.networkError"));
    } finally {
      setSending(false);
    }
  }

  if (outcome === "sent") {
    return (
      <div>
        <h1 className="text-h2 font-bold text-text">{t("thanks.title")}</h1>
        <p className="mt-3 text-body text-text-muted">{t("thanks.body")}</p>
      </div>
    );
  }

  if (outcome === "already") {
    return (
      <div>
        <h1 className="text-h2 font-bold text-text">{t("done.title")}</h1>
        <p className="mt-3 text-body text-text-muted">{t("done.body")}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-h2 font-bold text-text">{heading}</h1>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-7">
        {/*
          Radios nativos, no divs con onClick: así las flechas del teclado
          recorren las estrellas y el lector de pantalla las anuncia como "1
          de 5 estrellas", sin que haya que reimplementar nada de eso a mano.
          Lo visual se controla desde el estado de React; los inputs quedan
          ocultos pero siguen siendo los que reciben el foco.
        */}
        <fieldset>
          <legend className="text-small font-semibold text-text">
            {t("form.ratingLegend")}
          </legend>

          <div className="mt-2 flex gap-1">
            {RATINGS.map((n) => (
              <label key={n} className="cursor-pointer p-2">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="peer sr-only"
                />
                <span className="sr-only">{t("form.starLabel", { count: n })}</span>
                <span className="block rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  <Star filled={rating !== null && n <= rating} className="size-10" />
                </span>
              </label>
            ))}
          </div>

          {rating === null && (
            <p className="mt-1 text-tiny text-text-faint">{t("form.ratingHint")}</p>
          )}
        </fieldset>

        <div>
          <label htmlFor="review-body" className="text-small font-semibold text-text">
            {t("form.commentLabel")}{" "}
            <span className="font-normal text-text-faint">
              ({t("form.commentOptional")})
            </span>
          </label>
          <textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            maxLength={MAX_BODY}
            rows={5}
            placeholder={t("form.commentPlaceholder")}
            className="mt-2 w-full rounded-md border-2 border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-right text-tiny text-text-faint">
            {t("form.counter", { count: body.length })}
          </p>
        </div>

        <div>
          <label htmlFor="review-name" className="text-small font-semibold text-text">
            {t("form.displayNameLabel")}
          </label>
          <input
            id="review-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, MAX_NAME))}
            maxLength={MAX_NAME}
            className="mt-2 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="text-small text-text-muted">{t("form.consent")}</span>
        </label>

        {error && (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="h-12 w-full rounded-pill bg-accent text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? t("form.submitting") : t("form.submit")}
        </button>
      </form>
    </div>
  );
}

/**
 * Estrella. Dorada cuando está elegida, gris cuando no — la convención de
 * Google Maps y del resto de los sistemas de reseñas. Los dos colores salen
 * de `brand.config.ts` (`star` y `starEmpty`) como todo lo demás.
 *
 * `aria-hidden` porque el texto que lee el lector de pantalla ya lo pone el
 * `<span className="sr-only">` del label — si la estrella también se
 * anunciara, cada opción se leería dos veces.
 */
