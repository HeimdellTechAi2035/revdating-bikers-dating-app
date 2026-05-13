import Link from 'next/link';
import Image from 'next/image';
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
    description: 'Show off your bike, riding style, and personality. Date someone who truly gets your passion for the road.',
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
    description: 'Like, pass, or Rev It on real bikers near you. When the spark is mutual — it’s a match. Start something special.',
  },
  {
    Icon: MapPin,
    accent: 'border-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    title: 'Local biker dates',
    description: 'Set your distance. Meet bikers close enough for a coffee, a date, and maybe that first ride together.',
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

const STATS = [
  { value: '50K+', label: 'Bikers dating',      color: 'text-red-500' },
  { value: '120+', label: 'Cities covered',      color: 'text-yellow-400' },
  { value: '18K+', label: 'Couples matched',     color: 'text-blue-400' },
  { value: '4.8★', label: 'App store rating',   color: 'text-white' },
];

/* Builds a direct Unsplash image URL — proxied via /_next/image to avoid ORB */
function unsplash(id: string, w = 800, h = 600) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── CONCEPT BANNER ──────────────────────────────────────────────── */}
      <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white text-center text-xs font-semibold py-1.5 tracking-wide">
        🚧 Concept App — Full launch coming soon. Stay tuned!
      </div>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-8 inset-x-0 z-50 bg-black/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-display text-2xl font-black tracking-widest">
            <span className="text-white">REV</span>
            <span className="text-red-600">MATCH</span>
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
                alt="Cute blonde biker woman"
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
              The #1 dating app for bikers
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
              Date someone
              <br />
              <span className="text-red-500">who rides</span>
              <br />
              like you do
            </h1>

            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed mb-10 max-w-lg">
              REVdating is the dating app built exclusively for bikers. Find love,
              sparks, or your perfect partner — someone who shares your passion
              for the road and the rumble.
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
                <Heart className="w-3.5 h-3.5 text-red-500" />
                50K+ bikers dating
              </span>
            </div>
          </div>
          </div>{/* end flex row */}
        </div>

        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black to-transparent z-10" />
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
              Sports, cruisers, café racers, adventure riders — the bike gets you noticed. Your personality finds you love.
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
                  alt={`${bike.label} motorcycle`}
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
              Real bikers.{' '}
              <span className="text-yellow-400">Real romance.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Female biker */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1619849143518-8ed46f904878', 600, 800)}
                alt="Female biker with motorcycle"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-widest mb-2">
                  Women who ride
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Date amazing women who live for the road
                </p>
              </div>
            </div>

            {/* Male biker */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1535575180499-e009db7bc2c8', 600, 800)}
                alt="Male biker in leather jacket"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black uppercase tracking-widest mb-2">
                  Men who ride
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Date passionate bikers near you
                </p>
              </div>
            </div>

            {/* Together */}
            <div className="relative rounded-3xl overflow-hidden aspect-[3/4] group">
              <Image
                src={unsplash('photo-1558981420-87aa9dad1c89', 600, 800)}
                alt="Biker riding on the road"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1 bg-yellow-400" />
              <div className="absolute bottom-0 inset-x-0 p-5">
                <span className="inline-block px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-black uppercase tracking-widest mb-2">
                  Ride together
                </span>
                <p className="text-white font-bold text-lg leading-snug">
                  Find love and ride off into the sunset together
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
              Dating, designed
              <br />for bikers
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

      {/* ── STATS ───────────────────────────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 px-6 border-y border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label} className="space-y-2">
                <p className={`text-5xl md:text-6xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SPLIT CTA PANEL ─────────────────────────────────────────────── */}
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
              Find a date who matches your passion — not just your postcode.
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
            Ready to find
            <br />
            <span className="text-red-500">biker love?</span>
          </h2>
          <p className="text-zinc-400 text-xl mb-10">
            Join 50,000+ bikers already dating on REVdating. No credit card needed.
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

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="font-display text-2xl font-black tracking-widest">
              <span className="text-white">REV</span>
              <span className="text-red-600">MATCH</span>
            </span>
            <p className="text-zinc-500 text-sm mt-1">
              The #1 dating app for bikers
              <Link href="/admin" className="opacity-0 hover:opacity-0 select-none cursor-default" tabIndex={-1} aria-hidden="true">.</Link>
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
            <Link href="/privacy"              className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms"                className="hover:text-white transition-colors">Terms</Link>
            <Link href="/community-guidelines" className="hover:text-white transition-colors">Guidelines</Link>
            <Link href="/safety-policy"        className="hover:text-white transition-colors">Safety</Link>
            <Link href="/cookies"              className="hover:text-white transition-colors">Cookies</Link>
          </div>
          <div className="text-zinc-600 text-xs text-center md:text-right leading-relaxed">
            <Link href="/portal" className="opacity-0 hover:opacity-0 select-none pointer-events-auto" tabIndex={-1} aria-hidden="true">©</Link>
            <p>© 2026 Heimdell Tech Ai Ltd.</p>
            <p>Registered in England &amp; Wales. Company No. 16478408.</p>
            <p>ICO Reg: ZC079121.</p>
          </div>
        </div>
      </footer>

    </main>
  );
}
