const fs = require('fs');
const path = require('path');

class LogViewer {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
  }

  // Get all log files
  getLogFiles() {
    try {
      const files = fs.readdirSync(this.logsDir);
      return files.filter(file => file.endsWith('.log')).map(file => ({
        name: file,
        path: path.join(this.logsDir, file),
        size: fs.statSync(path.join(this.logsDir, file)).size
      }));
    } catch (error) {
      console.error('Error reading logs directory:', error.message);
      return [];
    }
  }

  // Read log file content
  readLogFile(filename, lines = 100) {
    try {
      const filePath = path.join(this.logsDir, filename);
      if (!fs.existsSync(filePath)) {
        console.error(`Log file ${filename} not found`);
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const logLines = content.split('\n').filter(line => line.trim());
      
      // Return last N lines
      return logLines.slice(-lines);
    } catch (error) {
      console.error('Error reading log file:', error.message);
      return [];
    }
  }

  // Filter logs by platform
  filterByPlatform(logLines, platform) {
    return logLines.filter(line => {
      try {
        const log = JSON.parse(line);
        return log.message && log.message.includes(`[${platform}]`);
      } catch {
        return line.includes(`[${platform}]`);
      }
    });
  }

  // Filter logs by level
  filterByLevel(logLines, level) {
    return logLines.filter(line => {
      try {
        const log = JSON.parse(line);
        return log.level === level;
      } catch {
        return line.toLowerCase().includes(`[${level}]`);
      }
    });
  }

  // Filter logs by error type
  filterByError(logLines, errorType) {
    return logLines.filter(line => {
      try {
        const log = JSON.parse(line);
        return log.message && log.message.includes(errorType);
      } catch {
        return line.includes(errorType);
      }
    });
  }

  // Search logs by keyword
  searchLogs(logLines, keyword) {
    return logLines.filter(line => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // Get recent errors
  getRecentErrors(filename = null, hours = 24) {
    const files = filename ? [filename] : this.getLogFiles().map(f => f.name);
    const allErrors = [];

    files.forEach(file => {
      const lines = this.readLogFile(file, 1000);
      const errors = this.filterByLevel(lines, 'error');
      allErrors.push(...errors);
    });

    // Filter by time (simple implementation)
    return allErrors.slice(-50); // Return last 50 errors
  }

  // Display log summary
  showSummary() {
    const files = this.getLogFiles();
    console.log('\n=== LOG FILES SUMMARY ===');
    files.forEach(file => {
      const sizeKB = (file.size / 1024).toFixed(2);
      console.log(`${file.name} - ${sizeKB} KB`);
    });

    // Show recent errors count
    const recentErrors = this.getRecentErrors();
    console.log(`\nRecent errors: ${recentErrors.length}`);
  }

  // Interactive log viewer
  async viewLogs() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n=== LOG VIEWER ===');
    console.log('Commands:');
    console.log('  list - Show all log files');
    console.log('  read <filename> [lines] - Read log file');
    console.log('  errors [filename] - Show recent errors');
    console.log('  platform <platform> [filename] - Filter by platform');
    console.log('  level <level> [filename] - Filter by log level');
    console.log('  search <keyword> [filename] - Search logs');
    console.log('  summary - Show log summary');
    console.log('  quit - Exit');

    const askQuestion = () => {
      rl.question('\nEnter command: ', async (input) => {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();

        try {
          switch (command) {
            case 'list':
              const files = this.getLogFiles();
              files.forEach(file => {
                const sizeKB = (file.size / 1024).toFixed(2);
                console.log(`${file.name} - ${sizeKB} KB`);
              });
              break;

            case 'read':
              const filename = parts[1];
              const lines = parseInt(parts[2]) || 50;
              if (!filename) {
                console.log('Usage: read <filename> [lines]');
                break;
              }
              const logLines = this.readLogFile(filename, lines);
              logLines.forEach(line => console.log(line));
              break;

            case 'errors':
              const errorFile = parts[1];
              const errors = this.getRecentErrors(errorFile);
              errors.forEach(error => console.log(error));
              break;

            case 'platform':
              const platform = parts[1];
              const platformFile = parts[2];
              if (!platform) {
                console.log('Usage: platform <platform> [filename]');
                break;
              }
              const platformLogs = platformFile ? 
                this.readLogFile(platformFile, 100) : 
                this.getLogFiles().flatMap(f => this.readLogFile(f.name, 100));
              const filtered = this.filterByPlatform(platformLogs, platform);
              filtered.forEach(line => console.log(line));
              break;

            case 'level':
              const level = parts[1];
              const levelFile = parts[2];
              if (!level) {
                console.log('Usage: level <level> [filename]');
                break;
              }
              const levelLogs = levelFile ? 
                this.readLogFile(levelFile, 100) : 
                this.getLogFiles().flatMap(f => this.readLogFile(f.name, 100));
              const levelFiltered = this.filterByLevel(levelLogs, level);
              levelFiltered.forEach(line => console.log(line));
              break;

            case 'search':
              const keyword = parts[1];
              const searchFile = parts[2];
              if (!keyword) {
                console.log('Usage: search <keyword> [filename]');
                break;
              }
              const searchLogs = searchFile ? 
                this.readLogFile(searchFile, 100) : 
                this.getLogFiles().flatMap(f => this.readLogFile(f.name, 100));
              const searchResults = this.searchLogs(searchLogs, keyword);
              searchResults.forEach(line => console.log(line));
              break;

            case 'summary':
              this.showSummary();
              break;

            case 'quit':
            case 'exit':
              rl.close();
              return;

            default:
              console.log('Unknown command. Type "help" for available commands.');
          }
        } catch (error) {
          console.error('Error executing command:', error.message);
        }

        askQuestion();
      });
    };

    askQuestion();
  }
}

// CLI usage
if (require.main === module) {
  const viewer = new LogViewer();
  
  if (process.argv.length > 2) {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    switch (command) {
      case 'summary':
        viewer.showSummary();
        break;
      case 'errors':
        const errors = viewer.getRecentErrors(args[0]);
        errors.forEach(error => console.log(error));
        break;
      case 'platform':
        if (!args[0]) {
          console.log('Usage: node logViewer.js platform <platform> [filename]');
          break;
        }
        const files = args[1] ? [args[1]] : viewer.getLogFiles().map(f => f.name);
        files.forEach(file => {
          const logs = viewer.readLogFile(file, 100);
          const filtered = viewer.filterByPlatform(logs, args[0]);
          if (filtered.length > 0) {
            console.log(`\n=== ${file} ===`);
            filtered.forEach(line => console.log(line));
          }
        });
        break;
      default:
        console.log('Usage: node logViewer.js <command> [args]');
        console.log('Commands: summary, errors, platform');
    }
  } else {
    viewer.viewLogs();
  }
}

module.exports = LogViewer; 