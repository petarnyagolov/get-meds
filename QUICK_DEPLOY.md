# 🚀 Quick Deploy Guide

Бърза инструкция за пускане на GetMeds в production.

## Преглед

GetMeds използва Cloudflare Worker за CORS proxy. Това е **задължително** за SOpharmacy и VMClub интеграциите.

## Стъпки за Deploy

### 1️⃣ Setup Cloudflare Worker

```bash
# Инсталирай Wrangler CLI (еднократно)
npm install -g wrangler

# Влез в Cloudflare акаунт
wrangler login

# Deploy worker-а
cd cloudflare-worker
wrangler deploy
```

**Резултат:** Ще получиш Worker URL като:
```
https://get-meds-cors-proxy.YOUR-SUBDOMAIN.workers.dev
```

### 2️⃣ Конфигурирай Frontend

Редактирай `app.js`:

```javascript
const CONFIG = {
    CORS_PROXY: 'https://get-meds-cors-proxy.YOUR-SUBDOMAIN.workers.dev',
    USE_CORS_PROXY: true, // ВАЖНО: Задај true!
    // ...
};
```

### 3️⃣ Test Локално

```bash
# Отвори index.html в браузър
# ИЛИ използвай local server:

# С Python
python -m http.server 8000

# С Node.js
npx http-server
```

Отвори: `http://localhost:8000`

### 4️⃣ Deploy на GitHub Pages

```bash
git add .
git commit -m "Enable CORS proxy for production"
git push origin main
```

След това:
1. GitHub → Settings → Pages
2. Source: Branch `main`, folder `/` (root)
3. Save

Сайтът ще е на: `https://YOUR-USERNAME.github.io/get-meds/`

## ✅ Проверка

### Test Worker
```bash
# SOpharmacy test
curl "https://get-meds-cors-proxy.petyrnyagolov.workers.dev?pharmacy=sopharmacy&url=https%3A%2F%2Fsopharmacy.bg"

# VMClub test
curl "https://get-meds-cors-proxy.petyrnyagolov.workers.dev?pharmacy=vmclub&q=аспирин"
```

### Test Frontend
1. Отвори сайта
2. Търси "парацетамол"
3. Трябва да видиш резултати от SOpharmacy и VMClub

## 🔧 Troubleshooting

### Проблем: CORS error
**Решение:**
- Провери че `USE_CORS_PROXY: true`
- Провери Worker URL-а
- Тествай Worker-а директно с curl

### Проблем: Worker не работи
**Решение:**
```bash
# Виж logs
wrangler tail

# Redeploy
wrangler deploy
```

### Проблем: Празни резултати
**Решение:**
- Проверѝ browser console за грешки
- Провери че Worker-ът е deployed
- Тествай Worker-а с curl

## 📊 Worker Limits

**Free Tier:**
- 100,000 requests/ден
- 10ms CPU time per request
- Повече от достатъчно за лично използване

**Paid Tier ($5/месец):**
- 10,000,000 requests/месец
- За production сайт с повече трафик

## 🔐 Security Notes

1. **Worker whitelist** - Само разрешени домейни (sopharmacy.bg, vmclub.bg, etc.)
2. **No API keys needed** - Използва публични endpoints
3. **Rate limiting** - Cloudflare автоматично защитава от abuse

## 📚 Допълнителна Документация

- [Cloudflare Worker README](cloudflare-worker/README.md) - Пълни deployment инструкции
- [Worker API Usage](cloudflare-worker/API_USAGE.md) - API референция
- [SOpharmacy Integration](docs/SOPHARMACY_INTEGRATION.md) - SOpharmacy детайли
- [VMClub Integration](docs/VMCLUB_INTEGRATION.md) - VMClub детайли

## ⚡ Quick Commands Cheat Sheet

```bash
# Worker Deploy
cd cloudflare-worker && wrangler deploy

# Worker Logs
wrangler tail

# Worker Local Test
wrangler dev

# Git Push
git add . && git commit -m "Update" && git push

# Local Server (Python)
python -m http.server 8000

# Local Server (Node)
npx http-server
```

## 🎯 Production Checklist

- [ ] Cloudflare Worker deployed
- [ ] Worker URL конфигуриран в `app.js`
- [ ] `USE_CORS_PROXY: true` в `app.js`
- [ ] Tested локално
- [ ] Git push to main branch
- [ ] GitHub Pages enabled
- [ ] Tested production URL
- [ ] Worker logs проверени (no errors)

## 🆘 Support

Ако имаш проблеми:

1. **Провери документацията** в `docs/` папка
2. **Worker logs**: `wrangler tail`
3. **Browser console**: F12 → Console tab
4. **Test Worker**: Използвай curl команди от секция "Проверка"
5. **GitHub Issues**: Създай issue в repository-то

---

**Успех! 🎉** След тези стъпки GetMeds ще работи с реални данни от SOpharmacy и VMClub!
