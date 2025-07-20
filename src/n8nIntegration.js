const PodhaTwitterListener = require('./index');
const AirtableLogger = require('./services/airtableLogger');
const NotionLogger = require('./services/notionLogger');
const credentialManager = require('./services/credentialManager');
const rateLimiter = require('./services/rateLimiter');
const logger = require('./utils/logger');

class N8nIntegration {
  constructor() {
    this.listener = new PodhaTwitterListener();
    this.airtableLogger = new AirtableLogger();
    this.notionLogger = new NotionLogger();
  }

  async executeWorkflow() {
    const startTime = Date.now();
    let result = {
      status: 'error',
      tweetsFound: 0,
      tweetsProcessed: 0,
      error: null,
      executionTime: 0,
      airtableData: null,
      notionData: null
    };

    try {
      // Validate credentials
      const credentialValidation = credentialManager.validateCredentials();
      if (!credentialValidation.valid) {
        throw new Error(`Missing required credentials: ${credentialValidation.missing.join(', ')}`);
      }

      // Check rate limits
      const canProceed = await rateLimiter.checkLimit('twitter');
      if (!canProceed) {
        await rateLimiter.waitForLimit('twitter');
      }

      // Initialize and run workflow
      await this.listener.initialize();
      
      // Override the runWorkflow method to capture results
      const originalRunWorkflow = this.listener.runWorkflow.bind(this.listener);
      const tweets = [];
      
      this.listener.runWorkflow = async function() {
        const queries = this.filterEngine.getSearchQueries();
        const allTweets = [];

        for (const query of queries) {
          logger.info(`Searching for: ${query}`);
          const queryTweets = await this.twitterScraper.searchTweets(query);
          allTweets.push(...queryTweets);
          
          await this.delay(parseInt(process.env.REQUEST_DELAY_MS) || 2000);
        }

        const uniqueTweets = this.removeDuplicates(allTweets);
        const newTweets = await this.filterNewTweets(uniqueTweets);
        
        tweets.push(...newTweets);
        result.tweetsFound = newTweets.length;

        if (newTweets.length === 0) {
          logger.info('No new tweets found');
          return;
        }

        // Process tweets
        for (const tweet of newTweets) {
          await this.discordNotifier.sendTweet(tweet);
          await this.tweetStorage.markAsSent(tweet.id, tweet);
          result.tweetsProcessed++;
          
          await this.delay(1000);
        }

        logger.info(`Successfully processed ${newTweets.length} new tweets`);
      };

      // Run the workflow
      await this.listener.runWorkflow();

      // Log to external services if configured
      if (tweets.length > 0) {
        // Prepare data for Airtable
        if (this.airtableLogger.enabled) {
          result.airtableData = {
            records: tweets.map(tweet => ({
              fields: {
                'Tweet ID': tweet.id,
                'Author': tweet.author,
                'Text': tweet.text,
                'URL': tweet.url,
                'Timestamp': tweet.timestamp,
                'Sent At': new Date().toISOString(),
                'Source': tweet.source,
                'Likes': tweet.likes || 0,
                'Retweets': tweet.retweets || 0,
                'Status': 'Sent'
              }
            }))
          };

          // Log each tweet to Airtable
          for (const tweet of tweets) {
            await this.airtableLogger.logTweet(tweet);
          }
        }

        // Prepare data for Notion
        if (this.notionLogger.enabled) {
          // Log each tweet to Notion
          for (const tweet of tweets) {
            await this.notionLogger.logTweet(tweet);
          }
        }
      }

      result.status = 'success';
      result.executionTime = Date.now() - startTime;

    } catch (error) {
      logger.error('n8n workflow execution failed:', error);
      result.error = error.message;
      result.executionTime = Date.now() - startTime;

      // Log error to external services
      if (this.airtableLogger.enabled) {
        await this.airtableLogger.logError(error, { context: 'n8n_workflow' });
      }
    } finally {
      await this.listener.stop();
    }

    return result;
  }

  // Method for manual testing from n8n
  async testWorkflow() {
    try {
      const credentialValidation = credentialManager.validateCredentials();
      const rateLimitStatus = rateLimiter.getStatus('twitter');
      
      return {
        status: 'success',
        credentials: credentialValidation,
        rateLimits: rateLimitStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get configuration for n8n credential manager
  getCredentialConfig() {
    return credentialManager.getN8nConfig();
  }

  // Health check endpoint for n8n
  async healthCheck() {
    try {
      const stats = await this.listener.tweetStorage.getStats();
      const rateLimits = {
        twitter: rateLimiter.getStatus('twitter'),
        discord: rateLimiter.getStatus('discord'),
        nitter: rateLimiter.getStatus('nitter')
      };

      return {
        status: 'healthy',
        stats,
        rateLimits,
        services: {
          airtable: this.airtableLogger.enabled,
          notion: this.notionLogger.enabled
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// CLI interface for n8n
async function main() {
  const args = process.argv.slice(2);
  const integration = new N8nIntegration();

  try {
    if (args.includes('--test')) {
      const result = await integration.testWorkflow();
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--health')) {
      const result = await integration.healthCheck();
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--config')) {
      const result = integration.getCredentialConfig();
      console.log(JSON.stringify(result, null, 2));
    } else {
      const result = await integration.executeWorkflow();
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = N8nIntegration;