/**
 * Stage 1 quiz — email capture with algorithmic destination matching.
 * 4 questions (vibe → season → guest count → budget) → email → top 3 matched destinations.
 * No phone, no full lead form. Low friction, high aspiration.
 */

import { useState, useEffect, useRef } from 'react';
import destinationsData from '../../data/destinations.json';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

function fireEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params);
}

interface DestData {
  slug: string;
  name: string;
  emoji: string;
  country: string;
  vibeProfile: string[];
  bestMonths: string[];
  guestCapacity: string;
  budgetTier: string;
  avgCostUSD: { min: number; max: number };
  guestBurden: { score: number };
  isHiddenGem: boolean;
}

const allDestinations: DestData[] = destinationsData as DestData[];

const VIBES = [
  { value: 'luxury', label: 'Luxe & romantic', image: '/images/quiz/vibe-luxury.jpg' },
  { value: 'tropical', label: 'Tropical & relaxed', image: '/images/quiz/vibe-tropical.jpg' },
  { value: 'boho', label: 'Bohemian & free-spirited', image: '/images/quiz/vibe-boho.jpg' },
  { value: 'adventurous', label: 'Adventurous & unique', image: '/images/quiz/vibe-adventurous.jpg' },
  { value: 'mediterranean', label: 'Mediterranean elegance', image: '/images/quiz/vibe-mediterranean.jpg' },
  { value: 'rustic', label: 'Rustic & vineyard', image: '/images/quiz/vibe-rustic.jpg' },
];

const SEASONS = [
  { value: 'winter', label: 'Winter (Dec–Feb)', image: '/images/quiz/season-winter.jpg', months: ['December', 'January', 'February'] },
  { value: 'spring', label: 'Spring (Mar–May)', image: '/images/quiz/season-spring.jpg', months: ['March', 'April', 'May'] },
  { value: 'summer', label: 'Summer (Jun–Aug)', image: '/images/quiz/season-summer.jpg', months: ['June', 'July', 'August'] },
  { value: 'fall', label: 'Fall (Sep–Nov)', image: '/images/quiz/season-fall.jpg', months: ['September', 'October', 'November'] },
  { value: 'flexible', label: "I'm flexible", image: '/images/quiz/season-flexible.jpg', months: [] },
];

const GUEST_COUNTS = [
  { value: 'intimate', label: 'Under 30 guests', image: '/images/quiz/guests-intimate.jpg' },
  { value: 'medium', label: '30–80 guests', image: '/images/quiz/guests-medium.jpg' },
  { value: 'large', label: '80+ guests', image: '/images/quiz/guests-large.jpg' },
];

const BUDGETS = [
  { value: 'budget', label: 'Under $15K total', image: '/images/quiz/budget-budget.jpg' },
  { value: 'mid', label: '$15K–$40K', image: '/images/quiz/budget-mid.jpg' },
  { value: 'luxury', label: '$40K+', image: '/images/quiz/budget-luxury.jpg' },
];

interface Answers {
  vibe?: string;
  season?: string;
  guestCount?: string;
  budget?: string;
}

function scoreDestination(dest: DestData, answers: Answers): number {
  let score = 0;

  // Vibe match (40 points max)
  if (answers.vibe && dest.vibeProfile.includes(answers.vibe)) {
    score += 40;
  }

  // Season match (30 points max)
  if (answers.season && answers.season !== 'flexible') {
    const seasonDef = SEASONS.find(s => s.value === answers.season);
    if (seasonDef) {
      const overlap = seasonDef.months.filter(m => dest.bestMonths.includes(m)).length;
      score += (overlap / seasonDef.months.length) * 30;
    }
  } else if (answers.season === 'flexible') {
    score += 15; // Neutral bonus for flexible
  }

  // Guest capacity match (20 points max)
  if (answers.guestCount) {
    if (dest.guestCapacity === answers.guestCount) {
      score += 20;
    } else if (dest.guestCapacity === 'large') {
      score += 10; // Large can accommodate smaller groups
    } else if (dest.guestCapacity === 'medium' && answers.guestCount === 'intimate') {
      score += 10;
    }
  }

  // Budget match (10 points max)
  if (answers.budget && dest.budgetTier === answers.budget) {
    score += 10;
  } else if (answers.budget === 'mid') {
    score += 5; // Partial credit for adjacent tiers
  }

  return score;
}

function getTopMatches(answers: Answers): DestData[] {
  const scored = allDestinations.map(d => ({
    dest: d,
    score: scoreDestination(d, answers),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Return top 3, ensuring at least some variety
  const top = scored.slice(0, 3).map(s => s.dest);
  return top;
}

function PhotoCard({ label, image, onClick, portrait = false }: {
  label: string;
  image: string;
  onClick: () => void;
  portrait?: boolean;
}) {
  return (
    <button
      className={`group relative overflow-hidden rounded-xl w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${portrait ? 'aspect-[4/3] sm:aspect-[2/3]' : 'aspect-[4/3]'}`}
      onClick={onClick}
    >
      <img
        src={image}
        alt={label}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
        width={portrait ? 320 : 480}
        height={portrait ? 480 : 360}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:from-black/80 transition-colors duration-200" />
      <span className="absolute bottom-0 left-0 right-0 px-3 py-2.5 text-white font-semibold text-sm text-left leading-tight">
        {label}
      </span>
    </button>
  );
}

interface Props {
  turnstileSiteKey?: string;
}

export default function DestinationQuiz({ turnstileSiteKey }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);
  const quizRef = useRef<HTMLDivElement>(null);

  // Render Turnstile widget when email step is visible
  useEffect(() => {
    if (step !== 4 || !turnstileSiteKey || !turnstileRef.current) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const render = () => {
      if (!window.turnstile || !turnstileRef.current) return false;
      turnstileWidgetRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        theme: 'light',
        size: 'flexible',
      });
      return true;
    };

    if (!render()) {
      intervalId = setInterval(() => {
        if (render() && intervalId) clearInterval(intervalId);
      }, 200);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (turnstileWidgetRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetRef.current);
        turnstileWidgetRef.current = null;
      }
    };
  }, [step, turnstileSiteKey]);

  const matches = submitted ? getTopMatches(answers) : [];

  function scrollToTop() {
    if (!quizRef.current) return;
    const rect = quizRef.current.getBoundingClientRect();
    const navHeight = (document.querySelector('header') as HTMLElement)?.offsetHeight ?? 80;
    window.scrollTo({ top: rect.top + window.scrollY - navHeight - 16, behavior: 'smooth' });
  }

  function pick(key: keyof Answers, value: string) {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    fireEvent(`quiz_${key}_selected`, { [key]: value });
    setTimeout(() => {
      setStep(s => s + 1);
      scrollToTop();
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Honeypot — silently fake success for bots
    if (honeypot) { setSubmitted(true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError('');

    const topMatches = getTopMatches(answers);

    try {
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email-capture',
          email,
          name: name || undefined,
          destination: topMatches[0]?.name,
          destinationSlug: topMatches[0]?.slug,
          vibe: answers.vibe,
          season: answers.season,
          guestCount: answers.guestCount,
          budget: answers.budget,
          matchedDestinations: topMatches.map(d => d.slug),
          utm_source: sessionStorage.getItem('utm_source') || undefined,
          utm_medium: sessionStorage.getItem('utm_medium') || undefined,
          utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
          'cf-turnstile-response': turnstileToken || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      fireEvent('stage1_captured', { destination: topMatches[0]?.slug });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Your top 3 matches!</h2>
        <p className="text-gray-600 mb-6">
          Based on your answers, these destinations are your best fit. We've also sent a personalized guide to your inbox.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {matches.map((dest, i) => (
            <a
              key={dest.slug}
              href={`/destinations/${dest.slug}/`}
              className="quiz-match-card group"
            >
              {i === 0 && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Best match
                </span>
              )}
              {dest.isHiddenGem && (
                <span className="absolute top-2 right-2 text-[9px] font-semibold text-brand-accent">
                  ✦ Gem
                </span>
              )}
              <span className="font-bold text-sm text-gray-900 group-hover:text-brand transition-colors">{dest.name}</span>
              <span className="text-xs text-gray-400 block">{dest.country}</span>
              <span className="text-xs text-gray-500 block mt-1">
                From ${(dest.avgCostUSD.min / 1000).toFixed(0)}k · Guest score: {dest.guestBurden.score}/10
              </span>
            </a>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/destinations/" className="quiz-btn-outline">
            Browse all destinations
          </a>
          <a href="/vendors/" className="quiz-btn-outline">
            Browse vendors
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Ready to get matched with a planner?{' '}
          <a href="/quiz/?stage=2" className="text-brand underline">
            Take the full quiz →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div ref={quizRef}>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`rounded-full transition-all duration-200 ${
              i === step
                ? 'w-6 h-2 bg-brand'
                : i < step
                ? 'w-2 h-2 bg-brand/40'
                : 'w-2 h-2 bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step 0: Vibe */}
      {step === 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            What's your wedding vibe?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">This helps us match you to destinations that fit your style.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {VIBES.map(v => (
              <PhotoCard key={v.value} label={v.label} image={v.image} onClick={() => pick('vibe', v.value)} />
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Season */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            When are you thinking?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">We'll match you to destinations with the best weather for your season.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SEASONS.map(s => (
              <PhotoCard key={s.value} label={s.label} image={s.image} onClick={() => pick('season', s.value)} />
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => { setStep(0); scrollToTop(); }}>← Back</button>
        </div>
      )}

      {/* Step 2: Guest count */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            How many guests?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">Some destinations are perfect for 20 guests, others handle 200.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {GUEST_COUNTS.map(g => (
              <PhotoCard key={g.value} label={g.label} image={g.image} onClick={() => pick('guestCount', g.value)} portrait />
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => { setStep(1); scrollToTop(); }}>← Back</button>
        </div>
      )}

      {/* Step 3: Budget */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            What's your total budget?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">Including venue, vendors, and travel — not per guest.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {BUDGETS.map(b => (
              <PhotoCard key={b.value} label={b.label} image={b.image} onClick={() => pick('budget', b.value)} portrait />
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => { setStep(2); scrollToTop(); }}>← Back</button>
        </div>
      )}

      {/* Step 4: Email capture */}
      {step === 4 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            Where should we send your matches?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            We'll send your top 3 destination matches with a personalized planning guide — free.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
              <label htmlFor="q-website">Website</label>
              <input id="q-website" type="text" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="q-name" className="quiz-label">Your first name <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                id="q-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane"
                className="quiz-input"
              />
            </div>
            <div>
              <label htmlFor="q-email" className="quiz-label">Email address *</label>
              <input
                id="q-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="quiz-input"
              />
            </div>
            {turnstileSiteKey && <div ref={turnstileRef} className="flex justify-center" />}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={submitting} className="quiz-submit-btn">
              {submitting ? 'Matching…' : 'Show my matches →'}
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-3">
            No spam. Unsubscribe anytime. We never sell your email.
          </p>
          <button className="quiz-back-btn mt-2" onClick={() => { setStep(3); scrollToTop(); }}>← Back</button>
        </div>
      )}
    </div>
  );
}
