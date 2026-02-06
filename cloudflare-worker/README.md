# GetMeds Cloudflare Worker Deployment

Инструкции за deploy на Cloudflare Worker за CORS proxy.

## Предпоставки

1. Cloudflare акаунт (безплатен план е достатъчен)
2. Node.js и npm инсталирани

## Deployment Стъпки

### Защо Wrangler CLI?

**Wrangler** е официалният Cloudflare CLI инструмент за deploy на Workers.

**Плюсове:**
- ✅ Официален инструмент от Cloudflare
- ✅ Автоматизиран deploy процес (една команда)
- ✅ Локално тестване с `wrangler dev`
- ✅ Real-time logs с `wrangler tail`
- ✅ Управление на версии и rollback

**Минуси:**
- ❌ Изисква Node.js и npm инсталация
- ❌ Допълнителна dependency в development environment

**Алтернативи без Wrangler:**
1. **Cloudflare Dashboard** - Ръчно copy/paste на кода в web интерфейса
   - Плюсове: Не изисква инсталация
   - Минуси: Ръчен процес, трудно за поддръжка
2. **Cloudflare API** - Директни HTTP заявки
   - Плюсове: Скриптуеми deployments
   - Минуси: По-сложно, изисква API token management

**Препоръка:** Използвай Wrangler за production. За бързо тестване можеш да copy/paste кода в Cloudflare Dashboard (Settings → Workers → Quick Edit), но за дългосрочна поддръжка Wrangler е по-добрият избор.

### 1. Инсталирай Wrangler

```bash
npm install -g wrangler
```

### 2. Login в Cloudflare

```bash
wrangler login
```

### 3. Deploy Worker

От този директорий:

```bash
wrangler deploy
```

### 4. Получи Worker URL

След успешен deploy, ще видиш URL като:
```
https://get-meds-cors-proxy.your-subdomain.workers.dev
```

### 5. Update Frontend Config

Копирай URL-а и го сложи в `../app.js`:

```javascript
const CONFIG = {
    CORS_PROXY: 'https://get-meds-cors-proxy.your-subdomain.workers.dev',
    // ...
};
```

## Testing

Тествай worker-а:

### SOpharmacy Test
```bash
curl "https://your-worker.workers.dev?pharmacy=sopharmacy&url=https%3A%2F%2Fsopharmacy.bg%2Fbg%2FsophSearch%2F%3Ftext%3Dаспирин"
```

### VMClub Test
```bash
curl "https://your-worker.workers.dev?pharmacy=vmclub&q=аспирин"
```

### Generic Proxy Test
```bash
curl "https://your-worker.workers.dev?url=https%3A%2F%2Fsopharmacy.bg"
```

## API Usage

Worker-ът поддържа три начина на работа:

### 1. SOpharmacy Handler
```
?pharmacy=sopharmacy&url={encoded_url}
```
- Проксира заявки към sopharmacy.bg
- Добавя правилни browser headers
- Връща HTML или JSON

### 2. VMClub Handler
```
?pharmacy=vmclub&q={search_query}
```
- Автоматично взима CSRF token
- Създава валидна сесия
- Прави POST заявка с правилни headers

### 3. Generic Proxy
```
?url={encoded_url}
```
- Универсален proxy за whitelist домейни
- Проста GET заявка с CORS headers

**Детайлна документация:** Виж [API_USAGE.md](API_USAGE.md)

## Configuration

### Добавяне на нов allowed domain

Редактирай `worker.js` и добави domain в `allowedDomains` array в `handleGenericProxy` функцията:

```javascript
const allowedDomains = [
    'sopharmacy.bg',
    'remedium.bg',
    'vmclub.bg',
    'your-new-domain.bg'  // добави тук
];
```

После redeploy:
```bash
wrangler deploy
```

## Monitoring

View logs в real-time:
```bash
wrangler tail
```

## Troubleshooting

### Worker не работи

1. Провери deployments:
```bash
wrangler deployments list
```

2. Виж logs:
```bash
wrangler tail
```

3. Test локално:
```bash
wrangler dev
```

### Rate Limits

Безплатният план има:
- 100,000 requests/ден
- 10ms CPU time per request

За повече, upgrade-ни на платен план.

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
