const { Client } = require('@notionhq/client');
const logger = require('../utils/logger');

class NotionLogger {
  constructor() {
    this.apiKey = process.env.NOTION_API_KEY;
    this.databaseId = process.env.NOTION_DATABASE_ID;
    this.enabled = !!(this.apiKey && this.databaseId);
    
    if (this.enabled) {
      this.notion = new Client({ auth: this.apiKey });
    } else {
      logger.warn('Notion logging disabled - missing credentials');
    }
  }

  async logTweet(tweet) {
    if (!this.enabled) return;

    try {
      await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          'Tweet ID': {
            title: [
              {
                text: {
                  content: tweet.id
                }
              }
            ]
          },
          'Author': {
            rich_text: [
              {
                text: {
                  content: tweet.author
                }
              }
            ]
          },
          'Text': {
            rich_text: [
              {
                text: {
                  content: tweet.text.substring(0, 2000) // Notion has limits
                }
              }
            ]
          },
          'URL': {
            url: tweet.url
          },
          'Timestamp': {
            date: {
              start: tweet.timestamp
            }
          },
          'Sent At': {
            date: {
              start: new Date().toISOString()
            }
          },
          'Source': {
            select: {
              name: tweet.source
            }
          },
          'Likes': {
            number: tweet.likes || 0
          },
          'Retweets': {
            number: tweet.retweets || 0
          },
          'Status': {
            select: {
              name: 'Sent'
            }
          }
        }
      });

      logger.info(`Tweet logged to Notion: ${tweet.id}`);
    } catch (error) {
      logger.error('Failed to log tweet to Notion:', error);
    }
  }

  async getRecentTweets(limit = 50) {
    if (!this.enabled) return [];

    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        sorts: [
          {
            property: 'Sent At',
            direction: 'descending'
          }
        ],
        page_size: limit
      });

      return response.results.map(page => ({
        id: page.properties['Tweet ID'].title[0]?.text.content,
        author: page.properties['Author'].rich_text[0]?.text.content,
        text: page.properties['Text'].rich_text[0]?.text.content,
        url: page.properties['URL'].url,
        timestamp: page.properties['Timestamp'].date?.start,
        sentAt: page.properties['Sent At'].date?.start,
        source: page.properties['Source'].select?.name,
        likes: page.properties['Likes'].number,
        retweets: page.properties['Retweets'].number
      }));
    } catch (error) {
      logger.error('Failed to fetch tweets from Notion:', error);
      return [];
    }
  }

  async getStats() {
    if (!this.enabled) return null;

    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId
      });

      const authors = new Set(
        response.results.map(page => 
          page.properties['Author'].rich_text[0]?.text.content
        ).filter(Boolean)
      );

      return {
        totalTweets: response.results.length,
        uniqueAuthors: authors.size,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get stats from Notion:', error);
      return null;
    }
  }
}

module.exports = NotionLogger;