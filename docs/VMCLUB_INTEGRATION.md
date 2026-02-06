# VMClub Integration Documentation

## Статус
✅ **Fully Implemented** - Реалната интеграция с VMClub е пълно функционална чрез Cloudflare Worker!

## Описание

VMClub интеграцията използва специален Cloudflare Worker handler, който:
1. Взима fresh CSRF token от homepage
2. Създава валидна сесия с cookies
3. Прави POST заявка към search endpoint с правилни headers

## Защо е нужен Worker за VMClub?

VMClub изисква:
- ✅ **CSRF Token** - Динамичен token от homepage
- ✅ **Session Cookies** - Валидна сесия
- ✅ **AJAX Headers** - `X-Requested-With: XMLHttpRequest`
- ✅ **Correct Content-Type** - `application/x-www-form-urlencoded`

Невъзможно е да се направи директно от браузъра заради CORS и липса на cookies.

## Как работи Worker-ът

### Стъпка 1: Взимане на сесия
```javascript
const homePage = await fetch("https://sofia.vmclub.bg/");
const html = await homePage.text();
const cookies = homePage.headers.get("set-cookie");
```

### Стъпка 2: Извличане на CSRF token
```javascript
const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
```

Търси в HTML:
```html
<meta name="csrf-token" content="AbC123XyZ...">
```

### Стъпка 3: POST заявка към search
```javascript
const searchResponse = await fetch("https://sofia.vmclub.bg/products/fast-search", {
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-CSRF-TOKEN": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": cookies,
        "User-Agent": "Mozilla/5.0...",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": "https://sofia.vmclub.bg/"
    },
    body: `q=${encodeURIComponent(query)}&field=fast-search`
});
```

### Стъпка 4: Връщане на резултата
```javascript
const data = await searchResponse.json();
return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
});
```

## API Използване

### От Frontend (app.js)

```javascript
async function searchVMClub(query) {
    if (!CONFIG.USE_CORS_PROXY) {
        console.warn('VMClub requires CORS proxy to be enabled');
        return [];
    }

    const fetchUrl = `${CONFIG.CORS_PROXY}?pharmacy=vmclub&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
        throw new Error(`VMClub search failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return parseVMClubResponse(data, query);
}
```

### Worker API Format

**Endpoint:**
```
GET https://your-worker.workers.dev?pharmacy=vmclub&q={search_query}
```

**Параметри:**
- `pharmacy=vmclub` - Задължително
- `q` - Търсена дума/лекарство (URL encoded)

**Пример:**
```bash
curl "https://your-worker.workers.dev?pharmacy=vmclub&q=аспирин"
```

## Response Format

VMClub връща JSON с HTML съдържание:

```json
{
    "html": "<div class='search-results'>...</div>",
    "count": 5,
    "success": true
}
```

### Парсване на HTML Response

```javascript
function parseVMClubResponse(data, query) {
    const results = [];
    
    if (!data || !data.html) {
        return results;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.html, 'text/html');
    
    const productItems = doc.querySelectorAll('.product-item, .search-result-item');
    
    productItems.forEach(item => {
        const nameElement = item.querySelector('.product-name, h3, .name');
        const priceElement = item.querySelector('.price, .product-price');
        const linkElement = item.querySelector('a[href*="/product/"]');
        const imgElement = item.querySelector('img');
        
        if (nameElement) {
            results.push({
                medicine: {
                    name: nameElement.textContent.trim(),
                    manufacturer: 'VMClub',
                    imageUrl: imgElement ? fixImageUrl(imgElement.src) : null,
                    productLink: linkElement ? fixProductUrl(linkElement.href) : null
                },
                pharmacy: {
                    name: 'VMClub София',
                    address: 'Различни локации в София',
                    phone: '0700 20 888',
                    city: 'София'
                },
                price: extractPrice(priceElement),
                inStock: true,
                availability: 'available'
            });
        }
    });
    
    return results;
}
```

## Конфигурация

### app.js
```javascript
const CONFIG = {
    CORS_PROXY: 'https://your-worker.workers.dev',
    USE_CORS_PROXY: true, // Задължително за VMClub!
    PHARMACIES: [
        {
            name: 'VMClub',
            endpoint: 'https://sofia.vmclub.bg/products/fast-search',
            enabled: true
        }
    ]
};
```

### Worker е вече конфигуриран
Worker кодът в `cloudflare-worker/worker.js` вече съдържа `handleVMClub` функция.

## Предимства

✅ **Автоматична сесия** - Worker създава fresh сесия за всяка заявка  
✅ **CSRF handling** - Автоматично извличане и използване на token  
✅ **CORS решен** - Worker добавя правилни CORS headers  
✅ **Реални данни** - Директно от VMClub системата  
✅ **Browser-like** - Имитира реална браузър заявка  

## Ограничения

⚠️ **Задължителен Worker** - Не може да се използва без Cloudflare Worker  
⚠️ **Performance** - Всяка заявка включва 2 requests (homepage + search)  
⚠️ **Sofia Only** - Endpoint е специфичен за София (`sofia.vmclub.bg`)  
⚠️ **HTML Parsing** - Зависимост от HTML структурата  
⚠️ **Rate Limiting** - Cloudflare Worker limits (100K requests/day free tier)  

## Error Handling

### CSRF Token грешка
```json
{
    "error": "VMClub fetch failed",
    "message": "Failed to extract CSRF token"
}
```

**Решение:** VMClub може да е променил HTML структурата. Провери regex в worker.js

### Session грешка
```json
{
    "error": "VMClub fetch failed",
    "message": "Invalid session"
}
```

**Решение:** Cookies не са били правилно преподадени. Провери Worker код.

### Празни резултати
```javascript
{
    "html": "",
    "count": 0
}
```

**Решение:** Няма продукти или грешка в търсенето.

## Deployment

### 1. Deploy Worker
```bash
cd cloudflare-worker
wrangler deploy
```

### 2. Test Worker
```bash
curl "https://your-worker.workers.dev?pharmacy=vmclub&q=парацетамол"
```

### 3. Enable в app.js
```javascript
const CONFIG = {
    CORS_PROXY: 'https://your-worker.workers.dev', // Твоя Worker URL
    USE_CORS_PROXY: true,
    PHARMACIES: [
        {
            name: 'VMClub',
            enabled: true
        }
    ]
};
```

## Тестване

### Manual Test
1. Deploy Worker
2. Отвори `index.html` в браузъра
3. Търси "парацетамол" или друго лекарство
4. Резултатите от VMClub ще се покажат заедно със SOpharmacy

### Console Test
```javascript
// В Browser Console (след deploy на Worker)
const CONFIG = {
    CORS_PROXY: 'https://your-worker.workers.dev',
    USE_CORS_PROXY: true
};

searchVMClub('аспирин').then(console.log);
```

## Алтернативни локации

За други градове, може да се модифицира Worker-а:

```javascript
// В worker.js
const cities = {
    'sofia': 'https://sofia.vmclub.bg',
    'plovdiv': 'https://plovdiv.vmclub.bg',
    'varna': 'https://varna.vmclub.bg',
    // ...
};

// Добави параметър city
const city = url.searchParams.get('city') || 'sofia';
const baseUrl = cities[city];
```

**API:**
```
?pharmacy=vmclub&city=plovdiv&q=аспирин
```

## Бъдещи подобрения

- 🔄 **Caching** - Кеширане на CSRF tokens (валидни за сесията)
- 🏙️ **Multi-city** - Поддръжка за всички градове на VMClub
- 📦 **Batch requests** - Търсене на множество продукти наведнъж
- 🔍 **Advanced search** - Филтриране по категория, производител
- 📊 **Availability levels** - Точна наличност вместо само boolean

## Troubleshooting

### Problem: "Failed to extract CSRF token"
**Причина:** HTML структурата на VMClub е променена  
**Решение:** Отвори https://sofia.vmclub.bg и провери meta tag-а:
```html
<meta name="csrf-token" content="...">
```
Обнови regex в `worker.js` ако е нужно.

### Problem: "VMClub requires CORS proxy to be enabled"
**Причина:** `USE_CORS_PROXY: false` в конфигурацията  
**Решение:** Задай `USE_CORS_PROXY: true` в `app.js`

### Problem: Празни резултати
**Причина:** HTML структурата за продукти е променена  
**Решение:** Провери селекторите в `parseVMClubResponse()` функцията

### Problem: Worker timeout
**Причина:** VMClub е бавен или недостъпен  
**Решение:** 
- Провери статуса на https://sofia.vmclub.bg
- Увеличи timeout в Worker settings (Cloudflare Dashboard)

## Resources

- [VMClub София](https://sofia.vmclub.bg)
- [Cloudflare Worker Docs](https://developers.cloudflare.com/workers/)
- [API Usage Documentation](../cloudflare-worker/API_USAGE.md)

## Контакти

За въпроси относно VMClub интеграцията:
- GitHub Issues: [repository URL]
- Email: [your email]
