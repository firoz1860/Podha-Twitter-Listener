const logger = require('../utils/logger');

class FilterEngine {
  constructor() {
    this.filters = [
      {
        name: 'Podha RWA',
        query: 'filter:blue_verified min_faves:3 Podha AND ("RWA" OR "Real World Assets" OR "Yield")',
        description: 'Podha Protocol mentions with RWA keywords'
      },
      {
        name: 'Solana Smart Vaults',
        query: 'filter:blue_verified min_faves:3 Solana AND ("Smart Vaults" OR "Safe Yield" OR "Podha")',
        description: 'Solana mentions with Smart Vaults and Podha keywords'
      },
      {
        name: 'Bitcoin Tokenized Treasury',
        query: 'filter:blue_verified min_faves:3 Bitcoin AND ("tokenized treasury" OR "credit protocol" OR "RWA on-chain")',
        description: 'Bitcoin mentions with tokenized treasury keywords'
      },
      {
        name: 'DeFi Custodial',
        query: 'filter:blue_verified min_faves:3 DeFi AND ("custodial vault" OR "delta neutral")',
        description: 'DeFi mentions with custodial and delta neutral keywords'
      }
    ];
  }

  getSearchQueries() {
    // Return both original and simplified queries for better results
    const queries = [];
    this.filters.forEach(filter => {
      queries.push(filter.query);
      // Add simplified version for better success rate
      queries.push(this.simplifyQuery(filter.query));
    });
    // Remove duplicates
    return [...new Set(queries)];
  }

  // Simplify complex queries for better results
  simplifyQuery(query) {
    // Extract main keywords from complex Twitter search syntax
    const keywords = [];
    
    // Extract quoted terms
    const quotedTerms = query.match(/"([^"]+)"/g);
    if (quotedTerms) {
      quotedTerms.forEach(term => {
        keywords.push(term.replace(/"/g, ''));
      });
    }
    
    // Extract main terms (non-filter words)
    const words = query.split(/\s+/);
    words.forEach(word => {
      if (!word.includes('filter:') && 
          !word.includes('min_faves:') && 
          !['AND', 'OR', '(', ')'].includes(word) &&
          !word.startsWith('"')) {
        keywords.push(word);
      }
    });
    
    // Return simplified query with main keywords
    return keywords.slice(0, 2).join(' '); // Limit to 2 main keywords
  }

  getFilters() {
    return this.filters;
  }

  addCustomFilter(name, query, description) {
    this.filters.push({
      name,
      query,
      description
    });
    logger.info(`Added custom filter: ${name}`);
  }

  validateQuery(query) {
    // Basic validation for Twitter search syntax
    const requiredElements = ['filter:blue_verified', 'min_faves:3'];
    
    for (const element of requiredElements) {
      if (!query.includes(element)) {
        return {
          valid: false,
          error: `Query must include ${element}`
        };
      }
    }

    // Check for logical operators
    const hasLogicalOperators = query.includes('AND') || query.includes('OR');
    if (!hasLogicalOperators) {
      return {
        valid: false,
        error: 'Query should include logical operators (AND/OR)'
      };
    }

    return { valid: true };
  }

  formatQuery(baseQuery, keywords, operator = 'OR') {
    const keywordString = keywords.map(k => `"${k}"`).join(` ${operator} `);
    return `${baseQuery} (${keywordString})`;
  }

  // Helper method to build queries programmatically
  buildQuery(options) {
    const {
      baseFilters = ['filter:blue_verified', 'min_faves:3'],
      mainKeyword,
      keywords = [],
      operator = 'OR'
    } = options;

    let query = baseFilters.join(' ');
    
    if (mainKeyword) {
      query += ` ${mainKeyword}`;
    }

    if (keywords.length > 0) {
      const keywordString = keywords.map(k => `"${k}"`).join(` ${operator} `);
      query += ` AND (${keywordString})`;
    }

    return query;
  }

  // Method to test if a tweet matches our criteria
  matchesCriteria(tweet) {
    const text = tweet.text.toLowerCase();
    
    // Check for minimum engagement
    if (tweet.likes < 3) {
      return false;
    }

    // Check for blue verification (if available in tweet data)
    if (tweet.author && tweet.author.includes('blue_verified')) {
      return true;
    }

    // Check for keyword matches
    const podhaKeywords = ['podha', 'rwa', 'real world assets', 'yield', 'smart vaults', 'safe yield'];
    const defiKeywords = ['defi', 'custodial vault', 'delta neutral', 'tokenized treasury', 'credit protocol'];
    const allKeywords = [...podhaKeywords, ...defiKeywords];

    return allKeywords.some(keyword => text.includes(keyword));
  }

  // Get trending keywords from recent tweets
  extractTrendingKeywords(tweets) {
    const keywordCount = {};
    
    tweets.forEach(tweet => {
      const words = tweet.text.toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Clean the word
        const cleanWord = word.replace(/[^a-z0-9]/g, '');
        
        if (cleanWord.length > 3 && !this.isStopWord(cleanWord)) {
          keywordCount[cleanWord] = (keywordCount[cleanWord] || 0) + 1;
        }
      });
    });

    // Sort by frequency
    const sortedKeywords = Object.entries(keywordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    return sortedKeywords;
  }

  isStopWord(word) {
    const stopWords = ['the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that', 'will', 'have', 'has'];
    return stopWords.includes(word);
  }
}

module.exports = FilterEngine;


// const logger = require('../utils/logger');

// class FilterEngine {
//   constructor() {
//     this.filters = [
//       {
//         name: 'Podha RWA',
//         query: 'filter:blue_verified min_faves:3 Podha AND ("RWA" OR "Real World Assets" OR "Yield")',
//         description: 'Podha Protocol mentions with RWA keywords'
//       },
//       {
//         name: 'Solana Smart Vaults',
//         query: 'filter:blue_verified min_faves:3 Solana AND ("Smart Vaults" OR "Safe Yield" OR "Podha")',
//         description: 'Solana mentions with Smart Vaults and Podha keywords'
//       },
//       {
//         name: 'Bitcoin Tokenized Treasury',
//         query: 'filter:blue_verified min_faves:3 Bitcoin AND ("tokenized treasury" OR "credit protocol" OR "RWA on-chain")',
//         description: 'Bitcoin mentions with tokenized treasury keywords'
//       },
//       {
//         name: 'DeFi Custodial',
//         query: 'filter:blue_verified min_faves:3 DeFi AND ("custodial vault" OR "delta neutral")',
//         description: 'DeFi mentions with custodial and delta neutral keywords'
//       }
//     ];
//   }

//   getSearchQueries() {
//     return this.filters.map(filter => filter.query);
//   }

//   getFilters() {
//     return this.filters;
//   }

//   addCustomFilter(name, query, description) {
//     this.filters.push({
//       name,
//       query,
//       description
//     });
//     logger.info(`Added custom filter: ${name}`);
//   }

//   validateQuery(query) {
//     // Basic validation for Twitter search syntax
//     const requiredElements = ['filter:blue_verified', 'min_faves:3'];
    
//     for (const element of requiredElements) {
//       if (!query.includes(element)) {
//         return {
//           valid: false,
//           error: `Query must include ${element}`
//         };
//       }
//     }

//     // Check for logical operators
//     const hasLogicalOperators = query.includes('AND') || query.includes('OR');
//     if (!hasLogicalOperators) {
//       return {
//         valid: false,
//         error: 'Query should include logical operators (AND/OR)'
//       };
//     }

//     return { valid: true };
//   }

//   formatQuery(baseQuery, keywords, operator = 'OR') {
//     const keywordString = keywords.map(k => `"${k}"`).join(` ${operator} `);
//     return `${baseQuery} (${keywordString})`;
//   }

//   // Helper method to build queries programmatically
//   buildQuery(options) {
//     const {
//       baseFilters = ['filter:blue_verified', 'min_faves:3'],
//       mainKeyword,
//       keywords = [],
//       operator = 'OR'
//     } = options;

//     let query = baseFilters.join(' ');
    
//     if (mainKeyword) {
//       query += ` ${mainKeyword}`;
//     }

//     if (keywords.length > 0) {
//       const keywordString = keywords.map(k => `"${k}"`).join(` ${operator} `);
//       query += ` AND (${keywordString})`;
//     }

//     return query;
//   }

//   // Method to test if a tweet matches our criteria
//   matchesCriteria(tweet) {
//     const text = tweet.text.toLowerCase();
    
//     // Check for minimum engagement
//     if (tweet.likes < 3) {
//       return false;
//     }

//     // Check for blue verification (if available in tweet data)
//     if (tweet.author && tweet.author.includes('blue_verified')) {
//       return true;
//     }

//     // Check for keyword matches
//     const podhaKeywords = ['podha', 'rwa', 'real world assets', 'yield', 'smart vaults', 'safe yield'];
//     const defiKeywords = ['defi', 'custodial vault', 'delta neutral', 'tokenized treasury', 'credit protocol'];
//     const allKeywords = [...podhaKeywords, ...defiKeywords];

//     return allKeywords.some(keyword => text.includes(keyword));
//   }

//   // Get trending keywords from recent tweets
//   extractTrendingKeywords(tweets) {
//     const keywordCount = {};
    
//     tweets.forEach(tweet => {
//       const words = tweet.text.toLowerCase().split(/\s+/);
//       words.forEach(word => {
//         // Clean the word
//         const cleanWord = word.replace(/[^a-z0-9]/g, '');
        
//         if (cleanWord.length > 3 && !this.isStopWord(cleanWord)) {
//           keywordCount[cleanWord] = (keywordCount[cleanWord] || 0) + 1;
//         }
//       });
//     });

//     // Sort by frequency
//     const sortedKeywords = Object.entries(keywordCount)
//       .sort(([,a], [,b]) => b - a)
//       .slice(0, 10);

//     return sortedKeywords;
//   }

//   isStopWord(word) {
//     const stopWords = ['the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that', 'will', 'have', 'has'];
//     return stopWords.includes(word);
//   }
// }

// module.exports = FilterEngine;