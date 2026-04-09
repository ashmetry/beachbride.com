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
  SENDY_NURTURE_LIST_ID: string;       // Stage 1 quiz email-capture list
  SENDY_ROOM_BLOCK_LIST_ID: string;    // Room block calculator captures (separate sequence)
  TURNSTILE_SECRET?: string; // Cloudflare Turnstile — set via wrangler secret put TURNSTILE_SECRET
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

interface RoomBlockCapturePayload {
  type: 'room-block-capture';
  email: string;
  destination?: string;
  utm_source?: string;
  utm_medium?: string;
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
  roomBlockInterest?: boolean; // true = wants free group rate help — high-value signal
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

type Payload = EmailCapturePayload | RoomBlockCapturePayload | LeadPayload | VendorPayload | ContactPayload;

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

    case 'room-block-capture':
      return {
        subject: `Room Block Capture — ${payload.email} (${payload.destination ?? 'no destination'})`,
        text: [
          'ROOM BLOCK CALCULATOR CAPTURE',
          '==============================',
          `Email:       ${payload.email}`,
          `Destination: ${payload.destination ?? 'not specified'}`,
          ...(payload.utm_source ? [`\nSource:      ${payload.utm_source} / ${payload.utm_medium ?? 'none'}`] : []),
        ].join('\n'),
      };

    case 'lead':
      return {
        subject: `New Lead${payload.roomBlockInterest ? ' 🏨 ROOM BLOCK' : ''} — ${payload.name} (${payload.destination})`,
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
          `Room Block:  ${payload.roomBlockInterest ? 'YES — wants group rate help' : 'No'}`,
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

// ─── Turnstile ────────────────────────────────────────────────────────────────

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch {
    console.error('Turnstile verification failed');
    return false;
  }
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

    let raw: Record<string, unknown>;
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
    }

    // Honeypot — if filled, silently return success (trick the bot)
    if (raw._hp) {
      return jsonResponse({ ok: true });
    }

    // Turnstile — enforce for quiz forms when secret is configured
    const requiresTurnstile = (raw.type === 'email-capture' || raw.type === 'lead') && env.TURNSTILE_SECRET;
    if (requiresTurnstile) {
      const token = (raw['cf-turnstile-response'] as string) || '';
      const ip = request.headers.get('CF-Connecting-IP') || '';
      if (!await verifyTurnstile(env.TURNSTILE_SECRET!, token, ip)) {
        return jsonResponse({ ok: false, error: 'Verification failed' }, 403);
      }
    }

    const payload = raw as unknown as Payload;

    try {
      const { subject, text } = buildOwnerEmail(payload);

      // Always notify owner
      await sendMailgunEmail(env, env.NOTIFY_EMAIL, subject, text);

      if (payload.type === 'room-block-capture') {
        await subscribeToSendy(env, env.SENDY_ROOM_BLOCK_LIST_ID, payload.email, '', {
          destination: payload.destination ?? '',
          utmsource: payload.utm_source ?? '',
          utmmedium: payload.utm_medium ?? '',
        });
      }

      if (payload.type === 'email-capture') {
        // Stage 1: subscribe to nurture list, send confirmation
        await subscribeToSendy(env, env.SENDY_NURTURE_LIST_ID, payload.email, payload.name ?? '', {
          destinationslug: payload.destinationSlug ?? '',
          destination: payload.destination ?? '',
          vibe: payload.vibe ?? '',
          season: payload.season ?? '',
          guestcount: payload.guestCount ?? '',
          budget: payload.budget ?? '',
          utmsource: payload.utm_source ?? '',
          utmmedium: payload.utm_medium ?? '',
          utmcampaign: payload.utm_campaign ?? '',
        });
        // Email 1 is sent by Sendy autoresponder (day 0) — no Mailgun send needed here.
      }

      if (payload.type === 'lead') {
        // Stage 2: confirmation to bride + subscribe to main list
        await sendMailgunEmail(
          env,
          payload.email,
          `You're matched — ${payload.destination} wedding vendors will be in touch`,
          buildBrideConfirmation(payload)
        );

        // High-value signal: separate alert for room block interest
        if (payload.roomBlockInterest) {
          await sendMailgunEmail(
            env,
            env.NOTIFY_EMAIL,
            `[ROOM BLOCK] ${payload.name} — ${payload.destination} (${payload.guestCount ?? 'unknown guests'})`,
            [
              'ROOM BLOCK INTEREST — ACT WITHIN 24 HRS',
              '=========================================',
              `Name:        ${payload.name}`,
              `Email:       ${payload.email}`,
              `Phone:       ${payload.phone}`,
              `Destination: ${payload.destination}`,
              `Date:        ${payload.weddingDate ?? 'not specified'}`,
              `Guests:      ${payload.guestCount ?? 'not specified'}`,
              `Budget:      ${payload.budget ?? 'not specified'}`,
              '',
              'Next step: reach out to secure a courtesy block proposal from the resort group sales team.',
            ].join('\n')
          );
        }

        await subscribeToSendy(env, env.SENDY_LIST_ID, payload.email, payload.name, {
          destinationslug: payload.destinationSlug ?? '',
          weddingdate: payload.weddingDate ?? '',
          guestcount: payload.guestCount ?? '',
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
