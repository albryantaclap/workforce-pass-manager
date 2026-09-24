import { useState, useEffect } from 'react';

/**
 * Debounce a rapidly-changing value (e.g. search input).
 * Returns the value after `delay` ms of no changes.
 * Prevents a database request on every keystroke.
 */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}