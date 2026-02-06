# SOpharmacy Integration Documentation

## Статус
✅ **Fully Implemented** - Реалната интеграция със SOpharmacy е пълно функционална!

## Описание

SOpharmacy интеграцията работи в два етапа:
1. Търсене на продукти по име
2. Извличане на информация за наличност в аптеките

## Как работи

### Етап 1: Търсене на продукти

**Endpoint:**
```
GET https://sopharmacy.bg/bg/sophSearch/?text={query}
```

**Тип:** HTML response

**Какво правим:**
- Заявката връща HTML страница с резултати от търсенето
- Използваме `DOMParser` за parse-ване на HTML-a
- Търсим всички елементи с клас `.products-item`
- От всеки елемент извличаме:
  - Product ID от href атрибута (напр. `/bg/product/000000000010001118`)
  - Име на продукта
  - Изображение (ако има)
  - Цена (ако е достъпна)

**Пример HTML структура:**
```html
<div class="products-item">
    <a href="/bg/product/000000000010001118">
        <img src="/images/products/driptan.jpg" alt="Дриптан">
        <div class="products-item__name">Дриптан 5 мг</div>
        <div class="products-item__price">12.50 лв</div>
    </a>
</div>
```

**Код за извличане:**
```javascript
function extractSopharmacyProductIds(html) {
    const products = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const productItems = doc.querySelectorAll('.products-item');
    
    productItems.forEach(item => {
        const link = item.querySelector('a[href*="/bg/product/"]');
        if (link) {
            const href = link.getAttribute('href');
            const match = href.match(/\/bg\/product\/(\d+)/);
            if (match) {
                const productId = match[1];
                
                // Extract product name
                const nameElement = item.querySelector('.products-item__name, .product-name, h3, h4');
                const name = nameElement ? nameElement.textContent.trim() : 'Неизвестен продукт';
                
                // Extract image
                const imgElement = item.querySelector('img');
                const imageUrl = imgElement ? imgElement.getAttribute('src') : null;
                
                // Extract price
                const priceElement = item.querySelector('.price, .products-item__price');
                const priceText = priceElement ? priceElement.textContent.trim() : null;
                const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
                
                products.push({
                    id: productId,
                    name: name,
                    imageUrl: imageUrl,
                    price: price,
                    link: `https://sopharmacy.bg${href}`
                });
            }
        }
    });
    
    return products;
}
```

### Етап 2: Извличане на наличност

**Endpoint:**
```
GET https://sopharmacy.bg/bg/mapbox/{productId}/pdpProductAvailability.json
```

**Тип:** JSON response

**JSON структура:**
```json
{
    "contact-map": {
        "features": [
            {
                "id": "4012",
                "geometry": {
                    "type": "Point",
                    "coordinates": ["24.7286", "42.12465"]
                },
                "properties": {
                    "name": "Слънчеви лъчи Пловдив",
                    "city": "Пловдив",
                    "address": "ж.к. Христо Ботев - Юг ул. Георги Икономов 2",
                    "worktime": [
                        "Понеделник - Петък 08:00 - 21:00",
                        "Събота 09:00 - 20:00",
                        "Неделя 09:00 - 20:00"
                    ],
                    "contacts": {
                        "email": "SOpharmacy Call Center:",
                        "phone": "0882740013"
                    },
                    "summary": "<p>- НЗОК</p> <p>- Жълти и зелени рецепти</p>",
                    "icon": "sopharmacy-success",
                    "status": {
                        "type": "success",
                        "text": "Наличен"
                    }
                }
            }
        ]
    }
}
```

**Статус типове:**
- `success` - Продуктът е наличен
- `warning` - Ограничена наличност
- `error` или друг тип - Няма наличност

**Обработка на данните:**
```javascript
async function getSopharmacyAvailability(productInfo) {
    const availabilityUrl = `https://sopharmacy.bg/bg/mapbox/${productInfo.id}/pdpProductAvailability.json`;
    
    const response = await fetch(availabilityUrl);
    const data = await response.json();
    
    const features = data['contact-map']?.features || [];
    
    const results = features.map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        
        return {
            medicine: {
                name: productInfo.name,
                manufacturer: 'SOpharmacy',
                imageUrl: productInfo.imageUrl,
                productLink: productInfo.link
            },
            pharmacy: {
                name: props.name,
                address: `${props.address}, ${props.city}`,
                phone: props.contacts?.phone || '',
                workingHours: props.worktime ? props.worktime.join(', ') : 'Няма информация',
                coordinates: coords,
                city: props.city
            },
            inStock: props.status?.type === 'success',
            quantity: props.status?.type === 'success' ? 10 : props.status?.type === 'warning' ? 3 : 0,
            price: productInfo.price ? productInfo.price.toFixed(2) : 'Няма цена',
            availability: props.status?.type === 'success' ? 'available' : 
                         props.status?.type === 'warning' ? 'limited' : 'unavailable',
            statusText: props.status?.text || 'Неизвестен статус'
        };
    });
    
    return results;
}
```

## Предимства на интеграцията

✅ **Без нужда от API ключове** - Използваме публичните endpoints на SOpharmacy  
✅ **Реални данни** - Директно от системата на SOpharmacy  
✅ **Актуална наличност** - Информация за всички аптеки в мрежата  
✅ **Географски данни** - Координати за всяка аптека (може да се използва за карта)  
✅ **Работно време** - Пълна информация за работното време на всяка аптека  
✅ **Статус на наличност** - Три нива: Налично, Ограничено, Няма наличност  

## Ограничения

⚠️ **CORS** - SOpharmacy не поддържа CORS headers изисква се Cloudflare Worker proxy в production  
⚠️ **Rate Limiting** - Трябва да се внимава за ограничения на заявките  
⚠️ **HTML Parsing** - Зависимост от HTML структурата (може да се промени)  
⚠️ **Performance** - Две заявки за всеки продукт (търсене + наличност)  

### CORS Решение

Cloudflare Worker е вече конфигуриран да обработва SOpharmacy:

1. **Deploy Worker** (виж [cloudflare-worker/README.md](../cloudflare-worker/README.md))
2. **Конфигурирай в app.js:**
   ```javascript
   const CONFIG = {
       CORS_PROXY: 'https://your-worker.workers.dev',
       USE_CORS_PROXY: true // Задай true в production
   };
   ```

3. **Worker автоматично:**
   - Добавя правилни User-Agent и headers
   - Задава Referer към sopharmacy.bg
   - Връща response с CORS headers
   - Поддържа HTML и JSON content types

**API формат:**
```
GET https://your-worker.workers.dev?pharmacy=sopharmacy&url={encoded_url}
```

**Пример:**
```javascript
const searchUrl = 'https://sopharmacy.bg/bg/sophSearch/?text=дриптан';
const workerUrl = `${CONFIG.CORS_PROXY}?pharmacy=sopharmacy&url=${encodeURIComponent(searchUrl)}`;
const response = await fetch(workerUrl);
```  

## Конфигурация

В `app.js`:
```javascript
const CONFIG = {
    CORS_PROXY: 'https://your-worker.your-subdomain.workers.dev',
    USE_CORS_PROXY: false, // Set to true in production
    PHARMACIES: [
        {
            name: 'Sopharmacy',
            searchEndpoint: 'https://sopharmacy.bg/bg/sophSearch/',
            availabilityEndpoint: 'https://sopharmacy.bg/bg/mapbox',
            enabled: true
        }
    ]
};
```

## Използване

### Директно от браузъра (Development)
```javascript
// Търсене на продукт
const results = await searchSopharmacy('дриптан');
console.log(results);
```

### През CORS Proxy (Production)
Ако има CORS проблеми в production:
1. Deploy Cloudflare Worker (виж `cloudflare-worker/README.md`)
2. Настрой `USE_CORS_PROXY: true` в конфигурацията
3. Задай правилния `CORS_PROXY` URL

## Примерен работен flow

1. User въвежда "дриптан" в search box
2. Приложението прави заявка към `https://sopharmacy.bg/bg/sophSearch/?text=дриптан`
3. Извличат се Product IDs от HTML-a (напр. `000000000010001118`)
4. За всеки продукт се прави заявка към availability endpoint
5. Резултатите се обединяват и показват на потребителя
6. Всяка аптека се показва като отделна карта с:
   - Име на продукта и изображение
   - Статус на наличността
   - Цена (ако е налична)
   - Адрес, телефон и работно време на аптеката
   - Линк към продукта в SOpharmacy

## Тестване

### Manual Test
1. Отвори `index.html` в браузъра
2. Въведи име на лекарство (напр. "парацетамол", "дриптан")
3. Кликни "Търси"
4. Провери дали се показват резултати от SOpharmacy

### Console Test
```javascript
// В Browser Console
searchSopharmacy('дриптан').then(console.log);
```

## Бъдещи подобрения

- 🔄 **Caching** - Кеширане на резултатите за по-бързо зареждане
- 🗺️ **Карта** - Интеграция с Google Maps/OpenStreetMap за визуализация
- 🔍 **Филтриране** - Филтър по град, наличност, цена
- 📍 **Геолокация** - Сортиране по близост до потребителя
- ⭐ **Favorites** - Запазване на любими аптеки
- 🔔 **Известия** - Уведомяване при появяване на наличност

## Поддръжка

Ако SOpharmacy промени структурата на HTML-a:
1. Отвори Developer Tools на `sopharmacy.bg`
2. Провери новата HTML структура в Network tab
3. Обнови селекторите в `extractSopharmacyProductIds()`
4. Тествай промените

## Контакти

За въпроси относно интеграцията:
- GitHub Issues: [repository URL]
- Email: [your email]
