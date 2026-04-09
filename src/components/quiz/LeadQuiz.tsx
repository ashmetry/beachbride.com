/**
 * Stage 2 quiz — full lead capture.
 * Reached via email nurture (day 14) or direct /quiz/?stage=2.
 * Collects destination, date, guests, budget, services, name/email/phone.
 * Routes only to lead-eligible vendor types (NOT resorts or jewelers).
 */

import { useState, useEffect, useRef } from 'react';

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

const DESTINATIONS = [
  'Cancun, Mexico',
  'Punta Cana, Dominican Republic',
  'Jamaica',
  'Hawaii, USA',
  'Bali, Indonesia',
  'Santorini, Greece',
  'Tulum, Mexico',
  'Costa Rica',
  'Key West, Florida',
  'Los Cabos, Mexico',
  'St. Lucia',
  'Riviera Maya, Mexico',
  'Turks & Caicos',
  'Aruba',
  'Amalfi Coast, Italy',
  'Tuscany, Italy',
  'Algarve, Portugal',
  'Dubrovnik, Croatia',
  'Maldives',
  'Fiji',
  'Holbox Island, Mexico',
  'Roatán, Honduras',
  'Kotor, Montenegro',
  'Azores, Portugal',
  'Koh Lanta, Thailand',
  'Other / Not sure yet',
];

const SERVICES = [
  { value: 'planner', label: 'Wedding Planner', icon: '📋' },
  { value: 'photographer', label: 'Photographer', icon: '📸' },
  { value: 'florist', label: 'Florist', icon: '💐' },
  { value: 'caterer', label: 'Caterer / Food', icon: '🍽️' },
  { value: 'dj', label: 'DJ / Entertainment', icon: '🎵' },
  { value: 'officiant', label: 'Officiant', icon: '💍' },
];

const BUDGETS = [
  'Under $10,000',
  '$10,000 – $25,000',
  '$25,000 – $50,000',
  '$50,000 – $100,000',
  '$100,000+',
  'Not sure yet',
];

const GUEST_COUNTS = [
  'Elopement (just us)',
  'Intimate (under 20)',
  'Small (20–50)',
  'Medium (50–100)',
  'Large (100+)',
];

interface FormData {
  destination: string;
  weddingDate: string;
  guestCount: string;
  budget: string;
  services: string[];
  roomBlockInterest: boolean | null; // null = not yet answered
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}

function slugifyDestination(dest: string): string {
  return dest.toLowerCase().split(',')[0].trim().replace(/\s+/g, '-');
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const STEPS = ['Destination', 'Details', 'Services', 'Your info'];

interface Props {
  turnstileSiteKey?: string;
}

export default function LeadQuiz({ turnstileSiteKey }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    destination: '',
    weddingDate: '',
    guestCount: '',
    budget: '',
    services: [],
    roomBlockInterest: null,
    name: '',
    email: '',
    phone: '',
    consent: false,
  });
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetRef = useRef<string | null>(null);

  // Render Turnstile widget when contact step is visible
  useEffect(() => {
    if (step !== 3 || !turnstileSiteKey || !turnstileRef.current) return;

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

  function toggleService(val: string) {
    setForm(f => ({
      ...f,
      services: f.services.includes(val)
        ? f.services.filter(s => s !== val)
        : [...f.services, val],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Honeypot — silently fake success for bots
    if (honeypot) { setSubmitted(true); return; }
    if (!form.consent) { setError('Please confirm your consent to continue.'); return; }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) { setError('Please enter a valid 10-digit phone number.'); return; }
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email address.'); return; }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lead',
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          destination: form.destination,
          destinationSlug: slugifyDestination(form.destination),
          weddingDate: form.weddingDate || undefined,
          guestCount: form.guestCount || undefined,
          budget: form.budget || undefined,
          servicesNeeded: form.services.length ? form.services : undefined,
          roomBlockInterest: form.roomBlockInterest === true ? true : undefined,
          utm_source: sessionStorage.getItem('utm_source') || undefined,
          utm_medium: sessionStorage.getItem('utm_medium') || undefined,
          utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
          utm_term: sessionStorage.getItem('utm_term') || undefined,
          utm_content: sessionStorage.getItem('utm_content') || undefined,
          'cf-turnstile-response': turnstileToken || undefined,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');
      fireEvent('lead_submitted', { destination: form.destination, services: form.services });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-6">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're matched!</h2>
          <p className="text-gray-600 text-sm">
            Vetted vendors in <strong>{form.destination}</strong> will reach out within 24–48 hours.
          </p>
        </div>

        {/* Room block follow-up — only shown if they opted in */}
        {form.roomBlockInterest && (
          <div className="bg-brand-light border border-brand/20 rounded-xl p-5 mb-4 text-center">
            <p className="font-semibold text-gray-900 mb-1">We'll sort your guest rooms too.</p>
            <p className="text-sm text-gray-600 mb-3">
              We'll reach out within 24 hours about your group rate. Want to move faster?
            </p>
            <a
              href="https://beachbride.com/tools/room-block-calculator/"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Estimate your room block now →
            </a>
          </div>
        )}

        {/* Travel insurance CTA */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5 text-center">
          <p className="font-semibold text-gray-900 mb-1 text-sm">Protect your wedding investment</p>
          <p className="text-xs text-gray-500 mb-2">
            Non-refundable deposits + international flights = real risk. Most couples skip travel insurance and regret it.
          </p>
          <a
            href="https://www.insuremytrip.com/?utm_source=beachbride&utm_medium=quiz-confirmation&utm_campaign=destination-wedding-insurance"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            Compare travel insurance plans →
          </a>
        </div>

        <a
          href={`/destinations/${slugifyDestination(form.destination)}/`}
          className="quiz-btn-primary block text-center"
        >
          Explore {form.destination.split(',')[0]} →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Progress steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? 'bg-brand text-white' : i === step ? 'bg-brand text-white ring-4 ring-brand/20' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs text-center ${i === step ? 'text-brand font-semibold' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 0: Destination */}
      {step === 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Where are you getting married?</h2>
          <p className="text-sm text-gray-500 text-center mb-6">We'll find vendors who specialize in this location.</p>
          <div className="grid grid-cols-1 gap-2">
            {DESTINATIONS.map(d => (
              <button
                key={d}
                className={`quiz-list-option ${form.destination === d ? 'selected' : ''}`}
                onClick={() => { setForm(f => ({ ...f, destination: d })); setTimeout(() => setStep(1), 200); }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Date + guests + budget */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Wedding details</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Approximate is fine — vendors will confirm specifics with you.</p>
          <div className="space-y-5">
            <div>
              <label className="quiz-label">Approximate wedding date <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                type="month"
                value={form.weddingDate}
                onChange={e => setForm(f => ({ ...f, weddingDate: e.target.value }))}
                className="quiz-input"
              />
            </div>
            <div>
              <label className="quiz-label">Guest count</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {GUEST_COUNTS.map(g => (
                  <button
                    key={g}
                    className={`quiz-chip ${form.guestCount === g ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, guestCount: g }))}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="quiz-label">Total wedding budget</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {BUDGETS.map(b => (
                  <button
                    key={b}
                    className={`quiz-chip ${form.budget === b ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, budget: b }))}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button className="quiz-back-btn" onClick={() => setStep(0)}>← Back</button>
            <button
              className="quiz-btn-primary flex-1"
              onClick={() => setStep(2)}
              disabled={!form.guestCount || !form.budget}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Services */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">What vendors do you need?</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Select all that apply. You can always add more later.</p>
          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map(s => (
              <button
                key={s.value}
                className={`quiz-option-card py-4 ${form.services.includes(s.value) ? 'selected' : ''}`}
                onClick={() => toggleService(s.value)}
              >
                <span className="text-2xl mb-1">{s.icon}</span>
                <span className="font-semibold text-sm text-gray-900">{s.label}</span>
                {form.services.includes(s.value) && (
                  <span className="absolute top-2 right-2 text-brand text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
          {/* Room block opt-in */}
          <div className="mt-6 border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="font-semibold text-gray-900 text-sm mb-1">Would you like free help booking hotel rooms for your guests?</p>
            <p className="text-xs text-gray-500 mb-3">We secure group rates at all-inclusive resorts — no cost to you, resort pays us.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  form.roomBlockInterest === true
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                }`}
                onClick={() => setForm(f => ({ ...f, roomBlockInterest: true }))}
              >
                Yes, help me with that
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  form.roomBlockInterest === false
                    ? 'bg-gray-200 text-gray-700 border-gray-300'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setForm(f => ({ ...f, roomBlockInterest: false }))}
              >
                No thanks
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button className="quiz-back-btn" onClick={() => setStep(1)}>← Back</button>
            <button
              className="quiz-btn-primary flex-1"
              onClick={() => setStep(3)}
              disabled={form.services.length === 0}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Contact info */}
      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Almost there!</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Vendors will reach out within 24–48 hours with availability and pricing.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
              <label htmlFor="l-website">Website</label>
              <input id="l-website" type="text" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="l-name" className="quiz-label">Full name *</label>
              <input
                id="l-name"
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                className="quiz-input"
              />
            </div>
            <div>
              <label htmlFor="l-email" className="quiz-label">Email *</label>
              <input
                id="l-email"
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                className="quiz-input"
              />
            </div>
            <div>
              <label htmlFor="l-phone" className="quiz-label">Phone number *</label>
              <input
                id="l-phone"
                type="tel"
                required
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                placeholder="(555) 000-0000"
                maxLength={14}
                className="quiz-input"
              />
            </div>
            <div className="flex items-start gap-3">
              <input
                id="l-consent"
                type="checkbox"
                checked={form.consent}
                onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}
                className="mt-0.5 w-4 h-4 flex-shrink-0 accent-brand"
              />
              <label htmlFor="l-consent" className="text-xs text-gray-500">
                I agree to be contacted by BeachBride and matched vendors about my destination wedding. No spam — just relevant help.
              </label>
            </div>
            {turnstileSiteKey && <div ref={turnstileRef} className="flex justify-center" />}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={submitting} className="quiz-submit-btn">
              {submitting ? 'Sending…' : 'Get matched with vendors →'}
            </button>
          </form>
          <button className="quiz-back-btn mt-3" onClick={() => setStep(2)}>← Back</button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Your info is never sold. Shared only with vendors you're matched with.
          </p>
        </div>
      )}
    </div>
  );
}
