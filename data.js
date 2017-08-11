'use strict'
const mongo = require('mongodb-bluebird');
const mongoUrl = process.env.MONGO_URL;

///
// Database Helpers
///

function getUser(userId) {
  return mongo.connect(mongoUrl).then((db) => {
    const users = db.collection('users');
    return users.find({ fb_id: userId }).then((users) => {
      if (users === {}) {
        
      }
    })
  })
}