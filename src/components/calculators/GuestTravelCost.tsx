/**
 * Guest Travel Cost Estimator
 * Inputs: destination, guest count, stay length
 * Teaser: per-guest total, total guest burden (always visible)
 * Full results (email-gated): breakdown table + room block CTA
 * Submits room-block-capture payload → SENDY_ROOM_BLOCK_LIST_ID
 */

import { useState } from 'react';
import destinationsData from '../../data/destinations.json';

interface Destination {
  slug: string;
  name: string;
  country: string;
  guestBurden: {
    avgFlightCostUSD: number;
    avgHotelPerNightUSD: number;
    visaComplexity: string;
    physicalAccessibility: string;
    score: number;
  };
}

const ALL_DESTINATIONS = destinationsData as Destination[];

const DEST_OPTIONS = [
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
  { label: 'Maldives', slug: 'maldives' },
  { label: 'Fiji', slug: 'fiji' },
];

const NIGHTS_OPTIONS = [
  { value: 3, label: '3 nights' },
  { value: 4, label: '4 nights' },
  { value: 5, label: '5 nights' },
  { value: 7, label: '7 nights' },
];

// Avg destination wedding: ~70% of guests travel, avg 2 per room
const TRAVEL_RATE = 0.70;

function getRooms(guests: number): number {
  return Math.ceil(guests * TRAVEL_RATE / 2);
}

function getTravelingGuests(guests: number): number {
  return Math.round(guests * TRAVEL_RATE);
}

function getDestData(slug: string): Destination['guestBurden'] {
  const found = ALL_DESTINATIONS.find(d => d.slug === slug);
  // Generic fallback
  return found?.guestBurden ?? {
    avgFlightCostUSD: 450,
    avgHotelPerNightUSD: 220,
    visaComplexity: 'none',
    physicalAccessibility: 'easy',
    score: 7,
  };
}

function burdenContext(perGuest: number): string {
  if (perGuest < 1000) return 'below average for destination weddings';
  if (perGuest < 2000) return 'typical for destination weddings';
  if (perGuest < 3500) return 'above average — consider communicating early so guests can plan';
  return 'significant — give guests as much lead time as possible';
}

export default function GuestTravelCost() {
  const [destLabel, setDestLabel] = useState('');
  const [destSlug, setDestSlug] = useState('');
  const [guestCount, setGuestCount] = useState(50);
  const [nights, setNights] = useState(4);
  const [unlocked, setUnlocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  function handleDestChange(label: string) {
    setDestLabel(label);
    const opt = DEST_OPTIONS.find(d => d.label === label);
    setDestSlug(opt?.slug ?? '');
  }

  const burden = getDestData(destSlug);
  const travelingGuests = getTravelingGuests(guestCount);
  const rooms = getRooms(guestCount);

  const flightTotal = burden.avgFlightCostUSD * travelingGuests;
  const hotelTotal = burden.avgHotelPerNightUSD * nights * rooms;
  const totalBurden = flightTotal + hotelTotal;
  const perGuest = travelingGuests > 0 ? Math.round(totalBurden / travelingGuests) : 0;

  // Low/high ranges (±20%)
  const totalLow = Math.round(totalBurden * 0.8);
  const totalHigh = Math.round(totalBurden * 1.2);
  const perGuestLow = Math.round(perGuest * 0.8);
  const perGuestHigh = Math.round(perGuest * 1.2);

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
          destination: destLabel || undefined,
          destinationSlug: destSlug || undefined,
          guestCount: String(guestCount),
          utm_source: 'guest-travel-cost',
          utm_medium: 'tool',
        }),
      });
      if (!res.ok) throw new Error();
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
      <div className="card p-6 mb-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Destination</label>
          <select
            value={destLabel}
            onChange={e => handleDestChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Select a destination</option>
            {DEST_OPTIONS.map(d => <option key={d.slug} value={d.label}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Guest count: <span className="text-gray-900 font-bold">{guestCount}</span>
          </label>
          <input
            type="range" min={10} max={200} step={5} value={guestCount}
            onChange={e => setGuestCount(Number(e.target.value))}
            className="w-full accent-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>10</span><span>200</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Average stay length</label>
          <div className="flex gap-2 flex-wrap">
            {NIGHTS_OPTIONS.map(n => (
              <button
                key={n.value}
                type="button"
                onClick={() => setNights(n.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  nights === n.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900/50'
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Teaser results — always visible */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Guest travel burden estimate</h2>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              ${perGuestLow.toLocaleString()}–${perGuestHigh.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per traveling guest</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{travelingGuests}</p>
            <p className="text-xs text-gray-500 mt-1">Expected travelers</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              ${(totalLow / 1000).toFixed(0)}K–${(totalHigh / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-gray-500 mt-1">Total guest spend</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 mb-6">
          Per-guest cost is <span className="font-semibold">{burdenContext(perGuest)}</span>.
          {destSlug && ` Based on ${destLabel.split(',')[0]} average flight and accommodation data.`}
        </div>

        <p className="text-xs text-gray-400 mb-6">
          Assumes {Math.round(TRAVEL_RATE * 100)}% of guests travel, averaging 2 guests per room.
          Flight costs are round-trip averages from US East Coast.
        </p>

        {/* Email gate */}
        {!unlocked ? (
          <div className="border border-gray-100 rounded-xl p-5 bg-gray-50">
            <p className="font-semibold text-gray-900 mb-1 text-sm">See the full cost breakdown</p>
            <p className="text-xs text-gray-500 mb-3">
              Unlock the flight vs. accommodation split, and find out how a room block can lock in the accommodation rate for your guests.
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
          <div className="space-y-4">
            {/* Breakdown table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Cost component</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Per guest</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">All guests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 text-gray-700">Round-trip flights (avg)</td>
                    <td className="px-4 py-3 text-right font-medium">${burden.avgFlightCostUSD.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">${flightTotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-gray-700">Accommodation ({nights} nights, {rooms} rooms)</td>
                    <td className="px-4 py-3 text-right font-medium">${(burden.avgHotelPerNightUSD * nights).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">${hotelTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">Total (midpoint estimate)</td>
                    <td className="px-4 py-3 text-right font-bold">${perGuest.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold">${totalBurden.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Room block CTA */}
            <div className="bg-brand text-white rounded-xl p-5">
              <p className="font-bold mb-1">Lock in the accommodation rate for your guests</p>
              <p className="text-sm text-white/70 mb-4">
                A room block secures rooms at a negotiated group rate — guests pay the same or less than booking direct, and you get complimentary perks. Free to set up, no cost to you.
              </p>
              <a
                href="/book/"
                className="inline-block bg-white text-brand hover:bg-gray-100 font-bold px-6 py-3 rounded-lg transition-colors text-sm no-underline"
              >
                Get a free room block proposal →
              </a>
            </div>

            <a
              href="/tools/room-block-calculator/"
              className="block text-center text-sm text-brand font-medium hover:underline"
            >
              Estimate your room count and perks with our Room Block Calculator →
            </a>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Estimates are based on industry averages and destination-specific data. Actual flight costs vary significantly by departure city, airline, and booking timing.
      </p>
    </div>
  );
}
