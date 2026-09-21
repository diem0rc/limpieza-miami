"use client";

import { useTranslations } from "next-intl";
import {
  contactErrors,
  useBooking,
  type ContactInfo,
} from "@/components/booking/store";
import StepShell from "@/components/booking/StepShell";

type TextField = "name" | "phone" | "email" | "address";

const FIELDS: {
  field: TextField;
  type: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete: string;
}[] = [
  { field: "name", type: "text", autoComplete: "name" },
  { field: "phone", type: "tel", inputMode: "tel", autoComplete: "tel" },
  { field: "email", type: "email", inputMode: "email", autoComplete: "email" },
  { field: "address", type: "text", autoComplete: "street-address" },
];

export default function ContactStep({ showErrors }: { showErrors: boolean }) {
  const t = useTranslations("booking.contact");
  const { state, dispatch } = useBooking();
  const errors = contactErrors(state.contact);

  const set = (field: keyof ContactInfo, value: string) =>
    dispatch({ type: "setContactField", field, value });

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="group">
      {FIELDS.map(({ field, type, inputMode, autoComplete }) => {
        const error = showErrors ? errors[field] : null;
        const id = `contact-${field}`;
        return (
          <div key={field} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-small font-medium text-text">
              {t(field)}
            </label>
            <input
              id={id}
              type={type}
              inputMode={inputMode}
              autoComplete={autoComplete}
              value={state.contact[field]}
              onChange={(e) => set(field, e.target.value)}
              placeholder={t(`${field}Placeholder`)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={`w-full rounded-md border-2 bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint focus:outline-none ${
                error ? "border-error" : "border-border focus:border-accent"
              }`}
            />
            {error && (
              <p id={`${id}-error`} className="text-small text-error">
                {t(error)}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-notes" className="text-small font-medium">
          {t("notes")}
        </label>
        <textarea
          id="contact-notes"
          rows={3}
          value={state.contact.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder={t("notesPlaceholder")}
          className="w-full resize-y rounded-md border-2 border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
        />
      </div>
    </StepShell>
  );
}
