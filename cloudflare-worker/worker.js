/**
 * Cloudflare Worker for CORS Proxy - GetMeds
 * Handles CORS issues when fetching data from pharmacy APIs
 * Supports: SOpharmacy, VMClub, and other Bulgarian pharmacies
 */

export default {
  async fetch(request) {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-TOKEN, Authorization",
      "Access-Control-Max-Age": "86400",
    };

    // Handle preflight OPTIONS requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get('url');
      const pharmacy = url.searchParams.get('pharmacy'); // 'sopharmacy' or 'vmclub'
      const query = url.searchParams.get('q'); // search query

      // Route to specific pharmacy handler
      if (pharmacy === 'vmclub') {
        return await handleVMClub(query, corsHeaders);
      } else if (pharmacy === 'sopharmacy') {
        return await handleSOpharmacy(targetUrl, corsHeaders);
      } else if (targetUrl) {
        // Generic proxy for any allowed domain
        return await handleGenericProxy(targetUrl, corsHeaders);
      } else {
        return new Response(JSON.stringify({ 
          error: 'Missing parameters',
          usage: '?pharmacy=vmclub&q=query OR ?pharmacy=sopharmacy&url=... OR ?url=...'
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ 
        error: 'Worker error',
        message: err.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Handle VMClub requests (requires CSRF token and session)
 */
async function handleVMClub(query, corsHeaders) {
  try {
    if (!query) {
      return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // STEP 1: Get fresh session from homepage
    const homePage = await fetch("https://sofia.vmclub.bg/", {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
});

    const html = await homePage.text();
const setCookieHeaders = homePage.headers.get("set-cookie");
let allCookies = [];
if (setCookieHeaders) {
  const cookieParts = setCookieHeaders.split(',').map(c => c.trim());
  allCookies = cookieParts.map(cookie => cookie.split(';')[0]).filter(c => c);
}
const cookieString = allCookies.join('; ');
    // Extract CSRF token from HTML
    const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];

    if (!csrfToken) {
      throw new Error('Failed to extract CSRF token');
    }

    // STEP 2: Make search request with CSRF token
    const searchResponse = await fetch("https://sofia.vmclub.bg/products/fast-search", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-CSRF-TOKEN": csrfToken,
    "X-Requested-With": "XMLHttpRequest",
    "Cookie": cookieString,  // Използвай новия cookieString
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "bg-BG,bg;q=0.9,en;q=0.8",
    "Origin": "https://sofia.vmclub.bg",
    "Referer": "https://sofia.vmclub.bg/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin"
  },
  body: `q=${encodeURIComponent(query)}&field=fast-search`
});

    const data = await searchResponse.json();

    // STEP 3: Return data with CORS headers
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'VMClub fetch failed',
      message: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

/**
 * Handle SOpharmacy requests
 */
async function handleSOpharmacy(targetUrl, corsHeaders) {
  try {
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate it's a SOpharmacy URL
    const urlObj = new URL(targetUrl);
    if (!urlObj.hostname.includes('sopharmacy.bg')) {
      return new Response(JSON.stringify({ error: 'Invalid SOpharmacy URL' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch from SOpharmacy with proper headers
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'bg,en;q=0.9',
        'Referer': 'https://sopharmacy.bg/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    // Get response body
    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html';

    // Return with CORS headers
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'SOpharmacy fetch failed',
      message: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

/**
 * Generic proxy for other allowed domains
 */
async function handleGenericProxy(targetUrl, corsHeaders) {
  try {
    // Validate URL
    const urlObj = new URL(targetUrl);
    
    // Whitelist allowed domains
    const allowedDomains = [
      'sopharmacy.bg',
      'vmclub.bg',
      'remedium.bg',
      'subra.bg',
      'apteka.bg'
    ];

    const isAllowed = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch with proper headers
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'bg,en;q=0.9'
      }
    });

    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: 'Generic proxy failed',
      message: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
