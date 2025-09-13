const fs = require('fs');
const path = require('path');
const os = require('os');

class ProcessLock {
  constructor(lockFileName = 'dealsoptimised.lock') {
    this.lockFile = path.join(os.tmpdir(), lockFileName);
    this.pid = process.pid;
  }

  async acquire() {
    try {
      // Check if lock file exists
      if (fs.existsSync(this.lockFile)) {
        const lockData = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
        
        // Check if the process is still running
        try {
          process.kill(lockData.pid, 0); // This will throw if process doesn't exist
          console.log(`Another instance is already running (PID: ${lockData.pid})`);
          return false;
        } catch (error) {
          // Process doesn't exist, remove stale lock file
          console.log('Removing stale lock file');
          fs.unlinkSync(this.lockFile);
        }
      }

      // Create lock file
      const lockData = {
        pid: this.pid,
        timestamp: new Date().toISOString(),
        hostname: os.hostname()
      };
      
      fs.writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2));
      console.log(`Process lock acquired (PID: ${this.pid})`);
      return true;
    } catch (error) {
      console.error('Failed to acquire process lock:', error.message);
      return false;
    }
  }

  release() {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
        console.log('Process lock released');
      }
    } catch (error) {
      console.error('Failed to release process lock:', error.message);
    }
  }

  // Cleanup on process exit
  setupCleanup() {
    const cleanup = () => {
      this.release();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    process.on('uncaughtException', cleanup);
    process.on('unhandledRejection', cleanup);
  }
}

module.exports = ProcessLock;


