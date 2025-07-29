import { useEffect, useState } from 'react';
import './App.css';
import ThemeSwitcher from './components/ThemeSwitcher';

interface Quote {
  asset: string;
  strike: number;
  expiry: number;
  premium: number | null; // Only real scraped premiums from Rysk, null if not found
  apr: number;
  spotPrice: number;
  timeToExpiry: number;
  riskFreeRate: number;
  volatility: number;
  theoreticalApr?: number;
  excessApr?: number;
}

function App() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');

  const fetchQuotesWithTheoreticalAPR = async () => {
    const isInitialLoad = quotes.length === 0;
    if (isInitialLoad) {
      setLoading(true);
      setLoadingProgress(0);
      setLoadingMessage('Fetching market data...');
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // Step 1: Fetch quotes
      if (isInitialLoad) {
        setLoadingProgress(20);
        setLoadingMessage('Connecting to Rysk API...');
      }
      
      const quotesResponse = await fetch('/api/quotes');

      if (!quotesResponse.ok) {
        const errorData = await quotesResponse.json();
        throw new Error(errorData.message || 'Failed to fetch live market data');
      }

      const quotesData = await quotesResponse.json();
      const quotesArray = Array.isArray(quotesData) ? quotesData : quotesData.quotes || [];

      if (quotesArray.length === 0) {
        setError('No live market data available - all assets missing critical data (spot prices, volatilities, etc.)');
        setQuotes([]);
        return;
      }

      if (isInitialLoad) {
        setLoadingProgress(40);
        setLoadingMessage(`Processing ${quotesArray.length} positions...`);
      }

      // Process quotes in smaller batches to avoid blocking the UI
      const batchSize = 3;
      const quotesWithTheoreticalAPR: Quote[] = [];
      const totalBatches = Math.ceil(quotesArray.length / batchSize);
      
      for (let i = 0; i < quotesArray.length; i += batchSize) {
        const batch = quotesArray.slice(i, i + batchSize);
        const batchIndex = Math.floor(i / batchSize);
        
        if (isInitialLoad) {
          const progress = 40 + (batchIndex / totalBatches) * 50;
          setLoadingProgress(Math.round(progress));
          setLoadingMessage(`Calculating theoretical APRs... (${batchIndex + 1}/${totalBatches})`);
        }
        
        const processedBatch = await Promise.all(
          batch.map(async (quote: Quote) => {
            if (quote.spotPrice === null || quote.volatility === null) {
              return { ...quote, theoreticalApr: null, excessApr: null };
            }

            try {
              const theoreticalResponse = await fetch(
                `/api/theoretical_apr?s=${quote.spotPrice}&k=${quote.strike}&t=${quote.timeToExpiry}&r=${quote.riskFreeRate}&sigma=${quote.volatility}`
              );
              const theoreticalData = await theoreticalResponse.json();
              const theoreticalApr = theoreticalData.theoreticalApr || 0;
              const excessApr = quote.apr - theoreticalApr;
              return { ...quote, theoreticalApr, excessApr };
            } catch (error) {
              console.warn(`Failed to calculate theoretical APR for ${quote.asset}:`, error);
              return { ...quote, theoreticalApr: null, excessApr: null };
            }
          })
        );
        
        quotesWithTheoreticalAPR.push(...processedBatch);
        
        // Allow UI to update between batches - use requestAnimationFrame for smoother updates
        if (i + batchSize < quotesArray.length) {
          await new Promise(resolve => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 5); // Reduced from 10ms for faster loading
            });
          });
        }
      }

      if (isInitialLoad) {
        setLoadingProgress(95);
        setLoadingMessage('Finalizing dashboard...');
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 200));
        setLoadingProgress(100);
      }

      setQuotes(quotesWithTheoreticalAPR);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('Error:', err);
      setQuotes([]);
    } finally {
      if (isInitialLoad) {
        // Small delay to show 100% completion before hiding
        setTimeout(() => {
          setLoading(false);
        }, 300);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // Use requestAnimationFrame to ensure theme switcher renders immediately
    requestAnimationFrame(() => {
      // Small delay to let the UI render first
      setTimeout(() => {
        fetchQuotesWithTheoreticalAPR();
      }, 100);
    });
  }, []);

  // Group quotes by asset
  const groupedQuotes = quotes.reduce((acc, quote) => {
    if (!acc[quote.asset]) {
      acc[quote.asset] = [];
    }
    acc[quote.asset].push(quote);
    return acc;
  }, {} as Record<string, Quote[]>);

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatExcessAPR = (value: number) => {
    const percentage = (value * 100).toFixed(1);
    return value > 0 ? `+${percentage} pp` : `${percentage} pp`;
  };



  const formatStrike = (strike: number | null, asset: string) => {
    if (strike === null) return 'N/A';
    if (asset === 'UBTC' || asset === 'UETH') {
      return `${strike.toLocaleString()}`;
    }
    return `${strike.toFixed(4)}`;
  };

  const formatPremium = (premium: number | null) => {
    if (premium === null) return 'N/A';
    return premium > 1 ? `${premium.toFixed(2)}` : `${premium.toFixed(4)}`;
  };

  const formatSpotPrice = (price: number | null, asset: string) => {
    if (price === null) return 'N/A';
    if (asset === 'UBTC' || asset === 'UETH') {
      return `${price.toLocaleString()}`;
    }
    return `${price.toFixed(4)}`;
  };

  const formatVolatility = (vol: number | null) => {
    return vol !== null ? `${(vol * 100).toFixed(1)}%` : 'N/A';
  };



  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Rysk APR Monitor
            </h1>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">No Live Data Available</h2>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left">
                <h3 className="text-gray-900 dark:text-white font-medium mb-3">Required Data Sources:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span><strong>Rysk V12</strong> (app.rysk.finance) - for covered call APRs</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span><strong>CoinGecko API</strong> - for spot prices</span>
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                    <span><strong>Deribit API</strong> - for implied volatilities</span>
                  </li>
                </ul>
              </div>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-3 border-white border-t-transparent"></div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Loading Dashboard
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {loadingMessage}
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {loadingProgress}% complete
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Rysk APR Monitor
              </h1>
              <p className="text-gray-400 text-sm">Real-time APR monitoring</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {isRefreshing && (
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent"></div>
                <span>Updating...</span>
              </div>
            )}
            <button 
              onClick={fetchQuotesWithTheoreticalAPR}
              disabled={loading || isRefreshing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isRefreshing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
            </button>
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Legend */}
        <div className="bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 rounded-lg p-4 mb-6">
          <h3 className="text-white font-medium mb-2">How to Read This Data</h3>
          <div className="grid md:grid-cols-3 gap-2 text-xs">
            <div className="text-green-400">
              <strong>Green:</strong> Better valued income
            </div>
            <div className="text-yellow-400">
              <strong>Yellow:</strong> Fair pricing (±2pp)
            </div>
            <div className="text-red-400">
              <strong>Red:</strong> Poor pricing for sellers
            </div>
          </div>
        </div>

        {/* Asset Cards */}
        <div className="space-y-6">
          {Object.entries(groupedQuotes).map(([asset, assetQuotes]) => {
            const spotPrice = assetQuotes[0]?.spotPrice;
            const volatility = assetQuotes[0]?.volatility;
            const expiry = assetQuotes[0]?.expiry;
            
            return (
              <div key={asset} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                {/* Asset Header */}
                <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 p-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="mb-2 lg:mb-0">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{asset}</h2>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">Covered Call Options</p>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      Spot: {formatSpotPrice(spotPrice, asset)} | 
                      Vol: {formatVolatility(volatility)} | 
                      Expiry: {expiry ? new Date(expiry * 1000).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
                
                {/* Options Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                        <th className="py-3 px-4 text-left text-gray-700 dark:text-gray-300 font-semibold">Strike</th>
                        <th className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-semibold">Premium</th>
                        <th className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-semibold">Rysk APR</th>
                        <th className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-semibold">Theo APR</th>
                        <th className="py-3 px-4 text-right text-gray-700 dark:text-gray-300 font-semibold">Δ Excess</th>
                        <th className="py-3 px-4 text-center text-gray-700 dark:text-gray-300 font-semibold">Moneyness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetQuotes.map((quote, index) => {
                        const moneyness = quote.spotPrice ? quote.strike / quote.spotPrice : null;
                        const moneynessLabel = moneyness === null ? 'N/A' : 
                          moneyness > 1.05 ? 'OTM' : moneyness < 0.95 ? 'ITM' : 'ATM';
                        const moneynessColor = moneyness === null ? 'text-gray-400 dark:text-gray-500' :
                          moneyness > 1.05 ? 'text-blue-600 dark:text-blue-400' : moneyness < 0.95 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300';
                        
                        const getExcessAPRColorClean = (value: number) => {
                          if (value > 0.02) return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900';
                          if (value > 0) return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-800';
                          if (value > -0.02) return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900';
                          return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900';
                        };
                        
                        const excessAprColor = quote.excessApr !== null && quote.excessApr !== undefined ? 
                          getExcessAPRColorClean(quote.excessApr) : 'text-gray-400 dark:text-gray-500';
                        
                        return (
                          <tr key={index} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <td className="py-3 px-4">
                              <div className="text-gray-900 dark:text-white font-semibold">{formatStrike(quote.strike, asset)}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="text-gray-700 dark:text-gray-300 font-mono">{formatPremium(quote.premium)}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="text-blue-600 dark:text-blue-400 font-bold">{formatPercentage(quote.apr)}</div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="text-gray-700 dark:text-gray-300">
                                {quote.theoreticalApr !== null && quote.theoreticalApr !== undefined ? 
                                  formatPercentage(quote.theoreticalApr) : 
                                  <span className="text-gray-400 dark:text-gray-500">—</span>
                                }
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className={`inline-flex items-center px-2 py-1 rounded text-sm font-semibold ${excessAprColor}`}>
                                {quote.excessApr !== null && quote.excessApr !== undefined ? 
                                  formatExcessAPR(quote.excessApr) : 
                                  '—'
                                }
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className={`inline-flex flex-col items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 ${moneynessColor}`}>
                                <span className="font-semibold text-xs">{moneynessLabel}</span>
                                <span className="text-xs opacity-75">
                                  {moneyness !== null ? `${(moneyness * 100).toFixed(0)}%` : '—'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
            <h4 className="text-gray-900 dark:text-white font-medium mb-2">Data Sources & Assumptions</h4>
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div><strong>Rysk APRs:</strong> Live data from Rysk V12 (app.rysk.finance)</div>
              <div><strong>Theoretical APRs:</strong> Black-Scholes model with asset-specific volatilities</div>
              <div><strong>Risk-free rate:</strong> 4% (US Treasury rate approximation)</div>
              <div><strong>Contract size:</strong> 0.5 (as per Rysk specification)</div>
              <div><strong>Expiry:</strong> Aug 29, 2025 ({Math.ceil((new Date('2025-08-29').getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
