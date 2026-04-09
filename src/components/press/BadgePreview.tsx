import { useState, useMemo } from 'react';

interface Vendor {
  slug: string;
  name: string;
  type: string;
  tier: string;
  destinations: string[];
  rating?: number;
  reviewCount?: number;
}

interface Destination {
  slug: string;
  name: string;
}

interface Props {
  vendors: Vendor[];
  destinations: Destination[];
  initialSlug?: string;
}

const TIER_LABEL: Record<string, string> = { pro: 'Pro', premium: 'Premium', free: 'Free' };
const TIER_ORDER: Record<string, number> = { pro: 0, premium: 1, free: 2 };

// CSS-only logo mark — no SVG text, no emoji, renders identically on any site
function LogoMark({ gold, size = 40 }: { gold: boolean; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: gold
        ? 'linear-gradient(135deg, #C9974A 0%, #A67A35 100%)'
        : 'linear-gradient(135deg, #1C2B4A 0%, #111B30 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: '#fff',
      fontWeight: 800,
      fontSize: Math.round(size * 0.38),
      fontFamily: 'system-ui, sans-serif',
      letterSpacing: '-0.02em',
      userSelect: 'none',
    }}>
      BB
    </div>
  );
}

export function Badge({ vendor, destName }: { vendor: Vendor | null; destName: string | null }) {
  const tier = vendor?.tier ?? 'free';
  const isPremiumPlus = tier === 'premium' || tier === 'pro';
  const isPro = tier === 'pro';

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      background: isPremiumPlus ? 'linear-gradient(135deg, #fff 0%, #fdf8f0 100%)' : '#fff',
      border: `1.5px solid ${isPro ? '#C9974A' : isPremiumPlus ? '#e8c98a' : '#d1d5db'}`,
      borderRadius: 12,
      padding: '10px 16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: isPremiumPlus
        ? '0 2px 10px rgba(201,151,74,0.18)'
        : '0 1px 4px rgba(0,0,0,0.08)',
      maxWidth: 300,
    }}>
      <LogoMark gold={isPremiumPlus} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: isPremiumPlus ? '#A67A35' : '#6b7280',
          marginBottom: 1,
        }}>
          {isPro ? '✓ Verified Pro' : isPremiumPlus ? 'Featured Vendor' : 'Featured on'}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#1a5f6f', lineHeight: 1.1 }}>
          BeachBride.com
        </div>
        {isPremiumPlus && vendor && (
          <div style={{
            fontSize: 12, color: '#374151', fontWeight: 500, marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {vendor.name}
          </div>
        )}
        {isPro && (destName || vendor?.rating) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            {destName && <span style={{ fontSize: 10, color: '#6b7280' }}>📍 {destName}</span>}
            {vendor?.rating && (
              <span style={{ fontSize: 10, color: '#C9974A', fontWeight: 700 }}>★ {vendor.rating}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function generateEmbedCode(vendor: Vendor | null, destName: string | null): string {
  const href = vendor
    ? `https://beachbride.com/vendors/${vendor.slug}/`
    : 'https://beachbride.com/press/';

  const tier = vendor?.tier ?? 'free';
  const isPremiumPlus = tier === 'premium' || tier === 'pro';
  const isPro = tier === 'pro';
  const gold = isPremiumPlus;

  const circleBg = gold
    ? 'linear-gradient(135deg,#C9974A 0%,#A67A35 100%)'
    : 'linear-gradient(135deg,#1C2B4A 0%,#111B30 100%)';
  const border = isPro ? '#C9974A' : isPremiumPlus ? '#e8c98a' : '#d1d5db';
  const bg = isPremiumPlus ? 'linear-gradient(135deg,#fff 0%,#fdf8f0 100%)' : '#fff';
  const shadow = isPremiumPlus ? '0 2px 10px rgba(201,151,74,0.18)' : '0 1px 4px rgba(0,0,0,0.08)';
  const labelColor = isPremiumPlus ? '#A67A35' : '#6b7280';
  const label = isPro ? '&#10003; Verified Pro' : isPremiumPlus ? 'Featured Vendor' : 'Featured on';

  const extras = [
    isPremiumPlus && vendor
      ? `<div style="font-size:12px;color:#374151;font-weight:500;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${vendor.name}</div>`
      : '',
    isPro && (destName || vendor?.rating)
      ? `<div style="font-size:10px;color:#6b7280;margin-top:3px">${destName ? `📍 ${destName}` : ''}${destName && vendor?.rating ? '&nbsp; ' : ''}${vendor?.rating ? `<span style="color:#C9974A;font-weight:700">&#9733; ${vendor.rating}</span>` : ''}</div>`
      : '',
  ].filter(Boolean).join('\n    ');

  return `<!-- BeachBride.com vendor badge -->
<a href="${href}" target="_blank" rel="noopener" title="As featured on BeachBride.com"
   style="display:inline-flex;align-items:center;gap:12px;background:${bg};border:1.5px solid ${border};border-radius:12px;padding:10px 16px;font-family:system-ui,sans-serif;box-shadow:${shadow};text-decoration:none;max-width:300px">
  <div style="width:40px;height:40px;border-radius:50%;background:${circleBg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;flex-shrink:0;letter-spacing:-.02em">BB</div>
  <div>
    <div style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${labelColor};margin-bottom:1px">${label}</div>
    <div style="font-size:15px;font-weight:800;color:#1a5f6f;line-height:1.1">BeachBride.com</div>
    ${extras}
  </div>
</a>`;
}

export default function BadgePreview({ vendors, destinations, initialSlug }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug ?? 'none');
  const [copied, setCopied] = useState(false);

  const vendor = useMemo(
    () => (selectedSlug === 'none' ? null : vendors.find(v => v.slug === selectedSlug) ?? null),
    [selectedSlug, vendors]
  );

  const destName = useMemo(() => {
    if (!vendor?.destinations?.length) return null;
    return destinations.find(d => d.slug === vendor.destinations[0])?.name ?? null;
  }, [vendor, destinations]);

  const embedCode = generateEmbedCode(vendor, destName);

  function handleCopy() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const sortedVendors = [...vendors].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3)
  );

  return (
    <div className="space-y-6">

      {/* Step 1 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          Step 1 — Find your business
        </p>
        <select
          value={selectedSlug}
          onChange={e => setSelectedSlug(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <option value="none">— I don't have a listing yet —</option>
          {sortedVendors.map(v => (
            <option key={v.slug} value={v.slug}>
              {v.name} ({TIER_LABEL[v.tier] ?? v.tier})
            </option>
          ))}
        </select>
        {selectedSlug === 'none' && (
          <p className="text-xs text-gray-400 mt-1.5">
            Not listed?{' '}
            <a href="/advertise/" className="text-brand font-semibold hover:underline">
              Add your business free →
            </a>
          </p>
        )}
        {vendor?.tier === 'free' && (
          <p className="text-xs text-gray-500 mt-1.5">
            <a href="/vendors/upgrade/" className="text-accent font-semibold hover:underline">
              Upgrade to Premium or Pro
            </a>{' '}
            to add your name, destination, and rating to the badge.
          </p>
        )}
      </div>

      {/* Step 2 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          Step 2 — Your badge
        </p>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-8 flex items-center justify-center min-h-[100px]">
          <Badge vendor={vendor} destName={destName} />
        </div>
      </div>

      {/* Step 3 */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
          Step 3 — Copy &amp; paste on your site
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 pr-20 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{
              background: copied ? '#1C2B4A' : 'rgba(255,255,255,0.12)',
              color: copied ? '#fff' : '#d1d5db',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Paste on your website, portfolio, or email footer. The link goes to your BeachBride profile.
        </p>
      </div>

    </div>
  );
}
