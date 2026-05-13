import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Camera,
  CreditCard,
  MapPin,
  Phone,
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import LocationPrivacyToggle from '@/components/safety/LocationPrivacyToggle';
import EmergencyContactForm from '@/components/safety/EmergencyContactForm';
import SafetyTips from '@/components/safety/SafetyTips';
import CheckInResolveButton from '@/components/safety/CheckInResolveButton';

export const dynamic = 'force-dynamic';

type VerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

function VerificationBadge({ status }: { status: VerificationStatus }) {
  switch (status) {
    case 'approved':
      return (
        <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5" /> Verified
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 text-yellow-400 text-xs font-medium">
          <Clock className="w-3.5 h-3.5" /> Under review
        </span>
      );
    case 'rejected':
      return (
        <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
          <XCircle className="w-3.5 h-3.5" /> Rejected
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-brand-chrome text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" /> Not started
        </span>
      );
  }
}

function formatCheckinTime(dt: string) {
  return new Date(dt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default async function SafetyPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: profile },
    { data: verifications },
    { data: activeCheckin },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_verified, hide_exact_location, emergency_contact_name, emergency_contact_phone')
      .eq('id', user.id)
      .single(),
    supabase
      .from('verifications')
      .select('verification_type, status, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false }),
    supabase
      .from('safety_checkins')
      .select('id, ride_description, expected_return_at, status, destination_name')
      .eq('user_id', user.id)
      .in('status', ['active', 'overdue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const selfieStatus: VerificationStatus = (() => {
    const v = verifications?.find((v) => v.verification_type === 'face_selfie');
    return (v?.status as VerificationStatus | undefined) ?? 'not_started';
  })();

  const idStatus: VerificationStatus = (() => {
    const v = verifications?.find((v) => v.verification_type === 'id_document');
    return (v?.status as VerificationStatus | undefined) ?? 'not_started';
  })();

  const hideLocation = profile?.hide_exact_location ?? false;

  return (
    <div className="px-5 py-4 space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-orange" />
          Safety Centre
        </h1>
        <p className="text-brand-chrome text-sm mt-1">
          Tools to keep you safe while riding and dating.
        </p>
      </div>

      {/* Verification */}
      <Section title="Identity Verification">
        {/* Selfie */}
        <div className="flex items-start gap-3 p-4 bg-brand-dark-3 rounded-2xl border border-brand-dark-4">
          <div className="p-2 rounded-xl bg-brand-dark-4">
            <Camera className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-semibold text-sm">Selfie verification</p>
              <VerificationBadge status={selfieStatus} />
            </div>
            <p className="text-brand-chrome text-xs">
              Take a live selfie to prove you&apos;re a real person. Earns a verified badge on your profile.
            </p>
            {(selfieStatus === 'not_started' || selfieStatus === 'rejected') && (
              <Link
                href="/safety/verify-selfie"
                className="inline-flex items-center gap-1 mt-2 text-brand-orange text-xs font-semibold hover:underline"
              >
                {selfieStatus === 'rejected' ? 'Resubmit selfie' : 'Get verified'}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* ID — placeholder */}
        <div className="flex items-start gap-3 p-4 bg-brand-dark-3 rounded-2xl border border-brand-dark-4">
          <div className="p-2 rounded-xl bg-brand-dark-4">
            <CreditCard className="w-5 h-5 text-brand-chrome" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-semibold text-sm">ID verification</p>
              {idStatus === 'approved' ? (
                <VerificationBadge status="approved" />
              ) : (
                <span className="text-brand-chrome text-xs font-medium bg-brand-dark-4 px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              )}
            </div>
            <p className="text-brand-chrome text-xs">
              Upload a government-issued ID for enhanced trust. Documents are never stored after admin review.
            </p>
          </div>
        </div>
      </Section>

      {/* Ride Check-In */}
      <Section title="Ride Check-In">
        {activeCheckin ? (
          <div className="p-4 bg-brand-dark-3 rounded-2xl border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <p className="font-semibold text-sm text-yellow-400">Active check-in</p>
            </div>
            <p className="text-sm font-medium truncate">{activeCheckin.ride_description}</p>
            {activeCheckin.destination_name && (
              <p className="text-brand-chrome text-xs mt-0.5">To: {activeCheckin.destination_name}</p>
            )}
            <p className="text-brand-chrome text-xs mt-1">
              Expected back: {formatCheckinTime(activeCheckin.expected_return_at)}
            </p>
            <div className="flex gap-2 mt-3">
              <CheckInResolveButton id={activeCheckin.id} />
              <Link
                href="/safety/checkin"
                className="flex-1 text-center py-2 rounded-xl border border-brand-dark-4 text-sm text-brand-chrome hover:border-brand-orange/50 transition-colors"
              >
                New check-in
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-brand-dark-3 rounded-2xl border border-brand-dark-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-brand-dark-4 flex-shrink-0">
                <ClipboardCheck className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">No active check-in</p>
                <p className="text-brand-chrome text-xs mt-0.5">
                  Going on a ride or date? Start a check-in — your emergency contact is notified if you don&apos;t return on time.
                </p>
                <Link
                  href="/safety/checkin"
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-lg bg-brand-orange text-white text-xs font-semibold hover:bg-brand-orange/90 transition-colors"
                >
                  Start check-in <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
        <p className="text-brand-chrome text-xs px-1">
          💡 REVdating recommends meeting at a busy public spot before any private ride together.
        </p>
      </Section>

      {/* Location Privacy */}
      <Section title="Location Privacy">
        <LocationPrivacyToggle initial={hideLocation} />
        <p className="text-brand-chrome text-xs px-1">
          When enabled, other riders see only your approximate distance — your city name is hidden.
          Your exact GPS coordinates are <strong className="text-white">never</strong> shared publicly.
        </p>
      </Section>

      {/* Emergency Contact */}
      <Section title="Emergency Contact">
        <div className="p-4 bg-brand-dark-3 rounded-2xl border border-brand-dark-4">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="w-4 h-4 text-brand-orange" />
            <p className="font-semibold text-sm">Your emergency contact</p>
          </div>
          <EmergencyContactForm
            initialName={profile?.emergency_contact_name ?? null}
            initialPhone={profile?.emergency_contact_phone ?? null}
          />
        </div>
      </Section>

      {/* Safe dating tips + public meeting recommendation */}
      <Section title="Stay Safe">
        <SafetyTips />
        <div className="p-4 bg-brand-dark-3 rounded-2xl border border-green-500/20">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Meet in public first</p>
              <p className="text-brand-chrome text-xs mt-0.5 leading-relaxed">
                REVdating strongly recommends meeting at a public bike meet, café, or pub before riding to any private location.
                Trust takes time — ride safe.
              </p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-brand-chrome uppercase tracking-wider px-1">{title}</h2>
      {children}
    </div>
  );
}