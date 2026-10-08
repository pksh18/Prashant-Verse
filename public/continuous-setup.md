# PrashantVerse: continuous crypto and forex setup

## What is active now

- Ten crypto markets and spot gold retain the existing virtual execution engine.
- Continuous daily sessions: an armed bot stops entries at 23:30 IST, attempts intraday closes at 23:55, and resumes on the next IST day. Manual Pause, Close, or strategy selection disarms it until Resume.
- A $500 daily loss trigger (0.5% of initial $100,000), five total positions, $5,000 allocation per position, $5 roundtrip fees plus slippage. Historical results remain intact.
- Monitoring currently runs only while the browser is open. This update does not install a background service.
- EUR/USD, GBP/USD, AUD/USD and NZD/USD are prepared connection targets, NOT active forex instruments. The provider candle parser is implemented and tested; quote ingestion and execution integration still require completion and validation with your account.

## What you need to connect

1. A forex data account. Twelve Data is a candidate: https://twelvedata.com/forex and https://twelvedata.com/pricing. Confirm your plan permits private automated use, all four pairs, intraday history and the required polling rate. Its advertised free 800 daily requests is not enough for this intended continuous polling.
2. Data capacity: four quote requests every 15 seconds require approximately 16 credits/minute and 23,040 per 24-hour weekday, before history. Four five-minute candle requests add 1,152/day; one-minute strategies add up to 5,760/day. Batch requests may still charge per symbol. Choose capacity above these totals with provider confirmation; do not purchase a plan solely from these estimates.
3. An always-on host under your control, such as a small Linux VPS or managed worker with scheduled execution. It needs outbound HTTPS, persistent storage, automatic restart, a secret store, and health monitoring. A laptop or open browser is not an always-on host. No paid service has been purchased or provisioned.
4. Store the data API key using your host's secret manager, never chat, browser localStorage, a public repository, or a URL. Name the future server secret TWELVE_DATA_API_KEY. Adding this name alone does not activate forex in this release.

## Work to finish once those connections exist

- Connect the provider using server-only authentication; validate the account's real responses and entitlement. Fetch enough completed UTC candles for the selected strategy. Respect provider timestamps, gaps, closed sessions and rate limits. Never call daily FX reference rates a live trading feed.
- Complete the forex engine adapter using USD-quoted pairs. Position quantity is base-currency units; notional, costs and P&L are USD. No leverage, synthetic volume or fake historical fills. Use a price-only strategy and evaluate FX volatility thresholds and spreads separately before enabling entries.
- Deploy a dedicated execution service with one authoritative portfolio writer, atomic revisions/locks and idempotent decisions. The current site's browser must become read-only for ticks when that writer is connected, while Pause/Close commands go through the same authority. Do not create competing browser/server accounts or copy temporary sign-in cookies to a cron job.
- Wire authenticated communication between the service and this private Site. Do not bypass Site login, expose portfolio data publicly, or use an expiring sign-in bypass token as a permanent machine credential. Hosting and authentication must be finalized with the chosen platform.
- Run at least one unattended virtual session with the browser closed. Verify saved heartbeat, quotes, decisions, daily cutoff and restart. Only display “server connected” after a verified heartbeat; disable entries on stale data or a missed heartbeat. Alert on failure rather than silently continuing.

## Market calendar and limits

Crypto is available 24/7 subject to venue outages. Forex is generally 24/5, not open all weekend. The prepared model uses New York Sunday 17:05 to Friday 16:59, with a 16:59–17:05 daily break and close attempts starting 16:55. Confirm provider-specific holidays and hours before activation. Reference: https://www.oanda.com/us-en/trading/hours-of-operation/.

Daily closes and stop-losses require a working service and fresh tradable prices. A daily loss trigger is not a guaranteed maximum loss. Closed-market exits wait for the next tradable quote. A profitable trade, no-loss day, or target win rate is not guaranteed. All current fills are virtual; this setup does not connect broker orders.
