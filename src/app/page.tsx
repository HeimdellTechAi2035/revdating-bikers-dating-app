import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Bike,
  Flame,
  Shield,
  MapPin,
  MessageCircle,
  Heart,
  Star,
  ChevronRight,
  Zap,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   DATA
───────────────────────────────────────────────────────────────────────────── */

const BIKE_TYPES = [
  { label: 'Sport',      badge: 'bg-red-600',    img: 'photo-1568772585407-9361f9bf3a87' },  // Ducati SuperSport S
  { label: 'Cruiser',    badge: 'bg-yellow-500', img: 'photo-1515777315835-281b94c9589f' },  // Harley Davidson orange
  { label: 'Adventure',  badge: 'bg-blue-600',   img: 'photo-1600497934947-23786a93f382' },  // man riding adventure
  { label: 'Café Racer', badge: 'bg-red-600',    img: 'photo-1600705722908-bab1e61c0b4d' },  // man in helmet riding
  { label: 'Naked',      badge: 'bg-yellow-500', img: 'photo-1535575180499-e009db7bc2c8' },  // man on black bike
  { label: 'Touring',    badge: 'bg-blue-600',   img: 'photo-1558981001-792f6c0d5068' },     // Harley on dock at sunset
  { label: 'Scrambler',  badge: 'bg-red-600',    img: 'photo-1558981420-87aa9dad1c89' },     // Harley on open road
  { label: 'Classic',    badge: 'bg-yellow-500', img: 'photo-1558981852-426c6c22a060' },     // man beside silver Harley
];

const FEATURES = [
  {
    Icon: Bike,
    accent: 'border-red-600',
    iconBg: 'bg-red-600/10',
    iconColor: 'text-red-500',
    title: 'Biker profiles',
    description: "Your profile includes your photos, your bike details, your riding style, your location, and what you're looking for. Browse real profile photos of motorcycle riders near you — everyone is a verified UK biker.",
  },
  {
    Icon: Heart,
    accent: 'border-red-600',
    iconBg: 'bg-red-600/10',
    iconColor: 'text-red-500',
    title: 'Find real love',
    description: 'Whether you want something casual or a soulmate who rides — REVdating is built for real relationships, not just hookups.',
  },
  {
    Icon: Flame,
    accent: 'border-yellow-400',
    iconBg: 'bg-yellow-400/10',
    iconColor: 'text-yellow-400',
    title: 'Swipe & date',
    description: "Like a profile to show interest — or use Rev It, REVdating's super-like, to make it clear you're seriously interested. When the interest is mutual, it's a match. From there, start chatting.",
  },
  {
    Icon: MapPin,
    accent: 'border-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Local biker dates',
    description: "Set your distance and find motorcycle singles near you — whether you're in London, Manchester, Glasgow or anywhere across the UK. Coffee first, open road together next.",
  },
  {
    Icon: MessageCircle,
    accent: 'border-red-600',
    iconBg: 'bg-red-600/10',
    iconColor: 'text-red-500',
    title: 'Real-time chat',
    description: 'Matched? Start talking. Real-time messaging so the conversation never goes cold.',
  },
  {
    Icon: Shield,
    accent: 'border-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Safety first',
    description: 'Photo moderation, report & block tools, and a human admin team keep REVdating a safe space.',
  },
  {
    Icon: Star,
    accent: 'border-yellow-400',
    iconBg: 'bg-yellow-400/10',
    iconColor: 'text-yellow-400',
    title: 'Premium',
    description: 'See who liked you, unlock more Rev It credits, and boost your profile to the top of the stack.',
  },
];

/* Builds a direct Unsplash image URL — proxied via /_next/image to avoid ORB */
function unsplash(id: string, w = 800, h = 600) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://revdating.co.uk/',
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── NAV ────────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-black/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-2xl font-black tracking-widest">
            <span className="text-white">REV</span>
            <span className="text-red-600">dating</span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
            >
              Join free →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-24 overflow-hidden">
        {/* Full-bleed hero photo with dark gradient overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/heroimage.png"
            alt="Couple on a motorcycle at the beach"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
        </div>

        {/* Left yellow accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400 z-10" />

        <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-14 py-28">
          <div className="flex flex-col md:flex-row items-center gap-10 lg:gap-16">

            {/* ── Blonde biker portrait ── */}
            <div className="hidden md:block relative w-72 lg:w-80 xl:w-96 flex-shrink-0 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] border border-white/10 ring-2 ring-yellow-400/30" style={{height: '520px'}}>
              <Image
                src={unsplash('photo-1682345334042-3b4b8ab0c29a', 600, 900)}
                alt="A woman on REVdating, a biker dating app for UK motorcycle riders"
                fill
                className="object-cover object-center"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">⭐ REVdating Rider</span>
              </div>
            </div>

          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-8">
              <Zap className="w-3.5 h-3.5" />
              Biker dating · Built for UK riders
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
              The UK biker
              <br />
              <span className="text-red-500">dating app</span>
              <br />
              built for riders
            </h1>

            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed mb-10 max-w-lg">
              REVdating is the UK dating app built exclusively for bikers. Find love,
              sparks, or your perfect riding partner — meet real motorcycle riders
              near you and connect with someone who truly gets the ride.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-lg transition-all hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.4)]"
              >
                Start dating free
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-white/30 hover:border-white/60 text-white font-bold text-lg transition-all hover:bg-white/5"
              >
                Sign in
              </Link>
            </div>

            <div className="flex items-center gap-6 mt-10 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Free to join
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
                Verified profiles
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-yellow-400" />
                UK riders only
              </span>
            </div>
          </div>
          </div>{/* end flex row */}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black to-transparent z-10" />
      </section>

      {/* ── EARLY ACCESS STATUS ──────────────────────────────────────── */}
      <section className="bg-zinc-900 border-b border-zinc-800 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live &amp; open
            </span>
            <p className="text-zinc-300 font-medium">
              REVdating is live — sign up and start matching with UK bikers today.
            </p>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 flex-shrink-0">
            <span>Native iOS &amp; Android apps — <span className="text-yellow-400">coming soon</span></span>
            <Link href="/install" className="text-red-400 hover:text-red-300 font-semibold transition-colors">Install now →</Link>
          </div>
        </div>
      </section>

      {/* ── WHAT IS REVDATING / HOW IT WORKS ────────────────────────── */}
      <section className="bg-zinc-950 py-20 px-6 border-b border-zinc-900">
        <div className="max-w-5xl mx-auto">

          {/* Entity definition */}
          <div className="mb-20">
            <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">
              What is REVdating?
            </p>
            <h2 className="text-3xl md:text-4xl font-black mb-8 leading-tight">
              The UK's dedicated biker dating platform
            </h2>
            <div className="grid md:grid-cols-2 gap-6 text-zinc-300 text-lg leading-relaxed">
              <p>
                REVdating is a free UK biker dating app built exclusively for motorcycle riders
                and biker singles across the United Kingdom. It is a progressive web app (PWA)
                — meaning it works in any browser on your phone, tablet, or laptop without
                needing to be downloaded from an app store.
              </p>
              <p>
                REVdating is designed for men and women who ride — sports bike riders, cruiser
                fans, Harley-Davidson enthusiasts, adventure tourers, café racer lovers, naked
                bike riders, touring riders, and scramblers. It is also for people passionate
                about the biker lifestyle who want to meet someone who truly gets it.
                REVdating is available exclusively in the United Kingdom — every rider you
                see on the platform is UK-based.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div>
            <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-black mb-10 leading-tight">
              Three steps to your riding partner
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {([
                {
                  step: 1,
                  colour: 'bg-red-600 text-white',
                  title: 'Create your biker profile',
                  body: "Sign up free — no credit card needed. Add your photos, tell us what you ride, describe your riding style, and say what you're looking for. Your profile shows your bike type, your location, and the real you.",
                },
                {
                  step: 2,
                  colour: 'bg-yellow-400 text-black',
                  title: 'Browse and match with riders near you',
                  body: "Browse real motorcycle riders across the UK. Like a profile to show interest, or use Rev It — REVdating's super-like — to show serious interest. When two riders both express interest, it's a match.",
                },
                {
                  step: 3,
                  colour: 'bg-blue-500 text-white',
                  title: 'Chat and meet in real life',
                  body: "Once matched, message each other in real time. You can only message people who have matched with you — no unsolicited messages. From there: a coffee, a first date, or your first ride out together.",
                },
              ] as { step: number; colour: string; title: string; body: string }[]).map(({ step, colour, title, body }) => (
                <div key={step} className="flex flex-col gap-4">
                  <div className={`w-10 h-10 rounded-full ${colour} flex items-center justify-center font-black text-lg flex-shrink-0`}>
                    {step}
                  </div>
                  <h3 className="font-black text-xl text-white">{title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── BIKE TYPES GRID ─────────────────────────────────────────────── */}
      <section className="bg-black py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-2">
                Every style. Every rider. Every heart.
              </p>
              <h2 className="text-4xl md:text-5xl font-black leading-tight">
                Date any kind of biker
              </h2>
            </div>
            <p className="text-zinc-500 text-sm max-w-xs md:text-right">
              Whether you ride a sports bike in London or tour the Highlands on a Harley — REVdating connects motorcycle singles across the UK. Every riding style welcome.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BIKE_TYPES.map((bike) => (
              <div
                key={bike.label}
                className="relative rounded-2xl overflow-hidden group aspect-[4/3]"
              >
                <Image
                  src={unsplash(bike.img, 600, 450)}
                  alt={`${bike.label} motorcycle — UK biker singles on REVdating`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className={`${bike.badge} text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full`}>
                    {bike.label}
                  </span>
                </div>
                <p className="absolute bottom-3 left-3 right-3 text-white font-bold text-sm">
                  {bike.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REAL RIDERS PHOTO SECTION ───────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-2">
              Our community
            </p>
            <h2 className="text-4xl md:text-5xl font-black">
              Real UK bikers.{' '}
              <span className="text-yellow-400">Real romance.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Female biker */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1619849143518-8ed46f904878', 600, 800)}
                alt="Female motorcycle rider — meet UK biker singles on REVdating"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-widest mb-2">
                  Women who ride in the UK
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Meet real female motorcycle riders across England, Scotland, Wales &amp; NI
                </p>
              </div>
            </div>

            {/* Male biker */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1535575180499-e009db7bc2c8', 600, 800)}
                alt="Male motorcycle rider — UK biker dating on REVdating"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-widest mb-2">
                  Men who ride near you
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Connect with UK motorcycle riders who share your passion for the road
                </p>
              </div>
            </div>

            {/* Together */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1558981420-87aa9dad1c89', 600, 800)}
                alt="Two riders on motorcycles — find your riding partner on REVdating UK"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-black uppercase tracking-widest mb-2">
                  Ride together in the UK
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Find your co-rider — from casual dates to life on two wheels together
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="bg-black py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-2">
              Built different
            </p>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              Biker dating,
              <br />built for UK riders
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto text-lg">
              Not a generic app with a motorcycle filter. REVdating is built from
              the ground up for biker dating — every feature, every detail.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`p-6 rounded-2xl bg-zinc-900 border-l-4 ${f.accent} hover:bg-zinc-800 transition-colors`}
              >
                <div className={`w-11 h-11 rounded-xl ${f.iconBg} flex items-center justify-center mb-4`}>
                  <f.Icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className="font-black text-lg mb-2">{f.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SAFETY ────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 px-6 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-3">
                Safe by design
              </p>
              <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
                Your safety on REVdating
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                REVdating is designed to be a safe, respectful space for UK bikers — for women
                and men alike. Here is how we keep it that way.
              </p>
            </div>
            <div className="space-y-6">
              {([
                {
                  title: 'Photo moderation',
                  body: 'Every profile photo is reviewed to remove fake, inappropriate, or misleading images before they appear to other members.',
                },
                {
                  title: 'Report and block',
                  body: 'Every user can report or block any other user instantly. Reports are reviewed by our human moderation team.',
                },
                {
                  title: 'Safe messaging',
                  body: "You can only message someone after you've both matched — no unsolicited messages from strangers, ever.",
                },
                {
                  title: 'Human admin team',
                  body: 'REVdating is monitored by a real moderation team — not just automated filters. Real people review reports and take action.',
                },
                {
                  title: 'UK data protection',
                  body: 'Registered with the UK ICO (Reg: ZC079121). Compliant with UK GDPR and the Data Protection Act 2018. Your data is never sold to third parties.',
                },
              ] as { title: string; body: string }[]).map(({ title, body }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-2.5 flex-shrink-0" />
                  <div>
                    <p className="font-black text-white mb-1">{title}</p>
                    <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY NOT GENERIC APPS ─────────────────────────────────────── */}
      <section className="bg-black py-20 px-6 border-y border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-3">
                Built differently
              </p>
              <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
                Why REVdating instead of Tinder, Bumble, or Facebook Dating?
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Generic dating apps have millions of users — but almost none of them are bikers.
                Searching for a fellow rider on Tinder means swiping through thousands of
                non-riders and hoping a filter does the work. REVdating is built differently.
              </p>
              <p className="text-zinc-600 text-sm mt-6 italic">
                REVdating is not Tinder with a biker filter. It is a purpose-built platform
                for the UK motorcycle community — designed from the ground up for people who ride.
              </p>
            </div>
            <div className="space-y-4">
              {[
                'Every member is a motorcycle rider or biker lifestyle enthusiast based in the UK',
                'Every profile shows what they ride, how often, and their riding style',
                'Matching is built around biker compatibility — not just appearance',
                'UK-only community — every potential match is someone you could actually meet in person',
                "Features like Rev It, biker-specific profile fields, and ride-focused discovery don't exist on generic apps",
                'No non-rider profiles to filter through — ever',
              ].map((point) => (
                <div key={point} className="flex gap-3 items-start">
                  <ChevronRight className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-zinc-300 leading-relaxed">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW TO INSTALL THE APP (PWA) ─────────────────────────────── */}
      <section id="install" className="bg-zinc-950 border-t border-zinc-900 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-yellow-400 text-sm font-bold uppercase tracking-widest mb-2">No App Store needed</p>
            <h2 className="text-3xl md:text-4xl font-black">Add REVdating to your phone</h2>
            <p className="text-zinc-400 text-lg mt-4 max-w-xl mx-auto">
              REVdating is a Progressive Web App — it works in your browser and installs directly
              on your phone&apos;s home screen. No App Store. No Google Play. No waiting.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-lg mb-5">1</div>
              <h3 className="font-black text-white text-lg mb-2">iPhone (Safari)</h3>
              <ol className="text-zinc-400 text-sm leading-relaxed space-y-1.5 list-none">
                <li>Open <span className="text-white font-semibold">revdating.co.uk</span> in Safari</li>
                <li>Tap the <span className="text-white font-semibold">Share</span> button (box with arrow)</li>
                <li>Scroll down → tap <span className="text-white font-semibold">&ldquo;Add to Home Screen&rdquo;</span></li>
                <li>Tap <span className="text-white font-semibold">Add</span> — done</li>
              </ol>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400 font-black text-lg mb-5">2</div>
              <h3 className="font-black text-white text-lg mb-2">Android (Chrome)</h3>
              <ol className="text-zinc-400 text-sm leading-relaxed space-y-1.5 list-none">
                <li>Open <span className="text-white font-semibold">revdating.co.uk</span> in Chrome</li>
                <li>Tap the <span className="text-white font-semibold">⋮ menu</span> (top right)</li>
                <li>Tap <span className="text-white font-semibold">&ldquo;Add to Home screen&rdquo;</span> or <span className="text-white font-semibold">&ldquo;Install app&rdquo;</span></li>
                <li>Tap <span className="text-white font-semibold">Add</span> — done</li>
              </ol>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-black text-lg mb-5">✓</div>
              <h3 className="font-black text-white text-lg mb-2">Once installed</h3>
              <ul className="text-zinc-400 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
                <li>Stays signed in automatically</li>
                <li>Sends match &amp; message notifications</li>
                <li>Full-screen — no browser bar</li>
                <li>Works on any phone, tablet, or laptop</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SPLIT CTA PANEL ─────────────────────────────────────────────────────────────────────────────────────────────────── */}
      <section className="bg-black py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl overflow-hidden grid md:grid-cols-2">
            {/* Red panel */}
            <div className="bg-red-600 p-10 md:p-14 flex flex-col justify-center">
              <p className="text-red-200 text-sm font-bold uppercase tracking-widest mb-4">
                Stop dating people who don't get it
              </p>
              <h2 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              Date someone who{' '}
              <span className="text-yellow-300">loves the ride</span>
              </h2>
              <p className="text-red-100 text-lg mb-8 leading-relaxed">
              Every profile shows what you ride, how often, and what you're looking for.
              Meet biker singles and motorcycle riders across the UK who match your
              passion — and your postcode.
              </p>
              <Link
                href="/register"
                className="self-start inline-flex items-center gap-2 px-8 py-4 rounded-full bg-black text-white font-black text-lg hover:bg-zinc-900 transition-colors"
              >
                Find your match
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Photo panel */}
            <div className="relative aspect-video md:aspect-auto min-h-[300px]">
              <Image
                src={unsplash('photo-1568772585407-9361f9bf3a87', 800, 600)}
                alt="Red sport motorcycle"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-red-600/20" />
              <div className="absolute bottom-0 inset-x-0 h-1.5 bg-yellow-400" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="relative bg-black py-28 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-red-600/5 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-400/40 bg-yellow-400/5 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-8">
            <Flame className="w-3.5 h-3.5" />
              Free to join — always
          </div>
          <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Ready to meet
            <br />
            <span className="text-red-500">UK biker singles?</span>
          </h2>
          <p className="text-zinc-400 text-xl mb-10">
            Join the UK biker dating app — free to start, no credit card needed.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xl transition-all hover:scale-105 shadow-[0_0_60px_rgba(220,38,38,0.5)]"
          >
            Start dating free
            <ChevronRight className="w-6 h-6" />
          </Link>
          <p className="text-zinc-600 text-sm mt-6">
            By joining you agree to our{' '}
            <Link href="/terms" className="underline hover:text-zinc-400 transition-colors">Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 border-t border-zinc-900 py-20 px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              '@id': 'https://revdating.co.uk/#faq',
              url: 'https://revdating.co.uk/',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'Is REVdating free?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes — REVdating is free to join and use. Premium features (like seeing who liked you and boosting your profile) are available as an optional upgrade. No credit card required to sign up.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is REVdating only for UK bikers?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "Yes. REVdating is a UK-only biker dating app. Every rider on the platform is based in the United Kingdom — so you're always matching with real local biker singles.",
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What types of motorcycle riders use REVdating?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'All of them. Sports bike riders, cruiser fans, adventure tourers, café racer enthusiasts, Harley-Davidson riders, naked bike riders, tourers, and scramblers — if you ride, you belong on REVdating.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is REVdating an app or a website?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Both. REVdating works in any browser on your phone or desktop, and can be installed as an app directly from the website — no app store required.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How is REVdating different from Tinder or Bumble?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "REVdating is built exclusively for motorcycle riders and bikers. Every profile shows what you ride, every match is a real rider, and every feature is designed around the biker lifestyle — not a generic dating template with a motorcycle filter bolted on.",
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Do REVdating profiles include photos?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "Yes. Every REVdating profile includes photos alongside bike details, riding style, location, and what the person is looking for. You can browse real profile photos of motorcycle riders near you before choosing to like or match.",
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What is Rev It on REVdating?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "Rev It is REVdating's super-like feature. When you Rev It on someone's profile, it signals you are seriously interested — more than a standard like. If they like you back or Rev It you, it becomes an instant match.",
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How does matching work on REVdating?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Matching on REVdating is mutual. Browse motorcycle riders near you and like profiles that interest you. When two riders both like each other — or one uses Rev It and the other responds — it becomes a match. Once matched, you can start chatting in real time.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is REVdating safe for women?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'REVdating is designed to be safe for all members. Profile photos are moderated to remove fake or misleading images. You can only receive messages from people you have already matched with — no unsolicited contact. Every user can report or block any other user instantly, and all reports are reviewed by a human moderation team.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What does REVdating cost?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'REVdating is free to join. The free plan includes creating a full profile with photos, browsing riders near you, matching, and messaging your matches. Premium features — such as seeing who liked your profile, extra Rev It credits, and a profile boost — are available as an optional paid upgrade.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Who is REVdating for?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'REVdating is for anyone in the UK who rides or loves motorcycles — sports bike riders, cruiser and Harley-Davidson fans, adventure tourers, café racer enthusiasts, naked bike riders, touring riders, scrambler owners, and people passionate about the biker lifestyle. REVdating is open to all genders and orientations, and welcomes people seeking relationships, dates, friendships, or riding companions.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How do I install REVdating on my phone?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "REVdating is a Progressive Web App — no App Store download required. On iPhone: open revdating.co.uk in Safari, tap the Share button, then 'Add to Home Screen'. On Android: open revdating.co.uk in Chrome, tap the three-dot menu, then 'Add to Home screen'. It works like a native app once installed.",
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How do I delete my REVdating account?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Go to Settings → Delete account. Your profile, photos, matches, and messages are permanently removed within 30 days under UK GDPR. If you cannot access your account, email dpo@revdating.app from your registered address with the subject "Account deletion request".',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'How do I report someone on REVdating?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Tap the three-dot menu (⋯) on any profile or message thread and select Report. All reports are reviewed by a human moderation team. For urgent or illegal content, email safety@revdating.app with URGENT in the subject line. You can block any user instantly — blocked users cannot see your profile or contact you.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Do I need to own a motorbike to use REVdating?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No. REVdating welcomes motorcycle enthusiasts and people passionate about the biker lifestyle — not just registered bike owners. You do need a genuine interest in motorcycling. If you love the culture, the rides, and the community, you belong here.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'When is REVdating fully launching?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: "REVdating is live and open to join right now. The core app — matching, chat, photo profiles, safety tools — is fully functional. We're rolling out additional features including the Ride Date Planner, club profiles, and native iOS and Android apps through 2026. Sign up now to be part of the early community.",
                  },
                },
              ],
            }),
          }}
        />
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-2">About REVdating</p>
            <h2 className="text-3xl md:text-4xl font-black">Biker dating questions, answered</h2>
          </div>
          <dl className="space-y-4">
            {(
              [
                {
                  q: 'Is REVdating free?',
                  a: 'Yes — REVdating is free to join and use. Premium features (like seeing who liked you and boosting your profile) are available as an optional upgrade. No credit card required to sign up.',
                },
                {
                  q: 'Is REVdating only for UK bikers?',
                  a: "Yes. REVdating is a UK-only biker dating app. Every rider on the platform is based in the United Kingdom — so you're always matching with real local biker singles.",
                },
                {
                  q: 'What types of motorcycle riders use REVdating?',
                  a: 'All of them. Sports bike riders, cruiser fans, adventure tourers, café racer enthusiasts, Harley-Davidson riders, naked bike riders, tourers, and scramblers — if you ride, you belong on REVdating.',
                },
                {
                  q: 'Is REVdating an app or a website?',
                  a: 'Both. REVdating works in any browser on your phone or desktop, and can be installed as an app directly from the website — no app store required.',
                },
                {
                  q: 'How is REVdating different from Tinder or Bumble?',
                  a: "REVdating is built exclusively for motorcycle riders and bikers. Every profile shows what you ride, every match is a real rider, and every feature is designed around the biker lifestyle — not a generic dating template with a motorcycle filter bolted on.",
                },
                {
                  q: 'Do REVdating profiles include photos?',
                  a: "Yes. Every REVdating profile includes photos alongside bike details, riding style, location, and what the person is looking for. You can browse real profile photos of motorcycle riders near you before choosing to like or match.",
                },
                {
                  q: 'What is Rev It on REVdating?',
                  a: "Rev It is REVdating's super-like feature. When you Rev It on someone's profile, it signals you're seriously interested — more than a standard like. If they like you back or Rev It you, it becomes an instant match.",
                },
                {
                  q: 'How does matching work on REVdating?',
                  a: 'Matching on REVdating is mutual. Browse motorcycle riders near you and like profiles that interest you. When two riders both like each other — or one uses Rev It and the other responds — it becomes a match. Once matched, you can start chatting in real time.',
                },
                {
                  q: 'Is REVdating safe for women?',
                  a: 'REVdating is designed to be safe for all members. Profile photos are moderated to remove fake or misleading images. You can only receive messages from people you have already matched with — no unsolicited contact. Every user can report or block any other user instantly, and all reports are reviewed by a human moderation team.',
                },
                {
                  q: 'What does REVdating cost?',
                  a: 'REVdating is free to join. The free plan includes creating a full profile with photos, browsing riders near you, matching, and messaging your matches. Premium features — such as seeing who liked your profile, extra Rev It credits, and a profile boost — are available as an optional paid upgrade.',
                },
                {
                  q: 'Who is REVdating for?',
                  a: 'REVdating is for anyone in the UK who rides or loves motorcycles — sports bike riders, cruiser and Harley-Davidson fans, adventure tourers, café racer enthusiasts, naked bike riders, touring riders, scrambler owners, and people passionate about the biker lifestyle. REVdating is open to all genders and orientations, and welcomes people seeking relationships, dates, friendships, or riding companions.',
                },
                {
                  q: 'How do I install REVdating on my phone?',
                  a: "REVdating is a Progressive Web App — no App Store download required. On iPhone: open revdating.co.uk in Safari, tap the Share button, then 'Add to Home Screen'. On Android: open revdating.co.uk in Chrome, tap the three-dot menu, then 'Add to Home screen'. It works like a native app once installed.",
                },
                {
                  q: 'How do I delete my REVdating account?',
                  a: 'Go to Settings → Delete account. Your profile, photos, matches, and messages are permanently removed within 30 days under UK GDPR. If you cannot access your account, email dpo@revdating.app from your registered address with the subject line "Account deletion request".',
                },
                {
                  q: 'How do I report someone on REVdating?',
                  a: "Tap the three-dot menu (⋯) on any profile or message thread and select Report. All reports are reviewed by a human moderation team. For urgent or potentially illegal content, email safety@revdating.app with URGENT in the subject line. You can block any user instantly — blocked users cannot see your profile or contact you.",
                },
                {
                  q: 'Do I need to own a motorbike to use REVdating?',
                  a: 'No. REVdating welcomes motorcycle enthusiasts and people passionate about the biker lifestyle — not just registered bike owners. You do need a genuine interest in motorcycling. If you love the culture, the rides, and the community, you belong here.',
                },
                {
                  q: 'When is REVdating fully launching?',
                  a: "REVdating is live and open to join right now. The core app — matching, chat, photo profiles, safety tools — is fully functional. We're rolling out additional features including the Ride Date Planner, club profiles, and native iOS and Android apps through 2026. Sign up now to be part of the early community.",
                },
              ] as { q: string; a: string }[]
            ).map(({ q, a }) => (
              <div key={q} className="border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
                <dt className="font-black text-lg mb-2 text-white">{q}</dt>
                <dd className="text-zinc-400 leading-relaxed">{a}</dd>
              </div>
            ))}
          </dl>

          {/* About REVdating */}
          <div className="mt-12 p-8 rounded-2xl bg-zinc-900 border border-zinc-800">
            <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-3">Who we are</p>
            <h3 className="text-xl font-black text-white mb-4">About REVdating</h3>
            <p className="text-zinc-400 leading-relaxed mb-4">
              REVdating is owned and operated by Heimdell Tech Ai Ltd, registered in England &amp; Wales
              (Company No. 16478408). Registered Office: 11 Lower Croft, Preston, PR1 9DJ. We are
              registered with the UK Information Commissioner's Office (ICO Reg: ZC079121) and comply
              with UK GDPR and the Data Protection Act 2018. Your data is never sold to third parties.
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed italic">
              Our mission: to give UK bikers their own dating community — somewhere you don't have to
              explain why you ride, why the bike matters, or why a country road beats a wine bar for a
              first date. If you ride, you belong here.
            </p>
          </div>

        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="font-display text-2xl font-black tracking-widest">
              <span className="text-white">REV</span>
              <span className="text-red-600">dating</span>
            </span>
            <p className="text-zinc-500 text-sm mt-1">
              The UK biker dating app
              <Link href="/admin" className="opacity-0 hover:opacity-0 select-none cursor-default" tabIndex={-1} aria-hidden="true">.</Link>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
            <Link href="/privacy"              className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms"                className="hover:text-white transition-colors">Terms</Link>
            <Link href="/community-guidelines" className="hover:text-white transition-colors">Guidelines</Link>
            <Link href="/safety-policy"        className="hover:text-white transition-colors">Safety</Link>
            <Link href="/cookies"              className="hover:text-white transition-colors">Cookies</Link>
            <Link href="/contact"              className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="text-zinc-600 text-xs text-center md:text-right leading-relaxed">
            <Link href="/portal" className="opacity-0 hover:opacity-0 select-none pointer-events-auto" tabIndex={-1} aria-hidden="true">©</Link>
            <p>© 2026 Heimdell Tech Ai Ltd.</p>
            <p>Registered in England &amp; Wales. Company No. 16478408.</p>
            <p>Registered Office: 11 Lower Croft, Preston, PR1 9DJ.</p>
            <p>ICO Reg: ZC079121.</p>
          </div>
        </div>
      </footer>

    </main>
  );
}
