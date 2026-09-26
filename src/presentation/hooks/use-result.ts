import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

import type { AppEventType } from '@/application/events/event-bus';
import type { DomainError } from '@/domain/shared/domain-error';
import { Result } from '@/domain/shared/result';

import { useServices } from '../providers/services';

export type ResultState<T> = {
  status: 'loading' | 'success' | 'error';
  data: T | undefined;
  error: DomainError | undefined;
  refreshing: boolean;
  reload: () => Promise<void>;
};

/**
 * Runs a use case and tracks its `Result`. Re-runs when `deps` change and — the
 * local-first bit — silently whenever one of `invalidateOn` domain events fires.
 */
export function useResult<T>(
  load: () => Promise<Result<T>>,
  deps: DependencyList,
  options: { invalidateOn?: readonly AppEventType[] } = {},
): ResultState<T> {
  const { container } = useServices();
  const [state, setState] = useState<Omit<ResultState<T>, 'reload'>>({ status: 'loading', data: undefined, error: undefined, refreshing: false });
  const loadRef = useRef(load);
  const mounted = useRef(true);

  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'refresh') setState((previous) => ({ ...previous, refreshing: true }));
    const result = (await Result.fromPromise(loadRef.current())).flatMap((inner) => inner);
    if (!mounted.current) return;
    setState(
      result.isOk()
        ? { status: 'success', data: result.value, error: undefined, refreshing: false }
        : (previous) => ({ status: previous.data ? 'success' : 'error', data: previous.data, error: result.error, refreshing: false }),
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadRef.current = load;
    // setState only happens after the awaited use case resolves (never synchronously).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run('initial');
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const events = options.invalidateOn;
  useEffect(() => {
    if (!events || events.length === 0) return undefined;
    return container.events.subscribe((event) => {
      if (events.includes(event.type)) void run('silent');
    });
  }, [container, events, run]);

  const reload = useCallback(() => run('refresh'), [run]);
  return { ...state, reload };
}
