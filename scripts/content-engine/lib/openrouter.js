/**
 * Content Engine — OpenRouter API Client
 * Shared client for all AI calls with retry logic and rate limiting.
 */

import { env } from './config.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MIN_GAP_MS = 300;
let lastCallTime = 0;

/**
 * Call an OpenRouter model.
 * @param {string} model - OpenRouter model ID (e.g. 'anthropic/claude-opus-4-6')
 * @param {string} systemPrompt - System message
 * @param {string} userPrompt - User message
 * @param {object} options - Extra params: temperature, max_tokens, response_format
 * @returns {Promise<{text: string, citations?: string[]}>}
 */
export async function callModel(model, systemPrompt, userPrompt, options = {}) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  // Rate limit: enforce minimum gap between calls
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_GAP_MS) {
    await sleep(MIN_GAP_MS - elapsed);
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...options,
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      lastCallTime = Date.now();
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://beachbride.com',
          'X-Title': 'BeachBride Content Engine',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
        const waitMs = Math.max(retryAfter * 1000, backoff(attempt));
        console.log(`  Rate limited (429). Waiting ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500) {
        const waitMs = backoff(attempt);
        console.log(`  Server error (${res.status}). Retry in ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? '';
      const usage = data.usage;

      if (usage) {
        console.log(`  [${model}] ${usage.prompt_tokens}→${usage.completion_tokens} tokens`);
      }

      // Perplexity models return citations as annotations on the message
      if (model.startsWith('perplexity/')) {
        const annotations = data.choices?.[0]?.message?.annotations || [];
        const citations = annotations
          .filter(a => a.type === 'url_citation' && a.url_citation?.url)
          .map(a => a.url_citation.url);
        return { text, citations };
      }

      return { text };
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        const waitMs = backoff(attempt);
        console.log(`  Error: ${err.message}. Retry in ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError || new Error('OpenRouter call failed after 3 attempts');
}

/**
 * Call a model and parse the response as JSON.
 * Strips markdown code fences if present.
 */
export async function callModelJSON(model, systemPrompt, userPrompt, options = {}) {
  const { text } = await callModel(model, systemPrompt, userPrompt, options);
  const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

function backoff(attempt) {
  return Math.pow(4, attempt) * 1000; // 1s, 4s, 16s
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
