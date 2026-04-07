/**
 * Stage 1 quiz — email capture with algorithmic destination matching.
 * 4 questions (vibe → season → guest count → budget) → email → top 3 matched destinations.
 * No phone, no full lead form. Low friction, high aspiration.
 */

import { useState } from 'react';
import destinationsData from '../../data/destinations.json';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
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
  { value: 'luxury', label: 'Luxe & romantic', icon: '🥂' },
  { value: 'tropical', label: 'Tropical & relaxed', icon: '🌺' },
  { value: 'boho', label: 'Bohemian & free-spirited', icon: '🌿' },
  { value: 'adventurous', label: 'Adventurous & unique', icon: '🏔️' },
  { value: 'mediterranean', label: 'Mediterranean elegance', icon: '🍷' },
  { value: 'rustic', label: 'Rustic & vineyard', icon: '🍇' },
];

const SEASONS = [
  { value: 'winter', label: 'Winter (Dec–Feb)', icon: '❄️', months: ['December', 'January', 'February'] },
  { value: 'spring', label: 'Spring (Mar–May)', icon: '🌸', months: ['March', 'April', 'May'] },
  { value: 'summer', label: 'Summer (Jun–Aug)', icon: '☀️', months: ['June', 'July', 'August'] },
  { value: 'fall', label: 'Fall (Sep–Nov)', icon: '🍂', months: ['September', 'October', 'November'] },
  { value: 'flexible', label: "I'm flexible", icon: '📅', months: [] },
];

const GUEST_COUNTS = [
  { value: 'intimate', label: 'Under 30 guests', icon: '💕' },
  { value: 'medium', label: '30–80 guests', icon: '👫' },
  { value: 'large', label: '80+ guests', icon: '🎉' },
];

const BUDGETS = [
  { value: 'budget', label: 'Under $15K total', icon: '💰' },
  { value: 'mid', label: '$15K–$40K', icon: '💎' },
  { value: 'luxury', label: '$40K+', icon: '👑' },
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

export default function DestinationQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const matches = submitted ? getTopMatches(answers) : [];

  function pick(key: keyof Answers, value: string) {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    fireEvent(`quiz_${key}_selected`, { [key]: value });
    setTimeout(() => setStep(s => s + 1), 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        <div className="text-5xl mb-4">🌊</div>
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
              <span className="text-3xl mb-2 block">{dest.emoji}</span>
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
    <div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {VIBES.map(v => (
              <button
                key={v.value}
                className="quiz-option-card py-5"
                onClick={() => pick('vibe', v.value)}
              >
                <span className="text-3xl mb-2">{v.icon}</span>
                <span className="font-semibold text-sm text-gray-900">{v.label}</span>
              </button>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SEASONS.map(s => (
              <button
                key={s.value}
                className="quiz-option-card py-4"
                onClick={() => pick('season', s.value)}
              >
                <span className="text-2xl mb-1">{s.icon}</span>
                <span className="font-semibold text-sm text-gray-900">{s.label}</span>
              </button>
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => setStep(0)}>← Back</button>
        </div>
      )}

      {/* Step 2: Guest count */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            How many guests?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">Some destinations are perfect for 20 guests, others handle 200.</p>
          <div className="grid grid-cols-3 gap-3">
            {GUEST_COUNTS.map(g => (
              <button
                key={g.value}
                className="quiz-option-card py-5"
                onClick={() => pick('guestCount', g.value)}
              >
                <span className="text-3xl mb-2">{g.icon}</span>
                <span className="font-semibold text-sm text-gray-900">{g.label}</span>
              </button>
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => setStep(1)}>← Back</button>
        </div>
      )}

      {/* Step 3: Budget */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            What's your total budget?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">Including venue, vendors, and travel — not per guest.</p>
          <div className="grid grid-cols-3 gap-3">
            {BUDGETS.map(b => (
              <button
                key={b.value}
                className="quiz-option-card py-5"
                onClick={() => pick('budget', b.value)}
              >
                <span className="text-3xl mb-2">{b.icon}</span>
                <span className="font-semibold text-sm text-gray-900">{b.label}</span>
              </button>
            ))}
          </div>
          <button className="quiz-back-btn mt-4" onClick={() => setStep(2)}>← Back</button>
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
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={submitting} className="quiz-submit-btn">
              {submitting ? 'Matching…' : 'Show my matches →'}
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-3">
            No spam. Unsubscribe anytime. We never sell your email.
          </p>
          <button className="quiz-back-btn mt-2" onClick={() => setStep(3)}>← Back</button>
        </div>
      )}
    </div>
  );
}
