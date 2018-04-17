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

    MongoClient.connect(settings.url, {
        poolSize: settings.dbPoolSize
        // other options can go here
    }, function (err, db) {
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
    if (collectionName === 'comments') {
        if (document.isParent) {
            let id = new ObjectId();
            document._id = id;
            document.parentId = id;
        } else {
            document.parentId = new ObjectId(document.parentId);
        }
    }
    return this.getCollection(collectionName).insert(document);
};

exports.insertInbox = function (collectionName, document) {
    if (collectionName === 'comments') {
        if (document.isParent) {
            let id = new ObjectId();
            document._id = id;
            document.parentId = id;
        } else {
            document.parentId = new ObjectId(document.parentId);
        }
    }

    //let query = { sessionId: document.sessionId, owner: document.owner, status: "assigned" };
    let query = { sessionId: document.sessionId, questionId: document.questionId, owner: document.owner };

    return this.getCollection(collectionName).update(query, {
        $set: {
            'sessionId': (document.sessionId).trim(),
            'questionId': (document.questionId).trim(),
            'transactionId': document.transactionId,
            'owner': (document.owner).trim(),
            'assigner': document.assigner.trim(),
            'status': 'assigned',
            'createdAt': document.createdAt
        }
    }, { upsert: true })
};

exports.removeCommentById = function (id, wwid, done) {
    try {
        let key = new ObjectId(id);
        let query = (wwid == -1) ? { "_id": key, "likeCount": { $lte: 0 } } : { "_id": key, "WWID": wwid, "likeCount": { $lte: 0 } };
        return this.getCollection('comments').findOneAndUpdate(query, { $set: { "removed": true } }, { returnOriginal: false }, function (err, data) {
            done(err, data);
        });
    } catch (error) {
        done(error, null);
    }

}

exports.getNestedCommentsCount = function (id, done) {
    try {
        let key = new ObjectId(id);
        return this.getCollection('comments').count({ "parentId": key, "removed": { "$exists": false } }, function (err, data) {
            done(err, data);
        });
    } catch (error) {
        done(error, null);
    }
}


exports.getIncrementalCount = function (id) {
    try {
        let key = new ObjectId(id);
        return this.getCollection('comments').count({ "sessionId": id, "isParent": true});
    } catch (error) {
        return new P(function (resolve, reject) {
            reject(error);
        })
    }
}

exports.updateOne = function (collectionName, id, newValue) {
    return this.getCollection(collectionName).updateOne({ _id: id }, { $set: { "parentId": newValue } });
};

exports.updateSession = function (collectionName, id, wwid, today, newValue) {
    try {
        let query = (wwid == -1) ? { _id: new ObjectId(id), "close_date.date": { $gt: today } } : { _id: new ObjectId(id), "author": wwid, "close_date.date": { $gt: today } };
        return this.getCollection(collectionName).updateOne(query, { $set: newValue });
    } catch (err) {
        return new P(function (resolve, reject) {
            reject(err);
        })
    }
};

exports.updateInboxCommentStatusById = function (questionid, ownerid, status, done) {
    try {
        let key = questionid; //new ObjectId(questionid);
        let query = { "questionId": key, "owner": ownerid };
        return this.getCollection('inbox').findOneAndUpdate(query, { $set: { "status": status } }, { returnOriginal: false }, function (err, data) {
            done(err, data);
        });
    } catch (error) {
        done(error, null);
    }
}

exports.updateQuestionAnsweredStatusById = function (questionid, status, done) {
    try {
        let key = new ObjectId(questionid);
        let query = { "_id": key };
        return this.getCollection('comments').findOneAndUpdate(query, { $set: { "isAnswered": status } }, { returnOriginal: false }, function (err, data) {
            done(err, data);
        });
    } catch (error) {
        done(error, null);
    }
}


exports.findWithPaging = function (collectionName, sessionKey, skip, size, done) {
    collectionName.find({ sessionId: sessionKey }).sort({ parentId: -1 }).skip(skip).limit(size).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });
};


exports.findParentsWithNestedComments = function (collectionName, sessionKey, sortKey, skip, size, done) {

    collectionName.aggregate([
        { "$match": { sessionId: sessionKey } },
        { "$sort": { "parentId": -1, "isParent": -1, "createdAt": -1 } },
        { "$limit": size },
        { "$skip": skip },
        {
            "$group": {
                "_id": {
                    "_id": "$_id",
                    "parentId": "$parentId",
                    "content": "$content",
                    "transactionId": "$transactionId",
                    "createdAt": "$createdAt",
                    "firstName": "$firstName",
                    "lastName": "$lastName",
                    "WWID": "$WWID",
                    "isParent": "$isParent",
                    "likeCount": "$likeCount",
                    "reportedBy": "$reportedBy"
                }
            }
        },
        {
            "$group": {
                "_id": "$_id.parentId",

                "comments": {
                    "$push": {
                        "_id": "$_id",
                    }
                }
            }
        }
    ]).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });

};

exports.findParentsWithNestedCommentsNewest = function (collectionName, sessionKey, skip, size, done) {
    try {
        let validateKey = new ObjectId(sessionKey);
        collectionName.find({ sessionId: sessionKey, "removed": { "$exists": false } }).sort({ "parentId": -1, "isParent": -1, isAnswered: -1, isReply: -1, "createdAt": 1 }).skip(skip).limit(size).toArray(function (err, comments) {
            if (err) {
                done(err, null);
            }
            else {
                done(null, comments);
            }
        });
    } catch (e) {
        done(e, null);
    }
};

exports.findParentsWithNestedReplies = function (collectionName, sessionKey, skip, size, done) {
    try {
        //"isAnswered": false
        let validateKey = new ObjectId(sessionKey);
        //$or: [ { "isReply": true }, { "isAnswered": true } ]
        //collectionName.find({ sessionId: sessionKey, "isReply": true , "removed": { "$exists": false } }).sort({ "parentId": -1, "isParent": -1, isAnswered: -1, isReply: -1, "createdAt": 1 }).skip(skip).limit(size).toArray(function (err, comments) {
        //collectionName.find({ sessionId: sessionKey, $or: [ { "isReply": true }, { "isAnswered": true } ] , "removed": { "$exists": false } }).sort({ "parentId": -1, "isParent": -1, isAnswered: -1, isReply: -1, "createdAt": 1 }).skip(skip).limit(size).toArray(function (err, comments) {

        collectionName.aggregate([
            { $match: { sessionId: sessionKey, "removed": { "$exists": false } } },
            {
                $lookup:
                {
                    from: "comments",
                    localField: "_id",
                    foreignField: "questionId",
                    as: "question_docs"
                }
            }
        ]).toArray(function (err, comments) {

            if (err) {
                done(err, null);
            }
            else {
                done(null, comments);
            }
        });
    } catch (e) {
        done(e, null);
    }
};

exports.findParentsWithNestedCommentsTop = function (collectionName, sessionKey, sortKey, skip, size, done) {

    collectionName.find({ sessionId: sessionKey }).sort({ "likeCount": -1, "parentId": 1 }).skip(skip).limit(size).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });

};

exports.findParentsWithNestedCommentsTopByLikeCount = function (collectionName, sessionKey, sortKey, skip, size, done) {

    // collectionName.aggregate([
    //     { "$match": { sessionId: sessionKey } },
    //     { "$limit": size },
    //     { "$skip": skip },
    //     {
    //         "$group": {
    //             "_id": {
    //                 "_id": "$_id",
    //                 "parentId": "$parentId",
    //                 "content": "$content",
    //                 "transactionId": "$transactionId",
    //                 "createdAt": "$createdAt",
    //                 "firstName": "$firstName",
    //                 "lastName": "$lastName",
    //                 "WWID": "$WWID",
    //                 "isParent": "$isParent",
    //                 "likeCount": "$likeCount"
    //             }
    //         }
    //     },
    //     {
    //         "$group": {
    //             "_id": "$_id.parentId",

    //             "comments": {
    //                 "$push": {
    //                     "_id": "$_id",
    //                 }
    //             }
    //         }
    //     },
    //     { "$sort": { "likeCount": -1, "parentId": -1, "isParent": -1, "createdAt": -1 } }
    // ]).toArray(function (err, comments) {
    //     if (err) {
    //         done(err, null);
    //     }
    //     else {
    //         done(null, comments);
    //     }
    // });

    collectionName.aggregate([
        { "$match": { sessionId: sessionKey, "removed": { "$exists": false } } },
        {
            "$group": {
                "_id": {
                    "_id": "$_id",
                    "parentId": "$parentId",
                    "questionId": "$questionId",
                    "content": "$content",
                    "transactionId": "$transactionId",
                    "createdAt": "$createdAt",
                    "firstName": "$firstName",
                    "lastName": "$lastName",
                    "WWID": "$WWID",
                    "isParent": "$isParent",
                    "likeCount": "$likeCount",
                    "isAnswered": "$isAnswered",
                    "isReply": "$isReply"
                }
            }
        },
        {
            "$group": {
                "_id": "$_id.parentId",

                "comments": {
                    "$push": {
                        "_id": "$_id",
                    }
                }
            }
        },
        { "$sort": { "likeCount": -1, "parentId": -1, "isParent": -1, "createdAt": -1 } }
    ]).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });


};

exports.findAllParentsWithMostVotes = function (collectionName, sessionKey, done) {
    //gets total of likecount and total comments + question with same parentId
    collectionName.aggregate(
        { "$match": { sessionId: sessionKey } },
        { $unwind: '$likeCount' },
        { $group: { _id: '$parentId', numlikes: { $sum: "$likeCount" }, totalItems: { $sum: 1 } } },
        { $totalItems: 1 }
    ).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });


};

exports.findMostlyVotedParentsTop = function (collectionName, sessionKey, sortKey, skip, size, done) {

    collectionName.find({ sessionId: sessionKey }).sort({ "parentId": -1, "isParent": -1, "likeCount": -1 }).skip(skip).limit(size).toArray(function (err, comments) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, comments);
        }
    });

};

exports.findActiveByDateWithPaging = function (collectionName, skip, size, today, done) {
    //start_date: { $gte: today }
    collectionName.find({}).sort({ _id: -1 }).skip(skip).limit(size).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
};

exports.findAnsweredComments = function (collectionName, sessionKey, skip, size, done) {
    try {
        let validateKey = new ObjectId(sessionKey);
        collectionName.find({ "sessionId": sessionKey, $or: [{ "isAnswered": true }, { "isReply": true }] }).sort({ "parentId": -1, "isParent": -1, "createdAt": 1 }).skip(skip).limit(size).toArray(function (err, result) {
            if (err) {
                done(err, null);
            }
            else {
                done(null, result);
            }
        });
    } catch (error) {
        done(error, null);
    }

}

// exports.findAnsweredComments = function (collectionName, sessionKey, skip, size, done) {
//     try {
//         let validateKey = new ObjectId(sessionKey);
//         collectionName.find({ "sessionId": sessionKey, "isAnswered": true }).sort({ "createdAt": 1 }).skip(skip).limit(size).toArray(function (err, result) {
//             if (err) {
//                 done(err, null);
//             }
//             else {
//                 done(null, result);
//             }
//         });
//     } catch (error) {
//         done(error, null);
//     }

// }

exports.findActiveSessions = function (collectionName, skip, size, today, done) {
    //start_date: { $gte: today }
    collectionName.find({ "privacy_hide": false, "start_date.date": { $lte: today }, "close_date.date": { $gt: today } }).sort({ "start_date.date": 1 }).skip(skip).limit(size).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
};

exports.findUserSessions = function (collectionName, wwid, today, done) {
    //start_date: { $gte: today }
    collectionName.find({ "author": wwid, "close_date.date": { $gt: today } }).sort({ "start_date.date": 1 }).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
};

exports.remove = function (collectionName, query) {
    return this.getCollection(collectionName).deleteOne(query);
}

exports.findTotalActiveSessionCount = function (collectionName, today, done) {
    //start_date: { $gte: today }

    //collectionName.find({ "privacy_hide": false, "start_date.date": { $lte: today }, "close_date.date": { $gt: today } }).count(function (err,result) {
    collectionName.find({ "start_date.date": { $lte: today }, "close_date.date": { $gt: today } }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalAssignedUserQuestionsCount = function (collectionName, sessionId, ownerId, done) {
   
    collectionName.find({ "sessionId": sessionId, "owner": ownerId, "status": "assigned" }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalPrivateSessionCount = function (collectionName, today, done) {
    collectionName.find({ "privacy_hide": true }).count(function (err, result) {

        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalQuestionCount = function (collectionName, done) {
    //collectionName.find({ "isParent": true}).count(function (err,result) {
    collectionName.find({ $or: [{ "isParent": true }, { "parentId": null }, { "parentId": "" }, { "parentId": undefined }] }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalCommentCount = function (collectionName, done) {
    //collectionName.find({ "isParent": true}).count(function (err,result) {
    collectionName.find({ $or: [{ "isParent": false }, { "parentId": { $ne: null } }, { "parentId": { $ne: "" } }] }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalActiveCommentCount = function (collectionName, today, done) {
    //today
    //{ "createdAt": { $lte: today }, "createdAt": { $gt: today } 
    //TODO: add logic to find comments for only active sessions
    collectionName.find({ $or: [{ "isParent": false }, { "parentId": { $ne: null } }, { "parentId": { $ne: "" } }] }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalClosedSessionCount = function (collectionName, today, done) {
    collectionName.find({ "close_date.date": { $lte: today } }).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findTotalSessionCount = function (collectionName, today, done) {
    collectionName.find({}).count(function (err, result) {
        if (err) {
            done(null);
        }
        else {
            done(result);
        }
    });
};

exports.findClosedSessions = function (collectionName, skip, size, today, minDate, done) {
    console.log(minDate, today);
    collectionName.find({ "privacy_hide": false, "close_date.date": { $gte: minDate, $lte: today } }).sort({ "start_date.date": 1 }).skip(skip).limit(size).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
};

exports.findUserClosedSessions = function (collectionName, wwid, today, minDate, done) {
    console.log(minDate, today);
    collectionName.find({ "author": wwid, "close_date.date": { $gte: minDate, $lte: today } }).sort({ "start_date.date": 1 }).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
};

exports.findUpcomingSessions = function (collectionName, skip, size, today, done) {

    collectionName.find({ "privacy_hide": false, "start_date.date": { $gt: today } }).sort({ "start_date.date": 1 }).skip(skip).limit(size).toArray(function (err, results) {
        if (err) {
            done(err, null);
        }
        else {
            done(null, results);
        }
    });
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

exports.findCount = function (collectionName, sessionKey, done) {
    collectionName.find({ sessionId: sessionKey }).count(function (err, result) {
        if (err) {
            done(err);
        } else {
            done(result);
        }
    });
};

exports.findCommentByID = function (collectionName, commentID, done) {
    this.getCollection(collectionName).find({ _id: new ObjectId(commentID) }).limit(1).toArray(function (err, result) {
        if (err) {
            done(null, err);
        } else {
            if (result.length == 0)
                done(null, "Comment with id: " + commentID + " not found");
            else
                done(result[0], null);
        }
    });
};


exports.findAssignedSessionCommentsByOwnerID = function (collectionName, sessionId, ownerId, done) {
    this.getCollection(collectionName).find({ sessionId: sessionId, owner: ownerId, status: "assigned" }).toArray(function (err, result) {
        if (err) {
            done(null, err);
        } else {
            
                done(result, null);
        }
    });
};

exports.findAllAssignedSessionComments = function (collectionName, sessionId, done) {
    this.getCollection(collectionName).find({ sessionId: sessionId, status: "assigned" }).toArray(function (err, result) {
        if (err) {
            done(null, err);
        } else {
            
                done(result, null);
        }
    });
};

exports.findUserVote = function (vote, done) {
    this.getCollection('votes').find({ commentId: vote.commentId, user: vote.user }).limit(1).sort({ $natural: -1 }).toArray(function (err, result) {
        if (err) {
            done(null, err);
        } else {
            vote.voted = (result.length > 0) ? -result[0].voted : vote.voted;
            exports.updateLikeCount(vote, vote.voted, done);
        }
    });
};

exports.findUserReport = function (report, reportedBy, done) {
    this.getCollection('reports').find({ commentId: report.commentId, user: report.user }).limit(1).sort({ $natural: -1 }).toArray(function (err, result) {
        if (err) {
            done(null, err);
        } else {
            // exports.removeReport(report, done);
            let isReported = (result.length == 0) ? true : false;
            exports.updateUserReportedBy(report, reportedBy, result, isReported, done);
            //TODO: determine update for isReported field on comment collection
            //done(result, null);
        }
    });
};

exports.updateLikeCount = function (result, counter, done) {
    try {
        this.getCollection('comments').findOneAndUpdate({ _id: new ObjectId(result.commentId) }, { $inc: { likeCount: counter } }, { returnOriginal: false }, function (err, data) {
            if (err)
                done(null, err);
            else
                if (data.value) {
                    result.sessionId = data.value.sessionId;
                    result.likeCount = data.value.likeCount;
                    done(result, null);
                } else {
                    done(null, "Comment id does not exist on persistent DB");
                }
        });
    } catch (err) {
        done(null, err);
    }

}

exports.updateUserReportedBy = function (result, reportedBy, newreport, isReported, done) {
    try {
        if (!reportedBy) {
            reportedBy = [];
            reportedBy.push(result.user);
        }
        else {
            let itemExists = reportedBy.indexOf(result.user);
            //check if user has already reported this comment.
            if (itemExists >= 0 && isReported) {
                done(newreport, null); //do nothing.
            }
            else if (itemExists < 0 && isReported) {
                //add new user to reportedBy list
                reportedBy.push(result.user);
            }
            //if user needs to be removed
            else if (itemExists >= 0 && !isReported) {
                reportedBy.splice(itemExists, 1);
            }
        }
        //this.getCollection('comments').findOneAndUpdate({ _id: new ObjectId(result.commentId) }, { $set: { reportedBy: reportedBy } }, { returnOriginal: false }, { upsert: true }, function (err, data) {
        this.getCollection('comments').findOneAndUpdate({ _id: new ObjectId(result.commentId) }, { $set: { reportedBy: reportedBy } }, { returnOriginal: false }, function (err, data) {
            if (err)
                done(null, err);
            else
                if (data.value) {
                    result.sessionId = data.value.sessionId;
                    result.isReported = data.value.isReported;
                    done(newreport, null);
                } else {
                    done(null, "Comment id does not exist on persistent DB");
                }
        });
    } catch (err) {
        done(null, err);
    }

}

exports.close = function (done) {
    if (state.db) {
        state.db.close(function (err, result) {
            state.db = null;
            state.mode = null;
            done(err)
        })
    }
};
