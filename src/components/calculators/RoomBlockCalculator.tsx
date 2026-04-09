/**
 * Room Block Calculator
 * Inputs: guest count, % traveling, avg nights, budget tier
 * Teaser output (free): rooms needed, total cost estimate
 * Full output (email-gated): resort tier recommendation, perks at their room count, CTA
 */

import { useState } from 'react';
import tiers from '../../data/room-block-tiers.json';

const DESTINATIONS = [
  'Cancun, Mexico',
  'Punta Cana, Dominican Republic',
  'Jamaica',
  'Hawaii, USA',
  'Riviera Maya, Mexico',
  'Los Cabos, Mexico',
  'St. Lucia',
  'Aruba',
  'Turks & Caicos',
  'Bali, Indonesia',
  'Santorini, Greece',
  'Other',
];

const NIGHTS_OPTIONS = [
  { value: 3, label: '3 nights' },
  { value: 4, label: '4 nights' },
  { value: 5, label: '5 nights' },
  { value: 7, label: '7 nights' },
];

function getApplicablePerks(rooms: number) {
  return tiers.perks.filter(p => p.minRooms <= rooms).slice(-1)[0] ?? null;
}

function getNextPerkThreshold(rooms: number) {
  return tiers.perks.find(p => p.minRooms > rooms) ?? null;
}

export default function RoomBlockCalculator() {
  const [guestCount, setGuestCount] = useState(40);
  const [travelPct, setTravelPct] = useState(70);
  const [nights, setNights] = useState(4);
  const [budgetTierId, setBudgetTierId] = useState('mid');
  const [destination, setDestination] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const budgetTier = tiers.budgetTiers.find(t => t.id === budgetTierId)!;
  const roomsNeeded = Math.ceil(guestCount * (travelPct / 100) / 2); // avg 2 guests/room
  const totalCost = roomsNeeded * budgetTier.avgNightly * nights;
  const perRoom = budgetTier.avgNightly * nights;
  const currentPerks = getApplicablePerks(roomsNeeded);
  const nextPerk = getNextPerkThreshold(roomsNeeded);
  const roomsToNextPerk = nextPerk ? nextPerk.minRooms - roomsNeeded : 0;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setEmailError('');
    try {
      await fetch('/workers/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'room-block-capture',
          email,
          destination: destination || undefined,
          utm_source: 'room-block-calculator',
          utm_medium: 'tool',
        }),
      });
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
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Estimated % of guests traveling: <span className="text-gray-900 font-bold">{travelPct}%</span>
          </label>
          <input
            type="range" min={30} max={100} step={5} value={travelPct}
            onChange={e => setTravelPct(Number(e.target.value))}
            className="w-full accent-gray-900"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>30%</span><span>100%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Average nights</label>
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Resort budget</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {tiers.budgetTiers.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBudgetTierId(t.id)}
                className={`px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                  budgetTierId === t.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-900/50'
                }`}
              >
                <span className="font-medium block">{t.label}</span>
                <span className={`text-xs ${budgetTierId === t.id ? 'text-white/70' : 'text-gray-400'}`}>
                  {t.brands.slice(0, 2).join(', ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Teaser results — always visible */}
      <div className="card p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Your room block estimate</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{roomsNeeded}</p>
            <p className="text-xs text-gray-500 mt-1">Rooms needed</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">${perRoom.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Per guest total</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">${totalCost.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Block value</p>
          </div>
        </div>

        {/* Perk progress bar */}
        {currentPerks && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-1">At {roomsNeeded} rooms you get:</p>
            <p className="text-sm text-gray-700">{currentPerks.description}</p>
            {nextPerk && (
              <p className="text-xs text-gray-500 mt-2 font-medium">
                {roomsToNextPerk} more room{roomsToNextPerk !== 1 ? 's' : ''} unlocks: {nextPerk.description}
              </p>
            )}
          </div>
        )}

        {/* Gated full results */}
        {!unlocked ? (
          <div className="border border-gray-100 rounded-xl p-5 bg-gray-50">
            <p className="font-semibold text-gray-900 mb-1 text-sm">See your full resort recommendation</p>
            <p className="text-xs text-gray-500 mb-3">
              Enter your email to unlock: best resort brands for your budget, what to ask for in your contract, and a free consultation offer.
            </p>
            <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <select
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="w-full mb-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                >
                  <option value="">Your destination (optional)</option>
                  {DESTINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-gray-900 text-white font-semibold rounded-lg text-sm hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                {submitting ? 'Sending…' : 'See full results'}
              </button>
            </form>
            {emailError && <p className="text-red-600 text-xs mt-1">{emailError}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resort recommendation */}
            <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
              <p className="font-semibold text-gray-900 mb-2 text-sm">Recommended resort brands for your budget</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {budgetTier.brands.map(b => (
                  <span key={b} className="bg-white border border-gray-200 text-gray-900 text-xs font-semibold px-3 py-1 rounded-full">{b}</span>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                These brands offer group programs and commissionable rates in the {budgetTier.label.toLowerCase()} range.
                We'll get proposals from 2–3 properties based on your destination and availability.
              </p>
            </div>

            {/* What to ask for */}
            <div className="border border-gray-100 rounded-xl p-5">
              <p className="font-semibold text-gray-900 mb-2 text-sm">What we'll negotiate for you</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className="flex gap-2"><span className="text-gray-900 mt-0.5">✓</span> Courtesy block (no attrition liability) for your group size</li>
                <li className="flex gap-2"><span className="text-gray-900 mt-0.5">✓</span> Locked rate below public rack rate</li>
                <li className="flex gap-2"><span className="text-gray-900 mt-0.5">✓</span> Complimentary rooms and/or upgrades at your threshold</li>
                <li className="flex gap-2"><span className="text-gray-900 mt-0.5">✓</span> Private guest booking link — guests reserve directly, no coordination chaos</li>
              </ul>
            </div>

            {/* CTA */}
            <div className="bg-gray-900 text-white rounded-xl p-5 text-center">
              <p className="font-bold mb-1">Ready to lock in your group rate?</p>
              <p className="text-sm text-white/70 mb-4">Free to you — the resort covers our fee. 20-minute call.</p>
              <a
                href="/book/"
                className="inline-block bg-white text-gray-900 hover:bg-gray-100 font-bold px-6 py-3 rounded-lg transition-colors text-sm no-underline"
              >
                Book a free consultation →
              </a>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Estimates based on industry averages. Actual rates vary by resort, season, and availability.
        BeachBride earns a commission from resorts — there is no cost to couples.
      </p>
    </div>
  );
}
