import { EmptyState, LoadingState, Screen } from '../../design-system';
import { useI18n } from '../../hooks/use-i18n';
import type { ResultState } from '../../hooks/use-result';

type Props = { state: Pick<ResultState<unknown>, 'status' | 'error' | 'reload'>; withTabBar?: boolean; edges?: 'top' | 'none' };

/** What every data screen shows until its use case has resolved: skeleton, or a retryable error. */
export function QueryFallback({ state, withTabBar, edges }: Props) {
  const { t, translator } = useI18n();
  return (
    <Screen withTabBar={withTabBar} edges={edges}>
      {state.status === 'error' ? (
        <EmptyState icon="alert" tone="danger" title={translator.error(state.error?.code ?? '')} actionLabel={t('common.retry')} onAction={state.reload} />
      ) : (
        <LoadingState />
      )}
    </Screen>
  );
}
