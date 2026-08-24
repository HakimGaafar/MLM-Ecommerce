"use client";

import type { InputHTMLAttributes } from "react";

type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "date" | "datetime-local";
};

/** Native date control that opens the calendar on click (not only after Space). */
export default function DateField({ type = "date", onClick, className, ...props }: DateFieldProps) {
  return (
    <input
      {...props}
      type={type}
      lang="en"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        const el = event.currentTarget;
        if (typeof el.showPicker !== "function") return;
        try {
          el.showPicker();
        } catch {
          /* Already open, or browser blocked showPicker. */
        }
      }}
    />
  );
}
