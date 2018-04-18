let config = require('../confd/config');
let moment = require('moment')
    , P = require('bluebird');
let persistentdb = require('./persistentDBModel');
let db = require('./dbModel');
let logger = require('../helpers/log');

exports.getProduct = function (request) {
    let query = request.params.id;
    return new P(function (resolve, reject) {
        db.getProductById(query).then(function (data) {
            resolve(data);
        }).catch(function (err) {
            reject(err);
        });
    })
};
