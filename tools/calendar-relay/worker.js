/**
 * A tiny relay for Broomit's calendar, to run as a Cloudflare Worker (free plan is enough).
 *
 * Some calendar sites (WebUntis, Google) do not let a web page read their iCal links. This
 * worker loads the link for Broomit and passes the calendar on. It keeps nothing.
 *
 * Set it up: dash.cloudflare.com → Workers → Create → paste this file → Deploy. Then put
 *   https://<your-worker>.workers.dev/?url={url}
 * into Broomit: Calendar → Calendars → Advanced: relay.
 */

// Only calendars are relayed, and only to Broomit.
const ALLOWED_ORIGIN = 'https://luschif.github.io'

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    const target = new URL(request.url).searchParams.get('url')
    if (!target || !/^https:\/\//i.test(target)) {
      return new Response('Missing calendar link', { status: 400, headers: cors })
    }
    const response = await fetch(target, { headers: { Accept: 'text/calendar' } })
    const text = await response.text()
    if (!response.ok || !text.includes('BEGIN:VCALENDAR')) {
      return new Response('Not a calendar', { status: 502, headers: cors })
    }
    return new Response(text, {
      headers: {
        ...cors,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  },
}
