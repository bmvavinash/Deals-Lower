const config = require("./config");

const users = {
    dealsglobalhub: {
        username: 'dealsglobalhub',
        telegramId: config.TELEGRAM_CHANNELS.ALL_DEALS,
        // telegramId: 'telegramid1',
        telegramToken: '5759815900:AAH-Xd2wQhU4JBhNOF26bfu-plI8oGaU9qQ',
        amazonTagId: 'dealshubglo0c-21',
    },
    dealsworldlinks: {
        username: 'dealsworldlinks',
        telegramId: '@DealsHubWorld',
        telegramToken: '7717095838:AAGIWxqLaTjXVrHJTRFiFhGCVtuK14k7wQc',
        amazonTagId: '',
    }
};

module.exports = { users };
