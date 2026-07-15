// useHistoryDismiss — makes the Android back button / iOS swipe-back gesture
// close an overlay (takeover, bottom sheet) instead of navigating away.
//
// When `active` is true it pushes a sentinel history entry (same URL); a
// popstate that removes *this* entry fires `onDismiss`. Each overlay gets its
// own monotonic id, so nested overlays (takeover + sheet) dismiss in LIFO order
// — a back gesture closes the sheet, then the takeover, never the app.
//
// Closing through the UI (active → false / unmount) pops our own sentinel to
// keep the stack tidy. That teardown pop is deferred one tick so React 18
// StrictMode — which synchronously runs cleanup then setup again — can cancel
// it on remount; otherwise the double-invoke would eat the sentinel and close
// the overlay the instant it opened.
import { useEffect, useRef } from "react";

let seq = 0;

export default function useHistoryDismiss(active, onDismiss) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const st = useRef({ id: 0, pushed: false, timer: null });

  useEffect(() => {
    const s = st.current;
    // A re-setup while still active (StrictMode remount) cancels a pending pop.
    if (active && s.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }
    if (!active) return undefined;

    if (!s.pushed) {
      s.id = ++seq;
      window.history.pushState({ tlDismiss: true, tlId: s.id }, "");
      s.pushed = true;
    }
    const myId = s.id;

    const onPop = () => {
      // Our entry is gone only when the current top id is below ours.
      if ((window.history.state?.tlId ?? 0) >= myId) return;
      s.pushed = false;
      onDismissRef.current?.();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      s.timer = setTimeout(() => {
        s.timer = null;
        // Only pop if our sentinel is still the current top (not already
        // consumed by a real back gesture).
        if (s.pushed && (window.history.state?.tlId ?? 0) === s.id) {
          window.history.back();
        }
        s.pushed = false;
      }, 0);
    };
  }, [active]);
}
