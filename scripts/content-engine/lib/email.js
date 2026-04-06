/**
 * Content Engine — Mailgun Email Notifications
 * Sends publish notifications, failure alerts, and weekly digests.
 */

import { env } from './config.js';

const MAILGUN_ENDPOINT = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;

/**
 * Send an email via Mailgun HTTP API.
 * @param {string} subject
 * @param {string} text - Plain text body
 * @param {string} [html] - Optional HTML body
 */
export async function sendEmail(subject, text, html = null) {
  if (!env.MAILGUN_API_KEY) {
    console.log('  ⚠ MAILGUN_API_KEY not set — skipping email');
    return;
  }

  const formData = new FormData();
  formData.append('from', `BeachBride Content Engine <noreply@${env.MAILGUN_DOMAIN}>`);
  formData.append('to', env.NOTIFY_EMAIL);
  formData.append('subject', subject);
  formData.append('text', text);
  if (html) formData.append('html', html);

  try {
    const auth = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64');
    const res = await fetch(MAILGUN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  Mailgun error (${res.status}): ${err}`);
    } else {
      console.log(`  Email sent: "${subject}"`);
    }
  } catch (err) {
    console.error(`  Email failed: ${err.message}`);
  }
}

/**
 * Notify: article published successfully.
 */
export async function notifyPublished(title, slug) {
  const url = `https://beachbride.com/${slug}/`;
  await sendEmail(
    `Published: ${title}`,
    [
      `A new article has been published on beachbride.com:`,
      ``,
      `Title: ${title}`,
      `URL: ${url}`,
      ``,
      `Review it to make sure everything looks good.`,
      `If anything needs fixing, edit src/content/articles/${slug}.md and push.`,
    ].join('\n'),
  );
}

/**
 * Notify: article failed quality gates after max rewrites.
 */
export async function notifyFailed(topicId, reason, qualityReport = null) {
  let body = [
    `An article failed quality gates and needs manual review:`,
    ``,
    `Topic: ${topicId}`,
    `Reason: ${reason}`,
  ];
  if (qualityReport) {
    body.push('', '--- Quality Report ---', JSON.stringify(qualityReport, null, 2));
  }
  await sendEmail(`Content Engine: Article Failed — ${topicId}`, body.join('\n'));
}

/**
 * Notify: weekly generation digest.
 */
export async function notifyDigest(stats) {
  const body = [
    `Weekly Content Engine Digest`,
    ``,
    `Published this week: ${stats.published?.length || 0}`,
  ];

  if (stats.published?.length) {
    for (const p of stats.published) {
      body.push(`  - ${p.title} → https://beachbride.com/${p.slug}/ (${p.date})`);
    }
  }

  body.push(
    ``,
    `Queue: ${stats.queueDepth || 0} articles ready for next week`,
    `Failed: ${stats.failed || 0}`,
  );

  if (stats.failures?.length) {
    body.push('');
    for (const f of stats.failures) {
      body.push(`  - ${f.id}: ${f.reason}`);
    }
  }

  body.push(
    ``,
    `Topics discovered this week: ${stats.discovered || 0}`,
  );

  await sendEmail('BeachBride Content Engine — Weekly Digest', body.join('\n'));
}
