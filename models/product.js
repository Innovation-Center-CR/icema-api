let config = require('../confd/config');
let moment = require('moment')
    , P = require('bluebird');
let persistentdb = require('./persistentDBModel');
let db = require('./dbModel');
let logger = require('../helpers/log');

exports.getComment = function (request, transactionId) {
    let query = request.params.id;
    return new P(function (resolve, reject) {
        if (query && transactionId) {
            persistentdb.getCommentById(query).then(function (data) {
                resolve(data);
            }).catch(function (err) {
                const error = this.getCommentModelError(err, transactionId, request);
                reject(error);
            });
        } else {
            const error = this.getCommentModelError(query, transactionId, request);
            reject(error);
        }
    })
};

exports.createComment = function (request, transactionId) {
    let data = request.body;
    return new P(function (resolve, reject) {
        let comment = data;
        let errorList = exports.validateComment(comment);
        if (errorList && errorList.length == 0) {
            persistentdb.insertComment(comment, transactionId, request)
                .then(function (data) {
                    msgBusDb.insertMessageBusComment(data, transactionId, request).then(function (data) {
                        resolve(data);
                    }).catch(function (err) {
                        reject(err);
                    });
                })
                .catch(function (err) {
                    reject(err);
                });
        } else {
            const error = this.createCommentModelError(errorList, transactionId, request);
            reject(error);
        }
    })
};