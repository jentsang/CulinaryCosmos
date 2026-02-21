import { useCallback, useRef, useEffect } from "react";

/**
 * Returns a function that returns true if the component is still mounted.
 * Useful for avoiding state updates after unmount (e.g. in async callbacks).
 */
export function useIsMounted(): () => boolean {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return useCallback(() => mountedRef.current, []);
}
