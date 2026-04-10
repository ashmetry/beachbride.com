/**
 * Wedding Budget Calculator
 * Inputs: destination, guest count, services needed
 * Teaser: total budget range + per-category bar (always visible)
 * Full results (email-gated): itemised breakdown + vendor CTA
 * Submits email-capture payload → SENDY_NURTURE_LIST_ID
 */

import { useState } from 'react';
import destinationsData from '../../data/destinations.json';

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
  'Maldives',
  'Fiji',
  'Other / Not sure yet',
];

const SERVICES = [
  { value: 'planner', label: 'Wedding Planner', pct: 0.12 },
  { value: 'photographer', label: 'Photographer', pct: 0.15 },
  { value: 'florist', label: 'Florist', pct: 0.10 },
  { value: 'caterer', label: 'Caterer / Food', pct: 0.25 },
  { value: 'dj', label: 'DJ / Entertainment', pct: 0.05 },
  { value: 'officiant', label: 'Officiant', pct: 0.03 },
];

// Category breakdown of base budget (venue always included)
const CATEGORIES = [
  { key: 'venue', label: 'Venue / Resort Fee', pct: 0.30 },
  { key: 'photographer', label: 'Photography', pct: 0.15, service: 'photographer' },
  { key: 'florals', label: 'Florals & Decor', pct: 0.10, service: 'florist' },
  { key: 'catering', label: 'Catering', pct: 0.25, service: 'caterer' },
  { key: 'planner', label: 'Wedding Planner', pct: 0.12, service: 'planner' },
  { key: 'dj', label: 'DJ / Entertainment', pct: 0.05, service: 'dj' },
  { key: 'officiant', label: 'Officiant', pct: 0.03, service: 'officiant' },
];

// Map quiz destination names → destinations.json slugs
function getDestinationSlug(dest: string): string {
  return dest.toLowerCase().split(',')[0].trim().replace(/\s+/g, '-');
}

// Find avgCostUSD from destinations.json
function getDestinationCost(dest: string): { min: number; max: number } {
  const slug = getDestinationSlug(dest);
  const found = (destinationsData as Array<{ slug: string; avgCostUSD?: { min: number; max: number } }>)
    .find(d => d.slug === slug);
  return found?.avgCostUSD ?? { min: 18000, max: 45000 }; // generic fallback
}

// Scale base cost (calibrated for ~50 guests) to actual guest count
function scaleCost(base: number, guests: number): number {
  if (guests <= 50) return base * (guests / 50);
  // Diminishing returns above 50 (catering scales; venue/photo don't)
  return base * (1 + (guests - 50) / 50 * 0.85);
}

function guestCountLabel(n: number): string {
  if (n <= 2) return 'Elopement (just us)';
  if (n <= 20) return 'Intimate (under 20)';
  if (n <= 50) return 'Small (20–50)';
  if (n <= 100) return 'Medium (50–100)';
  return 'Large (100+)';
}

function budgetLabel(total: number): string {
  if (total < 20000) return '$10,000 – $25,000';
  if (total < 50000) return '$25,000 – $50,000';
  if (total < 100000) return '$50,000 – $100,000';
  return '$100,000+';
}

function formatK(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

export default function WeddingBudgetCalculator() {
  const [destination, setDestination] = useState('');
  const [guestCount, setGuestCount] = useState(50);
  const [services, setServices] = useState<string[]>(['planner', 'photographer', 'florist', 'caterer']);
  const [unlocked, setUnlocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Budget calculation
  const baseCost = getDestinationCost(destination);
  const scaledMin = scaleCost(baseCost.min, guestCount);
  const scaledMax = scaleCost(baseCost.max, guestCount);

  // Only include categories for selected services (venue always included)
  const activeCategories = CATEGORIES.filter(
    c => !c.service || services.includes(c.service)
  );
  const activePctSum = activeCategories.reduce((s, c) => s + c.pct, 0);

  // Normalise to active categories
  const categoryBreakdown = activeCategories.map(c => ({
    ...c,
    normPct: c.pct / activePctSum,
    minAmt: Math.round((c.pct / activePctSum) * scaledMin),
    maxAmt: Math.round((c.pct / activePctSum) * scaledMax),
  }));

  const perGuestMin = Math.round(scaledMin / Math.max(guestCount, 1));
  const perGuestMax = Math.round(scaledMax / Math.max(guestCount, 1));

  function toggleService(val: string) {
    setServices(s =>
      s.includes(val) ? s.filter(x => x !== val) : [...s, val]
    );
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setEmailError('');
    try {
      const slug = destination ? getDestinationSlug(destination) : '';
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email-capture',
          email,
          name: firstName.trim() || undefined,
          destination: destination || undefined,
          destinationSlug: slug || undefined,
          guestCount: guestCountLabel(guestCount),
          budget: budgetLabel(scaledMax),
          utm_source: 'budget-calculator',
          utm_medium: 'tool',
        }),
      });
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      setUnlocked(true);
    } catch {
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const destSlug = destination ? getDestinationSlug(destination) : '';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inputs */}
      <div className="card p-6 mb-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Destination
          </label>
          <select
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Select a destination (optional)</option>
            {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Guest count: <span className="text-gray-900 font-bold">{guestCount}</span>
          </label>
          <input
            type="range" min={2} max={300} step={2} value={guestCount}
            onChange={e => setGuestCount(Number(e.target.value))}
            className="w-full accent-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>2</span><span>300</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Vendors you need <span className="font-normal text-gray-400">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SERVICES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleService(s.value)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors ${
                  services.includes(s.value)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900/50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Teaser results — always visible */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Your estimated budget</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatK(scaledMin)}</p>
            <p className="text-xs text-gray-500 mt-1">Low estimate</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{formatK(scaledMax)}</p>
            <p className="text-xs text-gray-500 mt-1">High estimate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{formatK(perGuestMin)}–{formatK(perGuestMax)}</p>
            <p className="text-xs text-gray-500 mt-1">Per guest</p>
          </div>
        </div>

        {/* Category bars */}
        <div className="space-y-2 mb-2">
          {categoryBreakdown.map(c => (
            <div key={c.key}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span>{c.label}</span>
                <span className="font-medium">{formatK(c.minAmt)}–{formatK(c.maxAmt)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full"
                  style={{ width: `${Math.round(c.normPct * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Based on industry averages{destination ? ` for ${destination.split(',')[0]}` : ''}. Actual costs vary by resort, season, and vendor.
        </p>

        {/* Email gate */}
        {!unlocked ? (
          <div className="border border-gray-100 rounded-xl p-5 bg-gray-50 mt-6">
            <p className="font-semibold text-gray-900 mb-1 text-sm">See your full itemised breakdown</p>
            <p className="text-xs text-gray-500 mb-3">
              Unlock per-category ranges, a vendor checklist, and a direct path to vendor matching for your budget.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-brand text-white font-semibold rounded-lg text-sm hover:bg-brand-dark transition-colors"
              >
                {submitting ? 'Sending…' : 'See full breakdown'}
              </button>
            </form>
            {emailError && <p className="text-red-600 text-xs mt-1">{emailError}</p>}
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {/* Per-category detail */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Category</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoryBreakdown.map(c => (
                    <tr key={c.key}>
                      <td className="px-4 py-3 text-gray-700">{c.label}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatK(c.minAmt)} – {formatK(c.maxAmt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">Total estimate</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatK(scaledMin)} – {formatK(scaledMax)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Vendor CTA */}
            <div className="bg-brand text-white rounded-xl p-5 text-center">
              <p className="font-bold mb-1">
                Ready to find vendors{destination ? ` in ${destination.split(',')[0]}` : ''}?
              </p>
              <p className="text-sm text-white/70 mb-4">
                Tell us what you need and we'll match you with vetted local vendors — free.
              </p>
              <a
                href="/quiz/"
                className="inline-block bg-white text-brand hover:bg-gray-100 font-bold px-6 py-3 rounded-lg transition-colors text-sm no-underline"
              >
                Get matched with vendors →
              </a>
            </div>

            {/* Room block upsell for larger weddings */}
            {guestCount >= 20 && (
              <div className="border border-accent/30 bg-accent/5 rounded-xl p-4 text-center">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  With {guestCount} guests, a room block could save them money
                </p>
                <a
                  href="/tools/room-block-calculator/"
                  className="text-sm font-semibold text-accent-dark hover:underline"
                >
                  Estimate your room block →
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Estimates are based on industry averages and destination cost data. Actual pricing varies by resort, vendor, season, and package inclusions.
      </p>
    </div>
  );
}
