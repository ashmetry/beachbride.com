/**
 * Wedding Planning Timeline Generator
 * Inputs: wedding date, destination, guest count
 * Teaser: months to go + 3 upcoming milestones
 * Full results (email-gated): complete reverse-countdown table with destination-specific notes
 * Submits email-capture payload → SENDY_NURTURE_LIST_ID
 */

import { useState } from 'react';
import destinationsData from '../../data/destinations.json';

interface Destination {
  slug: string;
  name: string;
  country: string;
  legalCeremonyType?: string;
  legalNotes?: string;
  bestMonths?: string[];
}

const DESTINATIONS = [
  { label: 'Cancun, Mexico', slug: 'cancun' },
  { label: 'Punta Cana, Dominican Republic', slug: 'punta-cana' },
  { label: 'Jamaica', slug: 'jamaica' },
  { label: 'Hawaii, USA', slug: 'hawaii' },
  { label: 'Bali, Indonesia', slug: 'bali' },
  { label: 'Santorini, Greece', slug: 'santorini' },
  { label: 'Tulum, Mexico', slug: 'tulum' },
  { label: 'Costa Rica', slug: 'costa-rica' },
  { label: 'Key West, Florida', slug: 'key-west' },
  { label: 'Los Cabos, Mexico', slug: 'los-cabos' },
  { label: 'St. Lucia', slug: 'st-lucia' },
  { label: 'Riviera Maya, Mexico', slug: 'riviera-maya' },
  { label: 'Turks & Caicos', slug: 'turks-caicos' },
  { label: 'Aruba', slug: 'aruba' },
  { label: 'Amalfi Coast, Italy', slug: 'amalfi-coast' },
  { label: 'Other / Not sure yet', slug: '' },
];

const GUEST_COUNTS = [
  'Elopement (just us)',
  'Intimate (under 20)',
  'Small (20–50)',
  'Medium (50–100)',
  'Large (100+)',
];

interface Milestone {
  phase: string;
  monthsBefore: number;
  tasks: string[];
  note?: string;
}

function getMilestones(destSlug: string, weddingMonth: string, guestCount: string): Milestone[] {
  const dest = (destinationsData as Destination[]).find(d => d.slug === destSlug);
  const isSymbolic = dest?.legalCeremonyType === 'symbolic';
  const legalNote = dest?.legalNotes;
  const bestMonths = dest?.bestMonths ?? [];
  const destName = dest?.name ?? 'your destination';

  // Check if wedding month is in best months
  const wMonth = weddingMonth ? new Date(weddingMonth + '-01').toLocaleString('en-US', { month: 'long' }) : '';
  const isOffSeason = wMonth && bestMonths.length > 0 && !bestMonths.includes(wMonth);

  const isLarge = guestCount === 'Large (100+)' || guestCount === 'Medium (50–100)';

  return [
    {
      phase: '18–12 months out',
      monthsBefore: 18,
      tasks: [
        'Finalise your destination and set a target budget',
        'Start researching resorts and venues',
        isLarge ? 'Secure a room block early — availability fills fast for large groups' : 'Research group room block options for guests',
        'Check passport validity for you and your partner (6+ months past wedding date)',
      ],
      note: isOffSeason
        ? `${wMonth} is outside the best travel months for ${destName} (${bestMonths.slice(0, 3).join(', ')}). Factor in weather risk when planning.`
        : undefined,
    },
    {
      phase: '12 months out',
      monthsBefore: 12,
      tasks: [
        'Book your venue or resort and sign the contract',
        isSymbolic
          ? `Book your ceremony officiant — ${destName} ceremonies are typically symbolic (your home-country legal ceremony is separate)`
          : 'Book your ceremony — ask about the legal vs. symbolic ceremony process',
        'Hire your wedding planner (local knowledge is invaluable for destination weddings)',
        'Set your guest list and send save-the-dates',
      ],
    },
    {
      phase: '9 months out',
      monthsBefore: 9,
      tasks: [
        'Book your photographer and videographer (top talent fills 9–12 months out)',
        'Book your florist and discuss what local blooms are available',
        'Begin dress shopping (alterations take 4–6 months)',
        'Research travel insurance options for you and guests',
      ],
    },
    {
      phase: '6 months out',
      monthsBefore: 6,
      tasks: [
        'Send formal invitations with RSVP deadline',
        'Set up your room block if not already done',
        'Book additional vendors: DJ/band, caterer (if not resort-catered), officiant',
        'Plan rehearsal dinner and welcome event logistics',
      ],
    },
    {
      phase: '3 months out',
      monthsBefore: 3,
      tasks: [
        isSymbolic
          ? 'Complete legal marriage paperwork in your home country (before or after the ceremony)'
          : `Gather legal documents for the ceremony in ${destName}`,
        'Confirm all vendor bookings in writing',
        'Finalise your ceremony script and vows',
        'Arrange airport transfers and welcome bags for guests',
      ],
      note: !isSymbolic && legalNote
        ? `Legal requirements for ${destName}: ${legalNote.slice(0, 200)}${legalNote.length > 200 ? '…' : ''}`
        : undefined,
    },
    {
      phase: '1 month out',
      monthsBefore: 1,
      tasks: [
        'Final headcount and RSVP follow-ups',
        'Create a day-of timeline and share with all vendors',
        'Arrange wedding-day emergency kit (safety pins, stain remover, etc.)',
        'Schedule a final call with your planner to walk through the day',
      ],
    },
  ];
}

function monthsUntil(weddingMonth: string): number {
  if (!weddingMonth) return 0;
  const now = new Date();
  const target = new Date(weddingMonth + '-01');
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

function getUpcomingMilestones(milestones: Milestone[], months: number): Milestone[] {
  // Find the 3 milestones whose monthsBefore is >= months (not yet passed)
  return milestones
    .filter(m => m.monthsBefore <= months)
    .slice(-3)
    .reverse();
}

function getDestinationSlug(label: string): string {
  return DESTINATIONS.find(d => d.label === label)?.slug ?? '';
}

export default function WeddingTimelineGenerator() {
  const [weddingDate, setWeddingDate] = useState('');
  const [destination, setDestination] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const months = monthsUntil(weddingDate);
  const destSlug = getDestinationSlug(destination);
  const milestones = getMilestones(destSlug, weddingDate, guestCount);
  const upcoming = getUpcomingMilestones(milestones, months);
  const hasDate = weddingDate !== '';

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setEmailError('');
    try {
      const res = await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email-capture',
          email,
          name: firstName.trim() || undefined,
          destination: destination || undefined,
          destinationSlug: destSlug || undefined,
          weddingDate: weddingDate || undefined,
          guestCount: guestCount || undefined,
          utm_source: 'timeline-generator',
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inputs */}
      <div className="card p-6 mb-6 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Wedding date <span className="font-normal text-gray-400">(approximate is fine)</span>
          </label>
          <input
            type="month"
            value={weddingDate}
            onChange={e => setWeddingDate(e.target.value)}
            min={new Date().toISOString().slice(0, 7)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Destination</label>
          <select
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Select a destination (optional)</option>
            {DESTINATIONS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Guest count</label>
          <div className="flex flex-wrap gap-2">
            {GUEST_COUNTS.map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGuestCount(g)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  guestCount === g
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900/50'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Teaser — always visible once date is set */}
      <div className="card p-6 mb-6">
        {!hasDate ? (
          <p className="text-gray-500 text-sm text-center py-4">Enter your wedding date above to see your timeline.</p>
        ) : (
          <>
            <div className="text-center mb-6">
              <p className="text-5xl font-bold text-gray-900">{months}</p>
              <p className="text-gray-500 text-sm mt-1">months until your wedding</p>
            </div>

            {upcoming.length > 0 && (
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-gray-700">Coming up next:</p>
                {upcoming.map((m, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-brand mt-1.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.phase}</p>
                      <p className="text-xs text-gray-500">{m.tasks[0]}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Email gate */}
            {!unlocked ? (
              <div className="border border-gray-100 rounded-xl p-5 bg-gray-50">
                <p className="font-semibold text-gray-900 mb-1 text-sm">Get your complete planning timeline</p>
                <p className="text-xs text-gray-500 mb-3">
                  All milestones from now until your wedding
                  {destination ? `, with notes specific to ${destination.split(',')[0]}` : ''}.
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
                    {submitting ? 'Sending…' : 'See full timeline'}
                  </button>
                </form>
                {emailError && <p className="text-red-600 text-xs mt-1">{emailError}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {milestones.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-5 ${
                      m.monthsBefore <= months
                        ? 'border-brand/20 bg-brand/5'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <p className="font-bold text-gray-900 mb-2">{m.phase}</p>
                    <ul className="space-y-1.5">
                      {m.tasks.map((t, j) => (
                        <li key={j} className="flex gap-2 items-start text-sm text-gray-700">
                          <span className="text-brand font-bold mt-0.5">✓</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                    {m.note && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {m.note}
                      </p>
                    )}
                  </div>
                ))}

                {/* CTA */}
                <div className="bg-brand text-white rounded-xl p-5 text-center">
                  <p className="font-bold mb-1">
                    Need a local planner{destination ? ` in ${destination.split(',')[0]}` : ''}?
                  </p>
                  <p className="text-sm text-white/70 mb-4">
                    A local planner handles vendor coordination, legal paperwork, and day-of logistics — free to get matched.
                  </p>
                  <a
                    href="/quiz/"
                    className="inline-block bg-white text-brand hover:bg-gray-100 font-bold px-6 py-3 rounded-lg transition-colors text-sm no-underline"
                  >
                    Find a local planner →
                  </a>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Timelines are general guidelines. Specific lead times vary by destination, vendor availability, and season.
      </p>
    </div>
  );
}
