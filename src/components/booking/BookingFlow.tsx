"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/ui/Container";
import { BookingProvider, useBooking } from "@/components/booking/store";
import ProgressBar from "@/components/booking/ProgressBar";
import PriceBar from "@/components/booking/PriceBar";
import ServiceStep from "@/components/booking/steps/ServiceStep";
import SizeStep from "@/components/booking/steps/SizeStep";
import RoomsStep from "@/components/booking/steps/RoomsStep";
import LevelStep from "@/components/booking/steps/LevelStep";
import PetsStep from "@/components/booking/steps/PetsStep";
import AddonsStep from "@/components/booking/steps/AddonsStep";
import FrequencyStep from "@/components/booking/steps/FrequencyStep";
import ScheduleStep from "@/components/booking/steps/ScheduleStep";
import ContactStep from "@/components/booking/steps/ContactStep";
import PaymentStep from "@/components/booking/steps/PaymentStep";

export default function BookingFlow() {
  return (
    <BookingProvider>
      <Flow />
    </BookingProvider>
  );
}

function Flow() {
  const t = useTranslations("nav");
  const { step, stepNumber, canAdvance, dispatch } = useBooking();
  const [showContactErrors, setShowContactErrors] = useState(false);

  // Cada paso empieza arriba; si no, en móvil se aterriza a media pantalla.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stepNumber, step]);

  function handleNext() {
    if (!canAdvance) {
      // En contacto el botón sigue activo para poder revelar qué falta.
      if (step === "contact") setShowContactErrors(true);
      return;
    }
    setShowContactErrors(false);
    dispatch({ type: "next" });
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href={ROUTES.home}>
            <BrandMark />
          </Link>
          <Link
            href={ROUTES.home}
            className="text-small text-text-muted transition-colors hover:text-text"
          >
            {t("home")}
          </Link>
        </Container>
      </header>

      <Container className="pt-6">
        <ProgressBar />
      </Container>

      <div className="flex-1">
        <Container className="py-8">
          <Step step={step} showContactErrors={showContactErrors} />
        </Container>
      </div>

      <PriceBar
        onNext={handleNext}
        onBack={() => dispatch({ type: "back" })}
        // En contacto se deja activo para poder mostrar los errores al tocarlo.
        nextDisabled={!canAdvance && step !== "contact"}
      />
    </div>
  );
}

function Step({
  step,
  showContactErrors,
}: {
  step: string;
  showContactErrors: boolean;
}) {
  switch (step) {
    case "service":
      return <ServiceStep />;
    case "size":
      return <SizeStep />;
    case "rooms":
      return <RoomsStep />;
    case "level":
      return <LevelStep />;
    case "pets":
      return <PetsStep />;
    case "addons":
      return <AddonsStep />;
    case "frequency":
      return <FrequencyStep />;
    case "schedule":
      return <ScheduleStep />;
    case "contact":
      return <ContactStep showErrors={showContactErrors} />;
    case "payment":
      return <PaymentStep />;
    default:
      return null;
  }
}
