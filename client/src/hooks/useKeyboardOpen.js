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
    const check = () => {
      // Keyboard eats a large chunk of the viewport; 25% is a safe threshold
      // that ignores browser chrome collapse/expand.
      const shrink = window.innerHeight - vv.height;
      setOpen(shrink > window.innerHeight * 0.25);
    };
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);

  return open;
}
