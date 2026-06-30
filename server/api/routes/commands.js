const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const commandsFilePath = path.join(__dirname, '../../../config/commandsList.json');

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

router.post('/execute', (req, res) => {
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
        
        // Execute the command asynchronously
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
