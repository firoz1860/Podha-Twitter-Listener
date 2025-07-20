const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.limits = {
      twitter: {
        requests: 15,
        window: 15 * 60 * 1000 // 15 minutes
      },
      discord: {
        requests: 50,
        window: 60 * 1000 // 1 minute
      },
      nitter: {
        requests: 30,
        window: 60 * 1000 // 1 minute
      }
    };
  }

  async checkLimit(service, identifier = 'default') {
    const key = `${service}:${identifier}`;
    const limit = this.limits[service];
    
    if (!limit) {
      logger.warn(`No rate limit configured for service: ${service}`);
      return true;
    }

    const now = Date.now();
    const windowStart = now - limit.window;
    
    // Get or create request history for this key
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const requestHistory = this.requests.get(key);
    
    // Remove old requests outside the window
    const validRequests = requestHistory.filter(timestamp => timestamp > windowStart);
    this.requests.set(key, validRequests);
    
    // Check if we're within limits
    if (validRequests.length >= limit.requests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = oldestRequest + limit.window - now;
      
      logger.warn(`Rate limit exceeded for ${service}. Wait ${Math.ceil(waitTime / 1000)}s`);
      return false;
    }
    
    // Record this request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  async waitForLimit(service, identifier = 'default') {
    const key = `${service}:${identifier}`;
    const limit = this.limits[service];
    
    if (!limit) return;
    
    const now = Date.now();
    const windowStart = now - limit.window;
    const requestHistory = this.requests.get(key) || [];
    const validRequests = requestHistory.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= limit.requests) {
      const oldestRequest = Math.min(...validRequests);
      const waitTime = oldestRequest + limit.window - now;
      
      if (waitTime > 0) {
        logger.info(`Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset`);
        await this.delay(waitTime);
      }
    }
  }

  getStatus(service) {
    const limit = this.limits[service];
    if (!limit) return null;
    
    const now = Date.now();
    const windowStart = now - limit.window;
    const allRequests = [];
    
    // Collect all requests for this service
    for (const [key, requests] of this.requests.entries()) {
      if (key.startsWith(`${service}:`)) {
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        allRequests.push(...validRequests);
      }
    }
    
    return {
      service,
      currentRequests: allRequests.length,
      maxRequests: limit.requests,
      windowMs: limit.window,
      resetTime: allRequests.length > 0 ? Math.min(...allRequests) + limit.window : now
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    
    for (const [key, requests] of this.requests.entries()) {
      const service = key.split(':')[0];
      const limit = this.limits[service];
      
      if (limit) {
        const windowStart = now - limit.window;
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        
        if (validRequests.length === 0) {
          this.requests.delete(key);
        } else {
          this.requests.set(key, validRequests);
        }
      }
    }
  }

  // Start periodic cleanup
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }
}

module.exports = new RateLimiter();