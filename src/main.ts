#!/usr/bin/env node

import { Logger } from './utils/Logger';
import { CliApp } from './cli/CliApp';

// Initialize logger
const logger = new Logger({
  level: process.env.LOG_LEVEL as any || 'info',
  format: process.env.LOG_FORMAT as any || 'text',
  enableColors: process.env.NO_COLOR !== '1'
});

// Create and run CLI application
const cli = new CliApp(logger);

async function main() {
  try {
    const args = process.argv.slice(2);
    const exitCode = await cli.run(args);
    process.exit(exitCode);
  } catch (error) {
    logger.error('Fatal error', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main();
}

export { main };