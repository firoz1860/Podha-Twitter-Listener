const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class TweetStorage {
  constructor() {
    this.dbPath = process.env.DATABASE_PATH || './data/tweets.db';
    this.ensureDirectoryExists();
    this.initializeDatabase();
  }

  ensureDirectoryExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created database directory: ${dir}`);
    }
  }

  initializeDatabase() {
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        throw err;
      }
      logger.info(`Connected to SQLite database: ${this.dbPath}`);
    });

    this.createTables();
    this.insertSampleData();
  }

  async initialize() {
    // This method is called to ensure the database is properly set up
    // The actual initialization happens in the constructor
    return Promise.resolve();
  }

  createTables() {
    const createTweetsTable = `
      CREATE TABLE IF NOT EXISTS tweets (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        likes INTEGER DEFAULT 0,
        retweets INTEGER DEFAULT 0,
        replies INTEGER DEFAULT 0,
        url TEXT,
        hashtags TEXT,
        mentions TEXT,
        media_urls TEXT,
        is_retweet BOOLEAN DEFAULT 0,
        retweet_count INTEGER DEFAULT 0,
        quote_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        bookmark_count INTEGER DEFAULT 0,
        lang TEXT,
        source TEXT,
        in_reply_to_status_id TEXT,
        in_reply_to_user_id TEXT,
        geo TEXT,
        coordinates TEXT,
        place TEXT,
        contributors TEXT,
        is_quote_status BOOLEAN DEFAULT 0,
        quoted_status_id TEXT,
        quoted_status TEXT,
        possibly_sensitive BOOLEAN DEFAULT 0,
        filter_level TEXT,
        withheld_copyright BOOLEAN DEFAULT 0,
        withheld_in_countries TEXT,
        withheld_scope TEXT,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notified BOOLEAN DEFAULT 0,
        sentiment_score REAL,
        category TEXT,
        priority INTEGER DEFAULT 1
      )
    `;

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT,
        description TEXT,
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        tweets_count INTEGER DEFAULT 0,
        verified BOOLEAN DEFAULT 0,
        profile_image_url TEXT,
        banner_url TEXT,
        location TEXT,
        website TEXT,
        created_at DATETIME,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createKeywordsTable = `
      CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT UNIQUE NOT NULL,
        category TEXT,
        priority INTEGER DEFAULT 1,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createNotificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tweet_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT 1,
        error_message TEXT,
        FOREIGN KEY (tweet_id) REFERENCES tweets (id)
      )
    `;

    const createAnalyticsTable = `
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        tweets_processed INTEGER DEFAULT 0,
        notifications_sent INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        avg_sentiment REAL,
        top_keywords TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    [createTweetsTable, createUsersTable, createKeywordsTable, createNotificationsTable, createAnalyticsTable].forEach(sql => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error('Error creating table:', err);
        }
      });
    });

    logger.info('Database tables initialized');
  }

  insertSampleData() {
    // Insert sample keywords
    const sampleKeywords = [
      { keyword: 'AI', category: 'technology', priority: 3 },
      { keyword: 'machine learning', category: 'technology', priority: 3 },
      { keyword: 'blockchain', category: 'technology', priority: 2 },
      { keyword: 'cryptocurrency', category: 'finance', priority: 2 },
      { keyword: 'startup', category: 'business', priority: 2 },
      { keyword: 'innovation', category: 'business', priority: 1 },
      { keyword: 'breaking news', category: 'news', priority: 3 },
      { keyword: 'urgent', category: 'news', priority: 3 }
    ];

    const insertKeyword = `INSERT OR IGNORE INTO keywords (keyword, category, priority) VALUES (?, ?, ?)`;
    
    sampleKeywords.forEach(({ keyword, category, priority }) => {
      this.db.run(insertKeyword, [keyword, category, priority], (err) => {
        if (err && !err.message.includes('UNIQUE constraint failed')) {
          logger.error('Error inserting sample keyword:', err);
        }
      });
    });

    // Insert sample tweets
    const sampleTweets = [
      {
        id: 'sample_tweet_1',
        username: 'tech_news',
        text: 'Breaking: New AI breakthrough in machine learning shows 95% accuracy improvement! #AI #MachineLearning #Innovation',
        created_at: new Date().toISOString(),
        likes: 150,
        retweets: 45,
        replies: 23,
        url: 'https://twitter.com/tech_news/status/sample_tweet_1',
        hashtags: JSON.stringify(['AI', 'MachineLearning', 'Innovation']),
        category: 'technology',
        priority: 3,
        sentiment_score: 0.8
      },
      {
        id: 'sample_tweet_2',
        username: 'startup_world',
        text: 'Exciting startup news: New blockchain platform raises $50M in Series A funding! The future of decentralized finance is here. #Blockchain #Startup #Crypto',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        likes: 89,
        retweets: 34,
        replies: 12,
        url: 'https://twitter.com/startup_world/status/sample_tweet_2',
        hashtags: JSON.stringify(['Blockchain', 'Startup', 'Crypto']),
        category: 'business',
        priority: 2,
        sentiment_score: 0.7
      },
      {
        id: 'sample_tweet_3',
        username: 'news_alert',
        text: 'URGENT: Major tech conference announces revolutionary innovation in quantum computing. Industry experts are calling it a game-changer!',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        likes: 234,
        retweets: 78,
        replies: 45,
        url: 'https://twitter.com/news_alert/status/sample_tweet_3',
        hashtags: JSON.stringify(['QuantumComputing', 'Innovation', 'TechNews']),
        category: 'news',
        priority: 3,
        sentiment_score: 0.9
      }
    ];

    const insertTweet = `INSERT OR IGNORE INTO tweets (
      id, username, text, created_at, likes, retweets, replies, url, 
      hashtags, category, priority, sentiment_score, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    sampleTweets.forEach(tweet => {
      this.db.run(insertTweet, [
        tweet.id, tweet.username, tweet.text, tweet.created_at,
        tweet.likes, tweet.retweets, tweet.replies, tweet.url,
        tweet.hashtags, tweet.category, tweet.priority, tweet.sentiment_score
      ], (err) => {
        if (err && !err.message.includes('UNIQUE constraint failed')) {
          logger.error('Error inserting sample tweet:', err);
        }
      });
    });

    logger.info('Sample data inserted into database');
  }

  async saveTweet(tweet) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO tweets (
          id, username, text, created_at, likes, retweets, replies, url,
          hashtags, mentions, media_urls, is_retweet, lang, source,
          processed_at, sentiment_score, category, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `;

      const values = [
        tweet.id,
        tweet.username,
        tweet.text,
        tweet.created_at,
        tweet.likes || 0,
        tweet.retweets || 0,
        tweet.replies || 0,
        tweet.url,
        JSON.stringify(tweet.hashtags || []),
        JSON.stringify(tweet.mentions || []),
        JSON.stringify(tweet.media_urls || []),
        tweet.is_retweet || false,
        tweet.lang || 'en',
        tweet.source || 'twitter',
        tweet.sentiment_score || 0,
        tweet.category || 'general',
        tweet.priority || 1
      ];

      this.db.run(sql, values, function(err) {
        if (err) {
          logger.error('Error saving tweet:', err);
          reject(err);
        } else {
          logger.info(`Tweet saved: ${tweet.id}`);
          resolve({ id: tweet.id, changes: this.changes });
        }
      });
    });
  }

  async getTweets(limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tweets 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;

      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          logger.error('Error fetching tweets:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getTweetById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM tweets WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          logger.error('Error fetching tweet by ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getRecentTweets(hours = 24) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tweets 
        WHERE created_at > datetime('now', '-${hours} hours')
        ORDER BY created_at DESC
      `;

      this.db.all(sql, (err, rows) => {
        if (err) {
          logger.error('Error fetching recent tweets:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async markAsNotified(tweetId) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE tweets SET notified = 1 WHERE id = ?';
      
      this.db.run(sql, [tweetId], function(err) {
        if (err) {
          logger.error('Error marking tweet as notified:', err);
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async getKeywords() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM keywords WHERE active = 1 ORDER BY priority DESC';
      
      this.db.all(sql, (err, rows) => {
        if (err) {
          logger.error('Error fetching keywords:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async addKeyword(keyword, category = 'general', priority = 1) {
    return new Promise((resolve, reject) => {
      const sql = 'INSERT INTO keywords (keyword, category, priority) VALUES (?, ?, ?)';
      
      this.db.run(sql, [keyword, category, priority], function(err) {
        if (err) {
          logger.error('Error adding keyword:', err);
          reject(err);
        } else {
          logger.info(`Keyword added: ${keyword}`);
          resolve({ id: this.lastID, keyword, category, priority });
        }
      });
    });
  }

  async getStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalTweets: 'SELECT COUNT(*) as count FROM tweets',
        todayTweets: "SELECT COUNT(*) as count FROM tweets WHERE date(created_at) = date('now')",
        notifiedTweets: 'SELECT COUNT(*) as count FROM tweets WHERE notified = 1',
        avgSentiment: 'SELECT AVG(sentiment_score) as avg FROM tweets WHERE sentiment_score IS NOT NULL',
        topCategories: `
          SELECT category, COUNT(*) as count 
          FROM tweets 
          WHERE category IS NOT NULL 
          GROUP BY category 
          ORDER BY count DESC 
          LIMIT 5
        `
      };

      const stats = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      Object.entries(queries).forEach(([key, sql]) => {
        if (key === 'topCategories') {
          this.db.all(sql, (err, rows) => {
            if (err) {
              logger.error(`Error fetching ${key}:`, err);
              stats[key] = [];
            } else {
              stats[key] = rows;
            }
            completed++;
            if (completed === total) resolve(stats);
          });
        } else {
          this.db.get(sql, (err, row) => {
            if (err) {
              logger.error(`Error fetching ${key}:`, err);
              stats[key] = 0;
            } else {
              stats[key] = row.count || row.avg || 0;
            }
            completed++;
            if (completed === total) resolve(stats);
          });
        }
      });
    });
  }

  async wasSent(tweetId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT notified FROM tweets WHERE id = ?';
      
      this.db.get(sql, [tweetId], (err, row) => {
        if (err) {
          logger.error('Error checking if tweet was sent:', err);
          reject(err);
        } else {
          resolve(row ? row.notified === 1 : false);
        }
      });
    });
  }

  async markAsSent(tweetId, tweetData = null) {
    return new Promise((resolve, reject) => {
      // First save the tweet if data is provided
      if (tweetData) {
        this.saveTweet(tweetData).then(() => {
          // Then mark as sent
          this.markAsNotified(tweetId).then(resolve).catch(reject);
        }).catch(reject);
      } else {
        // Just mark as sent
        this.markAsNotified(tweetId).then(resolve).catch(reject);
      }
    });
  }

  async getSentTweets(limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tweets 
        WHERE notified = 1 
        ORDER BY processed_at DESC 
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          logger.error('Error fetching sent tweets:', err);
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            author: row.username,
            text: row.text,
            url: row.url,
            timestamp: row.created_at,
            sent_at: row.processed_at,
            likes: row.likes,
            retweets: row.retweets,
            source: row.source
          })));
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Error closing database:', err);
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

module.exports = TweetStorage;