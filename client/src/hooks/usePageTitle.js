// src/hooks/usePageTitle.js
import { useEffect } from "react";

/**
 * Sets document.title when the component is mounted.
 * Usage: usePageTitle("Privacy Policy");
 * Result: "Privacy Policy · TrekList.co"
 */
export default function usePageTitle(title) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (title) {
      document.title = `${title} - TrekList`;
    } else {
      document.title = "TrekList";
    }
  }, [title]);
}
