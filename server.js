var express = require('express');
var validator = require('validator');
var mongo = require('mongodb').MongoClient

var app = express();

// Mongodb pre tasks
var mongoUri = process.env.MONGODB_URI;

mongo.connect(mongoUri, function(err, db) {
    if (err) {
        console.log(err);
        throw err;
    }
    else {
        var collection = db.collection('urls');
        
        collection.createIndex(
            { url : "text" },
            function(err, result) {
                if (err) console.log(err);
            }
        );
        
        db.collection("counters").insert({
            _id: "urlid",
            seq: 0
        });
        
        db.close();
    }
});


// create short url
app.get('/new/:urlInput*', function (req, res) {
    try {
        var output = {};
        var urlToBeShortened = req.params.urlInput + req.params[0];
        
        if (validator.isURL(urlToBeShortened)) {
            var urlId;
            
            mongo.connect(mongoUri, function(err, db) {
                if (err) {
                    console.log(err);
                    throw err;
                }
                else {
                    var collection = db.collection('urls');
                    
                    collection.find({url: urlToBeShortened})
                        .toArray(function(err, docs) {
                            if (err) {
                                console.log(err);
                                throw err;
                            }
                            if (docs[0]) {
                                urlId = docs[0]._id;
                                output.original_url = urlToBeShortened;
                                output.short_url = "https://" + req.headers.host + "/" + urlId;
                                
                                db.close();
                                
                                res.json(output);
                            }
                            else {
                                getNextSequence(db, "urlid", function(err, result) {
                                    if (err) {
                                        console.log(err);
                                        throw err;
                                    }
                                    else {
                                        urlId = result;
                                        collection.insert({
                                            "_id": result,
                                            "url": urlToBeShortened
                                        }, function (err, result) {
                                            if (err) {
                                                console.log(err);
                                                throw err;
                                            }
                                            else {
                                                output.original_url = urlToBeShortened;
                                                output.short_url = "https://" + req.headers.host + "/" + urlId;
                                                
                                                db.close();
                                                
                                                res.json(output);
                                            }
                                        });
                                    }
                                });
                            }
                        }
                    );
                }
            });
        }
        else {
            output.error = "Invalid URL";
            res.json(output);
        }
    }
    catch (e) {
        res.sendStatus(500);
    }
});

// navigate to short url
app.get('/:urlId', function (req, res) {
    try {
        mongo.connect(mongoUri, function(err, db) {
            if (err) {
                console.log(err);
                throw err;
            }
            else {
                var collection = db.collection('urls');
                
                collection.find({_id: parseInt(req.params.urlId)})
                    .toArray(function(err, docs) {
                        if (err) {
                            console.log(err);
                            throw err;
                        }
                        if (docs[0]) {
                            db.close();
                            
                            res.redirect(docs[0].url);
                        }
                        else {
                            db.close();
                            
                            res.json({error: "Url not found in the database"});
                        }
                    }
                );
            }
        });
    }
    catch (e) {
        res.sendStatus(500);
    }
});

// Any other url
app.get('*', function (req, res) {
    res.send("Please enter a url to be shortened, like " + req.headers.host + "/new/https://www.google.com");
});

app.listen(process.env.PORT || 8080, function () {
    console.log('App started');
});

// helper functions
function getNextSequence(db, name, callback) {
    db.collection("counters").findAndModify( { _id: name }, null, { $inc: { seq: 1 } }, function(err, result){
        if(err) callback(err, result);
        callback(err, result.value.seq);
    } );
}