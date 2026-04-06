/**
 * Stage 2 quiz — full lead capture.
 * Reached via email nurture (day 14) or direct /quiz/?stage=2.
 * Collects destination, date, guests, budget, services, name/email/phone.
 * Routes only to lead-eligible vendor types (NOT resorts or jewelers).
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
  'Cancun, Mexico',
  'Punta Cana, Dominican Republic',
  'Jamaica',
  'Hawaii, USA',
  'Bali, Indonesia',
  'Santorini, Greece',
  'Tulum, Mexico',
  'Costa Rica',
  'Key West, Florida',
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

export default function LeadQuiz() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    destination: '',
    weddingDate: '',
    guestCount: '',
    budget: '',
    services: [],
    name: '',
    email: '',
    phone: '',
    consent: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
          utm_source: sessionStorage.getItem('utm_source') || undefined,
          utm_medium: sessionStorage.getItem('utm_medium') || undefined,
          utm_campaign: sessionStorage.getItem('utm_campaign') || undefined,
          utm_term: sessionStorage.getItem('utm_term') || undefined,
          utm_content: sessionStorage.getItem('utm_content') || undefined,
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
      <div className="text-center py-6">
        <div className="text-5xl mb-4">🌊</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">You're matched!</h2>
        <p className="text-gray-600 mb-2">
          Vetted vendors in <strong>{form.destination}</strong> will reach out within 24–48 hours.
        </p>
        <p className="text-gray-500 text-sm mb-6">
          We've also sent a confirmation to <strong>{form.email}</strong>.
        </p>
        <a
          href={`/destinations/${slugifyDestination(form.destination)}/`}
          className="quiz-btn-primary"
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
          <div className="flex gap-3 mt-6">
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
