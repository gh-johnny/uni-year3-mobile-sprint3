import { FloatingTabs } from '@/presentation/navigation/floating-tab-bar';
import { useI18n } from '@/presentation/hooks/use-i18n';

export default function OwnerTabsLayout() {
  const { t } = useI18n();
  return (
    <FloatingTabs
      tabs={[
        { name: 'garage', href: '/garage', icon: 'garage', label: t('tabs.garage') },
        { name: 'history', href: '/history', icon: 'history', label: t('tabs.history') },
        { name: 'dealers', href: '/dealers', icon: 'pin', label: t('tabs.dealers') },
        { name: 'account', href: '/account', icon: 'user', label: t('tabs.profile') },
      ]}
    />
  );
}
