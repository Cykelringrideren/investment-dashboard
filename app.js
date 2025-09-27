// Investment Portfolio Dashboard with Real Market Data
class PortfolioDashboard {
    constructor() {
        this.assets = [];
        this.contributions = [];
        this.currentSort = { field: 'name', direction: 'asc' };
        this.searchTerm = '';
        this.editingAsset = null;
        this.nextAssetId = 1;
        this.charts = {};
        this.priceCache = new Map();
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
        this.cryptoList = null;
        this.isLoading = false;

		// API endpoints - using proxy-free alternatives
		this.apis = {
			// Yahoo Finance quote endpoint (may be subject to CORS depending on environment)
			yahooQuote: "https://query1.finance.yahoo.com/v7/finance/quote?symbols=",
			// CoinGecko endpoints
			coinGecko: "https://api.coingecko.com/api/v3/simple/price",
			cryptoList: "https://api.coingecko.com/api/v3/coins/list",
			// Fallback demo data toggle
			demoMode: false
		};

        // Demo price data for testing
        this.demoPrices = {
            'AAPL': { price: 175.50, name: 'Apple Inc.' },
            'MSFT': { price: 378.85, name: 'Microsoft Corporation' },
            'GOOGL': { price: 142.65, name: 'Alphabet Inc.' },
            'AMZN': { price: 145.86, name: 'Amazon.com Inc.' },
            'TSLA': { price: 248.42, name: 'Tesla Inc.' },
            'NOVO-B.CO': { price: 892.40, name: 'Novo Nordisk A/S' },
            'SPY': { price: 445.80, name: 'SPDR S&P 500 ETF' },
            'bitcoin': { price: 65420.00, name: 'Bitcoin' },
            'ethereum': { price: 2650.75, name: 'Ethereum' }
        };

        this.init();
    }

    trapFocus(modal) {
        const focusableSelectors = [
            'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
            'textarea:not([disabled])', 'button:not([disabled])', 'iframe', 'object', 'embed',
            '[contenteditable]', '[tabindex]:not([tabindex="-1"])'
        ];
        const focusable = modal.querySelectorAll(focusableSelectors.join(','));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        first.focus();

        const handleKeydown = (e) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        modal.addEventListener('keydown', handleKeydown);
    }

    async init() {
        this.setupEventListeners();
        await this.loadCryptoList();
        this.loadSampleData();
        this.updatePortfolioSummary();
        this.renderAssetsTable();
        this.renderRecentAssets();
        this.renderContributionsList();
        this.renderAssetProjections();
        this.renderPerformanceSummary();
        this.populateAssetSelect();
        
        // Initialize charts after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.initCharts();
        }, 500);

		// Initialize projection slider label
		this.updateProjectionLabel();
    }

    loadSampleData() {
        // Load with some sample data with realistic prices
        this.assets = [
            {
                id: 1,
                name: "Apple Inc.",
                symbol: "AAPL",
                type: "Stock",
                currentPrice: 175.50,
                shares: 10,
                currentValue: 1755.00,
                totalContributed: 1500.00,
                expectedGrowthRate: 8.0,
                dateAdded: "2024-01-15",
                lastUpdated: new Date().toISOString()
            },
            {
                id: 2,
                name: "Novo Nordisk A/S",
                symbol: "NOVO-B.CO",
                type: "Stock",
                currentPrice: 892.40,
                shares: 50,
                currentValue: 44620.00,
                totalContributed: 41000.00,
                expectedGrowthRate: 7.0,
                dateAdded: "2024-02-10",
                lastUpdated: new Date().toISOString()
            }
        ];

        this.contributions = [
            {assetId: 1, date: "2024-01-15", amount: 1500.00},
            {assetId: 2, date: "2024-02-10", amount: 41000.00}
        ];

        this.nextAssetId = 3;
    }

    async loadCryptoList() {
        try {
            const response = await fetch(this.apis.cryptoList);
            if (response.ok) {
                this.cryptoList = await response.json();
            }
        } catch (error) {
            console.log('Using demo mode for crypto data');
        }
    }

	async fetchStockPrice(symbol, { force = false } = {}) {
		if (!symbol) {
			return { price: 0, name: 'Unknown', currency: 'USD' };
		}

		const cacheKey = `stock:${symbol.toUpperCase()}`;
		const cached = this.getCachedPrice(cacheKey);
		if (cached && !force) {
			return cached;
		}

		// In demo mode, use predefined prices if available
		if (this.apis.demoMode) {
			const demoData = this.demoPrices[symbol.toUpperCase()];
			if (demoData) {
				const payload = { price: demoData.price, name: demoData.name, currency: 'USD' };
				this.setCachedPrice(cacheKey, payload);
				return payload;
			}
		}

		// Try Yahoo Finance quote endpoint (symbol or ISIN). If 12+ chars and alnum, treat as ISIN and search first.
		try {
            let resolvedSymbol = symbol;
            if (/^[A-Z0-9]{12,}$/.test(symbol)) {
                const search = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=0`);
                if (search.ok) {
                    const sdata = await search.json();
                    if (sdata && sdata.quotes && sdata.quotes[0] && sdata.quotes[0].symbol) {
                        resolvedSymbol = sdata.quotes[0].symbol;
                    }
                }
            }
            const url = `${this.apis.yahooQuote}${encodeURIComponent(resolvedSymbol)}`;
			const response = await fetch(url);
			if (response.ok) {
				const data = await response.json();
				const result = data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0];
				if (result && typeof result.regularMarketPrice === 'number') {
					const price = result.regularMarketPrice;
					const name = result.longName || result.shortName || symbol;
					const currency = result.currency || 'USD';
					const payload = { price, name, currency };
					this.setCachedPrice(cacheKey, payload);
					return payload;
				}
			}
			throw new Error('Yahoo response invalid');
		} catch (error) {
			// If demo mode enabled and we have demo data, allow demo fallback; otherwise rethrow
			if (this.apis.demoMode) {
				const demoData = this.demoPrices[symbol.toUpperCase()];
				if (demoData) {
					const payload = { price: demoData.price, name: demoData.name, currency: 'USD' };
					this.setCachedPrice(cacheKey, payload);
					return payload;
				}
			}
			throw error;
		}
	}

	async fetchCryptoPrice(symbol, { force = false } = {}) {
		if (!symbol) {
			return { price: 0, name: 'Unknown', currency: 'USD' };
		}

		const keySymbol = symbol.toLowerCase();
		const cacheKey = `crypto:${keySymbol}`;
		const cached = this.getCachedPrice(cacheKey);
		if (cached && !force) {
			return cached;
		}

		try {
			const cryptoId = this.getCryptoId(symbol);
			if (!cryptoId && this.demoPrices[keySymbol]) {
				const demoData = this.demoPrices[keySymbol];
				const payload = { price: demoData.price, name: demoData.name, currency: 'USD' };
				this.setCachedPrice(cacheKey, payload);
				return payload;
			}

			if (cryptoId) {
				const response = await fetch(`${this.apis.coinGecko}?ids=${cryptoId}&vs_currencies=usd`);
				if (response.ok) {
					const data = await response.json();
					if (data[cryptoId] && data[cryptoId].usd) {
						const payload = { price: data[cryptoId].usd, name: this.getCryptoName(cryptoId), currency: 'USD' };
						this.setCachedPrice(cacheKey, payload);
						return payload;
					}
				}
			}
			throw new Error('Crypto not found');
		} catch (error) {
			if (this.apis.demoMode) {
				const demoData = this.demoPrices[keySymbol];
				const price = demoData ? demoData.price : (Math.random() * 50000 + 1000);
				const name = demoData ? demoData.name : symbol.charAt(0).toUpperCase() + symbol.slice(1);
				const payload = { price, name, currency: 'USD' };
				this.setCachedPrice(cacheKey, payload);
				return payload;
			}
			throw error;
		}
	}

	getCachedPrice(cacheKey) {
		const entry = this.priceCache.get(cacheKey);
		if (!entry) return null;
		if (Date.now() - entry.timestamp < this.cacheTimeout) {
			return entry.data;
		}
		this.priceCache.delete(cacheKey);
		return null;
	}

	setCachedPrice(cacheKey, data) {
		this.priceCache.set(cacheKey, { timestamp: Date.now(), data });
	}

    getCryptoId(symbol) {
        if (!this.cryptoList) return null;
        
        const crypto = this.cryptoList.find(c => 
            c.symbol.toLowerCase() === symbol.toLowerCase() || 
            c.name.toLowerCase() === symbol.toLowerCase()
        );
        
        return crypto ? crypto.id : null;
    }

    getCryptoName(cryptoId) {
        if (!this.cryptoList) return cryptoId;
        
        const crypto = this.cryptoList.find(c => c.id === cryptoId);
        return crypto ? crypto.name : cryptoId;
    }

    async validateAndFetchAssetData(symbol, type) {
        this.setLoading(true);
        
        try {
            let priceData;
            
            if (type === 'Crypto') {
                priceData = await this.fetchCryptoPrice(symbol);
            } else {
                priceData = await this.fetchStockPrice(symbol);
            }
            
            return {
                isValid: true,
                price: priceData.price,
                name: priceData.name,
                currency: priceData.currency || 'USD'
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message,
                price: 0,
                name: symbol
            };
        } finally {
            this.setLoading(false);
        }
    }

	async refreshAssetPrice(asset, { force = false } = {}) {
        try {
            let priceData;
            
			if (asset.type === 'Crypto') {
				priceData = await this.fetchCryptoPrice(asset.symbol, { force });
            } else {
				priceData = await this.fetchStockPrice(asset.symbol, { force });
            }
            
            asset.currentPrice = priceData.price;
            asset.currency = priceData.currency || 'USD';
            asset.currentValue = asset.currentPrice * asset.shares;
            asset.lastUpdated = new Date().toISOString();
            
            return true;
        } catch (error) {
            console.error(`Failed to update price for ${asset.symbol}:`, error);
            return false;
        }
    }

	async refreshAllPrices() {
		this.setLoading(true);
		try {
			const results = await Promise.all(this.assets.map(asset => this.refreshAssetPrice(asset, { force: true })));
			const successCount = results.filter(Boolean).length;
			if (successCount === this.assets.length) {
				this.showNotification('Prices updated successfully!', 'success');
			} else if (successCount > 0) {
				this.showNotification('Some prices failed to update', 'warning');
			} else {
				this.showNotification('Failed to update prices', 'error');
			}
			this.refreshAllData();
		} catch (error) {
			this.showNotification('Failed to update prices', 'error');
		} finally {
			this.setLoading(false);
		}
	}

    setLoading(loading) {
        this.isLoading = loading;
        const refreshBtn = document.getElementById('refreshPricesBtn');
        if (refreshBtn) {
            refreshBtn.disabled = loading;
            refreshBtn.textContent = loading ? 'Refreshing...' : 'Refresh Prices';
        }
    }

    showNotification(message, type = 'info') {
        // Create notifications container if it doesn't exist
        let container = document.getElementById('notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notifications';
            container.className = 'notifications-container';
            container.setAttribute('role', 'status');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
            tab.addEventListener('keydown', (e) => {
                const tabs = Array.from(document.querySelectorAll('.nav-tab'));
                const currentIndex = tabs.indexOf(e.currentTarget);
                if (e.key === 'ArrowRight') {
                    const next = tabs[(currentIndex + 1) % tabs.length];
                    next.focus();
                } else if (e.key === 'ArrowLeft') {
                    const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                    prev.focus();
                } else if (e.key === 'Home') {
                    tabs[0].focus();
                } else if (e.key === 'End') {
                    tabs[tabs.length - 1].focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    this.switchTab(e.currentTarget.dataset.tab);
                }
            });
        });

        // Asset management
        document.getElementById('addAssetBtn').addEventListener('click', () => this.openAssetModal());
        document.getElementById('assetForm').addEventListener('submit', (e) => this.handleAssetSubmit(e));
        const assetSearch = document.getElementById('assetSearch');
        if (assetSearch) {
            let debounceTimer = null;
            assetSearch.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const value = e.target.value;
                debounceTimer = setTimeout(() => {
                    this.handleAssetSearch({ target: { value } });
                }, 200);
            });
        }
        document.getElementById('refreshPricesBtn').addEventListener('click', () => this.refreshAllPrices());

        // Contributions
        document.getElementById('addContributionBtn').addEventListener('click', () => this.openContributionModal());
        document.getElementById('contributionForm').addEventListener('submit', (e) => this.handleContributionSubmit(e));

		// Projections (slider)
		const projectionSlider = document.getElementById('projectionPeriod');
		if (projectionSlider) {
			projectionSlider.addEventListener('input', () => {
				this.updateProjectionLabel();
				this.renderAssetProjections();
				this.updateProjectionChart();
			});
		}

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // Modal management
        document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });

        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal(overlay.closest('.modal'));
                }
            });
        });

        // Escape to close active modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal:not(.hidden)');
                if (openModal) this.closeModal(openModal);
            }
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => this.handleSort(e.target.dataset.sort));
        });

        // Symbol validation + suggestions
        setTimeout(() => {
            const symbolInput = document.querySelector('input[name="symbol"]');
            const typeSelect = document.querySelector('select[name="type"]');
            if (symbolInput && typeSelect) {
                symbolInput.addEventListener('blur', () => this.validateSymbol());
                typeSelect.addEventListener('change', () => this.validateSymbol());

                let suggestTimer = null;
                symbolInput.addEventListener('input', (e) => {
                    clearTimeout(suggestTimer);
                    const q = e.target.value.trim();
                    suggestTimer = setTimeout(() => this.fetchSymbolSuggestions(q), 250);
                });
            }
        }, 100);
    }

    async validateSymbol() {
        const symbolInput = document.querySelector('input[name="symbol"]');
        const typeSelect = document.querySelector('select[name="type"]');
        const nameInput = document.querySelector('input[name="name"]');
        const priceInput = document.querySelector('input[name="currentPrice"]');
        const validationMsg = document.getElementById('symbolValidation');

        if (!symbolInput || !typeSelect || !symbolInput.value || !typeSelect.value) return;

        if (validationMsg) validationMsg.remove();

        const symbol = symbolInput.value.trim().toUpperCase();
        const type = typeSelect.value;

        const validation = await this.validateAndFetchAssetData(symbol, type);

        const msgDiv = document.createElement('div');
        msgDiv.id = 'symbolValidation';
        msgDiv.className = `validation-message ${validation.isValid ? 'validation-success' : 'validation-error'}`;

        if (validation.isValid) {
            const cur = validation.currency || 'USD';
            msgDiv.textContent = `✓ Found: ${validation.name} - ${this.formatCurrency(validation.price, cur)} (${cur})`;
            if (nameInput) nameInput.value = validation.name;
            if (priceInput) priceInput.value = validation.price.toFixed(2);
        } else {
            msgDiv.textContent = `⚠ Using demo data for ${symbol}`;
            if (nameInput) nameInput.value = `${symbol} Corporation`;
            if (priceInput) priceInput.value = (Math.random() * 200 + 50).toFixed(2);
        }

        symbolInput.parentNode.appendChild(msgDiv);
    }

    async fetchSymbolSuggestions(query) {
        const container = document.getElementById('symbolSuggestions');
        if (!container) return;
        if (!query || query.length < 2) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        try {
            // Yahoo Finance symbol suggest endpoint
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Search failed');
            const data = await res.json();
            const quotes = data.quotes || [];
            if (quotes.length === 0) {
                container.classList.add('hidden');
                container.innerHTML = '';
                return;
            }
            container.innerHTML = quotes.map(q => {
                const symbol = q.symbol || '';
                const name = q.shortname || q.longname || '';
                const exch = q.exchange || q.exchangeDisplay || '';
                const curr = q.currency || '';
                const isin = q.isin || '';
                const meta = [exch, curr, isin].filter(Boolean).join(' · ');
                return `
                    <div class="suggestion-item" role="option" data-symbol="${symbol}" data-currency="${curr}" data-name="${name}">
                        <div><strong>${symbol}</strong> — ${name}</div>
                        <div class="suggestion-meta">${meta}</div>
                    </div>
                `;
            }).join('');
            container.classList.remove('hidden');

            container.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const symbolInput = document.querySelector('input[name="symbol"]');
                    const nameInput = document.querySelector('input[name="name"]');
                    const priceInput = document.querySelector('input[name="currentPrice"]');
                    const typeSelect = document.querySelector('select[name="type"]');
                    const symbol = item.getAttribute('data-symbol');
                    const name = item.getAttribute('data-name');
                    const currency = item.getAttribute('data-currency') || 'USD';
                    if (symbolInput) symbolInput.value = symbol;
                    if (nameInput) nameInput.value = name;
                    // fetch a fresh price to reflect the selected symbol
                    const priceData = typeSelect && typeSelect.value === 'Crypto' ? await this.fetchCryptoPrice(symbol) : await this.fetchStockPrice(symbol);
                    if (priceInput && priceData && typeof priceData.price === 'number') priceInput.value = priceData.price.toFixed(2);
                    // attach currency hint on the name field
                    nameInput.setAttribute('data-currency', currency);
                    container.classList.add('hidden');
                    container.innerHTML = '';
                    // force revalidation summary
                    this.validateSymbol();
                });
            });
        } catch (e) {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            activeTab.setAttribute('aria-selected', 'true');
            activeTab.setAttribute('tabindex', '0');
            activeTab.focus();
        }

        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.setAttribute('aria-hidden', 'true');
        });
        const panel = document.getElementById(tabName);
        if (panel) {
            panel.classList.add('active');
            panel.setAttribute('aria-hidden', 'false');
        }

        // Update charts if necessary
        setTimeout(() => {
            if (tabName === 'dashboard') {
                this.updateAllocationChart();
                this.updatePerformanceChart();
            } else if (tabName === 'contributions') {
                this.updateContributionsChart();
            } else if (tabName === 'projections') {
                this.updateProjectionChart();
            } else if (tabName === 'reports') {
                this.updateTypeBreakdownChart();
            }
        }, 100);
    }

    updatePortfolioSummary() {
        const displayCur = this.getDisplayCurrency();
        const totalValue = this.assets.reduce((sum, asset) => sum + this.toDisplayCurrency((asset.currentValue || 0), asset.currency || 'USD'), 0);
        const totalContributed = this.assets.reduce((sum, asset) => sum + this.toDisplayCurrency(asset.totalContributed, asset.currency || 'USD'), 0);
        const totalGain = totalValue - totalContributed;
        const totalGainPercent = totalContributed > 0 ? (totalGain / totalContributed) * 100 : 0;

        document.getElementById('totalValue').textContent = this.formatCurrency(totalValue, displayCur);
        document.getElementById('totalContributed').textContent = this.formatCurrency(totalContributed, displayCur);
        document.getElementById('totalGain').textContent = this.formatCurrency(totalGain, displayCur);
        
        const gainElement = document.getElementById('totalGain');
        const gainPercentElement = document.getElementById('totalGainPercent');
        
        gainElement.className = `stat-value gain ${totalGain >= 0 ? 'positive' : 'negative'}`;
        gainPercentElement.className = `stat-value gain ${totalGain >= 0 ? 'positive' : 'negative'}`;
        gainPercentElement.textContent = `${totalGainPercent.toFixed(2)}%`;

        // Update last refresh time
        const lastUpdated = this.assets.reduce((latest, asset) => {
            if (asset.lastUpdated && (!latest || new Date(asset.lastUpdated) > new Date(latest))) {
                return asset.lastUpdated;
            }
            return latest;
        }, null);

        const lastRefreshElement = document.getElementById('lastRefresh');
        if (lastRefreshElement && lastUpdated) {
            lastRefreshElement.textContent = `Last updated: ${this.formatDateTime(lastUpdated)}`;
        }
    }

    renderAssetsTable() {
        const tbody = document.getElementById('assetsTableBody');
        const filteredAssets = this.getFilteredAndSortedAssets();

        if (filteredAssets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center">
                        <div class="empty-state">
                            <h3>No assets found</h3>
                            <p>Add your first asset to get started tracking your portfolio</p>
                            <button class="btn btn--primary" onclick="app.openAssetModal()">Add Asset</button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const displayCur = this.getDisplayCurrency();
        tbody.innerHTML = filteredAssets.map(asset => {
            const gain = (asset.currentValue || 0) - asset.totalContributed;
            const gainPercent = asset.totalContributed > 0 ? (gain / asset.totalContributed) * 100 : 0;
            const priceDisplay = this.toDisplayCurrency(asset.currentPrice || 0, asset.currency || 'USD');
            const valueDisplay = this.toDisplayCurrency(asset.currentValue || 0, asset.currency || 'USD');
            const contribDisplay = this.toDisplayCurrency(asset.totalContributed || 0, asset.currency || 'USD');
            const gainDisplay = this.toDisplayCurrency(gain, asset.currency || 'USD');
            
            return `
                <tr>
                    <td>
                        <div>
                            <strong>${asset.name}</strong>
                            ${asset.lastUpdated ? `<br><small class="text-secondary">Updated: ${this.formatTime(asset.lastUpdated)}</small>` : '<br><small class="text-warning">No update time</small>'}
                        </div>
                    </td>
                    <td><span class="asset-type asset-type--${asset.type.toLowerCase()}">${asset.type}</span></td>
                    <td><strong>${asset.symbol}</strong></td>
                    <td>${asset.currentPrice ? this.formatCurrency(priceDisplay, displayCur) : this.formatCurrency(0, displayCur)}</td>
                    <td>${this.formatNumber(asset.shares)}</td>
                    <td><strong>${asset.currentValue ? this.formatCurrency(valueDisplay, displayCur) : this.formatCurrency(0, displayCur)}</strong></td>
                    <td>${this.formatCurrency(contribDisplay, displayCur)}</td>
                    <td>
                        <span class="${gain >= 0 ? 'text-success' : 'text-error'}">
                            ${gain >= 0 ? '+' : ''}${this.formatCurrency(gainDisplay, displayCur)} (${gainPercent.toFixed(1)}%)
                        </span>
                    </td>
                    <td>${asset.expectedGrowthRate}%</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn--xs btn--secondary" onclick="app.editAsset(${asset.id})">Edit</button>
                            <button class="btn btn--xs btn--danger" onclick="app.deleteAsset(${asset.id})">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getFilteredAndSortedAssets() {
        let filtered = this.assets.filter(asset => 
            asset.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            asset.symbol.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            asset.type.toLowerCase().includes(this.searchTerm.toLowerCase())
        );

        return filtered.sort((a, b) => {
            let aVal = a[this.currentSort.field];
            let bVal = b[this.currentSort.field];
            
            // Handle special cases
            if (this.currentSort.field === 'gain') {
                aVal = (a.currentValue || 0) - a.totalContributed;
                bVal = (b.currentValue || 0) - b.totalContributed;
            }
            
            const modifier = this.currentSort.direction === 'asc' ? 1 : -1;

            if (typeof aVal === 'string') {
                return aVal.localeCompare(bVal) * modifier;
            }
            return (aVal - bVal) * modifier;
        });
    }

    handleSort(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }

        // Update sort indicators
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        const currentHeader = document.querySelector(`[data-sort="${field}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${this.currentSort.direction}`);
        }

        this.renderAssetsTable();
    }

    handleAssetSearch(e) {
        this.searchTerm = e.target.value;
        this.renderAssetsTable();
    }

    openAssetModal(asset = null) {
        this.editingAsset = asset;
        const modal = document.getElementById('assetModal');
        const form = document.getElementById('assetForm');
        const title = document.getElementById('assetModalTitle');

        title.textContent = asset ? 'Edit Asset' : 'Add Asset';
        
        // Clear any existing validation messages
        const validationMsg = document.getElementById('symbolValidation');
        if (validationMsg) validationMsg.remove();
        
        if (asset) {
            form.name.value = asset.name;
            form.symbol.value = asset.symbol;
            form.type.value = asset.type;
            form.currentPrice.value = asset.currentPrice || 0;
            form.shares.value = asset.shares;
            form.totalContributed.value = asset.totalContributed;
            form.expectedGrowthRate.value = asset.expectedGrowthRate;
            const currencySelect = document.getElementById('assetCurrency');
            if (currencySelect && asset.currency) currencySelect.value = asset.currency;
        } else {
            form.reset();
            form.expectedGrowthRate.value = 7.0;
            const currencySelect = document.getElementById('assetCurrency');
            if (currencySelect) currencySelect.value = this.getDisplayCurrency();
        }

        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
        this.trapFocus(modal);
    }

    async handleAssetSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const symbol = formData.get('symbol').trim().toUpperCase();
        const type = formData.get('type');
        
        // Validate required fields
        if (!symbol || !type || !formData.get('name') || !formData.get('shares') || !formData.get('totalContributed')) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const currencySelect = document.getElementById('assetCurrency');
        const assetData = {
            name: formData.get('name'),
            symbol: symbol,
            type: type,
            currentPrice: parseFloat(formData.get('currentPrice')) || 0,
            shares: parseFloat(formData.get('shares')),
            totalContributed: parseFloat(formData.get('totalContributed')),
            expectedGrowthRate: parseFloat(formData.get('expectedGrowthRate')) || 7.0,
            dateAdded: this.editingAsset ? this.editingAsset.dateAdded : new Date().toISOString().split('T')[0],
            lastUpdated: new Date().toISOString(),
            currency: currencySelect ? currencySelect.value : 'USD'
        };

        // Try to infer currency from quote if available; override select if present
        const guessed = await this.validateAndFetchAssetData(symbol, type);
        if (guessed && guessed.currency) {
            assetData.currency = guessed.currency;
            if (currencySelect) currencySelect.value = guessed.currency;
        }
        assetData.currentValue = assetData.currentPrice * assetData.shares;

        if (this.editingAsset) {
            const index = this.assets.findIndex(a => a.id === this.editingAsset.id);
            if (index !== -1) {
                this.assets[index] = { ...this.editingAsset, ...assetData };
            }
        } else {
            assetData.id = this.nextAssetId++;
            this.assets.push(assetData);
        }

        this.refreshAllData();
        this.closeModal(document.getElementById('assetModal'));
        this.showNotification(`Asset ${this.editingAsset ? 'updated' : 'added'} successfully!`, 'success');
    }

    editAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (asset) {
            this.openAssetModal(asset);
        }
    }

    deleteAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) return;

        if (confirm(`Are you sure you want to delete ${asset.name}?`)) {
            this.assets = this.assets.filter(a => a.id !== id);
            this.contributions = this.contributions.filter(c => c.assetId !== id);
            this.refreshAllData();
            this.showNotification('Asset deleted successfully!', 'success');
        }
    }

    refreshAllData() {
        this.updatePortfolioSummary();
        this.renderAssetsTable();
        this.renderRecentAssets();
        this.renderContributionsList();
        this.renderAssetProjections();
        this.renderPerformanceSummary();
        this.populateAssetSelect();
        this.updateAllCharts();
    }

    openContributionModal() {
        const modal = document.getElementById('contributionModal');
        const form = document.getElementById('contributionForm');
        
        form.reset();
        form.date.value = new Date().toISOString().split('T')[0];
        this.populateAssetSelect();
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
        this.trapFocus(modal);
    }

    handleContributionSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const assetId = parseInt(formData.get('assetId'));
        const date = formData.get('date');
        const amount = parseFloat(formData.get('amount'));

        if (!assetId || isNaN(assetId)) {
            this.showNotification('Please select an asset', 'error');
            return;
        }

        if (!amount || amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return;
        }

        const contribution = { assetId, date, amount };
        this.contributions.push(contribution);
        this.contributions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const asset = this.assets.find(a => a.id === assetId);
        if (asset) {
            asset.totalContributed += amount;
        }

        this.refreshAllData();
        this.closeModal(document.getElementById('contributionModal'));
        this.showNotification('Contribution added successfully!', 'success');
    }

    renderRecentAssets() {
        const container = document.getElementById('recentAssetsTable');
        const recentAssets = [...this.assets]
            .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
            .slice(0, 5);

        if (recentAssets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No assets yet</h3>
                    <p>Add your first asset to start tracking your portfolio</p>
                </div>
            `;
            return;
        }

        const displayCur = this.getDisplayCurrency();
        container.innerHTML = recentAssets.map(asset => {
            const gain = (asset.currentValue || 0) - asset.totalContributed;
            const gainPercent = asset.totalContributed > 0 ? (gain / asset.totalContributed) * 100 : 0;
            const valueDisplay = this.toDisplayCurrency(asset.currentValue || 0, asset.currency || 'USD');
            const gainDisplay = this.toDisplayCurrency(gain, asset.currency || 'USD');
            
            return `
                <div class="recent-asset-item">
                    <div class="recent-asset-info">
                        <h4>${asset.name}</h4>
                        <p>${asset.symbol} • ${asset.type}</p>
                    </div>
                    <div class="recent-asset-value">
                        <span class="value">${asset.currentValue ? this.formatCurrency(valueDisplay, displayCur) : this.formatCurrency(0, displayCur)}</span>
                        <span class="change ${gain >= 0 ? 'positive' : 'negative'}">
                            ${gain >= 0 ? '+' : ''}${this.formatCurrency(gainDisplay, displayCur)} (${gainPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderContributionsList() {
        const container = document.getElementById('contributionsList');
        const recentContributions = [...this.contributions]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);

        if (recentContributions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No contributions yet</h3>
                    <p>Add contributions to track your investment history</p>
                </div>
            `;
            return;
        }

        const displayCur = this.getDisplayCurrency();
        container.innerHTML = recentContributions.map(contribution => {
            const asset = this.assets.find(a => a.id === contribution.assetId);
            const amountDisplay = this.toDisplayCurrency(contribution.amount, asset ? asset.currency || 'USD' : 'USD');
            return `
                <div class="contribution-item">
                    <div class="contribution-info">
                        <h4>${asset ? asset.name : 'Unknown Asset'}</h4>
                        <p>${this.formatDate(contribution.date)}</p>
                    </div>
                    <div class="contribution-amount">
                        +${this.formatCurrency(amountDisplay, displayCur)}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderAssetProjections() {
        const container = document.getElementById('assetProjections');
        const period = parseInt(document.getElementById('projectionPeriod').value);

        if (this.assets.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No projections available</h3>
                    <p>Add assets to see growth projections</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.assets.map(asset => {
            const currentValue = asset.currentValue || asset.totalContributed;
            const projectedValue = this.calculateProjectedValue(currentValue, asset.expectedGrowthRate, period);
            const projectedGain = projectedValue - currentValue;
            const totalReturnPercent = this.calculatePercentage(projectedGain, currentValue);

            return `
                <div class="projection-item">
                    <div class="projection-header">
                        <h4>${asset.name}</h4>
                        <span class="projection-growth-rate">${asset.expectedGrowthRate}% annually</span>
                    </div>
                    <div class="projection-values">
                        <div class="projection-value">
                            <span>Current Value:</span>
                            <span>${this.formatCurrency(currentValue)}</span>
                        </div>
                        <div class="projection-value">
                            <span>Projected (${period}y):</span>
                            <strong>${this.formatCurrency(projectedValue)}</strong>
                        </div>
                        <div class="projection-value">
                            <span>Expected Gain:</span>
                            <strong>${this.formatCurrency(projectedGain)}</strong>
                        </div>
                        <div class="projection-value">
                            <span>Total Return:</span>
                            <strong>${totalReturnPercent !== null ? `${totalReturnPercent.toFixed(1)}%` : 'N/A'}</strong>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderPerformanceSummary() {
        const container = document.getElementById('performanceSummary');
        
        if (this.assets.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No assets to analyze</p></div>';
            return;
        }
        
        const totalValue = this.assets.reduce((sum, asset) => sum + this.toDisplayCurrency((asset.currentValue || 0), asset.currency || 'USD'), 0);
        const totalContributed = this.assets.reduce((sum, asset) => sum + this.toDisplayCurrency(asset.totalContributed, asset.currency || 'USD'), 0);
        
        const analyzedAssets = this.assets.filter(asset => asset && asset.totalContributed && asset.totalContributed > 0);
        const gainData = analyzedAssets.map(asset => ({
            asset,
            gainPercent: this.calculateGainPercent(asset)
        })).filter(item => item.gainPercent !== null && isFinite(item.gainPercent));

        let bestPerformer = null;
        let worstPerformer = null;

        if (gainData.length > 0) {
            bestPerformer = gainData.reduce((best, current) => current.gainPercent > best.gainPercent ? current : best);
            worstPerformer = gainData.reduce((worst, current) => current.gainPercent < worst.gainPercent ? current : worst);
        }

        const bestGainPercent = bestPerformer ? bestPerformer.gainPercent : null;
        const worstGainPercent = worstPerformer ? worstPerformer.gainPercent : null;
        const bestGainText = bestGainPercent !== null ? `${bestGainPercent >= 0 ? '+' : ''}${bestGainPercent.toFixed(1)}%` : null;
        const worstGainText = worstGainPercent !== null ? `${worstGainPercent >= 0 ? '+' : ''}${worstGainPercent.toFixed(1)}%` : null;

        container.innerHTML = `
            <div class="performance-summary-grid">
                <div class="performance-metric">
                    <span class="performance-metric-label">Portfolio Value</span>
                    <span class="performance-metric-value">${this.formatCurrency(totalValue)}</span>
                </div>
                <div class="performance-metric">
                    <span class="performance-metric-label">Total Invested</span>
                    <span class="performance-metric-value">${this.formatCurrency(totalContributed)}</span>
                </div>
                <div class="performance-metric">
                    <span class="performance-metric-label">Best Performer</span>
                    <span class="performance-metric-value text-success">
                        ${bestPerformer ? bestPerformer.asset.symbol : 'N/A'}
                        ${bestGainText ? `(${bestGainText})` : ''}
                    </span>
                </div>
                <div class="performance-metric">
                    <span class="performance-metric-label">Worst Performer</span>
                    <span class="performance-metric-value text-error">
                        ${worstPerformer ? worstPerformer.asset.symbol : 'N/A'}
                        ${worstGainText ? `(${worstGainText})` : ''}
                    </span>
                </div>
            </div>
        `;
    }

    populateAssetSelect() {
        const select = document.getElementById('contributionAssetSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Asset</option>' + 
            this.assets.map(asset => 
                `<option value="${asset.id}">${asset.name} (${asset.symbol})</option>`
            ).join('');
    }

    initCharts() {
        this.updateAllocationChart();
        this.updatePerformanceChart();
        this.updateContributionsChart();
        this.updateProjectionChart();
        this.updateTypeBreakdownChart();
    }

    updateAllocationChart() {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;

        if (this.charts.allocation) {
            this.charts.allocation.destroy();
        }

        const validAssets = this.assets.filter(asset => asset.currentValue && asset.currentValue > 0);
        if (validAssets.length === 0) {
            return;
        }

        const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545'];
        
        const displayCur = this.getDisplayCurrency();
        this.charts.allocation = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: validAssets.map(asset => asset.symbol),
                datasets: [{
                    data: validAssets.map(asset => this.toDisplayCurrency(asset.currentValue, asset.currency || 'USD')),
                    backgroundColor: colors.slice(0, validAssets.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${this.formatCurrency(context.raw, displayCur)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    updatePerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        if (this.charts.performance) {
            this.charts.performance.destroy();
        }

        const validAssets = this.assets.filter(asset => asset.currentValue && asset.currentValue > 0);
        if (validAssets.length === 0) {
            return;
        }

        const performanceData = validAssets.map(asset => ({
            label: asset.symbol,
            actualGainPercent: this.calculateGainPercent(asset),
            expectedGainPercent: this.calculateExpectedGainPercent(asset)
        })).filter(data => data.actualGainPercent !== null && isFinite(data.actualGainPercent));

        if (performanceData.length === 0) {
            return;
        }

        this.charts.performance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: performanceData.map(d => d.label),
                datasets: [
                    {
                        label: 'Actual Gain %',
                        data: performanceData.map(d => d.actualGainPercent ?? 0),
                        backgroundColor: performanceData.map(d => {
                            const percent = d.actualGainPercent ?? 0;
                            return percent >= 0 ? '#1FB8CD' : '#B4413C';
                        }),
                        borderWidth: 1
                    },
                    {
                        label: 'Expected Gain %',
                        data: performanceData.map(d => d.expectedGainPercent ?? 0),
                        backgroundColor: 'rgba(98, 108, 113, 0.35)',
                        borderColor: 'rgba(98, 108, 113, 0.6)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value.toFixed(1) + '%'
                        }
                    }
                }
            }
        });
    }

    updateContributionsChart() {
        const ctx = document.getElementById('contributionsChart');
        if (!ctx) return;

        if (this.charts.contributions) {
            this.charts.contributions.destroy();
        }

        if (this.contributions.length === 0) {
            return;
        }

        // Group contributions by month
        const monthlyData = {};
        this.contributions.forEach(contribution => {
            const date = new Date(contribution.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[key] = (monthlyData[key] || 0) + contribution.amount;
        });

        const sortedMonths = Object.keys(monthlyData).sort();
        
        this.charts.contributions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedMonths.map(month => {
                    const [year, monthNum] = month.split('-');
                    return new Date(year, monthNum - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                }),
                datasets: [{
                    label: 'Monthly Contributions',
                    data: sortedMonths.map(month => monthlyData[month]),
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    updateProjectionChart() {
        const ctx = document.getElementById('projectionChart');
        if (!ctx) return;

        if (this.charts.projection) {
            this.charts.projection.destroy();
        }

        const validAssets = this.assets.filter(asset => asset.currentValue && asset.currentValue > 0);
        if (validAssets.length === 0) {
            return;
        }

        const period = parseInt(document.getElementById('projectionPeriod').value);
        const currentTotal = validAssets.reduce((sum, asset) => sum + this.toDisplayCurrency(asset.currentValue, asset.currency || 'USD'), 0);
        
        // Calculate projected values for each year
        const years = Array.from({length: period + 1}, (_, i) => i);
        const projectedValues = years.map(year => {
            return validAssets.reduce((sum, asset) => {
                const projected = this.calculateProjectedValue(asset.currentValue, asset.expectedGrowthRate, year);
                return sum + this.toDisplayCurrency(projected, asset.currency || 'USD');
            }, 0);
        });

        const displayCur = this.getDisplayCurrency();
        this.charts.projection = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years.map(year => year === 0 ? 'Now' : `Year ${year}`),
                datasets: [{
                    label: 'Projected Portfolio Value',
                    data: projectedValues,
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: '#1FB8CD',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, displayCur)
                        }
                    }
                }
            }
        });
    }

    updateProjectionLabel() {
        const slider = document.getElementById('projectionPeriod');
        const label = document.getElementById('projectionPeriodLabel');
        if (slider && label) {
            const years = parseInt(slider.value) || 1;
            label.textContent = `${years} ${years === 1 ? 'year' : 'years'}`;
        }
    }

    updateTypeBreakdownChart() {
        const ctx = document.getElementById('typeBreakdownChart');
        if (!ctx) return;

        if (this.charts.typeBreakdown) {
            this.charts.typeBreakdown.destroy();
        }

        const validAssets = this.assets.filter(asset => asset.currentValue && asset.currentValue > 0);
        if (validAssets.length === 0) {
            return;
        }

        // Group assets by type
        const typeData = {};
        validAssets.forEach(asset => {
            typeData[asset.type] = (typeData[asset.type] || 0) + asset.currentValue;
        });

        const colors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F'];
        
        const displayCur = this.getDisplayCurrency();
        this.charts.typeBreakdown = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(typeData),
                datasets: [{
                    data: Object.values(typeData).map(v => this.toDisplayCurrency(v, 'USD')),
                    backgroundColor: colors.slice(0, Object.keys(typeData).length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${this.formatCurrency(context.raw, displayCur)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateAllCharts() {
        setTimeout(() => {
            this.updateAllocationChart();
            this.updatePerformanceChart();
            this.updateContributionsChart();
            this.updateProjectionChart();
            this.updateTypeBreakdownChart();
        }, 100);
    }

    calculateProjectedValue(currentValue, growthRate, years) {
        return currentValue * Math.pow(1 + (growthRate / 100), years);
    }

    calculatePercentage(numerator, denominator) {
        if (!denominator || denominator === 0) {
            return null;
        }
        return (numerator / denominator) * 100;
    }

    calculateGainPercent(asset) {
        if (!asset || !asset.totalContributed || asset.totalContributed <= 0) {
            return null;
        }
        const gain = (asset.currentValue || 0) - asset.totalContributed;
        return this.calculatePercentage(gain, asset.totalContributed);
    }

    calculateExpectedGainPercent(asset) {
        if (!asset || !asset.totalContributed || asset.totalContributed <= 0 || !asset.dateAdded) {
            return null;
        }
        const years = this.yearsSince(asset.dateAdded);
        const expectedValue = asset.totalContributed * Math.pow(1 + (asset.expectedGrowthRate / 100), years);
        const expectedGain = expectedValue - asset.totalContributed;
        return this.calculatePercentage(expectedGain, asset.totalContributed);
    }

    yearsSince(dateString) {
        const start = new Date(dateString);
        const now = new Date();
        const msInYear = 365 * 24 * 60 * 60 * 1000;
        return Math.max(0, (now - start) / msInYear);
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.add('hidden');
        }
        this.editingAsset = null;
        
        // Clear validation messages
        const validationMsg = document.getElementById('symbolValidation');
        if (validationMsg) validationMsg.remove();

        // release scroll lock
        document.body.classList.remove('no-scroll');

        // return focus to triggering tab if any
        const activeTab = document.querySelector('.nav-tab.active');
        if (activeTab) activeTab.focus();
    }

    exportData() {
        const csvData = this.assets.map(asset => {
            const gain = (asset.currentValue || 0) - asset.totalContributed;
            const gainPercent = asset.totalContributed > 0 ? (gain / asset.totalContributed) * 100 : 0;
            
            return {
                'Asset Name': asset.name,
                'Symbol': asset.symbol,
                'Type': asset.type,
                'Current Price': asset.currentPrice || 0,
                'Shares': asset.shares,
                'Current Value': asset.currentValue || 0,
                'Total Contributed': asset.totalContributed,
                'Gain/Loss': gain,
                'Gain/Loss %': gainPercent.toFixed(2),
                'Expected Growth Rate': asset.expectedGrowthRate + '%',
                'Date Added': asset.dateAdded,
                'Last Updated': asset.lastUpdated || 'Never'
            };
        });

        const csv = this.convertToCSV(csvData);
        this.downloadCSV(csv, 'portfolio-data.csv');
        this.showNotification('Portfolio data exported successfully!', 'success');
    }

    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(','))
        ].join('\n');
        return csvContent;
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    formatCurrency(amount, currency = 'USD') {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        } catch (e) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount);
        }
    }

    toDisplayCurrency(amount, fromCurrency = 'USD') {
        // Convert from asset currency to selected display currency
        const from = fromCurrency || 'USD';
        const to = this.getDisplayCurrency();
        const rates = this.fxRates || { USD: 1 };
        const fromRate = rates[from] || 1;
        const toRate = rates[to] || 1;
        // All rates are vs USD; convert via USD
        // amount_in_usd = amount / fromRate; target = amount_in_usd * toRate
        const amountInUsd = amount / fromRate;
        return amountInUsd * toRate;
    }

    getDisplayCurrency() {
        const selector = document.getElementById('displayCurrency');
        return selector && selector.value ? selector.value : 'USD';
    }

    formatNumber(number) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
        }).format(number);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PortfolioDashboard();
});