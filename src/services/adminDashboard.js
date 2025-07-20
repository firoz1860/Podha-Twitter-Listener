const express = require('express');
const path = require('path');
const logger = require('../utils/logger');
const FilterEngine = require('./filterEngine');
const TweetStorage = require('./tweetStorage');
const DiscordNotifier = require('./discordNotifier');

class AdminDashboard {
  constructor() {
    this.app = express();
    this.port = process.env.ADMIN_PORT || 3000;
    this.filterEngine = new FilterEngine();
    this.tweetStorage = new TweetStorage();
    this.discordNotifier = new DiscordNotifier();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));
  }

  setupRoutes() {
    // Dashboard home
    this.app.get('/', async (req, res) => {
      try {
        const stats = await this.tweetStorage.getStats();
        const filters = this.filterEngine.getFilters();
        
        res.render('dashboard', {
          title: 'Podha Twitter Listener Dashboard',
          stats,
          filters
        });
      } catch (error) {
        logger.error('Dashboard error:', error);
        res.status(500).send('Dashboard error');
      }
    });

    // Get recent tweets
    this.app.get('/api/tweets', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const tweets = await this.tweetStorage.getSentTweets(limit);
        res.json(tweets);
      } catch (error) {
        logger.error('API tweets error:', error);
        res.status(500).json({ error: 'Failed to fetch tweets' });
      }
    });

    // Test filter
    this.app.post('/api/test-filter', async (req, res) => {
      try {
        const { query } = req.body;
        const validation = this.filterEngine.validateQuery(query);
        
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        // Test the filter (mock result for demo)
        const testResult = {
          query,
          valid: true,
          estimatedResults: Math.floor(Math.random() * 20) + 1
        };

        res.json(testResult);
      } catch (error) {
        logger.error('Filter test error:', error);
        res.status(500).json({ error: 'Filter test failed' });
      }
    });

    // Add custom filter
    this.app.post('/api/filters', async (req, res) => {
      try {
        const { name, query, description } = req.body;
        
        const validation = this.filterEngine.validateQuery(query);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        this.filterEngine.addCustomFilter(name, query, description);
        res.json({ success: true, message: 'Filter added successfully' });
      } catch (error) {
        logger.error('Add filter error:', error);
        res.status(500).json({ error: 'Failed to add filter' });
      }
    });

    // Test Discord webhook
    this.app.post('/api/test-discord', async (req, res) => {
      try {
        const result = await this.discordNotifier.testWebhook();
        res.json({ success: result });
      } catch (error) {
        logger.error('Discord test error:', error);
        res.status(500).json({ error: 'Discord test failed' });
      }
    });

    // Get system stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        const stats = await this.tweetStorage.getStats();
        const systemInfo = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        };
        
        res.json({ stats, system: systemInfo });
      } catch (error) {
        logger.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });
  }

  async start() {
    try {
      await this.tweetStorage.initialize();
      
      this.server = this.app.listen(this.port, () => {
        logger.info(`Admin dashboard running on http://localhost:${this.port}`);
      });
    } catch (error) {
      logger.error('Failed to start admin dashboard:', error);
      throw error;
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
      await this.tweetStorage.close();
      logger.info('Admin dashboard stopped');
    }
  }
}

module.exports = AdminDashboard;