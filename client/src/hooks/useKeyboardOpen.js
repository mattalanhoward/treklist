// useKeyboardOpen — best-effort detection of the on-screen (virtual) keyboard
// on touch devices via the VisualViewport API. Returns true when the visual
// viewport has shrunk well below the layout viewport, which on mobile means
// the software keyboard is up. Used to hide the sticky commit bar while typing.
import { useEffect, useState } from "react";

export default function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    // Track the tallest visual viewport seen (the keyboard-closed baseline).
    // Comparing vv.height against window.innerHeight misses Android Chrome,
    // where the layout viewport shrinks with the keyboard too; measuring
    // vv.height against its own max detects the keyboard on iOS and Android.
    let maxHeight = vv.height;
    const check = () => {
      maxHeight = Math.max(maxHeight, vv.height);
      // Keyboard eats a large chunk of the viewport; 25% is a safe threshold
      // that ignores browser chrome collapse/expand.
      setOpen(vv.height < maxHeight * 0.75);
    };
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);

  return open;
}
