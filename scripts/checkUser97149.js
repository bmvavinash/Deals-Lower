#!/usr/bin/env node

/**
 * Check for user with mobile number ending in 97149 and send notification
 */

const { userFavoritesDB } = require('../database/firebaseDB/userFavoritesDB');
const { notifyTelegram, notifyWhatsapp } = require('../services/notifyService');
const { getModuleLogger } = require('../logger/logger');

const logger = getModuleLogger('checkUser97149');

async function findAndNotifyUser97149() {
  try {
    console.log('🔍 Searching for user with mobile number ending in 97149...\n');
    
    // Get all users from the database
    const usersData = await userFavoritesDB.getAllUsers();
    console.log(`📊 Found ${Object.keys(usersData).length} total users in database`);
    
    const foundUsers = [];
    
    // Search for users with mobile ending in 97149
    for (const [userId, userData] of Object.entries(usersData)) {
      console.log(`👤 Checking user: ${userId}`);
      
      // Check various possible mobile number fields
      const mobileFields = [
        userData.mobile,
        userData.phone,
        userData.phoneNumber,
        userData.contact,
        userData.whatsapp?.phone,
        userData.channels?.whatsapp?.phone,
        userData.preferences?.whatsapp?.phone,
        userData.profile?.mobileNumber
      ];
      
      for (const mobile of mobileFields) {
        if (mobile && typeof mobile === 'string' && mobile.includes('97149')) {
          foundUsers.push({
            userId,
            userData,
            mobile
          });
          console.log(`✅ Found user with mobile containing 97149!`);
          console.log(`   User ID: ${userId}`);
          console.log(`   Mobile: ${mobile}`);
          break;
        }
      }
    }
    
    if (foundUsers.length === 0) {
      console.log('❌ No user found with mobile number containing 97149');
      return;
    }
    
    console.log(`\n📱 Found ${foundUsers.length} user(s) with mobile containing 97149:`);
    
    // Send notifications to all found users
    for (let i = 0; i < foundUsers.length; i++) {
      const { userId, userData, mobile } = foundUsers[i];
      
      console.log(`\n👤 User ${i + 1} Details:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Name: ${userData.profile?.name || userData.name || 'Not provided'}`);
      console.log(`   Email: ${userData.profile?.email || userData.email || 'Not provided'}`);
      console.log(`   Mobile: ${mobile}`);
      console.log(`   Telegram: ${userData.telegram?.chatId || 'Not provided'}`);
      console.log(`   WhatsApp: ${userData.whatsapp?.phone || 'Not provided'}`);
      
      // Check notification preferences
      const preferences = userData.preferences || {};
      const notifications = preferences.notifications || {};
      const channels = notifications.channels || {};
      
      console.log(`\n🔔 Notification Preferences:`);
      console.log(`   Notifications Enabled: ${notifications.enabled || false}`);
      console.log(`   Telegram: ${channels.telegram || false}`);
      console.log(`   WhatsApp: ${channels.whatsapp || false}`);
      console.log(`   Push: ${channels.push || false}`);
      console.log(`   Browser: ${channels.browser || false}`);
      
      // Send test notification
      const testMessage = `🎉 Hello ${userData.profile?.name || userData.name || 'User'}!\n\nThis is a test notification from DealsOptimised system.\n\nYour mobile number (${mobile}) has been found in our database.\n\nThis is a system test to verify notification functionality.\n\nBest regards,\nDealsOptimised Team`;
      
      console.log(`\n📤 Sending test notification to user ${i + 1}...`);
      
      let notificationSent = false;
      
      // Try Telegram if available
      if (channels.telegram && userData.telegram?.chatId) {
        try {
          await notifyTelegram(userData.telegram.chatId, testMessage);
          console.log('✅ Telegram notification sent successfully');
          notificationSent = true;
        } catch (error) {
          console.log('❌ Failed to send Telegram notification:', error.message);
        }
      }
      
      // Try WhatsApp if available
      if (channels.whatsapp && userData.whatsapp?.phone) {
        try {
          await notifyWhatsapp(userData.whatsapp.phone, testMessage);
          console.log('✅ WhatsApp notification sent successfully');
          notificationSent = true;
        } catch (error) {
          console.log('❌ Failed to send WhatsApp notification:', error.message);
        }
      }
      
      // Try direct mobile number if no specific channel found
      if (!notificationSent) {
        try {
          await notifyWhatsapp(mobile, testMessage);
          console.log('✅ WhatsApp notification sent to mobile number');
          notificationSent = true;
        } catch (error) {
          console.log('❌ Failed to send WhatsApp notification to mobile:', error.message);
        }
      }
      
      if (!notificationSent) {
        console.log('❌ No notification channels available or all failed');
      }
    }
    
    console.log('\n✅ User check and notification process completed');
    
  } catch (error) {
    logger.error('Error in findAndNotifyUser97149', { error: error.message, stack: error.stack });
    console.error('❌ Error:', error.message);
  }
}

// Run the function
if (require.main === module) {
  findAndNotifyUser97149()
    .then(() => {
      console.log('\n🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { findAndNotifyUser97149 };
