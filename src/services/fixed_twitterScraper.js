
// --- FIXED VERSION ---
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class TwitterScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.useNitter = process.env.USE_NITTER === 'true';
    this.nitterInstance = process.env.NITTER_INSTANCE || 'https://nitter.net';
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
  }

  async initialize() {
    if (this.useNitter) {
      logger.info('Using Nitter proxy for Twitter scraping');
      return;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-zygote',
          '--no-first-run',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await this.page.setViewport({ width: 1280, height: 720 });

      await this.authenticate();
      logger.info('Twitter scraper initialized with Puppeteer');
    } catch (error) {
      logger.error('Failed to initialize Twitter scraper:', error);
      throw error;
    }
  }

  async authenticate() {
    if (process.env.TWITTER_COOKIE) {
      await this.authenticateWithCookie();
    } else if (process.env.TWITTER_USERNAME && process.env.TWITTER_PASSWORD) {
      await this.authenticateWithCredentials();
    } else {
      logger.warn('No authentication method provided - some features may be limited');
    }
  }

  async authenticateWithCookie() {
    try {
      const cookies = [{
        name: 'auth_token',
        value: process.env.TWITTER_COOKIE,
        domain: '.twitter.com',
        path: '/',
        httpOnly: true,
        secure: true
      }];
      await this.page.setCookie(...cookies);
      logger.info('Authenticated with Twitter cookie');
    } catch (error) {
      logger.error('Failed to authenticate with cookie:', error);
      throw error;
    }
  }

  async authenticateWithCredentials() {
    try {
      await this.page.goto('https://twitter.com/login', { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('input[name="text"]', { timeout: 15000 });
      await this.page.type('input[name="text"]', process.env.TWITTER_USERNAME);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(2000);
      await this.page.waitForSelector('input[name="password"]', { timeout: 15000 });
      await this.page.type('input[name="password"]', process.env.TWITTER_PASSWORD);
      await this.page.keyboard.press('Enter');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      logger.info('Authenticated with Twitter credentials');
    } catch (error) {
      logger.error('Failed to authenticate with credentials:', error);
      throw error;
    }
  }

  async searchTweets(query) {
    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        return this.useNitter ? await this.searchWithNitter(query) : await this.searchWithPuppeteer(query);
      } catch (error) {
        retries++;
        logger.warn(`Search attempt ${retries} failed: ${error.message}`);
        if (retries >= this.maxRetries) {
          logger.error(`Max retries reached for query: ${query}`);
          throw error;
        }
        await this.delay(2000 * retries);
      }
    }
  }

  async searchWithNitter(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `${this.nitterInstance}/search?q=${encodedQuery}`;
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const tweets = [];
      $('.timeline-item').each((i, el) => {
        const text = $(el).find('.tweet-content').text().trim();
        const author = $(el).find('.username').text().trim();
        const link = $(el).find('.tweet-link').attr('href');
        if (text && author && link) {
          tweets.push({
            id: this.extractTweetId(link),
            text,
            author,
            url: `https://twitter.com${link}`,
            timestamp: new Date().toISOString(),
            source: 'nitter',
            likes: this.extractNumber($(el).find('.icon-heart').parent().text()),
            retweets: this.extractNumber($(el).find('.icon-retweet').parent().text())
          });
        }
      });
      logger.info(`Found ${tweets.length} tweets via Nitter for query: ${query}`);
      return tweets;
    } catch (error) {
      logger.error(`Nitter search failed: ${error.message}`);
      throw error;
    }
  }

  async searchWithPuppeteer(query) {
    const url = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    try {
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('[data-testid="cellInnerDiv"]', { timeout: 15000 });
      await this.autoScroll();
      const tweets = await this.page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
        const extracted = [];
        tweetElements.forEach(el => {
          const textEl = el.querySelector('[data-testid="tweetText"]');
          const authorEl = el.querySelector('[data-testid="User-Name"]');
          const timeEl = el.querySelector('time');
          const likeEl = el.querySelector('[data-testid="like"]');
          const rtEl = el.querySelector('[data-testid="retweet"]');
          if (textEl && authorEl && timeEl) {
            const link = timeEl.parentElement.getAttribute('href');
            extracted.push({
              id: link.split('/').pop(),
              text: textEl.textContent.trim(),
              author: authorEl.textContent.trim(),
              url: 'https://twitter.com' + link,
              timestamp: timeEl.getAttribute('datetime'),
              source: 'puppeteer',
              likes: likeEl ? parseInt(likeEl.textContent.replace(/,/g, '')) || 0 : 0,
              retweets: rtEl ? parseInt(rtEl.textContent.replace(/,/g, '')) || 0 : 0
            });
          }
        });
        return extracted;
      });
      logger.info(`Found ${tweets.length} tweets via Puppeteer for query: ${query}`);
      return tweets;
    } catch (error) {
      logger.error(`Puppeteer search failed: ${error.message}`);
      throw error;
    }
  }

  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight >= 3000) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  extractTweetId(link) {
    const match = link.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  extractNumber(text) {
    const match = text.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : 0;
  }

  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = TwitterScraper;
