require('dotenv').config();
const PodhaTwitterListener = require('./index');
const DiscordNotifier = require('./services/discordNotifier');
const FilterEngine = require('./services/filterEngine');
const TweetStorage = require('./services/tweetStorage');
const logger = require('./utils/logger');

async function runTests() {
  logger.info('Starting Podha Twitter Listener tests...');

  try {
    // Test 1: Discord webhook
    logger.info('Test 1: Testing Discord webhook...');
    const discordNotifier = new DiscordNotifier();
    const webhookTest = await discordNotifier.testWebhook();
    logger.info(`Discord webhook test: ${webhookTest ? 'PASSED' : 'FAILED'}`);

    // Test 2: Database functionality
    logger.info('Test 2: Testing database functionality...');
    const tweetStorage = new TweetStorage();
    await tweetStorage.initialize();
    
    const testTweet = {
      id: 'test_tweet_123',
      username: 'testuser',
      author: 'test_user',
      text: 'This is a test tweet about #Podha and #RWA',
      url: 'https://twitter.com/test_user/status/test_tweet_123',
      created_at: new Date().toISOString(),
      source: 'test',
      likes: 5,
      retweets: 2
    };

    await tweetStorage.markAsSent(testTweet.id, testTweet);
    const wasSent = await tweetStorage.wasSent(testTweet.id);
    logger.info(`Database test: ${wasSent ? 'PASSED' : 'FAILED'}`);

    // Test 3: Filter engine
    logger.info('Test 3: Testing filter engine...');
    const filterEngine = new FilterEngine();
    const queries = filterEngine.getSearchQueries();
    logger.info(`Filter engine test: ${queries.length > 0 ? 'PASSED' : 'FAILED'} (${queries.length} queries)`);

    // Test 4: Query validation
    logger.info('Test 4: Testing query validation...');
    const validQuery = 'filter:blue_verified min_faves:3 Podha AND ("RWA" OR "Yield")';
    const validationResult = filterEngine.validateQuery(validQuery);
    logger.info(`Query validation test: ${validationResult.valid ? 'PASSED' : 'FAILED'}`);

    // Test 5: Tweet matching
    logger.info('Test 5: Testing tweet matching...');
    const matchResult = filterEngine.matchesCriteria(testTweet);
    logger.info(`Tweet matching test: ${matchResult ? 'PASSED' : 'FAILED'}`);

    // Test 6: Storage stats
    logger.info('Test 6: Testing storage stats...');
    const stats = await tweetStorage.getStats();
    logger.info(`Storage stats: ${stats.total_tweets} total tweets, ${stats.unique_authors} unique authors`);

    // Cleanup
    await tweetStorage.close();
    
    logger.info('All tests completed successfully!');
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run manual workflow test
async function runManualTest() {
  logger.info('Starting manual workflow test...');
  
  try {
    const listener = new PodhaTwitterListener();
    await listener.runWorkflow();
    logger.info('Manual workflow test completed');
  } catch (error) {
    logger.error('Manual workflow test failed:', error);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--manual')) {
  runManualTest();
} else {
  runTests();
}