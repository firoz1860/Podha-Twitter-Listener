const axios = require('axios');
const logger = require('../utils/logger');

class AirtableLogger {
  constructor() {
    this.baseId = process.env.AIRTABLE_BASE_ID;
    this.apiKey = process.env.AIRTABLE_API_KEY;
    this.tableName = process.env.AIRTABLE_TABLE_NAME || 'Tweets';
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}/${this.tableName}`;
    this.enabled = !!(this.baseId && this.apiKey);
    
    if (!this.enabled) {
      logger.warn('Airtable logging disabled - missing credentials');
    }
  }

  async logTweet(tweet) {
    if (!this.enabled) return;

    try {
      const record = {
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
      };

      await axios.post(this.baseUrl, record, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`Tweet logged to Airtable: ${tweet.id}`);
    } catch (error) {
      logger.error('Failed to log tweet to Airtable:', error);
    }
  }

  async logError(error, context = {}) {
    if (!this.enabled) return;

    try {
      const record = {
        fields: {
          'Type': 'Error',
          'Message': error.message,
          'Stack': error.stack,
          'Context': JSON.stringify(context),
          'Timestamp': new Date().toISOString()
        }
      };

      await axios.post(`https://api.airtable.com/v0/${this.baseId}/Errors`, record, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Error logged to Airtable');
    } catch (logError) {
      logger.error('Failed to log error to Airtable:', logError);
    }
  }

  async getRecentTweets(limit = 50) {
    if (!this.enabled) return [];

    try {
      const response = await axios.get(this.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        params: {
          maxRecords: limit,
          sort: [{ field: 'Sent At', direction: 'desc' }]
        }
      });

      return response.data.records.map(record => ({
        id: record.fields['Tweet ID'],
        author: record.fields['Author'],
        text: record.fields['Text'],
        url: record.fields['URL'],
        timestamp: record.fields['Timestamp'],
        sentAt: record.fields['Sent At'],
        source: record.fields['Source'],
        likes: record.fields['Likes'],
        retweets: record.fields['Retweets']
      }));
    } catch (error) {
      logger.error('Failed to fetch tweets from Airtable:', error);
      return [];
    }
  }

  async getStats() {
    if (!this.enabled) return null;

    try {
      const response = await axios.get(this.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      const records = response.data.records;
      const authors = new Set(records.map(r => r.fields['Author']));
      
      return {
        totalTweets: records.length,
        uniqueAuthors: authors.size,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get stats from Airtable:', error);
      return null;
    }
  }
}

module.exports = AirtableLogger;