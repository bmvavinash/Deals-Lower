import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input'; // npm install input

const apiId = 27621499; // Get this from my.telegram.org
const apiHash = '9372b6b2fd69a5ec1d53092958cada62'; // Get this from my.telegram.org
const stringSession = new StringSession(''); // Empty string means a new session

(async () => {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });
    
    await client.start({
        phoneNumber: async () => await input.text('Please enter your phone number: '),
        password: async () => await input.text('Please enter your password (if needed): '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });
    
    console.log('You are logged in!');

    console.log('Session:', client.session.save()); // Save this session string to reuse later
})();
