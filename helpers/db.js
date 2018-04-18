var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
let P = require('bluebird');

var state = {
    db: null,
}

/**
*
* @type {exports}
*/
exports.connect = function (settings, done) {
    if (state.db) return done()

    MongoClient.connect(settings.url, function (err, db) {
        if (err) return done(err)
        state.db = db
        done()
    })
}

exports.get = function () {
    return state.db;
};

exports.getCollection = function (collectionName) {
    return this.get().collection(collectionName);
};
exports.insert = function (collectionName, document) {
    return this.getCollection(collectionName).insert(document);
};

exports.findOne = function (collectionName, id, done) {
    try {
        collectionName.findOne({ _id: new ObjectId(id) }, function (err, result) {
            if (err) {
                done(err, null);
            }
            else {
                done(null, result);
            }
        });
    } catch (e) {
        done(e, null)
    }

};

exports.findSorted = function (collectionName, sessionKey, size, done) {
    collectionName.find({ sessionId: sessionKey }).sort({ $natural: -1 }).limit(size).toArray(function (err, result) {
        if (err) {
            done(err);
        }
        else {
            done(result);
        }
    });
};

exports.close = function (done) {
    if (state.db) {
        state.db.close(function (err, result) {
            state.db = null;
            state.mode = null;
            done(err)
        })
    }
};
