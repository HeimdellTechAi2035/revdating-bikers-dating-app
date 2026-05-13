import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import ReportIllegalContent from '@/components/compliance/ReportIllegalContent';

export const metadata = {
  title: 'Report Illegal Content — REVdating',
};

export default async function ReportIllegalPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="px-5 py-4 space-y-5 pb-16">
      <Link
        href="/safety"
        className="flex items-center gap-1.5 text-brand-chrome text-sm hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Safety Centre
      </Link>

      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          Report illegal or harmful content
        </h1>
        <p className="text-brand-chrome text-sm mt-1.5 leading-relaxed">
          Use this form to report content you believe is illegal. All reports go directly to our Trust &amp; Safety team and are reviewed urgently.
        </p>
      </div>

      <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl p-5">
        <ReportIllegalContent />
      </div>

      <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl p-4 space-y-1.5">
        <p className="text-xs font-semibold text-brand-chrome uppercase tracking-wider">Useful contacts</p>
        <ul className="text-brand-chrome text-xs space-y-1">
          <li>• <strong className="text-white">Emergency services:</strong> 999</li>
          <li>• <strong className="text-white">NSPCC (child protection):</strong> 0808 800 5000</li>
          <li>• <strong className="text-white">IWF (report CSAM online):</strong>{' '}
            <a href="https://www.iwf.org.uk/report/" className="text-brand-orange" target="_blank" rel="noopener noreferrer">iwf.org.uk/report</a>
          </li>
          <li>• <strong className="text-white">REVdating safety team:</strong>{' '}
            <a href="mailto:safety@REVdating.app" className="text-brand-orange">safety@REVdating.app</a>
          </li>
        </ul>
      </div>

      <p className="text-brand-chrome text-xs text-center">
        For general reports (harassment, fake profiles, etc.) use the{' '}
        <Link href="/safety" className="text-brand-orange hover:underline">Safety Centre</Link>.
      </p>
    </div>
  );
}
