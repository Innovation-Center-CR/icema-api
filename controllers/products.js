let express = require('express')
    , router = express.Router()
    , uuid = require('uuid/v4');
let product = require('../models/product');
let config = require('../confd/config');

//Gets a product based on ID
router.get("/product/:id", function (request, response) {
    const transactionId = uuid();
    product.getComment(request, transactionId)
        .then(function (data) {
            response.status(200).json(data);
        })
        .catch(function (err) {
            response.status(err.httpStatusCode).json(err.log_message);
        });
});

//Inserts a new product
router.post("/product", function (request, response) {
    const transactionId = uuid();
    if (!avaAuth.isUserBBValid(request, transactionId)) {
        let error = "Invalid user type";
        response.status(401).json(error);
    }
    product.createComment(request, transactionId)
        .then(function (data) {
            response.status(200).json(data);
        })
        .catch(function (err) {
            response.status(err.httpStatusCode).json(err.log_message + " - " + err.Exception);
        });
});

module.exports = router;