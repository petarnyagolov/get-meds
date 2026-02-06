# Инструкции за настройка на GetMeds

Този документ съдържа детайлни инструкции за настройка на GetMeds приложението.

## Съдържание

1. [Локално развитие](#локално-развитие)
2. [Cloudflare Worker Setup](#cloudflare-worker-setup)
3. [GitHub Pages Deployment](#github-pages-deployment)
4. [Конфигурация на API](#конфигурация-на-api)

## Локално развитие

### Предпоставки

За локално развитие ти трябва само web browser. Не са нужни build tools или dependencies, тъй като приложението използва vanilla JavaScript.

### Стъпки

1. **Клонирай repository-то**:
```bash
git clone https://github.com/petarnyagolov/get-meds.git
cd get-meds
```

2. **Отвори в browser**:

Опция А - Директно отваряне:
- Отвори `index.html` файла директно в браузъра

Опция Б - Локален HTTP server (препоръчително):
```bash
# С Python 3
python -m http.server 8000

# С Python 2
python -m SimpleHTTPServer 8000

# С Node.js http-server
npx http-server -p 8000

# С PHP
php -S localhost:8000
```

3. **Отвори в browser**: `http://localhost:8000`

### Разработка

Файловете които ще редактираш най-често:

- `index.html` - HTML структура
- `styles.css` - Стилове и дизайн
- `app.js` - JavaScript логика
- `cloudflare-worker/worker.js` - CORS proxy логика

При промени в кода, просто refresh-ни браузъра.

## Cloudflare Worker Setup

Cloudflare Worker се използва като CORS proxy за достъп до аптечни APIs, които не поддържат CORS.

### Стъпка 1: Създай Cloudflare акаунт

1. Отиди на [cloudflare.com](https://cloudflare.com)
2. Регистрирай се за безплатен акаунт
3. Потвърди email адреса си

### Стъпка 2: Инсталирай Wrangler CLI

Wrangler е официалният CLI tool за Cloudflare Workers.

```bash
npm install -g wrangler
```

Или с yarn:
```bash
yarn global add wrangler
```

### Стъпка 3: Login в Cloudflare

```bash
wrangler login
```

Това ще отвори браузър и ще те поиска да authorized-ваш Wrangler.

### Стъпка 4: Конфигурирай Worker-а

1. Отвори `cloudflare-worker/wrangler.toml`
2. Обнови името на worker-а (optional):
```toml
name = "get-meds-cors-proxy"
```

### Стъпка 5: Deploy Worker-а

```bash
cd cloudflare-worker
wrangler deploy
```

Успешният deploy ще изведе URL на worker-а:
```
Published get-meds-cors-proxy (0.01 sec)
  https://get-meds-cors-proxy.your-subdomain.workers.dev
```

### Стъпка 6: Обнови Frontend конфигурацията

Копирай worker URL-а и го сложи в `app.js`:

```javascript
const CONFIG = {
    CORS_PROXY: 'https://get-meds-cors-proxy.your-subdomain.workers.dev',
    // ...
};
```

### Testing Worker-а

Тествай worker-а директно:
```bash
curl "https://get-meds-cors-proxy.your-subdomain.workers.dev?url=https://example.com"
```

### Worker Limits (Free Plan)

- 100,000 requests/day
- 10ms CPU time per request
- 128MB memory

Това е повече от достатъчно за personal use или малки проекти.

## GitHub Pages Deployment

GitHub Pages предоставя безплатен hosting за статични сайтове.

### Стъпка 1: Enable GitHub Pages

1. Отиди в repository Settings
2. Scroll down до "Pages" секцията
3. Под "Source", избери:
   - Branch: `main`
   - Folder: `/ (root)`
4. Натисни "Save"

### Стъпка 2: Изчакай deploy-а

GitHub автоматично ще deploy-не сайта. Това отнема 1-2 минути.

### Стъпка 3: Провери сайта

Сайтът ще бъде на: `https://petarnyagolov.github.io/get-meds/`

### Стъпка 4: Custom Domain (Optional)

Ако имаш custom domain:

1. В repository Settings > Pages
2. Въведи custom domain (напр. `getmeds.yourdomain.com`)
3. Добави CNAME запис в DNS настройките:
   ```
   CNAME getmeds yourusername.github.io
   ```

### Auto-deployment

Всеки commit към `main` branch автоматично тrigger-ва deploy. Не е нужна допълнителна конфигурация.

## Конфигурация на API

### Добавяне на нова аптека

1. Отвори `app.js`
2. Добави нов API endpoint в `CONFIG.PHARMACIES`:

```javascript
PHARMACIES: [
    {
        name: 'Име на аптеката',
        endpoint: 'https://apteka.bg/api/search',
        enabled: true // Задай на true за да активираш
    }
]
```

3. Имплементирай парсинг функция за specific API response format в `parsePharmacyResponse()`:

```javascript
function parsePharmacyResponse(pharmacyName, data) {
    if (pharmacyName === 'Име на аптеката') {
        // Parse the specific response format
        return data.products.map(product => ({
            medicine: {
                name: product.name,
                manufacturer: product.manufacturer,
                packaging: product.packaging,
                prescription: product.prescription
            },
            pharmacy: {
                name: pharmacyName,
                address: product.pharmacy.address,
                phone: product.pharmacy.phone,
                workingHours: product.pharmacy.hours
            },
            inStock: product.stock > 0,
            quantity: product.stock,
            price: product.price,
            availability: product.stock > 20 ? 'available' : 
                         product.stock > 0 ? 'limited' : 'unavailable'
        }));
    }
    // ...
}
```

Вижте [API_INTEGRATION.md](API_INTEGRATION.md) за повече детайли.

## Troubleshooting

### Worker не работи

1. Провери дали worker-ът е deployed:
   ```bash
   wrangler deployments list
   ```

2. Провери logs:
   ```bash
   wrangler tail
   ```

3. Провери дали URL-ът в `app.js` е правилен

### GitHub Pages не работи

1. Провери дали Pages е enabled в Settings
2. Изчакай 5-10 минути след първия deploy
3. Провери дали branch и folder са правилно избрани
4. Clear browser cache и опитай отново

### CORS грешки

1. Провери дали Cloudflare Worker-ът работи
2. Провери дали target domain-ът е в whitelist-а в `worker.js`
3. Провери browser console за конкретни error съобщения

## Поддръжка

- За въпроси отвори GitHub Issue
- За bug reports използвай Issue template
- За feature requests създай Discussion

## Следващи стъпки

След успешна настройка:

1. Прочети [API_INTEGRATION.md](API_INTEGRATION.md) за API интеграция
2. Тествай приложението с demo данни
3. Добави първа реална аптечна интеграция
4. Споделете проекта! 🎉
