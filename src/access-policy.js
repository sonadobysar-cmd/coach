const PRODUCTION_HOSTS = new Set(['elitea.cz', 'www.elitea.cz']);

export function previewAccessAllowed(request, env = process.env) {
  if (env.ELITEA_PREVIEW_ACCESS !== 'true') return false;
  if (String(env.VERCEL_ENV || '').toLowerCase() === 'production') return false;
  return !PRODUCTION_HOSTS.has(requestHostname(request));
}

function requestHostname(request) {
  const rawHost = String(request?.get?.('host') || request?.headers?.host || '').trim().toLowerCase();
  if (!rawHost) return '';
  try {
    return new URL(`https://${rawHost}`).hostname.replace(/\.$/, '');
  } catch {
    return rawHost.split(':')[0].replace(/\.$/, '');
  }
}
