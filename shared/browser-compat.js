// Keep requests usable in older iOS WebViews without changing native implementations.
(() => {
  if (typeof AbortSignal === 'undefined' || typeof AbortController === 'undefined') return;
  if (typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = milliseconds => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), milliseconds);
      return controller.signal;
    };
  }
  if (typeof AbortSignal.any !== 'function') {
    AbortSignal.any = signals => {
      const controller = new AbortController(), listeners = [];
      const abort = signal => {
        controller.abort(signal.reason);
        for (const [source, listener] of listeners) source.removeEventListener('abort', listener);
        listeners.length = 0;
      };
      for (const signal of signals) {
        if (signal.aborted) { abort(signal); break; }
        const listener = () => abort(signal);
        listeners.push([signal, listener]);
        signal.addEventListener('abort', listener, {once: true});
      }
      return controller.signal;
    };
  }
})();

// Fixed hints only: never surface request URLs, keys or response bodies in errors.
window.MXRequestHint = error => {
  if (navigator.onLine === false) return '当前网络已断开。';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return '连接超时，请稍后重试。';
  if (error?.name === 'TypeError') return '无法连接内容服务，请检查网络后重试。';
  if (error?.status >= 500) return '内容服务暂不可用，请稍后重试。';
  return '';
};
