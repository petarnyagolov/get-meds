// Configuration
const CONFIG = {
    // Cloudflare Worker URL for CORS proxy (to be set up)
    CORS_PROXY: 'https://get-meds-cors-proxy.petyrnyagolov.workers.dev',
    
    // Set to true to use CORS proxy, false for development (may have CORS issues)
    USE_CORS_PROXY: true,
    
    // Pharmacy API endpoints
    PHARMACIES: [
        {
            name: 'Sopharmacy',
            searchEndpoint: 'https://sopharmacy.bg/bg/sophSearch/',
            availabilityEndpoint: 'https://sopharmacy.bg/bg/mapbox',
            enabled: true // SOpharmacy is now fully integrated
        },
        {
            name: 'VMClub',
            endpoint: 'https://sofia.vmclub.bg/products/fast-search',
            enabled: true // VMClub integration with CSRF handling
        },
        {
            name: 'Remedium',
            endpoint: 'https://remedium.bg/api/search',
            enabled: false
        }
    ]
};

// DOM Elements
const medicineSearchInput = document.getElementById('medicineSearch');
const searchButton = document.getElementById('searchButton');
const loadingElement = document.getElementById('loading');
const errorElement = document.getElementById('error');
const resultsElement = document.getElementById('results');
const suggestionsElement = document.getElementById('suggestions');

// State
let searchTimeout = null;

// Event Listeners
medicineSearchInput.addEventListener('input', handleSearchInput);
medicineSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});
searchButton.addEventListener('click', performSearch);

// Handle search input with debouncing
function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
        hideSuggestions();
        return;
    }
    
    searchTimeout = setTimeout(() => {
        // Could show suggestions here if we had a suggestion API
        // For now, we'll just wait for the user to click search
    }, 300);
}

// Perform the main search
async function performSearch() {
    const query = medicineSearchInput.value.trim();
    
    if (query.length < 2) {
        showError('Моля, въведете поне 2 символа');
        return;
    }
    
    hideError();
    hideResults();
    hideSuggestions();
    showLoading();
    
    try {
        const results = await searchMedicines(query);
        hideLoading();
        displayResults(results, query);
    } catch (error) {
        hideLoading();
        showError('Грешка при търсенето: ' + error.message);
        console.error('Search error:', error);
    }
}

// Search medicines across pharmacies
async function searchMedicines(query) {
    // For demo purposes, we'll create mock data
    // In production, this would call real pharmacy APIs through the CORS proxy
    
    const enabledPharmacies = CONFIG.PHARMACIES.filter(p => p.enabled);
    
    if (enabledPharmacies.length === 0) {
        // Return demo data if no real APIs are configured
        return generateDemoData(query);
    }
    
    // Search all enabled pharmacies in parallel
    const searchPromises = enabledPharmacies.map(pharmacy => 
        searchPharmacy(pharmacy, query)
    );
    
    const results = await Promise.allSettled(searchPromises);
    
    // Combine successful results
    const allResults = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            allResults.push(...result.value);
        } else {
            console.error(`Error searching ${enabledPharmacies[index].name}:`, result.reason);
        }
    });
    
    return allResults;
}

// Search a specific pharmacy
async function searchPharmacy(pharmacy, query) {
    if (pharmacy.name === 'Sopharmacy') {
        return await searchSopharmacy(query);
    } else if (pharmacy.name === 'VMClub') {
        return await searchVMClub(query);
    }
    
    // For other pharmacies
    const url = CONFIG.USE_CORS_PROXY 
        ? `${CONFIG.CORS_PROXY}?url=${encodeURIComponent(pharmacy.endpoint)}&q=${encodeURIComponent(query)}`
        : pharmacy.endpoint;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the pharmacy-specific response format
    return parsePharmacyResponse(pharmacy.name, data);
}

// Search SOpharmacy specifically
async function searchSopharmacy(query) {
    try {
        // Step 1: Search for products
        const searchUrl = `https://sopharmacy.bg/bg/sophSearch/?text=${encodeURIComponent(query)}`;
        
        // Use CORS proxy if enabled
        const fetchUrl = CONFIG.USE_CORS_PROXY 
            ? `${CONFIG.CORS_PROXY}?pharmacy=sopharmacy&url=${encodeURIComponent(searchUrl)}`
            : searchUrl;
        
        const searchResponse = await fetch(fetchUrl);
        
        if (!searchResponse.ok) {
            throw new Error(`Search failed: ${searchResponse.status}`);
        }
        
        const html = await searchResponse.text();
        
        // Step 2: Extract product IDs from HTML
        const productIds = extractSopharmacyProductIds(html);
        
        if (productIds.length === 0) {
            return [];
        }
        
        // Step 3: Get availability for each product (limit to first 5 for performance)
        const availabilityPromises = productIds.slice(0, 5).map(productInfo => 
            getSopharmacyAvailability(productInfo)
        );
        
        const availabilityResults = await Promise.allSettled(availabilityPromises);
        
        // Step 4: Combine results
        const results = [];
        availabilityResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                results.push(...result.value);
            }
        });
        
        return results;
        
    } catch (error) {
        console.error('Sopharmacy search error:', error);
        throw error;
    }
}

// Extract product IDs from SOpharmacy HTML
function extractSopharmacyProductIds(html) {
    const products = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find all product items
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
                
                // Extract image if available (try multiple selectors)
                const imgElement = item.querySelector('img');
                let imageUrl = null;
                if (imgElement) {
                    const src = imgElement.getAttribute('src') || imgElement.getAttribute('data-src');
                    if (src) {
                        // Make sure URL is absolute
                        imageUrl = src.startsWith('http') ? src : `https://sopharmacy.bg${src}`;
                    }
                }
                
                // Extract price if available
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

// Extract product image from SOpharmacy product page
async function extractProductImage(productId) {
    try {
        const productUrl = `https://sopharmacy.bg/bg/product/${productId}`;
        
        // Use CORS proxy if enabled
        const fetchUrl = CONFIG.USE_CORS_PROXY 
            ? `${CONFIG.CORS_PROXY}?pharmacy=sopharmacy&url=${encodeURIComponent(productUrl)}`
            : productUrl;
        
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            return null;
        }
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Try to extract og:image meta tag
        const ogImageMeta = doc.querySelector('meta[property="og:image"]');
        if (ogImageMeta) {
            const imageUrl = ogImageMeta.getAttribute('content');
            if (imageUrl) {
                // Make sure URL is absolute
                return imageUrl.startsWith('http') ? imageUrl : `https://sopharmacy.bg${imageUrl}`;
            }
        }
        
        // Fallback: try to find product image in page
        const productImage = doc.querySelector('.product-image img, .product-detail__image img, .pdp-image img');
        if (productImage) {
            const src = productImage.getAttribute('src');
            return src ? (src.startsWith('http') ? src : `https://sopharmacy.bg${src}`) : null;
        }
        
        return null;
        
    } catch (error) {
        console.warn(`Failed to extract image for product ${productId}:`, error);
        return null;
    }
}

// Get availability for a specific SOpharmacy product
async function getSopharmacyAvailability(productInfo) {
    const availabilityUrl = `https://sopharmacy.bg/bg/mapbox/${productInfo.id}/pdpProductAvailability.json`;
    
    try {
        // Use CORS proxy if enabled
        const fetchUrl = CONFIG.USE_CORS_PROXY 
            ? `${CONFIG.CORS_PROXY}?pharmacy=sopharmacy&url=${encodeURIComponent(availabilityUrl)}`
            : availabilityUrl;
        
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            console.warn(`Availability fetch failed for product ${productInfo.id}`);
            return null;
        }
        
        const data = await response.json();
        
        // Parse the contact-map data
        const features = data['contact-map']?.features || [];
        
        if (features.length === 0) {
            return null;
        }
        
        // If no image from search, try to get og:image from product page
        let imageUrl = productInfo.imageUrl;
        if (!imageUrl) {
            imageUrl = await extractProductImage(productInfo.id);
        }
        
        // Convert to our standard format
        const results = features.map(feature => {
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            
            return {
                medicine: {
                    name: productInfo.name,
                    manufacturer: 'SOpharmacy',
                    packaging: '',
                    prescription: false,
                    imageUrl: imageUrl, // Use the enhanced image URL (og:image from product page if available)
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
        
        // Sort by availability (available first) and then by city
        results.sort((a, b) => {
            if (a.inStock !== b.inStock) return b.inStock - a.inStock;
            return a.pharmacy.city.localeCompare(b.pharmacy.city, 'bg');
        });
        
        return results;
        
    } catch (error) {
        console.error(`Error fetching availability for product ${productInfo.id}:`, error);
        return null;
    }
}

// Search VMClub specifically
async function searchVMClub(query) {
    try {
        // VMClub requires CORS proxy due to CSRF token requirement
        if (!CONFIG.USE_CORS_PROXY) {
            console.warn('VMClub requires CORS proxy to be enabled. Set USE_CORS_PROXY: true');
            return [];
        }

        const fetchUrl = `${CONFIG.CORS_PROXY}?pharmacy=vmclub&q=${encodeURIComponent(query)}`;
        
        const response = await fetch(fetchUrl);
        
        if (!response.ok) {
            throw new Error(`VMClub search failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Parse VMClub response
        return parseVMClubResponse(data, query);
        
    } catch (error) {
        console.error('VMClub search error:', error);
        throw error;
    }
}

// Parse VMClub response into standard format
function parseVMClubResponse(data, query) {
    const results = [];
    
    // VMClub returns HTML in data.html or array of products
    // Adjust based on actual response format
    if (!data || (!data.html && !data.products)) {
        return results;
    }
    
    // If data has HTML, parse it
    if (data.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.html, 'text/html');
        
        const productItems = doc.querySelectorAll('.product-item, .search-result-item, [data-product-id]');
        
        productItems.forEach(item => {
            const nameElement = item.querySelector('.product-name, h3, h4, .name');
            const priceElement = item.querySelector('.price, .product-price');
            const linkElement = item.querySelector('a[href*="/product/"], a[href*="/products/"]');
            const imgElement = item.querySelector('img');
            
            if (nameElement) {
                const name = nameElement.textContent.trim();
                const priceText = priceElement ? priceElement.textContent.trim() : null;
                const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : null;
                const link = linkElement ? linkElement.getAttribute('href') : null;
                const imageUrl = imgElement ? imgElement.getAttribute('src') : null;
                
                results.push({
                    medicine: {
                        name: name,
                        manufacturer: 'VMClub',
                        packaging: '',
                        prescription: false,
                        imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://sofia.vmclub.bg${imageUrl}`) : null,
                        productLink: link ? (link.startsWith('http') ? link : `https://sofia.vmclub.bg${link}`) : null
                    },
                    pharmacy: {
                        name: 'VMClub София',
                        address: 'Различни локации в София',
                        phone: '0700 20 888',
                        workingHours: 'Виж сайта за работно време',
                        city: 'София'
                    },
                    inStock: true,
                    quantity: 5,
                    price: price ? price.toFixed(2) : 'Няма цена',
                    availability: 'available',
                    statusText: 'Наличен в София'
                });
            }
        });
    }
    
    return results;
}

// Parse pharmacy response into standard format
function parsePharmacyResponse(pharmacyName, data) {
    // This would be customized for each pharmacy's API response format
    // For now, return empty array
    return [];
}

// Generate demo data for testing
function generateDemoData(query) {
    const medicines = [
        {
            name: 'Парацетамол 500мг',
            manufacturer: 'Sopharma',
            packaging: '20 таблетки',
            prescription: false
        },
        {
            name: 'Ибупрофен 400мг',
            manufacturer: 'Actavis',
            packaging: '30 таблетки',
            prescription: false
        },
        {
            name: 'Аспирин 100мг',
            manufacturer: 'Bayer',
            packaging: '28 таблетки',
            prescription: false
        }
    ];
    
    const pharmacies = [
        {
            name: 'Аптека Sopharmacy',
            address: 'бул. Витоша 15, София',
            phone: '02 123 4567',
            workingHours: 'Пон-Пет: 8:00-20:00, Съб: 9:00-18:00'
        },
        {
            name: 'Аптека Remedium',
            address: 'ул. Граф Игнатиев 32, София',
            phone: '02 234 5678',
            workingHours: 'Пон-Нед: 8:00-22:00'
        },
        {
            name: 'Аптека Субра',
            address: 'бул. Христо Ботев 48, София',
            phone: '02 345 6789',
            workingHours: 'Пон-Пет: 8:30-19:00'
        }
    ];
    
    const results = [];
    
    // Filter medicines that match the query
    const matchedMedicines = medicines.filter(med => 
        med.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // If no matches, use all medicines for demo
    const medicinesToShow = matchedMedicines.length > 0 ? matchedMedicines : medicines;
    
    // Generate results for each pharmacy
    medicinesToShow.forEach(medicine => {
        pharmacies.forEach(pharmacy => {
            const availability = Math.random();
            const inStock = availability > 0.3;
            const quantity = inStock ? Math.floor(Math.random() * 50) + 1 : 0;
            const price = (Math.random() * 15 + 5).toFixed(2);
            
            results.push({
                medicine: medicine,
                pharmacy: pharmacy,
                inStock: inStock,
                quantity: quantity,
                price: price,
                availability: quantity > 20 ? 'available' : quantity > 0 ? 'limited' : 'unavailable'
            });
        });
    });
    
    // Sort by availability and price
    results.sort((a, b) => {
        if (a.inStock !== b.inStock) return b.inStock - a.inStock;
        return parseFloat(a.price) - parseFloat(b.price);
    });
    
    return results;
}

// Display search results
function displayResults(results, query) {
    if (results.length === 0) {
        resultsElement.innerHTML = `
            <div class="no-results">
                <h3>Няма намерени резултати</h3>
                <p>Не са намерени лекарства за "${query}"</p>
                <p>Опитайте с друго търсене или проверете правописа.</p>
            </div>
        `;
        resultsElement.classList.remove('hidden');
        return;
    }
    
    const resultsHTML = results.map(result => createPharmacyCard(result)).join('');
    resultsElement.innerHTML = resultsHTML;
    resultsElement.classList.remove('hidden');
}

// Create a pharmacy card HTML
function createPharmacyCard(result) {
    const { medicine, pharmacy, inStock, quantity, price, availability, statusText } = result;
    
    const availabilityLabels = {
        available: 'Налично',
        limited: 'Ограничено количество',
        unavailable: 'Няма наличност'
    };
    
    const stockInfo = statusText || (inStock ? `${quantity} бр. на склад` : 'Няма наличност');
    
    // Product image if available
    const productImage = medicine.imageUrl ? 
        `<div class="product-image"><img src="${medicine.imageUrl}" alt="${medicine.name}" loading="lazy"></div>` : '';
    
    // Product link if available
    const productLinkHtml = medicine.productLink ? 
        `<a href="${medicine.productLink}" target="_blank" class="product-link" rel="noopener noreferrer">Виж в SOpharmacy ↗</a>` : '';
    
    return `
        <div class="pharmacy-card">
            <div class="pharmacy-header">
                <div class="pharmacy-name">${pharmacy.name}</div>
                <div class="availability-badge ${availability}">
                    ${availabilityLabels[availability]}
                </div>
            </div>
            
            <div class="medicine-info">
                ${productImage}
                <div class="medicine-content">
                    <div class="medicine-name">${medicine.name}</div>
                    ${productLinkHtml}
                    <div class="medicine-details">
                        ${medicine.manufacturer ? `
                        <div class="detail-row">
                            <span class="detail-label">Мрежа:</span>
                            <span>${medicine.manufacturer}</span>
                        </div>` : ''}
                        ${medicine.packaging ? `
                        <div class="detail-row">
                            <span class="detail-label">Опаковка:</span>
                            <span>${medicine.packaging}</span>
                        </div>` : ''}
                        <div class="detail-row">
                            <span class="detail-label">Наличност:</span>
                            <span class="stock-info ${availability}">${stockInfo}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            ${price && inStock ? `<div class="price">${price} лв.</div>` : ''}
            
            <div class="pharmacy-location">
                <strong>📍 Адрес:</strong> ${pharmacy.address}<br>
                ${pharmacy.phone ? `<strong>📞 Телефон:</strong> <a href="tel:${pharmacy.phone}">${pharmacy.phone}</a><br>` : ''}
                <strong>🕐 Работно време:</strong> ${pharmacy.workingHours}
            </div>
        </div>
    `;
}

// UI Helper Functions
function showLoading() {
    loadingElement.classList.remove('hidden');
}

function hideLoading() {
    loadingElement.classList.add('hidden');
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

function hideError() {
    errorElement.classList.add('hidden');
}

function hideResults() {
    resultsElement.classList.add('hidden');
    resultsElement.innerHTML = '';
}

function showSuggestions() {
    suggestionsElement.classList.add('show');
}

function hideSuggestions() {
    suggestionsElement.classList.remove('show');
}

// Initialize app
console.log('GetMeds app initialized');
console.log('Integrated pharmacies:');
console.log('✅ SOpharmacy - Full integration (20+ locations)');
console.log('✅ VMClub - Full integration (Sofia)');
console.log('⚠️ IMPORTANT: Set USE_CORS_PROXY: true for production!');
console.log('📚 Documentation: See docs/ folder for integration details');
