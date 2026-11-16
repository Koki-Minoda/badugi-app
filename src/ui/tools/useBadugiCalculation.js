import { useEffect, useState } from 'react';

export function useBadugiCalculation(request) {
  const [response, setResponse] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!request) return;
    let active = true;
    let worker;
    const finish = result => {
      worker?.terminate();
      if (active) setResponse({ request, retry, ...result });
    };
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL('./badugiEquity.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = event => finish({ data: event.data });
        worker.onerror = () => finish({ failed: true });
        worker.postMessage(request);
      } catch {
        finish({ failed: true });
      }
    }, 100);
    return () => {
      active = false;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [request, retry]);

  const current = request && response?.request === request && response.retry === retry ? response : null;
  return { current, retry: () => setRetry(value => value + 1) };
}
