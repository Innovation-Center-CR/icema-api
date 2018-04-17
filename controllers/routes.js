let express = require('express')
    , router = express.Router();

//Setup routes
router.use('/', require('./products'));

module.exports = router;