//require('newrelic');
let express = require('express')
    , app = express()
    , cors = require('cors')
    , db = require('./helpers/db')
    , helmet = require('helmet')
    , port = process.env.PORT || 3000;

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
let config = require('./confd/config');

app.use(bodyParser({limit: '5mb'}));

app.use(bodyParser.json());

// This will be for CORS, we will use this in the future
// var originsWhitelist = config.whiteListUrls;

// var corsOptions = {
//     origin: function (origin, callback) {
//         var isWhitelisted = originsWhitelist.indexOf(origin) !== -1;
//         callback(null, isWhitelisted);
//     },
//     credentials: true
// }
// HERE is the magic for CORS
// app.use(cors(corsOptions));


app.use(require('./controllers/routes'));
app.use(helmet());


let settings = { url: config.dbUrl };
db.connect(settings, function (err) {
    if (err) {
        console.error('An error ocurred when connecting to the persistent db - ', err);
        process.exit(1);
    } else {
      // If the connection with MongoDB is OK, lets run the API
      app.listen(port, function () {
        console.log("App started successfully");
    });
    }
});

module.exports = app