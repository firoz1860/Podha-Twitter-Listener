const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CredentialManager {
  constructor() {
    this.credentialsPath = process.env.CREDENTIALS_PATH || './data/credentials.json';
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateKey();
    this.credentials = {};
    this.loadCredentials();
  }

  generateKey() {
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('Generated new encryption key. Set ENCRYPTION_KEY in .env for persistence');
    return key;
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  loadCredentials() {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const data = fs.readFileSync(this.credentialsPath, 'utf8');
        const encryptedCredentials = JSON.parse(data);
        
        this.credentials = {};
        for (const [key, encryptedValue] of Object.entries(encryptedCredentials)) {
          try {
            this.credentials[key] = this.decrypt(encryptedValue);
          } catch (error) {
            logger.error(`Failed to decrypt credential: ${key}`);
          }
        }
        
        logger.info('Credentials loaded successfully');
      }
    } catch (error) {
      logger.error('Failed to load credentials:', error);
    }
  }

  saveCredentials() {
    try {
      const encryptedCredentials = {};
      for (const [key, value] of Object.entries(this.credentials)) {
        encryptedCredentials[key] = this.encrypt(value);
      }
      
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.credentialsPath, JSON.stringify(encryptedCredentials, null, 2));
      logger.info('Credentials saved successfully');
    } catch (error) {
      logger.error('Failed to save credentials:', error);
    }
  }

  setCredential(key, value) {
    this.credentials[key] = value;
    this.saveCredentials();
    logger.info(`Credential set: ${key}`);
  }

  getCredential(key) {
    return this.credentials[key] || process.env[key];
  }

  hasCredential(key) {
    return !!(this.credentials[key] || process.env[key]);
  }

  removeCredential(key) {
    delete this.credentials[key];
    this.saveCredentials();
    logger.info(`Credential removed: ${key}`);
  }

  listCredentials() {
    const keys = Object.keys(this.credentials);
    const envKeys = Object.keys(process.env).filter(key => 
      key.startsWith('TWITTER_') || 
      key.startsWith('DISCORD_') || 
      key.startsWith('AIRTABLE_') || 
      key.startsWith('NOTION_')
    );
    
    return {
      stored: keys,
      environment: envKeys,
      all: [...new Set([...keys, ...envKeys])]
    };
  }

  // Validate required credentials
  validateCredentials() {
    const required = ['DISCORD_WEBHOOK_URL'];
    const optional = [
      'TWITTER_COOKIE',
      'TWITTER_USERNAME',
      'TWITTER_PASSWORD',
      'AIRTABLE_API_KEY',
      'AIRTABLE_BASE_ID',
      'NOTION_API_KEY',
      'NOTION_DATABASE_ID'
    ];

    const missing = [];
    const available = [];

    for (const key of required) {
      if (this.hasCredential(key)) {
        available.push(key);
      } else {
        missing.push(key);
      }
    }

    for (const key of optional) {
      if (this.hasCredential(key)) {
        available.push(key);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      available,
      hasTwitterAuth: this.hasCredential('TWITTER_COOKIE') || 
                     (this.hasCredential('TWITTER_USERNAME') && this.hasCredential('TWITTER_PASSWORD')),
      hasAirtable: this.hasCredential('AIRTABLE_API_KEY') && this.hasCredential('AIRTABLE_BASE_ID'),
      hasNotion: this.hasCredential('NOTION_API_KEY') && this.hasCredential('NOTION_DATABASE_ID')
    };
  }

  // Get configuration for n8n
  getN8nConfig() {
    const validation = this.validateCredentials();
    
    return {
      credentials: {
        discord_webhook: this.getCredential('DISCORD_WEBHOOK_URL'),
        twitter_cookie: this.getCredential('TWITTER_COOKIE'),
        twitter_username: this.getCredential('TWITTER_USERNAME'),
        twitter_password: this.getCredential('TWITTER_PASSWORD'),
        airtable_api_key: this.getCredential('AIRTABLE_API_KEY'),
        airtable_base_id: this.getCredential('AIRTABLE_BASE_ID'),
        notion_api_key: this.getCredential('NOTION_API_KEY'),
        notion_database_id: this.getCredential('NOTION_DATABASE_ID')
      },
      validation
    };
  }
}

module.exports = new CredentialManager();