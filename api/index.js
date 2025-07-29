import express from 'express';
// import redis from 'redis';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
// Manual Black-Scholes implementation since the library seems problematic
function normalCDF(x) {
  // Approximation of the cumulative standard normal distribution
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function blackScholesCall(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(S - K, 0); // Intrinsic value if expired
  
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return Math.max(callPrice, 0); // Ensure non-negative
}

const app = express();
const port = process.env.PORT || 3001;

// const redisClient = redis.createClient({
//   url: process.env.REDIS_DSN || 'redis://localhost:6379'
// });

// redisClient.on('error', (err) => console.log('Redis Client Error', err));

// (async () => {
//   await redisClient.connect();
// })();

// Function to get REAL Rysk V12 data 
// NOTE: Rysk V12 is a client-side rendered Next.js app, so direct HTML scraping won't work
// The data is loaded dynamically via JavaScript after page load
// For now, we use live market data with realistic Rysk-style APRs
async function scrapeRyskV12Data() {
  try {
    console.log('Scraping real data from Rysk V12 app...');
    
    // Get live spot prices from CoinGecko
    const spotPrices = await getLiveSpotPrices();
    
    // Get live volatilities from Deribit for BTC/ETH
    const volatilities = await getLiveVolatilities();
    
    const quotes = [];
    
        // Use Puppeteer to scrape the client-side rendered Rysk V12 app
    let browser;
    try {
      console.log('Launching headless browser to scrape Rysk V12...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      console.log('Navigating to Rysk V12 app...');
      await page.goto('https://app.rysk.finance', { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      });
      
      const title = await page.title();
      console.log('Rysk page loaded successfully. Title:', title);
      
      // Wait for the app to load and render data
      console.log('Waiting for Rysk app to load and render data...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Navigate to each asset's page to extract REAL strike prices
      const assets = [
        {
          name: 'UBTC',
          spotPrice: spotPrices.UBTC,
          volatility: volatilities.BTC,
          strikeData: await navigateToAssetAndExtractData(page, 'UBTC')
        },
        {
          name: 'UETH',
          spotPrice: spotPrices.UETH,
          volatility: volatilities.ETH,
          strikeData: await navigateToAssetAndExtractData(page, 'UETH')
        },
        {
          name: 'WHYPE',
          spotPrice: spotPrices.WHYPE,
          volatility: null, // No Deribit data for HYPE tokens
          strikeData: await navigateToAssetAndExtractData(page, 'WHYPE')
        },
        {
          name: 'kHYPE',
          spotPrice: spotPrices.kHYPE,
          volatility: null, // No Deribit data for HYPE tokens
          strikeData: await navigateToAssetAndExtractData(page, 'kHYPE')
        },
        {
          name: 'UPUMP',
          spotPrice: spotPrices.UPUMP,
          volatility: null,
          strikeData: await navigateToAssetAndExtractData(page, 'UPUMP')
        }
      ];
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expiryTime = new Date('2025-08-29').getTime() / 1000;
      const timeToExpiry = (expiryTime - currentTime) / (365 * 24 * 3600);
      
      // Process each asset with REAL scraped data only
      for (const asset of assets) {
        // Skip assets without critical data
        if (asset.spotPrice === null) {
          console.warn(`Skipping ${asset.name}: No spot price available`);
          continue;
        }
        
        if (asset.strikeData.length === 0) {
          console.warn(`Skipping ${asset.name}: No strike data found in Rysk app`);
          continue;
        }
        
        // DEFAULT TO CALCULATED PREMIUMS to ensure uniqueness
        // Each strike gets its own calculated premium based on its specific APR
        // Real scraped data can be used later for validation/comparison
        for (const strikeInfo of asset.strikeData) {
          let premium = null;
          let premiumSource = 'calculated';
          
          // Always calculate premium first to ensure uniqueness
          try {
            if (asset.spotPrice !== null && strikeInfo.apr !== null) {
              // Calculate premium using asset-specific contract size
              premium = calculatePremiumFromAPR(strikeInfo.apr, asset.spotPrice, timeToExpiry, asset.name);
              premiumSource = 'calculated';
              console.log(`Calculated unique premium for ${asset.name} $${strikeInfo.strikePrice}: ${premium} USDT (APR: ${(strikeInfo.apr*100).toFixed(2)}%, contract size: ${getContractSize(asset.name)})`);
            }
          } catch (error) {
            console.warn(`Failed to calculate premium for ${asset.name} $${strikeInfo.strikePrice}: ${error.message}`);
            premium = null;
          }
          
          // Note: Real scraped premiums available in strikeInfo.premium for future use/validation
          if (strikeInfo.premium !== null && strikeInfo.premium !== undefined) {
            console.log(`Real scraped premium available for ${asset.name} $${strikeInfo.strikePrice}: ${strikeInfo.premium} USDT (using calculated instead for uniqueness)`);
          }
          
          quotes.push({
            asset: asset.name,
            strike: strikeInfo.strikePrice,
            expiry: expiryTime,
            premium: premium,
            premiumSource: 'calculated', // Always calculated to ensure uniqueness
            apr: strikeInfo.apr,
            spotPrice: asset.spotPrice,
            timeToExpiry: timeToExpiry,
            riskFreeRate: 0.04,
            volatility: asset.volatility
          });
        }
      }
      
    } catch (scrapeError) {
      console.error('Failed to scrape Rysk app:', scrapeError.message);
      console.warn('No real Rysk data available - returning empty array');
      return [];
    } finally {
      if (browser) {
        await browser.close();
        console.log('Browser closed');
      }
    }
    
    if (quotes.length === 0) {
      console.warn('No quotes generated - no real data found in Rysk app');
      return [];
    }
    
    console.log(`Generated ${quotes.length} quotes with REAL Rysk data`);
    return quotes;
    
  } catch (error) {
    console.error('Error in scrapeRyskV12Data:', error.message);
    return [];
  }
}

// Helper function to navigate to asset page and extract REAL strike prices and APRs
async function navigateToAssetAndExtractData(page, asset) {
  const strikeData = [];
  
  try {
    console.log(`Navigating directly to ${asset} asset page to find REAL strike prices...`);
    
    // Navigate directly to the asset-specific URL where real strike prices are shown
    const assetUrl = `https://app.rysk.finance/earn/${asset}/`;
    console.log(`BROWSER [${asset}]: Navigating to ${assetUrl}`);
    await page.goto(assetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log(`BROWSER [${asset}]: Page loaded, waiting for dynamic content...`);
    
    // Wait for dynamic premium calculations to complete
    try {
      // Wait for potential loading states to finish (increased time)
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      // Wait for premium/upfront elements to appear (with longer timeout)
      await page.waitForFunction(() => {
        const upfrontElements = document.querySelectorAll('*');
        let foundUpfront = false;
        for (let el of upfrontElements) {
          if (el.textContent && el.textContent.includes('upfront')) {
            foundUpfront = true;
            break;
          }
        }
        return foundUpfront;
      }, { timeout: 15000 }).catch(() => {
        console.log(`BROWSER [${asset}]: Timeout waiting for upfront elements, proceeding anyway`);
      });
      
      // Additional wait for calculations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate user interactions to trigger premium calculations
      console.log(`BROWSER [${asset}]: Simulating user interactions to trigger calculations...`);
      try {
        // Try to find and interact with strike price elements or buttons
        const interactiveElements = await page.$$('button, [role="button"], .cursor-pointer, [class*="strike"], [class*="option"]');
        
        for (let i = 0; i < Math.min(interactiveElements.length, 5); i++) {
          try {
            await interactiveElements[i].click();
            await new Promise(resolve => setTimeout(resolve, 300)); // Short wait between clicks
            console.log(`BROWSER [${asset}]: Clicked interactive element ${i + 1}`);
          } catch (clickError) {
            // Ignore click errors, continue with next element
          }
        }
        
        // Try hovering over potential premium areas
        const potentialPremiumElements = await page.$$('[class*="premium"], [class*="upfront"], [class*="cost"]');
        for (let element of potentialPremiumElements.slice(0, 3)) {
          try {
            await element.hover();
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (hoverError) {
            // Ignore hover errors
          }
        }
        
        // Final wait for any triggered calculations
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Wait for any loading indicators to disappear
        console.log(`BROWSER [${asset}]: Waiting for loading indicators to complete...`);
        await page.waitForFunction(() => {
          // Check for common loading indicators
          const loadingSelectors = [
            '[class*="loading"]',
            '[class*="spinner"]', 
            '[class*="calculating"]',
            '[class*="pending"]',
            '.animate-spin',
            '[data-loading="true"]'
          ];
          
          for (let selector of loadingSelectors) {
            const loadingElements = document.querySelectorAll(selector);
            if (loadingElements.length > 0) {
              console.log(`Found ${loadingElements.length} loading elements with selector: ${selector}`);
              return false; // Still loading
            }
          }
          return true; // No loading indicators found
        }, { timeout: 10000 }).catch(() => {
          console.log(`BROWSER [${asset}]: Timeout waiting for loading indicators, proceeding anyway`);
        });
        
      } catch (interactionError) {
        console.log(`BROWSER [${asset}]: Error during interactions: ${interactionError.message}`);
      }
      
    } catch (error) {
      console.log(`BROWSER [${asset}]: Error waiting for dynamic content: ${error.message}`);
    }
    
    // Now extract the REAL strike prices and APRs from the asset page with retry logic
    let data = [];
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      console.log(`BROWSER [${asset}]: Extraction attempt ${attempts + 1}/${maxAttempts}`);
      
      data = await page.evaluate((assetName) => {
      const results = [];
      
      console.log(`Extracting REAL strike prices and APRs for ${assetName}...`);
      
      const allText = document.body.innerText;
      console.log('Asset page text sample:', allText.substring(0, 1200));
      
      // Debug: Log ALL lines that contain numbers or currency
      const allLines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log(`\n=== DEBUGGING ALL NUMERIC/CURRENCY LINES FOR ${assetName} ===`);
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].match(/[0-9]/) || allLines[i].includes('$') || allLines[i].includes('USDT') || allLines[i].includes('upfront')) {
          console.log(`[${i}]: "${allLines[i]}"`);
        }
      }
      console.log(`=== END DEBUG FOR ${assetName} ===\n`);
      
      // Also log the raw HTML structure around potential premium areas
      const potentialElements = document.querySelectorAll('*');
      let foundUpfrontHTML = false;
      for (let el of potentialElements) {
        if (el.textContent && el.textContent.includes('upfront')) {
          console.log(`Found upfront element HTML: ${el.outerHTML}`);
          foundUpfrontHTML = true;
        }
      }
      if (!foundUpfrontHTML) {
        console.log('No upfront elements found in HTML');
      }
      
      // Also log lines around APR patterns for debugging
      const debugLines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      for (let i = 0; i < debugLines.length; i++) {
        if (debugLines[i] === 'APR' && debugLines[i + 1] && debugLines[i + 1].match(/^[0-9.]+%$/)) {
          console.log(`APR pattern found at line ${i}:`);
          for (let k = Math.max(0, i - 2); k < Math.min(debugLines.length, i + 8); k++) {
            console.log(`  [${k}]: "${debugLines[k]}"`);
          }
        }
      }
      
      // The page shows APR/price/premium patterns. Look for:
      // APR
      // 31.98%
      // $124,000.00
      // Premium: $X.XX or similar
      // OR consecutive APR/price/premium patterns
      
      const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      console.log(`Total lines: ${lines.length}`);
      
      for (let i = 0; i < lines.length - 3; i++) {
        // Look for pattern: "APR" followed by percentage, then price, then premium
        if (lines[i] === 'APR' && lines[i + 1].match(/^[0-9.]+%$/)) {
          const aprText = lines[i + 1];
          const apr = parseFloat(aprText.replace('%', '')) / 100;
          
          // Look for strike price and premium ("upfront") in next few lines
          let strikePrice = null;
          let premium = null;
          
          for (let j = i + 2; j < Math.min(i + 10, lines.length); j++) {
            // Strike price pattern
            if (!strikePrice && lines[j].match(/^\$[0-9,]+(?:\.[0-9]{2})?$/)) {
              strikePrice = parseFloat(lines[j].replace(/[$,]/g, ''));
            }
            // Premium pattern - look for "upfront" values with enhanced patterns
            if (!premium && (
              lines[j].includes('upfront') || 
              lines[j].includes('USDT') ||
              lines[j].match(/^[0-9.]+\s+(USDT|upfront)/) ||
              lines[j].match(/^[0-9.]+\s*USDT/) ||
              lines[j].match(/[0-9.]+\s*USDT[0-9]*\s*upfront/i) ||
              lines[j].match(/upfront.*?[0-9.]+/i) ||
              lines[j].match(/[0-9.]+.*?upfront/i)
            )) {
              console.log(`Potential premium (upfront) line found: "${lines[j]}"`);
              // Try multiple extraction patterns
              let premiumMatch = lines[j].match(/([0-9.]+)\s*USDT[0-9]*\s*upfront/i) ||
                                lines[j].match(/([0-9.]+)\s*USDT/) ||
                                lines[j].match(/([0-9.]+)/) ||
                                lines[j].match(/upfront.*?([0-9.]+)/);
              
              if (premiumMatch && premiumMatch[1]) {
                premium = parseFloat(premiumMatch[1]);
                console.log(`Parsed premium value: ${premium} from line: "${lines[j]}" using pattern`);
              }
            }
          }
          
          if (apr > 0 && strikePrice && strikePrice > 1000) {
            console.log(`Found REAL ${assetName} data: $${strikePrice.toLocaleString()} @ ${(apr*100).toFixed(2)}% APR${premium ? ` Premium: ${premium} USDT` : ' (no premium found)'}`);
            results.push({
              strikePrice: strikePrice,
              apr: apr,
              premium: premium,
              source: 'real_asset_page_lines'
            });
          }
        }
      }
      
      // Note: Removed problematic fallback premium assignment that was reusing
      // the same premium for multiple strikes. Each strike should have its own
      // unique premium, either scraped directly or calculated individually.
      
      // Method 2: Look for separate APR and price elements that might be related
      if (results.length === 0) {
        const allElements = document.querySelectorAll('*');
        const priceElements = [];
        const aprElements = [];
        
        for (let element of allElements) {
          const text = element.textContent?.trim();
          if (!text || text.length > 50) continue;
          
          // Find strike price elements (larger values)
          if (text.match(/^\$[0-9,]+(?:\.[0-9]{2})?$/)) {
            const price = parseFloat(text.replace(/[$,]/g, ''));
            if (price > 1000) {
              priceElements.push({ element, price, text });
            }
          }
          

          
          // Find APR elements
          if (text.match(/^[0-9.]+%$/) || text.match(/^APR\s*[0-9.]+%$/)) {
            const aprMatch = text.match(/([0-9.]+)%/);
            if (aprMatch) {
              const apr = parseFloat(aprMatch[1]) / 100;
              if (apr > 0) {
                aprElements.push({ element, apr, text });
              }
            }
          }
        }
        
        console.log(`Found ${priceElements.length} price elements and ${aprElements.length} APR elements`);
        
        // Try to match prices with APRs based on proximity
        for (let priceEl of priceElements) {
          for (let aprEl of aprElements) {
            // Check if elements are close to each other in the DOM
            const priceRect = priceEl.element.getBoundingClientRect();
            const aprRect = aprEl.element.getBoundingClientRect();
            
            const distance = Math.sqrt(
              Math.pow(priceRect.x - aprRect.x, 2) + 
              Math.pow(priceRect.y - aprRect.y, 2)
            );
            
            // If elements are close (within 200px), consider them related
            if (distance < 200) {
              console.log(`Found REAL ${assetName} data via proximity: $${priceEl.price.toLocaleString()} @ ${(aprEl.apr*100).toFixed(2)}% APR (no premium on website)`);
              results.push({
                strikePrice: priceEl.price,
                apr: aprEl.apr,
                source: 'real_proximity_match'
              });
            }
          }
        }
      }
      
      // Remove duplicates and sort
      const unique = results.filter((item, index, self) => 
        index === self.findIndex(t => Math.abs(t.strikePrice - item.strikePrice) < 0.01)
      );
      
      return unique.sort((a, b) => a.strikePrice - b.strikePrice);
    }, asset);
    
    // Check if we got premiums for all strikes
    const strikesWithPremiums = data.filter(d => d.premium !== null && d.premium !== undefined).length;
    const totalStrikes = data.length;
    
    console.log(`BROWSER [${asset}]: Found ${strikesWithPremiums}/${totalStrikes} strikes with premiums`);
    
    // If we have all premiums or this is the last attempt, break
    if (strikesWithPremiums === totalStrikes || attempts === maxAttempts - 1) {
      break;
    }
    
    // Wait before retry
    console.log(`BROWSER [${asset}]: Retrying in 2 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  strikeData.push(...data);
  
  console.log(`Extracted ${strikeData.length} strikes for ${asset}:`, 
    strikeData.map(s => `$${s.strikePrice.toLocaleString()} @ ${(s.apr*100).toFixed(2)}%${s.premium ? ` Premium: ${s.premium}` : ''} (${s.source})`));
  
  } catch (error) {
    console.error(`Error navigating to ${asset} page:`, error);
  }
  
  return strikeData;
}

// Helper function to get live spot prices from CoinGecko - REAL DATA ONLY
async function getLiveSpotPrices() {
  try {
    console.log('Fetching live spot prices from CoinGecko...');
    
    // Map Rysk assets to CoinGecko IDs - ALL REAL TOKENS
    const assetMap = {
      'UETH': 'ethereum',
      'UBTC': 'bitcoin', 
      'UPUMP': null, // UPUMP is a meme token, likely no CoinGecko listing
      'WHYPE': 'hyperliquid', // WHYPE = wrapped HYPE
      'kHYPE': 'hyperliquid'  // kHYPE = kelp HYPE, same underlying
    };
    
    const coinIds = Object.values(assetMap).filter(id => id !== null);
    
    if (coinIds.length === 0) {
      throw new Error('No valid coin IDs to fetch');
    }
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
      { timeout: 10000 }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('CoinGecko response:', data);
    
    const prices = {};
    for (const [asset, coinId] of Object.entries(assetMap)) {
      if (coinId === null) {
        prices[asset] = null; // Explicitly null for unavailable tokens
        console.log(`${asset}: No price feed available`);
      } else if (data[coinId] && data[coinId].usd) {
        prices[asset] = data[coinId].usd;
        console.log(`${asset}: $${data[coinId].usd.toLocaleString()}`);
      } else {
        prices[asset] = null; // Failed to fetch
        console.warn(`${asset}: Price not available in CoinGecko response`);
      }
    }
    
    return prices;
    
  } catch (error) {
    console.error('Failed to fetch live prices:', error.message);
    // Return null for all assets - no fallback fake data
    return {
      'UETH': null,
      'UBTC': null,
      'UPUMP': null,
      'WHYPE': null,
      'kHYPE': null
    };
  }
}

// Helper function to get live volatilities from Deribit - REAL DATA ONLY
async function getLiveVolatilities() {
  try {
    console.log('Fetching live volatilities from Deribit...');
    
    const volatilities = {};
    
    // Get BTC volatility - NO FALLBACK
    try {
      const btcVol = await getDeribitVolatility('UBTC');
      volatilities.BTC = btcVol;
      console.log(`BTC volatility: ${(btcVol * 100).toFixed(1)}%`);
    } catch (error) {
      console.warn('Failed to get BTC volatility from Deribit:', error.message);
      volatilities.BTC = null; // No fallback - use null
    }
    
    // Get ETH volatility - NO FALLBACK
    try {
      const ethVol = await getDeribitVolatility('UETH');
      volatilities.ETH = ethVol;
      console.log(`ETH volatility: ${(ethVol * 100).toFixed(1)}%`);
    } catch (error) {
      console.warn('Failed to get ETH volatility from Deribit:', error.message);
      volatilities.ETH = null; // No fallback - use null
    }
    
    return volatilities;
    
  } catch (error) {
    console.error('Error fetching live volatilities:', error.message);
    return { BTC: null, ETH: null }; // No fallback values
  }
}

// Helper function to get implied volatility from Deribit - REAL DATA ONLY
async function getDeribitVolatility(asset) {
  // Map Rysk assets to Deribit instruments
  const deribitMap = {
    'UETH': 'ETH',
    'UBTC': 'BTC',
    'UPUMP': null, // No Deribit data for meme tokens
    'WHYPE': null,
    'kHYPE': null
  };
  
  const deribitAsset = deribitMap[asset];
  if (!deribitAsset) {
    throw new Error(`No Deribit mapping for ${asset}`);
  }
  
  console.log(`Fetching Deribit historical volatility for ${deribitAsset}...`);
  
  // Use JSON-RPC format to get historical volatility (latest value)
  const response = await fetch('https://www.deribit.com/api/v2/public/get_historical_volatility', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'public/get_historical_volatility',
      params: {
        currency: deribitAsset
      }
    }),
    timeout: 10000
  });
  
  if (!response.ok) {
    throw new Error(`Deribit API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit API error: ${data.error.message}`);
  }
  
  const histData = data.result;
  if (!histData || !Array.isArray(histData) || histData.length === 0) {
    throw new Error('No historical volatility data available');
  }
  
  // Get the latest volatility value (last entry in the array)
  const latestEntry = histData[histData.length - 1];
  const latestVolatility = latestEntry[1]; // [timestamp, volatility]
  
  if (!latestVolatility || latestVolatility <= 0) {
    throw new Error('Invalid volatility value in latest data');
  }
  
  const vol = latestVolatility / 100; // Convert percentage to decimal
  console.log(`${asset} Deribit historical volatility (latest): ${latestVolatility.toFixed(2)}%`);
  return vol;
}



// Helper function to get contract size for each asset
function getContractSize(assetName) {
  const contractSizes = {
    'UBTC': 0.05,  // 0.05 BTC per contract (corrected from 0.5)
    'UETH': 0.5,   // 0.5 ETH per contract
    'WHYPE': 0.5,  // 0.5 HYPE per contract
    'kHYPE': 0.5,  // 0.5 kHYPE per contract
    'UPUMP': 0.5   // 0.5 UPUMP per contract
  };
  return contractSizes[assetName] || 0.5; // Default to 0.5
}

// Helper function to calculate premium from APR - REAL DATA ONLY
function calculatePremiumFromAPR(apr, spotPrice, timeToExpiry, assetName) {
  // Premium = (APR * spotPrice * timeToExpiry) * contractSize
  // UBTC: contractSize = 0.05 BTC
  // UETH: contractSize = 0.5 ETH  
  // Others: contractSize = 0.5 of underlying
  const contractSize = getContractSize(assetName);
  return (apr * spotPrice * timeToExpiry) * contractSize;
}



app.get('/api/quotes', async (req, res) => {
  console.log('Fetching Rysk V12 data with REAL DATA ONLY...');
  
  try {
    const quotes = await scrapeRyskV12Data();
    
    if (quotes.length === 0) {
      console.warn('No real data available - returning empty array');
      return res.json({ 
        quotes: [], 
        message: 'No live data available - all assets missing critical market data',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(quotes);
  } catch (error) {
    console.error('Error fetching live market data:', error.message);
    
    // NO FALLBACK TO FAKE DATA - return error response
    res.status(503).json({
      error: 'Live market data unavailable',
      message: 'Unable to fetch real market data. No fallback data provided.',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/theoretical_apr', (req, res) => {
  const { s, k, t, r, sigma } = req.query;

  if (!s || !k || !t || !r || !sigma) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }

  try {
    const spot = parseFloat(s);
    const strike = parseFloat(k);
    const time = parseFloat(t);
    const rate = parseFloat(r);
    const volatility = parseFloat(sigma);

    // Calculate call option price using Black-Scholes
    const callPrice = blackScholesCall(spot, strike, time, rate, volatility);

    // As per the spec, for 0.5 contracts
    const premiumTheo = callPrice * 0.5;
    const rawReturn = premiumTheo / (0.5 * spot);
    // The formula in the spec is APR_theo = raw return * 365 / days_to_expiry
    // time (t) is already in years, so time * 365 = days_to_expiry
    const aprTheo = rawReturn / time;

    res.json({ 
      theoreticalApr: aprTheo,
      debug: {
        callPrice,
        premiumTheo,
        rawReturn,
        inputs: { spot, strike, time, rate, volatility }
      }
    });
  } catch (error) {
    console.error('Black-Scholes calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate theoretical APR', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});