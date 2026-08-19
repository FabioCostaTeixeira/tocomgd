export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Route landing page for root path
    if (path === '/') {
      const response = await env.ASSETS.fetch(new Request(new URL('/landing.html', url)));
      return response;
    }

    // Route app for tenant slugs and other paths (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};
