# Rysk APR Monitor Dashboard

> Real-time analytics dashboard comparing Rysk's income premium APRs vs theoretical Black-Scholes APRs to identify mispriced income. Although the instruments may be mispriced it is not a guarantee of arbitrage opportunities.

![Dashboard Preview](https://img.shields.io/badge/Status-Live-brightgreen) ![React](https://img.shields.io/badge/React-19.1.0-blue) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)

## 🎯 Overview

The Rysk APR Monitor Dashboard is a professional financial analytics tool that:

- **Scrapes live data** from Rysk V12 (app.rysk.finance) using Puppeteer
- **Fetches real market data** from CoinGecko (spot prices) and Deribit (volatilities)
- **Calculates theoretical APRs** using Black-Scholes pricing models
- **Identifies mispriced income** by comparing Rysk APRs vs theoretical rates
- **Displays insights** through a modern, color-coded dashboard interface

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Internet connection (for live data fetching)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/edwardathomson/rysk-dashboard.git
   cd rysk-dashboard
   npm install
   ```

2. **Start the backend server:**
   ```bash
   node api/index.js
   ```
   This starts the Express server on `http://localhost:3001`

3. **Start the frontend (in a new terminal):**
   ```bash
   npm run dev
   ```
   This starts the Vite dev server on `http://localhost:5173`

4. **Open the dashboard:**
   Navigate to `http://localhost:5173` in your browser

## 📊 What You'll See

### Dashboard Features

- **Asset Cards**: Individual cards for each supported asset (UBTC, UETH, etc.)
- **Real-time Data**: Live spot prices, volatilities, and APR calculations
- **Color-coded Indicators**:
  - 🟢 **Green**: Better valued income (excess APR > 5%)
  - 🟡 **Yellow**: Fair pricing (excess APR 0-5%)
  - 🔴 **Red**: Poor pricing (excess APR < 0%)
- **Moneyness**: ITM/ATM/OTM indicators for each strike
- **Professional UI**: Dark gradient theme with glassmorphism effects

### Current Data Sources

| Component | Source | Purpose |
|-----------|--------|---------|
| **Rysk APRs** | app.rysk.finance (scraped) | Live Rysk V12 APR rates |
| **Premiums** | Calculated (Black-Scholes) | Unique premiums per strike |
| **Spot Prices** | CoinGecko API | Current market prices |
| **Volatilities** | Deribit API | Implied volatility data |
| **Contract Sizes** | Asset-specific | UBTC: 0.05 BTC, UETH: 0.5 ETH |
| **Risk-free Rate** | 4% (fixed) | Theoretical pricing input |

## 🏗️ Architecture

### Backend (`/api/index.js`)

- **Express server** handling API requests
- **Puppeteer integration** for scraping Rysk V12 data
- **External API integration** (CoinGecko, Deribit)
- **Black-Scholes pricing engine** for theoretical APR calculations
- **Error handling** with graceful fallbacks

### Frontend (`/src/`)

- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for fast development and building
- **Modern UI components** with responsive design

## 🔧 Available Scripts

| Command | Description |
|---------|--------------|
| `npm run dev` | Start frontend development server (port 5173) |
| `node api/index.js` | Start backend API server (port 3001) |
| `npm run build` | Build production frontend |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint code analysis |

## 🌐 API Endpoints

### GET `/api/quotes`

Returns live APR data for all supported assets.

**Response Example:**
```json
[
  {
    "asset": "UBTC",
    "strike": 124000,
    "expiry": 1756425600,
    "premium": 136.21,
    "premiumSource": "calculated",
    "apr": 0.2749,
    "spotPrice": 118437,
    "timeToExpiry": 0.0837,
    "riskFreeRate": 0.04,
    "volatility": 0.3149
  }
]
```

## 🎨 UI Components

- **Asset Cards**: Grouped display of options by underlying asset
- **APR Comparison Table**: Strike prices, Rysk APRs, theoretical APRs, and excess
- **Loading States**: Professional spinners and skeleton loaders
- **Error Handling**: Informative error messages with retry functionality
- **Responsive Design**: Works on desktop, tablet, and mobile

## 💰 Premium Calculation

**Formula:** `Premium = (APR × Spot Price × Time to Expiry) × Contract Size`

**Example (UBTC $124,000 strike):**
- APR: 27.49% (scraped from Rysk)
- Spot Price: $118,437 (CoinGecko)
- Time to Expiry: 0.0837 years (≈30 days)
- Contract Size: 0.05 BTC
- **Result:** 136.21 USDT premium

**Contract Sizes:**
- UBTC: 0.05 BTC per contract
- UETH: 0.5 ETH per contract
- Others: 0.5 of underlying asset

## 🔍 Data Integrity

**100% Real Data Policy:**
- Rysk APRs scraped directly from live website
- Premiums calculated using real market data
- No fallback to mock or synthetic data
- All calculations based on real market inputs

## 🛠️ Development

### Code Quality

- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **TypeScript** for type safety

### Project Structure

```
rysk-dashboard/
├── api/
│   └── index.js          # Express backend server
├── src/
│   ├── App.tsx           # Main React application
│   ├── components/       # Reusable UI components
│   └── types/           # TypeScript type definitions
├── public/              # Static assets
└── package.json         # Dependencies and scripts
```

## 🚨 Troubleshooting

### Common Issues

1. **"No live data available"**
   - Check internet connection
   - Verify Rysk V12 site is accessible
   - Backend may need restart if scraping fails

2. **Port conflicts**
   - Frontend: Change port in `vite.config.ts`
   - Backend: Modify port in `api/index.js`

3. **Puppeteer issues**
   - First run downloads Chromium (may take time)
   - Linux users may need additional dependencies

### Debug Mode

Set environment variables for detailed logging:
```bash
DEBUG=true npm run start:server
```

## 📈 Future Enhancements

- [ ] Historical APR tracking and charts
- [ ] WebSocket integration for real-time updates
- [ ] Additional DeFi protocol integrations
- [ ] Portfolio optimization suggestions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is for educational and research purposes. Please respect Rysk's terms of service when using their data.

---

**Built with ❤️ for the DeFi community**
