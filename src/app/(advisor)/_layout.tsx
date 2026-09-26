import { FloatingTabs } from '@/presentation/navigation/floating-tab-bar';
import { useI18n } from '@/presentation/hooks/use-i18n';

export default function AdvisorTabsLayout() {
  const { t } = useI18n();
  return (
    <FloatingTabs
      tabs={[
        { name: 'pulse', href: '/pulse', icon: 'gauge', label: t('tabs.pulse') },
        { name: 'radar', href: '/radar', icon: 'radar', label: t('tabs.radar') },
        { name: 'profile', href: '/profile', icon: 'user', label: t('tabs.profile') },
      ]}
    />
  );
}
