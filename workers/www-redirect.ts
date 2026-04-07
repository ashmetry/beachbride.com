/**
 * Cloudflare Worker: www-redirect
 * Redirects all www.beachbride.com requests to beachbride.com (301)
 */
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    url.hostname = 'beachbride.com';
    return Response.redirect(url.toString(), 301);
  },
};
