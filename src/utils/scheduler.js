const cron = require('cron');
const logger = require('./logger');

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  start(intervalHours, callback) {
    // Create cron pattern for every N hours
    const cronPattern = `0 0 */${intervalHours} * * *`;
    
    const job = new cron.CronJob(cronPattern, async () => {
      try {
        logger.info('Scheduled job starting...');
        await callback();
        logger.info('Scheduled job completed');
      } catch (error) {
        logger.error('Scheduled job failed:', error);
      }
    });

    job.start();
    this.jobs.push(job);
    
    logger.info(`Scheduled job created with pattern: ${cronPattern}`);
  }

  startDaily(hour, minute, callback) {
    const cronPattern = `0 ${minute} ${hour} * * *`;
    
    const job = new cron.CronJob(cronPattern, async () => {
      try {
        logger.info('Daily scheduled job starting...');
        await callback();
        logger.info('Daily scheduled job completed');
      } catch (error) {
        logger.error('Daily scheduled job failed:', error);
      }
    });

    job.start();
    this.jobs.push(job);
    
    logger.info(`Daily scheduled job created with pattern: ${cronPattern}`);
  }

  stop() {
    this.jobs.forEach(job => {
      job.stop();
    });
    this.jobs = [];
    logger.info('All scheduled jobs stopped');
  }

  getStatus() {
    return {
      activeJobs: this.jobs.length,
      jobs: this.jobs.map(job => ({
        running: job.running,
        nextDate: job.nextDates()
      }))
    };
  }
}

module.exports = new Scheduler();