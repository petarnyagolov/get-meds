# API Integration Guide

Този документ описва как да интегрираш GetMeds с аптечни APIs.

## Съдържание

1. [Overview](#overview)
2. [API Architecture](#api-architecture)
3. [Добавяне на нова аптека](#добавяне-на-нова-аптека)
4. [Популярни аптечни вериги в България](#популярни-аптечни-вериги-в-българия)
5. [Testing](#testing)
6. [Best Practices](#best-practices)

## Overview

GetMeds използва client-side fetch requests за получаване на данни от аптечни платформи. Заради CORS ограничения, всички заявки минават през Cloudflare Worker proxy.

### Архитектура на заявките

```
Browser App → Cloudflare Worker (CORS Proxy) → Pharmacy API
           ←                                  ←
```

## API Architecture

### Конфигурация

Аптечните APIs се конфигурират в `app.js`:

```javascript
const CONFIG = {
    CORS_PROXY: 'https://your-worker.your-subdomain.workers.dev',
    PHARMACIES: [
        {
            name: 'Име на аптеката',
            endpoint: 'https://apteka.bg/api/search',
            enabled: true,
            searchParam: 'q', // query parameter name
            method: 'GET',    // HTTP method
            headers: {}       // optional custom headers
        }
    ]
};
```

### Data Flow

1. User въвежда search query
2. Frontend извиква `searchMedicines(query)`
3. За всяка enabled аптека се извиква `searchPharmacy(pharmacy, query)`
4. Request минава през CORS proxy
5. Response се parse-ва в стандартен формат
6. Резултатите се показват в UI

## Добавяне на нова аптека

### Стъпка 1: Проучване на API

Преди да започнеш, трябва да проучиш API-то на аптеката:

1. **Намери документация**
   - Провери дали аптеката има публично API
   - Провери дали е нужна authentication
   - Провери rate limits

2. **Анализирай network requests**
   - Отвори аптечния сайт
   - Отвори Developer Tools (F12)
   - Премини на Network tab
   - Направи search за лекарство
   - Анализирай XHR/Fetch requests

3. **Документирай response format**
   - Запиши примерен response
   - Намери полетата за име, цена, наличност, аптека и т.н.

### Стъпка 2: Добави конфигурация

В `app.js`, добави новата аптека в `CONFIG.PHARMACIES`:

```javascript
PHARMACIES: [
    // ... existing pharmacies
    {
        name: 'Нова аптека',
        endpoint: 'https://nova-apteka.bg/api/products/search',
        enabled: true,
        searchParam: 'q',
        method: 'GET',
        requiresAuth: false
    }
]
```

### Стъпка 3: Имплементирай parsing логика

В `parsePharmacyResponse()` function, добави case за новата аптека:

```javascript
function parsePharmacyResponse(pharmacyName, data) {
    if (pharmacyName === 'Нова аптека') {
        // Parse the specific response format
        return data.results.map(item => ({
            medicine: {
                name: item.product_name,
                manufacturer: item.manufacturer,
                packaging: item.package_info,
                prescription: item.requires_prescription
            },
            pharmacy: {
                name: pharmacyName,
                address: item.store.address,
                phone: item.store.phone,
                workingHours: item.store.working_hours
            },
            inStock: item.in_stock,
            quantity: item.quantity,
            price: item.price.toFixed(2),
            availability: item.quantity > 20 ? 'available' : 
                         item.quantity > 0 ? 'limited' : 'unavailable'
        }));
    }
    
    // ... other pharmacies
    
    return [];
}
```

### Стъпка 4: Update Cloudflare Worker whitelist

В `cloudflare-worker/worker.js`, добави domain-а в whitelist:

```javascript
const allowedDomains = [
    'sopharmacy.bg',
    'remedium.bg',
    'nova-apteka.bg', // нов domain
    // ...
];
```

После redeploy worker-а:
```bash
cd cloudflare-worker
wrangler deploy
```

### Стъпка 5: Testing

Тествай новата интеграция:

1. Отвори app-а в browser
2. Търси известно лекарство
3. Провери browser console за грешки
4. Провери дали резултатите се показват правилно

## Популярни аптечни вериги в България

### Sopharmacy

- **Website**: https://sopharmacy.bg
- **Има ли API?**: Да проверим
- **Забележки**: Една от най-големите вериги

**Примерна интеграция** (базирана на network analysis):

```javascript
{
    name: 'Sopharmacy',
    endpoint: 'https://sopharmacy.bg/search',
    searchParam: 'q',
    method: 'GET',
    enabled: true
}
```

### Remedium

- **Website**: https://remedium.bg
- **Има ли API?**: Да проверим
- **Забележки**: Популярна верига с много локации

### Аптека Субра

- **Website**: https://subra.bg
- **Има ли API?**: Да проверим
- **Забележки**: Традиционна аптечна верига

### Аптеки.БГ

- **Website**: https://apteki.bg
- **Има ли API?**: Да проверим
- **Забележки**: Агрегатор на аптеки

## API Response Examples

### Пример 1: JSON API

```json
{
  "status": "success",
  "results": [
    {
      "id": 12345,
      "name": "Парацетамол 500мг",
      "manufacturer": "Sopharma",
      "price": 4.50,
      "in_stock": true,
      "quantity": 25,
      "pharmacy": {
        "name": "Аптека Център",
        "address": "ул. Витоша 15, София",
        "phone": "02 123 4567"
      }
    }
  ]
}
```

Parsing:
```javascript
return data.results.map(item => ({
    medicine: {
        name: item.name,
        manufacturer: item.manufacturer,
        // ...
    },
    // ...
}));
```

### Пример 2: HTML Scraping

Ако аптеката няма JSON API, може да scrape-неш HTML:

```javascript
async function scrapePharmacyHTML(html, pharmacyName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const results = [];
    const items = doc.querySelectorAll('.product-item');
    
    items.forEach(item => {
        results.push({
            medicine: {
                name: item.querySelector('.product-name').textContent,
                // ...
            },
            // ...
        });
    });
    
    return results;
}
```

## Testing

### Unit Testing

Тествай parsing функциите с примерни данни:

```javascript
// Test data
const mockResponse = {
    results: [
        {
            product_name: "Тест лекарство",
            price: 10.50,
            // ...
        }
    ]
};

// Test parsing
const parsed = parsePharmacyResponse('Тест аптека', mockResponse);
console.log(parsed);
```

### Integration Testing

1. **Провери CORS proxy**:
```bash
curl "https://your-worker.workers.dev?url=https://apteka.bg"
```

2. **Провери response format**:
```javascript
fetch('https://your-worker.workers.dev?url=https://apteka.bg/api/search?q=парацетамол')
    .then(r => r.json())
    .then(data => console.log(data));
```

3. **Провери edge cases**:
   - Празни резултати
   - Специални символи в query
   - Много резултати
   - Timeout-и

## Best Practices

### 1. Error Handling

Винаги handle-вай грешки gracefully:

```javascript
async function searchPharmacy(pharmacy, query) {
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return parsePharmacyResponse(pharmacy.name, data);
        
    } catch (error) {
        console.error(`Error searching ${pharmacy.name}:`, error);
        return []; // Return empty array instead of crashing
    }
}
```

### 2. Rate Limiting

Respect API rate limits:

```javascript
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        await new Promise(resolve => 
            setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
        );
    }
    
    lastRequestTime = Date.now();
    return fetch(url);
}
```

### 3. Caching

Cache резултати за да намалиш броя на заявките:

```javascript
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}
```

### 4. Data Validation

Винаги validate-вай данните от API:

```javascript
function validateMedicine(medicine) {
    return medicine &&
           typeof medicine.name === 'string' &&
           medicine.name.length > 0 &&
           typeof medicine.price === 'number' &&
           medicine.price >= 0;
}
```

### 5. Privacy

Не съхранявай sensitive данни:
- Не логвай user search queries
- Не track-вай user behavior без consent
- Follow GDPR guidelines

## Troubleshooting

### CORS грешки

**Проблем**: `Access-Control-Allow-Origin` грешка

**Решение**:
1. Провери дали Cloudflare Worker работи
2. Провери дали domain-ът е в whitelist
3. Провери дали използваш правилния proxy URL

### Parsing грешки

**Проблем**: Резултатите не се показват правилно

**Решение**:
1. Console.log-ни raw response data
2. Провери дали полетата съществуват
3. Handle missing/null values

### Timeout грешки

**Проблем**: Requests timeout-ват

**Решение**:
1. Увеличи timeout в fetch options
2. Добави retry logic
3. Показвай loading indicator

## Contributing

Ако добавиш нова аптека:

1. Документирай API endpoint-а
2. Добави примерен response
3. Тествай интеграцията
4. Update-ни този документ
5. Отвори Pull Request

## Resources

- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## Support

За въпроси относно API интеграция:
- Отвори GitHub Issue
- Използвай "API Integration" label
- Включи примерен response от API-то
