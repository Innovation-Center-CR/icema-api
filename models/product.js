let config = require('../confd/config');
let moment = require('moment')
    , P = require('bluebird');
let dbModel = require('./dbModel');

exports.getProduct = function (request) {
    let query = request.params.id;
    return new P(function (resolve, reject) {
        dbModel.getProductById(query).then(function (data) {
            resolve(data);
        }).catch(function (err) {
            reject(err);
        });
    })
};
