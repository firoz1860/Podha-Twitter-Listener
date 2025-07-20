const axios = require('axios');
const logger = require('../utils/logger');

class DiscordNotifier {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.validateWebhookUrl();
  }

  validateWebhookUrl() {
    if (!this.webhookUrl || this.webhookUrl === 'https://discord.com/api/webhooks/YOUR_WEBHOOK_URL') {
      logger.warn('Discord webhook URL not configured properly. Please set DISCORD_WEBHOOK_URL in .env file');
      this.webhookUrl = null;
    }
  }

  async sendTweet(tweet) {
    return this.sendTweetNotification(tweet);
  }

  async sendTweetNotification(tweet) {
    if (!this.webhookUrl) {
      logger.warn('Discord webhook not configured, skipping notification');
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const embed = {
        title: '🐦 New Tweet Alert',
        description: tweet.text,
        color: 0x1DA1F2,
        fields: [
          {
            name: 'Author',
            value: `@${tweet.username}`,
            inline: true
          },
          {
            name: 'Date',
            value: new Date(tweet.created_at).toLocaleString(),
            inline: true
          },
          {
            name: 'Engagement',
            value: `❤️ ${tweet.likes || 0} | 🔄 ${tweet.retweets || 0}`,
            inline: true
          }
        ],
        footer: {
          text: 'Podha Twitter Listener',
          icon_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
        },
        timestamp: new Date().toISOString()
      };

      if (tweet.url) {
        embed.url = tweet.url;
      }

      const payload = {
        embeds: [embed],
        username: 'Twitter Bot',
        avatar_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.info(`Discord notification sent successfully for tweet: ${tweet.id}`);
      return { success: true, response: response.data };

    } catch (error) {
      logger.error('Failed to send Discord notification:', {
        error: error.message,
        tweet_id: tweet.id,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      return { success: false, error: error.message };
    }
  }

  async sendSystemNotification(message, type = 'info') {
    if (!this.webhookUrl) {
      logger.warn('Discord webhook not configured, skipping system notification');
      return { success: false, error: 'Webhook not configured' };
    }

    try {
      const colors = {
        info: 0x3498db,
        success: 0x2ecc71,
        warning: 0xf39c12,
        error: 0xe74c3c
      };

      const embed = {
        title: `🤖 System ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        description: message,
        color: colors[type] || colors.info,
        footer: {
          text: 'Podha Twitter Listener System',
        },
        timestamp: new Date().toISOString()
      };

      const payload = {
        embeds: [embed],
        username: 'System Bot'
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.info(`System notification sent to Discord: ${type}`);
      return { success: true, response: response.data };

    } catch (error) {
      logger.error('Failed to send system notification to Discord:', {
        error: error.message,
        type,
        status: error.response?.status
      });
      return { success: false, error: error.message };
    }
  }

  async testWebhook() {
    if (!this.webhookUrl) {
      const error = 'Discord webhook URL not configured. Please set DISCORD_WEBHOOK_URL in .env file with a valid Discord webhook URL.';
      logger.error(error);
      throw new Error(error);
    }

    try {
      const testPayload = {
        embeds: [{
          title: '✅ Test Message',
          description: 'Discord webhook is working correctly!',
          color: 0x00ff00,
          footer: {
            text: 'Podha Twitter Listener Test'
          },
          timestamp: new Date().toISOString()
        }],
        username: 'Test Bot'
      };

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      logger.info('Discord webhook test successful');
      return { success: true, message: 'Test message sent successfully!' };

    } catch (error) {
      const errorMsg = `Failed to send test message to Discord: ${error.message}`;
      logger.error(errorMsg, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        webhookUrl: this.webhookUrl ? 'configured' : 'not configured'
      });
      throw new Error(errorMsg);
    }
  }
}

module.exports = DiscordNotifier;