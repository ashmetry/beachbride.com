/**
 * Destination Comparison Tool
 * Pick 2–3 destinations, compare side-by-side on cost, guest burden, legal type, best months, etc.
 * Comparison is always visible — no gate.
 * Email gate on "Send me the guide for [destination]" → email-capture → SENDY_NURTURE_LIST_ID
 */

import { useState } from 'react';
import destinationsData from '../../data/destinations.json';

interface Destination {
  slug: string;
  name: string;
  country: string;
  tagline: string;
  avgCostUSD: { min: number; max: number };
  bestMonths: string[];
  legalCeremonyType: string;
  visaRequired: boolean;
  vibeProfile: string[];
  guestCapacity: string;
  budgetTier: string;
  isHiddenGem: boolean;
  flightHoursFromEastCoast: number;
  flightHoursFromWestCoast: number;
  guestBurden: {
    avgFlightCostUSD: number;
    avgHotelPerNightUSD: number;
    visaComplexity: string;
    physicalAccessibility: string;
    score: number;
  };
}

const ALL_DESTINATIONS = destinationsData as Destination[];

function flightAccessibility(hours: number): { label: string; color: string } {
  if (hours < 4) return { label: 'Easy (under 4h from East Coast)', color: 'text-green-700' };
  if (hours < 9) return { label: 'Moderate (4–9h from East Coast)', color: 'text-yellow-700' };
  return { label: 'Long-haul (9h+)', color: 'text-orange-700' };
}

function budgetTierLabel(tier: string): string {
  const map: Record<string, string> = {
    value: 'Budget-friendly',
    mid: 'Mid-range',
    upper: 'Upper-mid',
    luxury: 'Luxury',
  };
  return map[tier] ?? tier;
}

function formatK(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

interface GateState {
  destSlug: string;
  submitted: boolean;
  email: string;
  firstName: string;
  submitting: boolean;
  error: string;
}

export default function DestinationComparison() {
  const [selected, setSelected] = useState<string[]>([]);
  const [budgetFilter, setBudgetFilter] = useState('');
  const [gate, setGate] = useState<GateState | null>(null);

  const filtered = budgetFilter
    ? ALL_DESTINATIONS.filter(d => d.budgetTier === budgetFilter)
    : ALL_DESTINATIONS;

  function toggleDestination(slug: string) {
    setSelected(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, slug];
    });
  }

  function openGate(destSlug: string) {
    setGate({ destSlug, submitted: false, email: '', firstName: '', submitting: false, error: '' });
  }

  async function handleGateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gate) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gate.email)) {
      setGate(g => g ? { ...g, error: 'Please enter a valid email address.' } : g);
      return;
    }
    setGate(g => g ? { ...g, submitting: true, error: '' } : g);
    const dest = ALL_DESTINATIONS.find(d => d.slug === gate.destSlug);
    try {
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email-capture',
          email: gate.email,
          name: gate.firstName.trim() || undefined,
          destination: dest ? `${dest.name}, ${dest.country}` : gate.destSlug,
          destinationSlug: gate.destSlug,
          utm_source: 'destination-comparison',
          utm_medium: 'tool',
        }),
      });
      if (!res.ok) throw new Error();
      setGate(g => g ? { ...g, submitted: true } : g);
    } catch {
      setGate(g => g ? { ...g, submitting: false, error: 'Something went wrong. Please try again.' } : g);
    }
  }

  const comparedDestinations = selected
    .map(slug => ALL_DESTINATIONS.find(d => d.slug === slug))
    .filter((d): d is Destination => d !== undefined);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Destination picker */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <p className="text-sm font-semibold text-gray-700">
            Select 2–3 destinations to compare{selected.length > 0 ? ` (${selected.length} selected)` : ''}
          </p>
          <div className="flex gap-2 flex-wrap">
            {['', 'value', 'mid', 'upper', 'luxury'].map(tier => (
              <button
                key={tier}
                type="button"
                onClick={() => setBudgetFilter(tier)}
                className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                  budgetFilter === tier
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900/50'
                }`}
              >
                {tier === '' ? 'All budgets' : budgetTierLabel(tier)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtered.map(d => {
            const isSelected = selected.includes(d.slug);
            const isDisabled = !isSelected && selected.length >= 3;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => !isDisabled && toggleDestination(d.slug)}
                disabled={isDisabled}
                className={`px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-brand text-white border-brand'
                    : isDisabled
                      ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand/50'
                }`}
              >
                <span className="font-medium block">{d.name}</span>
                <span className={`text-xs block mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                  {d.country}
                </span>
              </button>
            );
          })}
        </div>

        {selected.length === 3 && (
          <p className="text-xs text-gray-400 mt-3">Maximum 3 destinations selected. Deselect one to add another.</p>
        )}
      </div>

      {/* Comparison table */}
      {comparedDestinations.length >= 2 ? (
        <div className="card overflow-hidden mb-6">
          {/* Header row */}
          <div
            className="grid border-b border-gray-100"
            style={{ gridTemplateColumns: `160px repeat(${comparedDestinations.length}, 1fr)` }}
          >
            <div className="p-4 bg-gray-50" />
            {comparedDestinations.map(d => (
              <div key={d.slug} className="p-4 text-center border-l border-gray-100">
                <p className="font-bold text-gray-900">{d.name}</p>
                <p className="text-xs text-gray-500">{d.country}</p>
                <p className="text-xs text-gray-400 mt-1 italic">{d.tagline}</p>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {[
            {
              label: 'Est. wedding cost',
              render: (d: Destination) => `${formatK(d.avgCostUSD.min)} – ${formatK(d.avgCostUSD.max)}`,
            },
            {
              label: 'Guest ease score',
              render: (d: Destination) => `${d.guestBurden.score}/10`,
              note: 'Higher = easier for guests to attend',
            },
            {
              label: 'Budget tier',
              render: (d: Destination) => budgetTierLabel(d.budgetTier),
            },
            {
              label: 'Ceremony type',
              render: (d: Destination) =>
                d.legalCeremonyType === 'legal' ? 'Legal ceremony available' : 'Symbolic only',
            },
            {
              label: 'Best months',
              render: (d: Destination) => d.bestMonths.slice(0, 4).join(', '),
            },
            {
              label: 'Flight (East Coast)',
              render: (d: Destination) => `~${d.flightHoursFromEastCoast}h`,
            },
            {
              label: 'Visa required',
              render: (d: Destination) => (d.visaRequired ? 'Yes' : 'No'),
            },
            {
              label: 'Guest flights (avg)',
              render: (d: Destination) => `~$${d.guestBurden.avgFlightCostUSD} pp`,
            },
            {
              label: 'Guest hotel/night',
              render: (d: Destination) => `~$${d.guestBurden.avgHotelPerNightUSD}/night`,
            },
            {
              label: 'Vibe',
              render: (d: Destination) => d.vibeProfile.slice(0, 3).join(' · '),
            },
          ].map((row, i) => (
            <div
              key={i}
              className={`grid border-b border-gray-100 last:border-b-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
              style={{ gridTemplateColumns: `160px repeat(${comparedDestinations.length}, 1fr)` }}
            >
              <div className="p-3 bg-gray-50 border-r border-gray-100">
                <p className="text-xs font-semibold text-gray-600">{row.label}</p>
                {'note' in row && row.note && (
                  <p className="text-xs text-gray-400 mt-0.5">{row.note}</p>
                )}
              </div>
              {comparedDestinations.map(d => (
                <div key={d.slug} className="p-3 text-center border-l border-gray-100">
                  <p className="text-sm text-gray-800">{row.render(d)}</p>
                </div>
              ))}
            </div>
          ))}

          {/* Per-destination guide CTA row */}
          <div
            className="grid border-t border-gray-200 bg-gray-50"
            style={{ gridTemplateColumns: `160px repeat(${comparedDestinations.length}, 1fr)` }}
          >
            <div className="p-4 flex items-center">
              <p className="text-xs font-semibold text-gray-600">Get the guide</p>
            </div>
            {comparedDestinations.map(d => (
              <div key={d.slug} className="p-3 border-l border-gray-100 text-center">
                {gate?.destSlug === d.slug ? (
                  gate.submitted ? (
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-1">On its way!</p>
                      <a
                        href={`/destinations/${d.slug}/`}
                        className="text-xs text-brand font-medium hover:underline"
                      >
                        Explore {d.name} →
                      </a>
                    </div>
                  ) : (
                    <form onSubmit={handleGateSubmit} className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="First name"
                        value={gate.firstName}
                        onChange={e => setGate(g => g ? { ...g, firstName: e.target.value } : g)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Email"
                        value={gate.email}
                        onChange={e => setGate(g => g ? { ...g, email: e.target.value } : g)}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand/30"
                      />
                      <button
                        type="submit"
                        disabled={gate.submitting}
                        className="w-full px-3 py-1.5 bg-brand text-white rounded text-xs font-semibold hover:bg-brand-dark transition-colors"
                      >
                        {gate.submitting ? 'Sending…' : 'Send guide'}
                      </button>
                      {gate.error && <p className="text-red-600 text-xs">{gate.error}</p>}
                    </form>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => openGate(d.slug)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    Email me the {d.name} guide →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center text-gray-500 mb-6">
          <p className="text-sm">Select at least 2 destinations above to see a comparison.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Cost estimates are for ~50 guests. Guest burden scores and flight data are averages — actual costs vary by departure city and season.
      </p>
    </div>
  );
}
