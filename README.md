# Podha Twitter Listener

A comprehensive Twitter listening workflow for Podha Protocol and RWA (Real World Assets) narratives.

## Features

- 🐦 Twitter scraping without API (using Puppeteer and Nitter)
- 🔒 Multiple authentication methods (session cookie or credentials)
- 🎯 Advanced filtering with logical operators
- 📊 De-duplication and SQLite storage
- 📢 Discord notifications with rich embeds
- ⏰ Automatic scheduling every hour
- 🔄 n8n workflow integration
- 📝 Comprehensive logging and error handling
- 🎛️ Admin dashboard for monitoring and configuration
- 📋 Airtable and Notion integration for external logging
- ⚡ Rate limiting and retry mechanisms
- 🔐 Encrypted credential management

## Quick Start

1. Copy `.env.example` to `.env` and configure your settings
2. Install dependencies: `npm install`
3. Run setup: `npm run setup`
4. Test the system: `npm test`
5. Start the listener: `npm start`
6. Access admin dashboard: `npm run dashboard` (http://localhost:3000)

## Configuration

Edit your `.env` file with:

- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL
- `TWITTER_COOKIE` or `TWITTER_USERNAME`/`TWITTER_PASSWORD`: Twitter authentication
- `USE_NITTER=true`: Use Nitter proxy instead of direct Twitter scraping
- `AIRTABLE_API_KEY` & `AIRTABLE_BASE_ID`: Optional Airtable integration
- `NOTION_API_KEY` & `NOTION_DATABASE_ID`: Optional Notion integration
- `ADMIN_ENABLED=true`: Enable web dashboard

## n8n Integration

Import the workflow files from `n8n-workflows/` into your n8n instance:

- `podha-twitter-listener.json`: Main scheduled workflow
- `podha-twitter-listener-manual.json`: Manual testing workflow
- `podha-twitter-listener-enhanced.json`: Enhanced workflow with external logging

### n8n Commands

- `npm run n8n`: Execute main workflow
- `npm run n8n:test`: Test workflow components
- `npm run n8n:health`: Health check
- `npm run n8n:config`: Get credential configuration

## Search Filters

The system monitors these search patterns:

1. `filter:blue_verified min_faves:3 Podha AND ("RWA" OR "Real World Assets" OR "Yield")`
2. `filter:blue_verified min_faves:3 Solana AND ("Smart Vaults" OR "Safe Yield" OR "Podha")`
3. `filter:blue_verified min_faves:3 Bitcoin AND ("tokenized treasury" OR "credit protocol" OR "RWA on-chain")`
4. `filter:blue_verified min_faves:3 DeFi AND ("custodial vault" OR "delta neutral")`

## Commands

- `npm start`: Start the listener with scheduling
- `npm test`: Run all tests
- `npm run setup`: Initialize project structure
- `node src/test.js --manual`: Run manual workflow test

## Architecture

- `src/index.js`: Main application entry point
- `src/services/`: Core services (Twitter scraper, Discord notifier, etc.)
- `src/utils/`: Utility modules (logger, scheduler)
- `data/`: SQLite database storage
- `logs/`: Application logs
- `n8n-workflows/`: n8n workflow definitions

## Support

For issues or questions, check the logs in `logs/app.log` and ensure your `.env` configuration is correct.
