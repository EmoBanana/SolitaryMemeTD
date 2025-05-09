// Re-export hooks with proper typing
import React from "react";

// For React 19, state hooks are exported separately
export function useState<T>(initialState: T | (() => T)) {
  return React.useState(initialState);
}

export function useEffect(
  effect: React.EffectCallback,
  deps?: React.DependencyList
) {
  return React.useEffect(effect, deps);
}

export function useRef<T>(initialValue: T) {
  return React.useRef(initialValue);
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
) {
  return React.useCallback(callback, deps);
}

export function useMemo<T>(factory: () => T, deps: React.DependencyList) {
  return React.useMemo(factory, deps);
}
