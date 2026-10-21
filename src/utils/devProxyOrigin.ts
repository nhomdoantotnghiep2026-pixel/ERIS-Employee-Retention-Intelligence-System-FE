// The development proxy only normalizes requests from its own loopback page.
// Preserve all other Origin values so backend CSRF validation can reject them.
export function devProxyOrigin(origin: string | undefined, host: string | undefined, allowedOrigin: string | undefined) {
  if (!origin || !host || !allowedOrigin) return origin;
  try {
    const page = new URL(origin);
    const expected = new URL(allowedOrigin);
    const loopback = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
    if (page.origin !== origin || page.protocol !== 'http:' || !loopback(page.hostname)
      || !loopback(expected.hostname) || expected.protocol !== 'http:' || expected.origin !== allowedOrigin) return origin;
    return page.host === host ? expected.origin : origin;
  } catch { return origin; }
}
