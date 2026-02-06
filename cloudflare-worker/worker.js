/**
 * Cloudflare Worker for CORS Proxy
 * This worker handles CORS issues when fetching data from pharmacy APIs
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')
  
  if (!targetUrl) {
    return new Response('Missing url parameter', {
      status: 400,
      headers: corsHeaders()
    })
  }

  // Validate target URL
  try {
    new URL(targetUrl)
  } catch (e) {
    return new Response('Invalid url parameter', {
      status: 400,
      headers: corsHeaders()
    })
  }

  // Optional: Whitelist allowed domains for security
  const allowedDomains = [
    'sopharmacy.bg',
    'remedium.bg',
    'subra.bg',
    'apteka.bg'
  ]

  const targetDomain = new URL(targetUrl).hostname
  const isAllowed = allowedDomains.some(domain => 
    targetDomain === domain || targetDomain.endsWith('.' + domain)
  )

  if (!isAllowed) {
    return new Response('Domain not allowed', {
      status: 403,
      headers: corsHeaders()
    })
  }

  try {
    // Forward the request to the target URL
    const targetRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'GetMeds/1.0',
        'Accept': 'application/json, text/html',
      }
    })

    const response = await fetch(targetRequest)
    
    // Clone the response and add CORS headers
    const modifiedResponse = new Response(response.body, response)
    
    // Add CORS headers
    const headers = corsHeaders()
    for (const [key, value] of Object.entries(headers)) {
      modifiedResponse.headers.set(key, value)
    }
    
    // Copy other important headers
    if (response.headers.get('content-type')) {
      modifiedResponse.headers.set('content-type', response.headers.get('content-type'))
    }

    return modifiedResponse
    
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to fetch from target URL',
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        'content-type': 'application/json'
      }
    })
  }
}

function handleOptions() {
  return new Response(null, {
    headers: corsHeaders()
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}
