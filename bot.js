'use strict';
const express = require('express');
const bodyParser = require('body-parser');
//const request = require('request');
const path = require('path');
const _ = require('underscore');
const rp = require('request-promise');
const Promise = require('bluebird');
//const mongodb = require('mongodb');
const mongo = require('mongodb-bluebird');

var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";
//var privacyPolicy = "<html><head><title>DAT Ask Privacy Policy</title></head><body><h1>DAT Ask Privacy Policy</h1>Thank you for reading our Privacy Policy. We collect the following information about you:<br><ul><li>Your Facebook ID number</li></ul><br>This information is processed on a server provided by glitch.com (<a href=\"https://glitch.com/legal/\">Privacy Policy</a>), and stored privately in a database hosted by mLab (<a href=\"https://mlab.com/company/legal/privacy/\">Privacy Policy</a>). We do not disclose this data to any other parties for any reason.</body></html>"

const questions = require('./questions.json');
const mongoUrl = process.env.MONGO_URL;

/*

Question Schema:
  id: int
  type: string
  subject: string
  question: string
  answer: string
  alts: [string]
  explanation: [string]
  
User Schema:
  id: int
  fb_id: string
  questions_passed: [int]
  questions_failed: [int]
  last_question: int

*/

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static('pages'));

// Webhook validation
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});

// Display the web page
app.get('/', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});

/*
app.get('/privacy', function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(privacyPolicy);
  res.end();
})*/

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);   
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});

// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  
  
  
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text.toLowerCase();
  var messageAttachments = message.attachments;
  
  if (message.quick_reply) {
    sendAnswer(senderID, message.quick_reply.payload);
    
  }
  else if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'question':
        sendQuestion(senderID);
        break;

      default:
        //sendTextMessage(senderID, messageText);
        sendQuestion(senderID);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;
  
  switch (payload) {
    case 'question':
      sendQuestion(senderID);
      break;
    case 'get-started':
      //TODO
    default:
      sendTextMessage(senderID, "Postback called");
  }

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

}

//////////////////////////
// Sending helpers
//////////////////////////

function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };

  return callSendAPI(messageData);
}


function sendTextArray(recipientId, messagesArray) {
  return Promise.each(messagesArray, (item, i, length) => {
    return callSendAPI({
      recipient: { id: recipientId },
      message: { text: item }
    });
  })
}


function prepQuestion(qId) {
  let answer = Math.floor(Math.random() * 5);
  let altOrder = _.sample(questions[qId].alts, 4);

  let letter;
  let returnObj = new Object();
  returnObj.questionText = questions[qId].question;
  returnObj.rightAnswer = String.fromCharCode(65 + answer);
  
  for (let i = 0; i < 5; i++) {
    letter = String.fromCharCode(65 + i);
    returnObj.questionText += "\n" + letter + ": ";
    if (i === answer) {
      returnObj.questionText += questions[qId].answer;
      returnObj[letter] = true;
    }
    else {
      returnObj.questionText += altOrder.pop();
      returnObj[letter] = false;
    }
  }
  return returnObj;
}


function sendQuestion(recipientId) {
  var qNum = Math.floor(Math.random() * 3);
  var qData = prepQuestion(qNum);
  
  var messageData = {
    recipient: {id: recipientId },
    message: {
      text: qData.questionText,
      quick_replies: [
        {
          "content_type":"text",
          "title":"A",
          "payload": JSON.stringify({question:qNum,answer:"A",correct:qData.A,rightAnswer:qData.rightAnswer})
        },
        {
          "content_type":"text",
          "title":"B",
          "payload": JSON.stringify({question:qNum,answer:"B",correct:qData.B,rightAnswer:qData.rightAnswer})
        },
        {
          "content_type":"text",
          "title":"C",
          "payload": JSON.stringify({question:qNum,answer:"C",correct:qData.C,rightAnswer:qData.rightAnswer})
        },
        {
          "content_type":"text",
          "title":"D",
          "payload": JSON.stringify({question:qNum,answer:"D",correct:qData.D,rightAnswer:qData.rightAnswer})
        },
        {
          "content_type":"text",
          "title":"E",
          "payload": JSON.stringify({question:qNum,answer:"E",correct:qData.E,rightAnswer:qData.rightAnswer})
        },
        {
          "content_type":"text",
          "title":"?",
          "payload": JSON.stringify({question:qNum,answer:"?",rightAnswer:qData.rightAnswer})
        }
      ]
    }
  }
  
  return callSendAPI(recipientId, "Hi, {{user_first_name}}! Here's a question for you:")
    .then( () => callSendAPI(messageData));
}


function sendAnswer(recipientId, payload) {
  let messageString = "";
  let payloadObj = JSON.parse(payload);
  
  if (payloadObj.answer === "?") {
    messageString += "OK, let's go over that one. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
  } else if (payloadObj.correct) {
    messageString += "Yes, that's right! Here's why:";
  } else {
    messageString += "No, that's not right. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
  }
  
  sendTextMessage(recipientId, messageString)
    .then(() => sendTextArray(recipientId, questions[payloadObj.question].explanation))
    .then(() => {
      if(!payloadObj.correct) {
        sendTextMessage(recipientId, "I'll ask you that question again sometime.");
      }
    });
}


function callSendAPI(messageData) {
  return rp({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    body: messageData,
    json: true
  }).then((body) => {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;
      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
  }).catch((err) => {
      console.error("Unable to send message.");
      console.error(err);
  });
}

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


// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Listening on port %s", server.address().port);
});


// TODO:
// - Migrate questions to db
// - Support images in questions
// - Set up question scraping
// - Support templating/wildcard questions (e.g. math problems)
// - Make screencast video for FB approval
// - Add permanent menu button
// - Handle manual answer submissions?
// - Support users - create db, record questions correct & incorrect
// - Set up proper logging
// - Set up scheduled questions