// Configuration
const CONFIG = {
    // Cloudflare Worker URL for CORS proxy (to be set up)
    CORS_PROXY: 'https://your-worker.your-subdomain.workers.dev',
    
    // Pharmacy API endpoints (examples - to be configured with real APIs)
    PHARMACIES: [
        {
            name: 'Sopharmacy',
            endpoint: 'https://sopharmacy.bg/api/products/search',
            enabled: false // Will be enabled when API is configured
        },
        {
            name: 'Remedium',
            endpoint: 'https://remedium.bg/api/search',
            enabled: false
        },
        {
            name: 'VMClub',
            endpoint: 'https://vmclub.bg/api/products',
            enabled: false // CORS enabled - requires Cloudflare Worker proxy
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
    const url = `${CONFIG.CORS_PROXY}?url=${encodeURIComponent(pharmacy.endpoint)}&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the pharmacy-specific response format
    return parsePharmacyResponse(pharmacy.name, data);
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
    const { medicine, pharmacy, inStock, quantity, price, availability } = result;
    
    const availabilityLabels = {
        available: 'Налично',
        limited: 'Ограничено количество',
        unavailable: 'Няма наличност'
    };
    
    const stockInfo = inStock ? `${quantity} бр. на склад` : 'Няма наличност';
    
    return `
        <div class="pharmacy-card">
            <div class="pharmacy-header">
                <div class="pharmacy-name">${pharmacy.name}</div>
                <div class="availability-badge ${availability}">
                    ${availabilityLabels[availability]}
                </div>
            </div>
            
            <div class="medicine-info">
                <div class="medicine-name">${medicine.name}</div>
                <div class="medicine-details">
                    <div class="detail-row">
                        <span class="detail-label">Производител:</span>
                        <span>${medicine.manufacturer}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Опаковка:</span>
                        <span>${medicine.packaging}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Рецепта:</span>
                        <span>${medicine.prescription ? 'Да' : 'Не'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Наличност:</span>
                        <span>${stockInfo}</span>
                    </div>
                </div>
            </div>
            
            ${inStock ? `<div class="price">${price} лв.</div>` : ''}
            
            <div class="pharmacy-location">
                <strong>📍 Адрес:</strong> ${pharmacy.address}<br>
                <strong>📞 Телефон:</strong> ${pharmacy.phone}<br>
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
console.log('Note: This demo uses mock data. Configure real pharmacy APIs in app.js');
