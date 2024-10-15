const speakeasy = require('speakeasy');
const constants = require('../../config/constants');

// Function to asynchronously generate TOTP
async function getTOTP(secret) {
    return new Promise((resolve, reject) => {
        try {
            const token = speakeasy.totp({
                secret: secret,
                encoding: 'base32' // Use 'base32' encoding for TOTP secret
            });
            resolve(token);
        } catch (error) {
            reject(error);
        }
    });
}

module.exports=getTOTP;

// Example usage
// const secret = constants.kiteKey; // Example secret key

// (async () => {
//     try {
//         const totp = await getTOTP(secret);
//         console.log(`Generated TOTP: ${totp}`);
//     } catch (error) {
//         console.error(`Error generating TOTP: ${error}`);
//     }
// })();
