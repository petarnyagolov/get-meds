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

```bash
curl "https://get-meds-cors-proxy.your-subdomain.workers.dev?url=https://example.com"
```

## Configuration

### Добавяне на нов allowed domain

Редактирай `worker.js` и добави domain в `allowedDomains` array:

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
