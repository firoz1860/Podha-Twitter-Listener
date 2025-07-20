require('dotenv').config();
const logger = require('./utils/logger');
const scheduler = require('./utils/scheduler');
const TwitterScraper = require('./services/twitterScraper');
const DiscordNotifier = require('./services/discordNotifier');
const TweetStorage = require('./services/tweetStorage');
const FilterEngine = require('./services/filterEngine');
const AirtableLogger = require('./services/airtableLogger');
const NotionLogger = require('./services/notionLogger');
const AdminDashboard = require('./services/adminDashboard');
const rateLimiter = require('./services/rateLimiter');

class PodhaTwitterListener {
  constructor() {
    this.twitterScraper = new TwitterScraper();
    this.discordNotifier = new DiscordNotifier();
    this.tweetStorage = new TweetStorage();
    this.filterEngine = new FilterEngine();
    this.airtableLogger = new AirtableLogger();
    this.notionLogger = new NotionLogger();
    this.adminDashboard = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      await this.twitterScraper.initialize();
      
      // Start rate limiter cleanup
      rateLimiter.startCleanup();
      
      // Start admin dashboard if enabled
      if (process.env.ADMIN_ENABLED === 'true') {
        this.adminDashboard = new AdminDashboard();
        await this.adminDashboard.start();
      }
      
      logger.info('Podha Twitter Listener initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize:', error);
      throw error;
    }
  }

  async runWorkflow() {
    if (this.isRunning) {
      logger.warn('Workflow already running, skipping...');
      return;
    }

    this.isRunning = true;
    logger.info('Starting Twitter listening workflow...');

    try {
      const queries = this.filterEngine.getSearchQueries();
      const allTweets = [];

      for (const query of queries) {
        logger.info(`Searching for: ${query}`);
        const tweets = await this.twitterScraper.searchTweets(query);
        allTweets.push(...tweets);
        
        // Add delay between queries to avoid rate limiting
        await this.delay(parseInt(process.env.REQUEST_DELAY_MS) || 2000);
      }

      // Remove duplicates and filter out already seen tweets
      const uniqueTweets = this.removeDuplicates(allTweets);
      const newTweets = await this.filterNewTweets(uniqueTweets);

      if (newTweets.length === 0) {
        logger.info('No new tweets found');
        return;
      }

      // Send to Discord
      for (const tweet of newTweets) {
        // Check Discord rate limit
        await rateLimiter.waitForLimit('discord');
        
        await this.discordNotifier.sendTweet(tweet);
        await this.tweetStorage.markAsSent(tweet.id);
        
        // Log to external services
        if (this.airtableLogger.enabled) {
          await this.airtableLogger.logTweet(tweet);
        }
        if (this.notionLogger.enabled) {
          await this.notionLogger.logTweet(tweet);
        }
        
        await this.delay(1000); // Delay between Discord messages
      }

      logger.info(`Successfully processed ${newTweets.length} new tweets`);
    } catch (error) {
      logger.error('Workflow execution failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  removeDuplicates(tweets) {
    const seen = new Set();
    return tweets.filter(tweet => {
      if (seen.has(tweet.id)) {
        return false;
      }
      seen.add(tweet.id);
      return true;
    });
  }

  async filterNewTweets(tweets) {
    const newTweets = [];
    for (const tweet of tweets) {
      const wasSent = await this.tweetStorage.wasSent(tweet.id);
      if (!wasSent) {
        newTweets.push(tweet);
      }
    }
    return newTweets;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start() {
    await this.initialize();
    
    // Run once immediately
    await this.runWorkflow();
    
    // Start scheduler if enabled
    if (process.env.ENABLE_SCHEDULER === 'true') {
      const intervalHours = parseInt(process.env.RUN_INTERVAL_HOURS) || 1;
      scheduler.start(intervalHours, () => this.runWorkflow());
      logger.info(`Scheduler started - will run every ${intervalHours} hour(s)`);
    }
  }

  async stop() {
    scheduler.stop();
    await this.twitterScraper.cleanup();
    await this.tweetStorage.close();
    
    if (this.adminDashboard) {
      await this.adminDashboard.stop();
    }
    
    logger.info('Podha Twitter Listener stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (global.listener) {
    await global.listener.stop();
  }
  process.exit(0);
});

// Start the application
async function main() {
  try {
    global.listener = new PodhaTwitterListener();
    await global.listener.start();
    logger.info('Podha Twitter Listener is running...');
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PodhaTwitterListener;