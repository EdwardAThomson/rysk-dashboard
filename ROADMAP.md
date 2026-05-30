# Roadmap — Rysk APR Monitor

_Status: active · updated 2026-05-30_

React + Express dashboard that scrapes live Rysk Finance covered-call APRs and
compares them against Black-Scholes theoretical pricing to spot mispriced income.

## Shipped

- [x] Live APR scraping from Rysk V12 via Puppeteer (UBTC, UETH, WHYPE, kHYPE, UPUMP)
- [x] Backend Black-Scholes theoretical APR pricing
- [x] Multi-asset dashboard tables (strikes, premiums, Rysk vs theoretical APR, excess)
- [x] CoinGecko spot-price + Deribit implied-volatility integration
- [x] Color-coded excess-APR indicators and ITM/ATM/OTM moneyness badges
- [x] Per-strike premium calculation
- [x] Dark / light theme toggle with persistence
- [x] 5-minute backend cache to reduce scraping load
- [x] Manual refresh with staged loading progress
- [x] Graceful error handling with retry
- [x] Responsive glassmorphic UI

## Next

- [ ] Stabilize Puppeteer scraping (reduce reliance on placeholder strikes)
- [ ] WebSocket real-time updates (JSON-RPC streaming, prototyped in test scripts)

## Backlog

- [ ] Historical APR tracking + charts
- [ ] Additional DeFi protocol integrations
- [ ] Portfolio optimization suggestions
- [ ] CSV / JSON export
