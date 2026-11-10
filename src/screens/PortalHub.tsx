import { Link } from 'react-router-dom';
import { BrainCircuit, CalendarDays, ClipboardList, MessageSquare, Target } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const portalFeatures = [
  {
    title: 'AI analysis',
    description: 'Review employee snapshots, run predictions and generate policy recommendations.',
    to: '/ai-analysis',
    icon: BrainCircuit,
    color: 'bg-orange-100 text-orange-700',
  },
  {
    title: 'Policy demo',
    description: 'Explore retention policies and recommendations created from prediction results.',
    to: '/policy-demo',
    icon: Target,
    color: 'bg-violet-100 text-violet-700',
  },
  {
    title: 'Engagement Surveys',
    description: 'Create surveys, publish them and review employee responses.',
    to: '/engagement',
    icon: MessageSquare,
    color: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'Employee Requests',
    description: 'Review leave requests, cancellations and approval history.',
    to: '/employee-requests',
    icon: ClipboardList,
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Work schedules',
    description: 'Create schedule templates and assign working schedules to employees.',
    to: '/work-schedules',
    icon: CalendarDays,
    color: 'bg-amber-100 text-amber-700',
  },
] as const;

export default function PortalHub() {
  const { t } = useLanguage();

  return <AppShell breadcrumb={['Retention', 'Portal']}>
    <SectionHeader
      title={t('Portal')}
      description={t('One place to access the HR workflows provided by the backend portal APIs.')}
    />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {portalFeatures.map(feature => {
        const Icon = feature.icon;
        return <Card key={feature.to} className="flex min-h-56 flex-col p-5 sm:p-6">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.color}`}><Icon size={22} /></span>
          <h2 className="mt-5 text-lg font-bold text-slate-900">{t(feature.title)}</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{t(feature.description)}</p>
          <Link to={feature.to} className="mt-5 inline-flex min-h-10 items-center justify-center self-start rounded-full bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
            {t('Open feature')}
          </Link>
        </Card>;
      })}
    </div>
  </AppShell>;
}
