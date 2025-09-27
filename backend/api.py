#!/usr/bin/env python3
"""
Enhanced Portfolio Backend API with yfinance Integration

This backend service provides:
- Real yfinance integration without CORS limitations
- Intelligent caching and rate limiting
- Batch processing for multiple symbols
- Error handling and fallback mechanisms
- API key management for premium data sources
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
import json
from functools import wraps

import yfinance as yf
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

class RateLimiter:
    """Simple rate limiter to prevent API abuse"""
    
    def __init__(self, max_requests=60, time_window=60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = {}
    
    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        client_requests = self.requests.get(client_id, [])
        
        # Remove old requests outside the time window
        client_requests = [req_time for req_time in client_requests if now - req_time < self.time_window]
        
        if len(client_requests) >= self.max_requests:
            return False
        
        client_requests.append(now)
        self.requests[client_id] = client_requests
        return True

class EnhancedPortfolioAPI:
    """Enhanced portfolio API with comprehensive financial data integration"""
    
    def __init__(self):
        self.cache = {}
        self.cache_duration = 900  # 15 minutes default
        self.rate_limiter = RateLimiter()
        
        # Configure requests session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # API endpoints for fallback
        self.fallback_apis = {
            'coingecko': 'https://api.coingecko.com/api/v3',
            'exchangerate': 'https://api.exchangerate-api.com/v4/latest/USD'
        }
    
    def get_client_id(self, request):
        """Get client identifier for rate limiting"""
        return request.environ.get('REMOTE_ADDR', 'unknown')
    
    def is_cache_valid(self, cache_key: str, duration: int = None) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self.cache:
            return False
        
        cache_duration = duration or self.cache_duration
        cache_time = self.cache[cache_key]['timestamp']
        return time.time() - cache_time < cache_duration
    
    def get_cached(self, cache_key: str):
        """Get cached data if valid"""
        if self.is_cache_valid(cache_key):
            return self.cache[cache_key]['data']
        return None
    
    def set_cache(self, cache_key: str, data, duration: int = None):
        """Set cache with timestamp"""
        self.cache[cache_key] = {
            'data': data,
            'timestamp': time.time(),
            'duration': duration or self.cache_duration
        }
    
    def get_stock_info(self, symbol: str, force_refresh: bool = False) -> Dict:
        """Get comprehensive stock information using yfinance"""
        cache_key = f"stock:{symbol.upper()}"
        
        if not force_refresh:
            cached = self.get_cached(cache_key)
            if cached:
                return cached
        
        try:
            # Use yfinance for comprehensive data
            ticker = yf.Ticker(symbol)
            info = ticker.info
            
            # Get current price from multiple sources
            current_price = None
            currency = info.get('currency', 'USD')
            
            # Try different price fields in order of preference
            price_fields = [
                'regularMarketPrice', 'currentPrice', 'previousClose',
                'regularMarketPreviousClose', 'price'
            ]
            
            for field in price_fields:
                if field in info and info[field] is not None:
                    current_price = float(info[field])
                    break
            
            if current_price is None:
                # Fallback to historical data
                hist = ticker.history(period="1d")
                if not hist.empty:
                    current_price = float(hist['Close'].iloc[-1])
            
            result = {
                'symbol': symbol.upper(),
                'price': current_price,
                'name': info.get('longName') or info.get('shortName') or symbol,
                'currency': currency,
                'market_cap': info.get('marketCap'),
                'volume': info.get('volume'),
                'pe_ratio': info.get('trailingPE'),
                'dividend_yield': info.get('dividendYield'),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'exchange': info.get('exchange'),
                'country': info.get('country'),
                'last_updated': datetime.now().isoformat(),
                'source': 'yfinance'
            }
            
            if current_price is not None:
                self.set_cache(cache_key, result)
                return result
            else:
                raise ValueError("No price data available")
                
        except Exception as e:
            logger.error(f"yfinance failed for {symbol}: {str(e)}")
            
            # Fallback to basic demo data
            result = {
                'symbol': symbol.upper(),
                'price': self.generate_realistic_price(symbol),
                'name': self.generate_company_name(symbol),
                'currency': 'USD',
                'last_updated': datetime.now().isoformat(),
                'source': 'fallback',
                'error': str(e)
            }
            
            # Cache fallback data for shorter duration
            self.set_cache(cache_key, result, duration=300)  # 5 minutes
            return result
    
    def get_crypto_price(self, symbol: str, force_refresh: bool = False) -> Dict:
        """Get cryptocurrency price from CoinGecko"""
        cache_key = f"crypto:{symbol.lower()}"
        
        if not force_refresh:
            cached = self.get_cached(cache_key)
            if cached:
                return cached
        
        try:
            # Map common symbols to CoinGecko IDs
            symbol_map = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'ADA': 'cardano',
                'SOL': 'solana',
                'DOT': 'polkadot',
                'LINK': 'chainlink',
                'MATIC': 'polygon',
                'AVAX': 'avalanche-2'
            }
            
            crypto_id = symbol_map.get(symbol.upper(), symbol.lower())
            
            url = f"{self.fallback_apis['coingecko']}/simple/price"
            params = {
                'ids': crypto_id,
                'vs_currencies': 'usd',
                'include_market_cap': 'true',
                'include_24hr_vol': 'true',
                'include_24hr_change': 'true'
            }
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if crypto_id in data:
                crypto_data = data[crypto_id]
                result = {
                    'symbol': symbol.upper(),
                    'price': crypto_data['usd'],
                    'name': crypto_id.replace('-', ' ').title(),
                    'currency': 'USD',
                    'market_cap': crypto_data.get('usd_market_cap'),
                    'volume_24h': crypto_data.get('usd_24h_vol'),
                    'change_24h': crypto_data.get('usd_24h_change'),
                    'last_updated': datetime.now().isoformat(),
                    'source': 'coingecko'
                }
                
                self.set_cache(cache_key, result)
                return result
            else:
                raise ValueError("Cryptocurrency not found")
                
        except Exception as e:
            logger.error(f"CoinGecko failed for {symbol}: {str(e)}")
            
            # Fallback data
            result = {
                'symbol': symbol.upper(),
                'price': self.generate_realistic_crypto_price(symbol),
                'name': symbol.capitalize(),
                'currency': 'USD',
                'last_updated': datetime.now().isoformat(),
                'source': 'fallback',
                'error': str(e)
            }
            
            self.set_cache(cache_key, result, duration=300)
            return result
    
    def generate_realistic_price(self, symbol: str) -> float:
        """Generate consistent realistic prices for unknown symbols"""
        hash_val = abs(hash(symbol))
        base_price = (hash_val % 490) + 10  # $10-500 range
        return round(base_price + (hash_val % 100) / 100, 2)
    
    def generate_realistic_crypto_price(self, symbol: str) -> float:
        """Generate realistic crypto prices"""
        hash_val = abs(hash(symbol))
        if symbol.upper() in ['BTC', 'BITCOIN']:
            return round(60000 + (hash_val % 10000), 2)
        elif symbol.upper() in ['ETH', 'ETHEREUM']:
            return round(2500 + (hash_val % 1000), 2)
        else:
            return round((hash_val % 100) + 1, 2)
    
    def generate_company_name(self, symbol: str) -> str:
        """Generate realistic company names"""
        prefixes = ['Advanced', 'Global', 'International', 'United', 'American', 'Digital']
        industries = ['Technology', 'Financial', 'Healthcare', 'Energy', 'Industrial', 'Consumer']
        suffixes = ['Corporation', 'Inc.', 'Ltd.', 'Group', 'Holdings', 'Systems']
        
        hash_val = abs(hash(symbol))
        prefix = prefixes[hash_val % len(prefixes)]
        industry = industries[(hash_val * 2) % len(industries)]
        suffix = suffixes[(hash_val * 3) % len(suffixes)]
        
        return f"{prefix} {industry} {suffix}"
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict]:
        """Search for symbols using yfinance"""
        try:
            # Use yfinance search functionality
            from yfinance import Ticker
            
            # For demo purposes, create a basic search
            # In production, you might want to use a dedicated search API
            common_symbols = [
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META',
                'SPY', 'QQQ', 'VTI', 'VOO', 'IWM', 'TLT', 'AGG',
                'BTC-USD', 'ETH-USD', 'ADA-USD'
            ]
            
            query_lower = query.lower()
            matches = []
            
            for symbol in common_symbols:
                if query_lower in symbol.lower():
                    try:
                        ticker = yf.Ticker(symbol)
                        info = ticker.info
                        
                        matches.append({
                            'symbol': symbol,
                            'name': info.get('longName', info.get('shortName', symbol)),
                            'exchange': info.get('exchange', 'NASDAQ'),
                            'currency': info.get('currency', 'USD'),
                            'type': self.classify_asset_type(info)
                        })
                        
                        if len(matches) >= limit:
                            break
                            
                    except Exception as e:
                        logger.warning(f"Could not get info for {symbol}: {e}")
                        continue
            
            return matches
            
        except Exception as e:
            logger.error(f"Symbol search failed: {e}")
            return []
    
    def classify_asset_type(self, info: Dict) -> str:
        """Classify asset type based on yfinance info"""
        quote_type = info.get('quoteType', '').upper()
        
        if quote_type == 'EQUITY':
            return 'Stock'
        elif quote_type == 'ETF':
            return 'ETF'
        elif quote_type == 'CRYPTOCURRENCY':
            return 'Crypto'
        elif 'BOND' in quote_type:
            return 'Bond'
        else:
            return 'Stock'  # Default fallback

# Initialize API instance
portfolio_api = EnhancedPortfolioAPI()

def rate_limit_required(f):
    """Decorator to enforce rate limiting"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_id = portfolio_api.get_client_id(request)
        if not portfolio_api.rate_limiter.is_allowed(client_id):
            return jsonify({
                'error': 'Rate limit exceeded',
                'message': 'Please wait before making more requests'
            }), 429
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Serve the main application"""
    return send_from_directory('..', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory('..', filename)

@app.route('/api/health')
def health_check():
    """API health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'cache_size': len(portfolio_api.cache)
    })

@app.route('/api/quote/<symbol>')
@rate_limit_required
def get_quote(symbol: str):
    """Get quote for a single symbol"""
    try:
        force_refresh = request.args.get('force', 'false').lower() == 'true'
        asset_type = request.args.get('type', 'stock').lower()
        
        if asset_type == 'crypto':
            data = portfolio_api.get_crypto_price(symbol, force_refresh)
        else:
            data = portfolio_api.get_stock_info(symbol, force_refresh)
        
        return jsonify({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        logger.error(f"Quote request failed for {symbol}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'symbol': symbol
        }), 400

@app.route('/api/quotes', methods=['POST'])
@rate_limit_required
def get_multiple_quotes():
    """Get quotes for multiple symbols (batch processing)"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        force_refresh = data.get('force', False)
        
        if not symbols or len(symbols) > 50:  # Limit batch size
            return jsonify({
                'success': False,
                'error': 'Invalid symbols list (max 50 symbols)'
            }), 400
        
        results = {}
        errors = {}
        
        for symbol_info in symbols:
            symbol = symbol_info.get('symbol')
            asset_type = symbol_info.get('type', 'stock').lower()
            
            try:
                if asset_type == 'crypto':
                    quote_data = portfolio_api.get_crypto_price(symbol, force_refresh)
                else:
                    quote_data = portfolio_api.get_stock_info(symbol, force_refresh)
                
                results[symbol] = quote_data
                
            except Exception as e:
                errors[symbol] = str(e)
                logger.error(f"Batch quote failed for {symbol}: {e}")
        
        return jsonify({
            'success': True,
            'data': results,
            'errors': errors,
            'processed': len(symbols),
            'successful': len(results)
        })
        
    except Exception as e:
        logger.error(f"Batch quotes request failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

@app.route('/api/search/<query>')
@rate_limit_required
def search_symbols(query: str):
    """Search for symbols"""
    try:
        limit = min(int(request.args.get('limit', 10)), 25)  # Max 25 results
        
        results = portfolio_api.search_symbols(query, limit)
        
        return jsonify({
            'success': True,
            'data': results,
            'query': query
        })
        
    except Exception as e:
        logger.error(f"Symbol search failed for {query}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'query': query
        }), 400

@app.route('/api/historical/<symbol>')
@rate_limit_required
def get_historical_data(symbol: str):
    """Get historical price data"""
    try:
        period = request.args.get('period', '1y')  # Default 1 year
        interval = request.args.get('interval', '1d')  # Default daily
        
        # Validate parameters
        valid_periods = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']
        valid_intervals = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo']
        
        if period not in valid_periods:
            period = '1y'
        if interval not in valid_intervals:
            interval = '1d'
        
        cache_key = f"hist:{symbol}:{period}:{interval}"
        cached = portfolio_api.get_cached(cache_key)
        if cached:
            return jsonify({
                'success': True,
                'data': cached,
                'cached': True
            })
        
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            raise ValueError("No historical data available")
        
        # Convert to JSON-serializable format
        hist_data = {
            'dates': [date.isoformat() for date in hist.index],
            'open': hist['Open'].tolist(),
            'high': hist['High'].tolist(),
            'low': hist['Low'].tolist(),
            'close': hist['Close'].tolist(),
            'volume': hist['Volume'].tolist(),
            'symbol': symbol.upper(),
            'period': period,
            'interval': interval
        }
        
        # Cache historical data for longer (1 hour for daily, less for intraday)
        cache_duration = 3600 if interval in ['1d', '5d', '1wk'] else 900
        portfolio_api.set_cache(cache_key, hist_data, cache_duration)
        
        return jsonify({
            'success': True,
            'data': hist_data,
            'cached': False
        })
        
    except Exception as e:
        logger.error(f"Historical data request failed for {symbol}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'symbol': symbol
        }), 400

@app.route('/api/exchange-rates')
@rate_limit_required
def get_exchange_rates():
    """Get current exchange rates"""
    cache_key = "exchange_rates"
    
    cached = portfolio_api.get_cached(cache_key)
    if cached:
        return jsonify({
            'success': True,
            'data': cached,
            'cached': True
        })
    
    try:
        response = portfolio_api.session.get(portfolio_api.fallback_apis['exchangerate'], timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        result = {
            'base': data['base'],
            'rates': data['rates'],
            'last_updated': datetime.now().isoformat()
        }
        
        # Cache exchange rates for 1 hour
        portfolio_api.set_cache(cache_key, result, duration=3600)
        
        return jsonify({
            'success': True,
            'data': result,
            'cached': False
        })
        
    except Exception as e:
        logger.error(f"Exchange rates request failed: {e}")
        
        # Fallback exchange rates
        fallback_rates = {
            'base': 'USD',
            'rates': {
                'USD': 1.0,
                'EUR': 0.85,
                'GBP': 0.75,
                'DKK': 6.9,
                'SEK': 10.8,
                'NOK': 11.2
            },
            'last_updated': datetime.now().isoformat(),
            'source': 'fallback'
        }
        
        return jsonify({
            'success': True,
            'data': fallback_rates,
            'cached': False
        })

@app.route('/api/stats')
def get_api_stats():
    """Get API usage statistics"""
    return jsonify({
        'cache_size': len(portfolio_api.cache),
        'cache_keys': list(portfolio_api.cache.keys())[:10],  # First 10 for privacy
        'uptime': time.time(),
        'endpoints': {
            'quote': '/api/quote/<symbol>',
            'quotes': '/api/quotes (POST)',
            'search': '/api/search/<query>',
            'historical': '/api/historical/<symbol>',
            'exchange_rates': '/api/exchange-rates'
        }
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting Enhanced Portfolio API on port {port}")
    logger.info(f"Debug mode: {debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)