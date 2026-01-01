// client/src/components/ui/ButtonLink.jsx
import React from "react";

export default function ButtonLink({
  href,
  children,
  className = "",
  target = "_blank",
  rel = "noreferrer noopener",
  ...props
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={
        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium " +
        "transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
        // 👇 replace these with YOUR button classes
        "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 " +
        className
      }
      {...props}
    >
      {children}
    </a>
  );
}
