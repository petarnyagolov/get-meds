var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var worker_default = {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CSRF-TOKEN, Authorization",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      const url = new URL(request.url);
      const targetUrl = url.searchParams.get("url");
      const pharmacy = url.searchParams.get("pharmacy");
      const query = url.searchParams.get("q");
      if (pharmacy === "vmclub") {
        return await handleVMClub(query, corsHeaders);
      } else if (pharmacy === "sopharmacy") {
        return await handleSOpharmacy(targetUrl, corsHeaders);
      } else if (targetUrl) {
        return await handleGenericProxy(targetUrl, corsHeaders);
      } else {
        return new Response(JSON.stringify({
          error: "Missing parameters",
          usage: "?pharmacy=vmclub&q=query OR ?pharmacy=sopharmacy&url=... OR ?url=..."
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({
        error: "Worker error",
        message: err.message
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
async function handleVMClub(query, corsHeaders) {
  try {
    if (!query) {
      return new Response(JSON.stringify({ error: "Missing query parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const homePage = await fetch("https://sofia.vmclub.bg/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "bg-BG,bg;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none"
      }
    });
    const html = await homePage.text();
    const setCookieHeaders = homePage.headers.get("set-cookie");
    let allCookies = [];
    if (setCookieHeaders) {
      const cookieParts = setCookieHeaders.split(",").map((c) => c.trim());
      allCookies = cookieParts.map((cookie) => cookie.split(";")[0]).filter((c) => c);
    }
    const cookieString = allCookies.join("; ");
    const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
    if (!csrfToken) {
      throw new Error("Failed to extract CSRF token");
    }
    const searchResponse = await fetch("https://sofia.vmclub.bg/products/fast-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-CSRF-TOKEN": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookieString,
        // Използвай новия cookieString
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
    const enrichedProducts = [];
    if (data.html) {
      const productUrlRegex = /href="\/pharmacy\/([\w-]+)"/g;
      const matches = [...data.html.matchAll(productUrlRegex)];
      const maxProducts = Math.min(matches.length, 10);
      for (let i = 0; i < maxProducts; i++) {
        const productSlug = matches[i][1];
        const productUrl = `https://sofia.vmclub.bg/pharmacy/${productSlug}`;
        try {
          const productPage = await fetch(productUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Cookie": cookieString
            }
          });
          const productHtml = await productPage.text();
          const jsonLdMatch = productHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
          if (jsonLdMatch) {
            const jsonLd = JSON.parse(jsonLdMatch[1]);
            const productID = jsonLd.productID;
            const availabilityUrl = `https://sofia.vmclub.bg/store-locations?check=${productID}`;
            const availabilityResponse = await fetch(availabilityUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Cookie": cookieString
              }
            });
            const availabilityHtml = await availabilityResponse.text();
            const locationRegex = /data-text='({[^']+})'/g;
            const locations = [];
            let locationMatch;
            while ((locationMatch = locationRegex.exec(availabilityHtml)) !== null) {
              try {
                const locationData = JSON.parse(locationMatch[1].replace(/\\/g, ""));
                locations.push({
                  id: locationData.id,
                  name: locationData.name,
                  address: locationData.address,
                  city: locationData.city,
                  email: locationData.email,
                  phone: locationData.phone,
                  lat: locationData.lat,
                  lon: locationData.lon,
                  status: locationData.status
                  // 0=available, 1=unavailable
                });
              } catch (e) {
              }
            }
            enrichedProducts.push({
              productID,
              name: jsonLd.name,
              description: jsonLd.description,
              image: jsonLd.image?.[0] || null,
              sku: jsonLd.sku,
              brand: jsonLd.brand?.name || "",
              price: jsonLd.offers?.price || null,
              priceCurrency: jsonLd.offers?.priceCurrency || "EUR",
              availability: jsonLd.offers?.availability || "",
              productUrl,
              slug: productSlug,
              locations
            });
          }
        } catch (err) {
          console.error(`Failed to fetch product ${productSlug}:`, err.message);
        }
      }
    }
    return new Response(JSON.stringify({
      success: true,
      query,
      totalProducts: enrichedProducts.length,
      products: enrichedProducts
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "VMClub fetch failed",
      message: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleVMClub, "handleVMClub");
async function handleSOpharmacy(targetUrl, corsHeaders) {
  try {
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const urlObj = new URL(targetUrl);
    if (!urlObj.hostname.includes("sopharmacy.bg")) {
      return new Response(JSON.stringify({ error: "Invalid SOpharmacy URL" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "bg,en;q=0.9",
        "Referer": "https://sopharmacy.bg/",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
      }
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "text/html";
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "SOpharmacy fetch failed",
      message: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleSOpharmacy, "handleSOpharmacy");
async function handleGenericProxy(targetUrl, corsHeaders) {
  try {
    const urlObj = new URL(targetUrl);
    const allowedDomains = [
      "sopharmacy.bg",
      "vmclub.bg",
      "remedium.bg",
      "subra.bg",
      "apteka.bg"
    ];
    const isAllowed = allowedDomains.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
    );
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: "Domain not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "bg,en;q=0.9"
      }
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") || "text/plain";
    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Generic proxy failed",
      message: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleGenericProxy, "handleGenericProxy");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
