// client/src/hooks/useStagedMessage.js
import { useEffect, useState } from "react";

// Steps through messages on a timer and stops on the last one.
// Resets whenever the number of messages changes (e.g. a new run starts).
export default function useStagedMessage(messages, intervalMs = 2500) {
  const [idx, setIdx] = useState(0);
  const count = messages.length;
  useEffect(() => {
    setIdx(0);
    if (count < 2) return undefined;
    const timer = setInterval(() => {
      setIdx((i) => Math.min(i + 1, count - 1));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [count, intervalMs]);
  return messages[Math.min(idx, count - 1)];
}
