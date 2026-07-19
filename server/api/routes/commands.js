const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const admin = require('firebase-admin');
const constants = require('../../../config/constants.js');
const config = require('../../../config/config.js');

const commandsFilePath = path.join(__dirname, '../../../config/commandsList.json');

// Initialize Firebase Admin if not already initialized
const dbname = constants.postingTypesConfig[constants.type].DB;
let DB_Name = config.DATABASE_CONFIG[`${dbname}_NAME`];
const filePath = config.DATABASE_CONFIG[`${dbname}_TOKEN_FILE`];
const defaultApp = admin.apps.find(app => app.name === '[DEFAULT]');
if (!defaultApp) {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  if (!serviceAccount) {
    try {
      serviceAccount = require(`${constants.pathToFile}/${filePath}.json`);
    } catch (e) {
      console.error(`Firebase credentials file not found at ${constants.pathToFile}/${filePath}.json and no FIREBASE_SERVICE_ACCOUNT_JSON env variable provided.`);
      throw e;
    }
  }
  const databaseURL = DB_Name === 'lowerdealhub' 
    ? `https://${DB_Name}-default-rtdb.asia-southeast1.firebasedatabase.app`
    : `https://${DB_Name}-default-rtdb.firebaseio.com`;
    
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(commandsFilePath)) {
            return res.status(404).json({ success: false, message: 'commandsList.json not found' });
        }
        const data = fs.readFileSync(commandsFilePath, 'utf8');
        res.json({ success: true, commands: JSON.parse(data) });
    } catch (error) {
        console.error('Error reading commands:', error);
        res.status(500).json({ success: false, message: 'Failed to read commands list' });
    }
});

router.post('/execute', async (req, res) => {
    const { id } = req.body;
    
    try {
        if (!fs.existsSync(commandsFilePath)) {
            return res.status(404).json({ success: false, message: 'commandsList.json not found' });
        }
        
        const data = fs.readFileSync(commandsFilePath, 'utf8');
        const commands = JSON.parse(data);
        const commandObj = commands.find(c => c.id === id);
        
        if (!commandObj) {
            return res.status(404).json({ success: false, message: 'Command not found' });
        }
        
        // If hybrid execution is enabled (production mode), queue command in Firebase for local runner execution
        if (process.env.HYBRID_EXECUTION === 'true' || constants.env === 'prod') {
            const db = admin.database();
            const queueRef = db.ref('commandsQueue');
            const newCommandRef = queueRef.push();
            
            await newCommandRef.set({
                id: id,
                command: commandObj.command,
                name: commandObj.name,
                role: commandObj.role || 'all',
                status: 'pending',
                createdAt: new Date().toISOString(),
                triggeredBy: 'api'
            });
            
            return res.json({ 
                success: true, 
                message: `Command "${commandObj.name}" has been queued in Firebase for execution by your local daemon.`,
                queuedId: newCommandRef.key
            });
        }
        
        // Otherwise, execute command locally (normal development scenario)
        const process = exec(commandObj.command, { cwd: path.join(__dirname, '../../../') }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${id}:`, error);
                return;
            }
            console.log(`Command ${id} completed. Stdout: ${stdout}`);
        });
        
        res.json({ 
            success: true, 
            message: `Command "${commandObj.name}" has been started successfully.`,
            pid: process.pid
        });
        
    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({ success: false, message: 'Failed to execute command' });
    }
});

module.exports = router;
