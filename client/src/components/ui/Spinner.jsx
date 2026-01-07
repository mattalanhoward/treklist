// client/src/components/ui/Spinner.jsx
import React from "react";

/**
 * Spinner
 *
 * Usage:
 *  - <Spinner />                             // default size + primary tone
 *  - <Spinner size="sm" />                   // smaller
 *  - <Spinner tone="white" />                // for dark overlays
 *  - <Spinner centered label="Loading..." /> // full-page style with label
 */
export default function Spinner({
  size = "lg", // sm | md | lg | xl
  tone = "primary", // primary | white
  centered = false,
  label,
  className = "",
}) {
  const sizeClass =
    size === "sm"
      ? "h-5 w-5"
      : size === "md"
      ? "h-8 w-8"
      : size === "xl"
      ? "h-12 w-12"
      : "h-10 w-10"; // lg (default) matches your existing h-10 w-10

  const ringClass =
    tone === "white"
      ? "border-white/40 border-t-white"
      : "border-primary/30 border-t-primary";

  const labelClass = tone === "white" ? "text-white" : "text-primary";

  const Wrapper = centered ? "div" : "span";
  const wrapperClasses = centered
    ? `h-full w-full flex flex-col items-center justify-center gap-3 ${className}`
    : `inline-flex items-center gap-2 ${className}`;

  return (
    <Wrapper className={wrapperClasses}>
      <span
        className={`${sizeClass} rounded-full border-2 ${ringClass} animate-spin`}
        role="status"
        aria-label={label || "Loading"}
      />
      {label ? <span className={`text-sm ${labelClass}`}>{label}</span> : null}
    </Wrapper>
  );
}
