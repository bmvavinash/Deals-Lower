const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'IPO routes pending' });
});

module.exports = router;
