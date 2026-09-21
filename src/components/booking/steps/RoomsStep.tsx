"use client";

import { useTranslations } from "next-intl";
import {
  ROOM_LIMITS,
  useBooking,
  type RoomField,
} from "@/components/booking/store";
import Counter from "@/components/booking/Counter";
import StepShell from "@/components/booking/StepShell";

const FIELDS: RoomField[] = ["bedrooms", "fullBaths", "halfBaths"];

export default function RoomsStep() {
  const t = useTranslations("booking.rooms");
  const { state, dispatch } = useBooking();

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="group">
      {FIELDS.map((field) => (
        <Counter
          key={field}
          label={t(field)}
          value={state[field]}
          min={ROOM_LIMITS[field].min}
          max={ROOM_LIMITS[field].max}
          onChange={(delta) => dispatch({ type: "setRoom", field, delta })}
          decreaseLabel={t("decrease")}
          increaseLabel={t("increase")}
        />
      ))}
    </StepShell>
  );
}
