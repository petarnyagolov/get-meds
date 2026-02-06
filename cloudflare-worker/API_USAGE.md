# Cloudflare Worker API Usage

Пълно ръководство за използване на GetMeds Cloudflare Worker CORS Proxy.

## 🎯 Обща информация

Worker-ът решава CORS проблемите при заявки към аптечни API-та и предоставя три начина за работа:

1. **SOpharmacy Handler** - Специализиран за sopharmacy.bg
2. **VMClub Handler** - С CSRF token и session management
3. **Generic Proxy** - За други whitelist-нати домейни

## 📋 API Endpoints

### 1. SOpharmacy Handler

**Формат:**
```
GET ${WORKER_URL}?pharmacy=sopharmacy&url={encodedURL}
```

**Параметри:**
- `pharmacy=sopharmacy` - Задължително, указва SOpharmacy handler
- `url` - URL encoded адрес към sopharmacy.bg endpoint

**Примери:**

#### Търсене на продукти
```javascript
const searchUrl = 'https://sopharmacy.bg/bg/sophSearch/?text=дриптан';
const workerUrl = `https://your-worker.workers.dev?pharmacy=sopharmacy&url=${encodeURIComponent(searchUrl)}`;

const response = await fetch(workerUrl);
const html = await response.text();
```

#### Наличност на продукт
```javascript
const availabilityUrl = 'https://sopharmacy.bg/bg/mapbox/000000000010001118/pdpProductAvailability.json';
const workerUrl = `https://your-worker.workers.dev?pharmacy=sopharmacy&url=${encodeURIComponent(availabilityUrl)}`;

const response = await fetch(workerUrl);
const data = await response.json();
```

**Какво прави:**
- Добавя правилни User-Agent и headers
- Задава Referer към sopharmacy.bg
- Връща HTML или JSON с CORS headers
- Запазва content-type на оригиналния response

---

### 2. VMClub Handler

**Формат:**
```
GET ${WORKER_URL}?pharmacy=vmclub&q={query}
```

**Параметри:**
- `pharmacy=vmclub` - Задължително, указва VMClub handler
- `q` - Търсена дума (лекарство)

**Пример:**
```javascript
const workerUrl = `https://your-worker.workers.dev?pharmacy=vmclub&q=${encodeURIComponent('дриптан')}`;

const response = await fetch(workerUrl);
const data = await response.json();

// data.html съдържа HTML резултатите от търсенето
```

**Какво прави:**
1. Прави заявка към `https://sofia.vmclub.bg/` за homepage
2. Извлича CSRF token от HTML-а
3. Взима session cookies от response
4. Прави POST заявка към `/products/fast-search` с:
   - CSRF token в header (`X-CSRF-TOKEN`)
   - Session cookies
   - Правилни headers за AJAX заявка
5. Връща JSON response с резултатите

**Response формат от VMClub:**
```json
{
  "html": "<div class='search-results'>...</div>",
  "count": 5,
  "...": "..."
}
```

---

### 3. Generic Proxy

**Формат:**
```
GET ${WORKER_URL}?url={encodedURL}
```

**Параметри:**
- `url` - URL encoded адрес (само whitelist домейни)

**Whitelist домейни:**
- `sopharmacy.bg`
- `vmclub.bg`
- `remedium.bg`
- `subra.bg`
- `apteka.bg`

**Пример:**
```javascript
const targetUrl = 'https://remedium.bg/api/search?q=аспирин';
const workerUrl = `https://your-worker.workers.dev?url=${encodeURIComponent(targetUrl)}`;

const response = await fetch(workerUrl);
const data = await response.text(); // или .json() в зависимост от response
```

**Какво прави:**
- Валидира че домейнът е в whitelist
- Прави GET заявка към целевия URL
- Добавя базови headers (User-Agent, Accept)
- Връща response с CORS headers

---

## 🔧 Използване в GetMeds

### В app.js конфигурация:

```javascript
const CONFIG = {
    CORS_PROXY: 'https://your-worker.workers.dev',
    USE_CORS_PROXY: true, // Задължително true за production
    PHARMACIES: [
        {
            name: 'Sopharmacy',
            enabled: true
        },
        {
            name: 'VMClub',
            enabled: true
        }
    ]
};
```

### SOpharmacy търсене:

```javascript
async function searchSopharmacy(query) {
    const searchUrl = `https://sopharmacy.bg/bg/sophSearch/?text=${encodeURIComponent(query)}`;
    
    const fetchUrl = CONFIG.USE_CORS_PROXY 
        ? `${CONFIG.CORS_PROXY}?pharmacy=sopharmacy&url=${encodeURIComponent(searchUrl)}`
        : searchUrl;
    
    const response = await fetch(fetchUrl);
    const html = await response.text();
    // ... parse HTML
}
```

### VMClub търсене:

```javascript
async function searchVMClub(query) {
    if (!CONFIG.USE_CORS_PROXY) {
        console.warn('VMClub requires CORS proxy');
        return [];
    }

    const fetchUrl = `${CONFIG.CORS_PROXY}?pharmacy=vmclub&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(fetchUrl);
    const data = await response.json();
    // ... parse response
}
```

---

## 🛠️ Error Handling

Worker-ът връща JSON с грешки в следните случаи:

### Missing Parameters
```json
{
  "error": "Missing parameters",
  "usage": "?pharmacy=vmclub&q=query OR ?pharmacy=sopharmacy&url=... OR ?url=..."
}
```
**HTTP Status:** 400

### Invalid Domain
```json
{
  "error": "Domain not allowed"
}
```
**HTTP Status:** 403

### CSRF Token Error (VMClub)
```json
{
  "error": "VMClub fetch failed",
  "message": "Failed to extract CSRF token"
}
```
**HTTP Status:** 500

### Generic Fetch Error
```json
{
  "error": "SOpharmacy fetch failed",
  "message": "Network error description"
}
```
**HTTP Status:** 500

---

## 📊 Response Headers

Всички responses включват CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-CSRF-TOKEN, Authorization
Access-Control-Max-Age: 86400
```

---

## 🔐 Security

### Whitelist
Само следните домейни са разрешени през generic proxy:
- sopharmacy.bg
- vmclub.bg
- remedium.bg
- subra.bg
- apteka.bg

### Rate Limiting
Cloudflare автоматично прилага rate limiting на Workers:
- Free tier: 100,000 requests/day
- Paid tier: 10,000,000 requests/month

### Headers
Worker-ът добавя реалистични browser headers за избягване на блокиране:
- `User-Agent`: Chrome 120 на Windows
- `Accept-Language`: bg,en
- `DNT`: 1 (Do Not Track)
- `Referer`: Appropriate for each site

---

## 📈 Monitoring

### View Logs
```bash
wrangler tail
```

### Test Worker
```bash
# Test SOpharmacy
curl "https://your-worker.workers.dev?pharmacy=sopharmacy&url=https%3A%2F%2Fsopharmacy.bg%2Fbg%2FsophSearch%2F%3Ftext%3D%D0%B4%D1%80%D0%B8%D0%BF%D1%82%D0%B0%D0%BD"

# Test VMClub
curl "https://your-worker.workers.dev?pharmacy=vmclub&q=дриптан"

# Test Generic
curl "https://your-worker.workers.dev?url=https%3A%2F%2Fsopharmacy.bg"
```

---

## 🚀 Best Practices

1. **Always use CORS proxy in production** - Set `USE_CORS_PROXY: true`
2. **Error handling** - Always wrap fetch calls in try-catch
3. **Cache responses** - Consider caching frequent searches (future improvement)
4. **Monitor usage** - Check Cloudflare dashboard for request counts
5. **Test locally** - Use `wrangler dev` for local testing

---

## 📝 Examples

### Complete SOpharmacy Search Flow

```javascript
async function fullSOpharmacySearch(query) {
    const WORKER = 'https://your-worker.workers.dev';
    
    // Step 1: Search products
    const searchUrl = `https://sopharmacy.bg/bg/sophSearch/?text=${encodeURIComponent(query)}`;
    const searchFetchUrl = `${WORKER}?pharmacy=sopharmacy&url=${encodeURIComponent(searchUrl)}`;
    
    const searchResponse = await fetch(searchFetchUrl);
    const html = await searchResponse.text();
    
    // Parse product IDs from HTML
    const productIds = extractProductIds(html);
    
    // Step 2: Get availability for each product
    const availabilityPromises = productIds.map(async (productId) => {
        const availUrl = `https://sopharmacy.bg/bg/mapbox/${productId}/pdpProductAvailability.json`;
        const fetchUrl = `${WORKER}?pharmacy=sopharmacy&url=${encodeURIComponent(availUrl)}`;
        
        const response = await fetch(fetchUrl);
        return await response.json();
    });
    
    const availabilities = await Promise.all(availabilityPromises);
    return availabilities;
}
```

### Complete VMClub Search

```javascript
async function fullVMClubSearch(query) {
    const WORKER = 'https://your-worker.workers.dev';
    const fetchUrl = `${WORKER}?pharmacy=vmclub&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(fetchUrl);
    const data = await response.json();
    
    // Parse HTML from data.html
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, 'text/html');
    
    const products = [];
    doc.querySelectorAll('.product-item').forEach(item => {
        products.push({
            name: item.querySelector('.product-name').textContent,
            price: item.querySelector('.price').textContent,
            // ... more fields
        });
    });
    
    return products;
}
```

---

## 🆘 Troubleshooting

### Problem: CORS error
**Solution:** Ensure `USE_CORS_PROXY: true` and Worker URL is correct

### Problem: 403 Forbidden
**Solution:** Check that domain is in whitelist (worker.js)

### Problem: CSRF token error (VMClub)
**Solution:** VMClub may have changed their HTML structure. Check the regex in worker.js

### Problem: Empty results
**Solution:** Check if pharmacy website has changed structure. Update parsers in app.js

---

## 📞 Support

For issues with the Worker:
1. Check Cloudflare dashboard logs
2. Run `wrangler tail` to see real-time errors
3. Test with `curl` to isolate the problem
4. Check this documentation for correct API usage
