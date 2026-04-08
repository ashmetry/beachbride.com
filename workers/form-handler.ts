/**
 * Cloudflare Worker: form-handler
 * Handles POST from all site forms:
 *   - email-capture (Stage 1 quiz)  → Sendy subscribe, nurture sequence triggered
 *   - lead         (Stage 2 quiz)   → notify owner + vendor emails, confirmation to bride
 *   - vendor                        → notify owner
 *   - contact                       → notify owner
 *
 * Worker secrets (set via Cloudflare dashboard or `wrangler secret put <NAME>`):
 *   MAILGUN_API_KEY, MAILGUN_DOMAIN, NOTIFY_EMAIL,
 *   SENDY_URL, SENDY_API_KEY, SENDY_LIST_ID, SENDY_NURTURE_LIST_ID
 */

export interface Env {
  MAILGUN_API_KEY: string;
  MAILGUN_DOMAIN: string;
  NOTIFY_EMAIL: string;
  SENDY_URL: string;
  SENDY_API_KEY: string;
  SENDY_LIST_ID: string;
  SENDY_NURTURE_LIST_ID: string; // Stage 1 email-capture list (triggers nurture sequence)
}

// ─── Payload Types ────────────────────────────────────────────────────────────

interface EmailCapturePayload {
  type: 'email-capture';
  email: string;
  name?: string;
  destination?: string; // e.g. "Cancun"
  destinationSlug?: string; // e.g. "cancun"
  vibe?: string; // e.g. "tropical", "bohemian", "luxe"
  season?: string; // e.g. "winter", "spring", "summer", "fall"
  guestCount?: string; // e.g. "intimate", "medium", "large"
  budget?: string; // e.g. "budget", "mid", "luxury"
  matchedDestinations?: string[]; // top 3 slugs from quiz scoring
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface LeadPayload {
  type: 'lead';
  name: string;
  email: string;
  phone: string;
  destination: string;
  destinationSlug?: string;
  weddingDate?: string;
  guestCount?: string;
  budget?: string;
  servicesNeeded?: string[]; // ["planner", "photographer", "florist"] — NOT resorts/jewelers
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface VendorPayload {
  type: 'vendor';
  name: string;
  email: string;
  phone: string;
  businessName: string;
  website?: string;
  vendorType?: string; // "planner", "photographer", "florist", etc.
  destinations?: string[];
  tier?: 'free' | 'premium' | 'pro';
  notes?: string;
}

interface ContactPayload {
  type: 'contact';
  name: string;
  email: string;
  message: string;
}

type Payload = EmailCapturePayload | LeadPayload | VendorPayload | ContactPayload;

// ─── Email ─────────────────────────────────────────────────────────────────────

async function sendMailgunEmail(env: Env, to: string, subject: string, text: string): Promise<void> {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.error('Mailgun not configured — skipping email to', to);
    return;
  }

  try {
    const formData = new FormData();
    formData.append('from', `BeachBride <noreply@${env.MAILGUN_DOMAIN}>`);
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('text', text);

    const res = await fetch(`https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}` },
      body: formData,
    });

    if (!res.ok) console.error('Mailgun error:', await res.text());
  } catch (err) {
    console.error('Mailgun send failed:', err);
  }
}

// ─── Sendy ─────────────────────────────────────────────────────────────────────

async function subscribeToSendy(
  env: Env,
  listId: string,
  email: string,
  name: string,
  customFields: Record<string, string> = {}
): Promise<void> {
  if (!env.SENDY_URL || !env.SENDY_API_KEY || !listId) {
    console.error('Sendy not configured — skipping subscribe');
    return;
  }

  const params = new URLSearchParams({
    api_key: env.SENDY_API_KEY,
    list: listId,
    email,
    name,
    boolean: 'true',
  });

  for (const [k, v] of Object.entries(customFields)) {
    if (v) params.append(k, v);
  }

  try {
    const res = await fetch(`${env.SENDY_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) console.error('Sendy subscribe error:', res.status);
  } catch (err) {
    console.error('Sendy subscribe failed:', err);
  }
}

// ─── Destination Data (inline — Worker can't import src/data at runtime) ──────

// Top resort per destination: [resortName, affiliateUrl]
// Replace affiliate URLs with your tracked links once programmes are activated.
const DESTINATION_RESORTS: Record<string, [string, string]> = {
  cancun:         ['Sandals Royal Cancun',           'https://www.sandals.com/royal-cancun/'],
  'punta-cana':   ['Secrets Cap Cana Resort & Spa',  'https://www.secretsresorts.com/en/resorts/dominican-republic/cap-cana'],
  jamaica:        ['Sandals Montego Bay',             'https://www.sandals.com/montego-bay/'],
  hawaii:         ['Four Seasons Resort Maui',        'https://www.fourseasons.com/maui/'],
  bali:           ['AYANA Resort Bali',               'https://www.ayana.com/bali/ayana-resort-and-spa'],
  santorini:      ['Canaves Oia Suites',              'https://www.canavesthe.com/'],
  tulum:          ['Azulik Tulum',                   'https://www.azulik.com/'],
  'costa-rica':   ['Andaz Costa Rica Resort',         'https://www.hyatt.com/andaz/cosar'],
  'key-west':     ['Sunset Key Cottages',             'https://www.sunsetkeywestcottages.com/'],
  'los-cabos':    ['Chileno Bay Resort & Residences', 'https://www.aubergeresorts.com/chilenobay/'],
  'st-lucia':     ['Sandals Grande St. Lucian',       'https://www.sandals.com/grande-st-lucian/'],
  'riviera-maya': ['Secrets Maroma Beach',            'https://www.secretsresorts.com/en/resorts/mexico/maroma-beach'],
  maldives:       ['Soneva Fushi',                    'https://www.soneva.com/soneva-fushi/'],
  aruba:          ['Manchebo Beach Resort',           'https://www.manchebo.com/'],
  fiji:           ['Kokomo Private Island',           'https://www.kokomofiji.com/'],
};

// InsureMyTrip affiliate link — replace with your tracked URL after signup at
// https://www.insuremytrip.com/affiliate-program/
const INSURANCE_URL = 'https://www.insuremytrip.com/?utm_source=beachbride&utm_medium=email';

// ─── Email Builders ───────────────────────────────────────────────────────────

function buildOwnerEmail(payload: Payload): { subject: string; text: string } {
  switch (payload.type) {
    case 'email-capture':
      return {
        subject: `Stage 1 Capture — ${payload.email} (${payload.destination ?? 'no destination'})`,
        text: [
          'STAGE 1 EMAIL CAPTURE',
          '====================',
          `Email:       ${payload.email}`,
          `Name:        ${payload.name ?? 'not provided'}`,
          `Destination: ${payload.destination ?? 'not specified'}`,
          `Vibe:        ${payload.vibe ?? 'not specified'}`,
          `Season:      ${payload.season ?? 'not specified'}`,
          `Guests:      ${payload.guestCount ?? 'not specified'}`,
          `Budget:      ${payload.budget ?? 'not specified'}`,
          `Matches:     ${payload.matchedDestinations?.join(', ') ?? 'none'}`,
          ...(payload.utm_source ? [`\nSource:      ${payload.utm_source} / ${payload.utm_medium ?? 'none'}`] : []),
        ].join('\n'),
      };

    case 'lead':
      return {
        subject: `New Lead — ${payload.name} (${payload.destination})`,
        text: [
          'NEW WEDDING LEAD',
          '================',
          `Name:        ${payload.name}`,
          `Email:       ${payload.email}`,
          `Phone:       ${payload.phone}`,
          `Destination: ${payload.destination}`,
          `Date:        ${payload.weddingDate ?? 'not specified'}`,
          `Guests:      ${payload.guestCount ?? 'not specified'}`,
          `Budget:      ${payload.budget ?? 'not specified'}`,
          `Services:    ${payload.servicesNeeded?.join(', ') ?? 'not specified'}`,
          ...(payload.utm_source ? [`\nSource:      ${payload.utm_source} / ${payload.utm_medium ?? 'none'}`] : []),
          ...(payload.utm_campaign ? [`Campaign:    ${payload.utm_campaign}`] : []),
        ].join('\n'),
      };

    case 'vendor':
      return {
        subject: `New Vendor Signup — ${payload.businessName} (${payload.vendorType ?? 'unknown type'})`,
        text: [
          'NEW VENDOR SIGNUP',
          '=================',
          `Business:    ${payload.businessName}`,
          `Contact:     ${payload.name}`,
          `Email:       ${payload.email}`,
          `Phone:       ${payload.phone}`,
          `Type:        ${payload.vendorType ?? 'not specified'}`,
          `Tier:        ${payload.tier ?? 'free'}`,
          `Destinations:${payload.destinations?.join(', ') ?? 'not specified'}`,
          `Website:     ${payload.website ?? 'not provided'}`,
          `Notes:       ${payload.notes ?? 'none'}`,
        ].join('\n'),
      };

    case 'contact':
      return {
        subject: `Contact Form — ${payload.name}`,
        text: [
          'CONTACT FORM SUBMISSION',
          '======================',
          `From:    ${payload.name} <${payload.email}>`,
          '',
          payload.message,
        ].join('\n'),
      };
  }
}

function buildBrideConfirmation(payload: LeadPayload): string {
  return [
    `Hi ${payload.name},`,
    '',
    `We've received your request and are matching you with vetted wedding vendors in ${payload.destination}.`,
    'You should hear from them within 24-48 hours.',
    '',
    'In the meantime, explore our destination guide:',
    `https://beachbride.com/destinations/${payload.destinationSlug ?? payload.destination.toLowerCase().replace(/\s+/g, '-')}/`,
    '',
    'Questions? Reply to this email anytime.',
    '',
    '— The BeachBride Team',
    'https://beachbride.com',
  ].join('\n');
}

function buildEmailCaptureConfirmation(payload: EmailCapturePayload): string {
  const firstName = payload.name ? payload.name.split(' ')[0] : null;
  const greeting = firstName ? `Hi ${firstName}` : 'Hi';
  const dest = payload.destination ?? 'your destination';
  const destSlug = payload.destinationSlug ?? '';
  const guideUrl = destSlug
    ? `https://beachbride.com/destinations/${destSlug}/`
    : 'https://beachbride.com/destinations/';

  const resort = destSlug ? DESTINATION_RESORTS[destSlug] : null;
  const resortBlock = resort
    ? [
        '─────────────────────────────────',
        `TOP RESORT PICK FOR ${dest.toUpperCase()}`,
        '',
        `${resort[0]}`,
        `${resort[1]}`,
        '',
        'Booking through this link costs you nothing extra — and it helps us',
        'keep guides like this one free.',
        '─────────────────────────────────',
      ].join('\n')
    : null;

  const lines = [
    `${greeting}!`,
    '',
    `Your ${dest} wedding guide is ready — I've put together everything below`,
    'to help you start planning with confidence.',
    '',
    `>>> OPEN YOUR FULL GUIDE`,
    guideUrl,
    '',
    "Here's what's inside:",
    '  • Best months to get married (weather + crowds)',
    '  • Realistic cost breakdown for your guest count',
    '  • Legal requirements and what paperwork you actually need',
    '  • Top resorts and venues with honest pros/cons',
    '  • Your 12-month planning timeline',
    '',
  ];

  if (resortBlock) {
    lines.push(resortBlock, '');
  }

  lines.push(
    '─────────────────────────────────',
    'ONE MORE THING: PROTECT YOUR WEDDING',
    '',
    'Most destination couples skip travel insurance — and regret it.',
    'A single cancelled flight or tropical storm can cost thousands.',
    '',
    'Compare plans from top-rated insurers (takes 2 minutes):',
    INSURANCE_URL,
    '─────────────────────────────────',
    '',
    "Over the next two weeks I'll send you a few more resources:",
    '  Day 3  — Beach-ready engagement rings and wedding bands (the styles',
    '           that actually photograph well in the sun)',
    '  Day 7  — The complete destination wedding checklist + legal tips',
    '  Day 14 — Ready to talk to a local planner? I\'ll introduce you.',
    '',
    'Reply to this email any time — I read every one.',
    '',
    '— The BeachBride Team',
    'https://beachbride.com',
    '',
    'To unsubscribe, click the link in any email we send.',
  );

  return lines.join('\n');
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://beachbride.com',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let payload: Payload;
    try {
      payload = (await request.json()) as Payload;
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
    }

    try {
      const { subject, text } = buildOwnerEmail(payload);

      // Always notify owner
      await sendMailgunEmail(env, env.NOTIFY_EMAIL, subject, text);

      if (payload.type === 'email-capture') {
        // Stage 1: subscribe to nurture list, send confirmation
        await subscribeToSendy(env, env.SENDY_NURTURE_LIST_ID, payload.email, payload.name ?? '', {
          destination_slug: payload.destinationSlug ?? '',
          vibe: payload.vibe ?? '',
          season: payload.season ?? '',
          guest_count: payload.guestCount ?? '',
          budget: payload.budget ?? '',
          utm_source: payload.utm_source ?? '',
          utm_medium: payload.utm_medium ?? '',
          utm_campaign: payload.utm_campaign ?? '',
        });

        await sendMailgunEmail(
          env,
          payload.email,
          `Your ${payload.destination ?? 'destination wedding'} guide is ready`,
          buildEmailCaptureConfirmation(payload)
        );
      }

      if (payload.type === 'lead') {
        // Stage 2: confirmation to bride + subscribe to main list
        await sendMailgunEmail(
          env,
          payload.email,
          `You're matched — ${payload.destination} wedding vendors will be in touch`,
          buildBrideConfirmation(payload)
        );

        await subscribeToSendy(env, env.SENDY_LIST_ID, payload.email, payload.name, {
          destination_slug: payload.destinationSlug ?? '',
          wedding_date: payload.weddingDate ?? '',
          guest_count: payload.guestCount ?? '',
          budget: payload.budget ?? '',
          services: payload.servicesNeeded?.join(', ') ?? '',
          phone: payload.phone,
          utm_source: payload.utm_source ?? '',
          utm_medium: payload.utm_medium ?? '',
          utm_campaign: payload.utm_campaign ?? '',
        });
      }

      return jsonResponse({ ok: true });
    } catch (err) {
      console.error('Form handler error:', err);
      return jsonResponse({ ok: false, error: 'Internal error' }, 500);
    }
  },
};
