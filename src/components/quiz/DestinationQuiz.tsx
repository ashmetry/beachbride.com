/**
 * Stage 1 quiz — email capture only.
 * 3 fun questions → email → destination guide delivered via Sendy nurture sequence.
 * No phone, no budget. Low friction, high aspiration.
 */

import { useState } from 'react';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function fireEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.('event', name, params);
}

const DESTINATIONS = [
  { slug: 'cancun', name: 'Cancun', emoji: '🌊', desc: 'Mexico' },
  { slug: 'punta-cana', name: 'Punta Cana', emoji: '🌴', desc: 'Dominican Republic' },
  { slug: 'jamaica', name: 'Jamaica', emoji: '🏝️', desc: 'Jamaica' },
  { slug: 'hawaii', name: 'Hawaii', emoji: '🌺', desc: 'USA' },
  { slug: 'bali', name: 'Bali', emoji: '🪷', desc: 'Indonesia' },
  { slug: 'santorini', name: 'Santorini', emoji: '🤍', desc: 'Greece' },
  { slug: 'tulum', name: 'Tulum', emoji: '🌿', desc: 'Mexico' },
  { slug: 'costa-rica', name: 'Costa Rica', emoji: '🦜', desc: 'Costa Rica' },
  { slug: 'key-west', name: 'Key West', emoji: '🦩', desc: 'Florida, USA' },
  { slug: 'other', name: 'Not sure yet', emoji: '✨', desc: 'Help me decide' },
];

const VIBES = [
  { value: 'luxe', label: 'Luxe & romantic', icon: '🥂' },
  { value: 'tropical', label: 'Tropical & relaxed', icon: '🌺' },
  { value: 'bohemian', label: 'Bohemian & free-spirited', icon: '🌿' },
  { value: 'intimate', label: 'Intimate & private', icon: '🕯️' },
];

const SEASONS = [
  { value: 'winter', label: 'Winter (Dec–Feb)', icon: '❄️' },
  { value: 'spring', label: 'Spring (Mar–May)', icon: '🌸' },
  { value: 'summer', label: 'Summer (Jun–Aug)', icon: '☀️' },
  { value: 'fall', label: 'Fall (Sep–Nov)', icon: '🍂' },
  { value: 'flexible', label: 'I\'m flexible', icon: '📅' },
];

interface Answers {
  destinationSlug?: string;
  destination?: string;
  vibe?: string;
  season?: string;
}

export default function DestinationQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function pick(key: keyof Answers, value: string, extra?: Partial<Answers>) {
    const updated = { ...answers, [key]: value, ...extra };
    setAnswers(updated);
    if (key === 'destinationSlug') fireEvent('quiz_destination_selected', { destination: value });
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

    try {
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email-capture',
          email,
          name: name || undefined,
          destination: answers.destination,
          destinationSlug: answers.destinationSlug,
          vibe: answers.vibe,
          season: answers.season,
          utm_source: sessionStorage.getItem('utm_source') || undefined,
          utm_medium: sessionStorage.getItem('utm_medium') || undefined,
          utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      fireEvent('stage1_captured', { destination: answers.destinationSlug });
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
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Your guide is on its way!</h2>
        <p className="text-gray-600 mb-6">
          Check your inbox — we've sent your personalized {answers.destination} wedding guide.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {answers.destinationSlug && answers.destinationSlug !== 'other' && (
            <a
              href={`/destinations/${answers.destinationSlug}/`}
              className="quiz-btn-primary"
            >
              Explore {answers.destination} →
            </a>
          )}
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
        {[0, 1, 2, 3].map(i => (
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

      {/* Step 0: Destination */}
      {step === 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            Where do you dream of saying "I do"?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">Pick your top destination — or tell us you're not sure yet.</p>
          <div className="grid grid-cols-3 gap-3">
            {DESTINATIONS.map(d => (
              <button
                key={d.slug}
                className="quiz-option-card"
                onClick={() => pick('destinationSlug', d.slug, { destination: d.name })}
              >
                <span className="text-2xl mb-1">{d.emoji}</span>
                <span className="font-semibold text-sm text-gray-900">{d.name}</span>
                <span className="text-xs text-gray-400">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Vibe */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            What's your wedding vibe?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">This helps us curate the right venues and vendors for you.</p>
          <div className="grid grid-cols-2 gap-3">
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
          <button className="quiz-back-btn mt-4" onClick={() => setStep(0)}>← Back</button>
        </div>
      )}

      {/* Step 2: Season */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            When are you thinking?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">We'll highlight the best times for your destination.</p>
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
          <button className="quiz-back-btn mt-4" onClick={() => setStep(1)}>← Back</button>
        </div>
      )}

      {/* Step 3: Email capture */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
            Where should we send your guide?
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            We'll send your personalized {answers.destination ?? 'destination'} wedding guide right to your inbox — free.
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
              {submitting ? 'Sending…' : 'Send my free guide →'}
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-3">
            No spam. Unsubscribe anytime. We never sell your email.
          </p>
          <button className="quiz-back-btn mt-2" onClick={() => setStep(2)}>← Back</button>
        </div>
      )}
    </div>
  );
}
