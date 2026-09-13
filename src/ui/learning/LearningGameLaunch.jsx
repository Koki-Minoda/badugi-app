import { useEffect, useRef } from 'react';

// Mounted only inside the existing AuthGate. Start through the normal ring
// handler so availability checks and table initialization remain centralized.
export default function LearningGameLaunch({ variantId, onLaunch }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onLaunch(variantId);
  }, [onLaunch, variantId]);
  return null;
}
