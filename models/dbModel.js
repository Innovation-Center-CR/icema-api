let config = require('../confd/config');
let db = require('../helpers/db')
    , moment = require('moment')
    , P = require('bluebird');

module.exports.getProductById = function (commentId) {

    return new P(function (resolve, reject) {
        db.findCommentByID('products', commentId, function (result, err) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports.insertProduct = function (comment, transactionId) {
    return new P(function (resolve, reject) {
        let createdAt = moment.utc().toDate();
        let updatedAt = moment.utc().toDate();
        try {
                let newProduct = {
                    'transactionId': transactionId,
                    'createdAt': createdAt,
                    'updatedAt': updatedAt
                }

                db.insert('comments', newProduct).then(function (data) {
                    resolve({ data });
                }).catch(function (err) {
                    reject(error);
                })
        } catch (error) {
            reject(_error);
        }
    });

}

