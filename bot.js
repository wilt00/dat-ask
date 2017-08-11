'use strict';
const express = require('express');
const bodyParser = require('body-parser');
//const Promise = require('bluebird');

const messenger = require('./messenger.js');
const data = require('./data.js');

var messengerButton = "<html><head><title>Facebook Messenger Bot</title></head><body><h1>Facebook Messenger Bot</h1>This is a bot based on Messenger Platform QuickStart. For more details, see their <a href=\"https://developers.facebook.com/docs/messenger-platform/guides/quick-start\">docs</a>.<script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

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
app.get('/webhook', (req, res) => {
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
app.get('/', (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(messengerButton);
  res.end();
});


app.post('/schedule', (req, res) => {/*TODO*/})


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
  
  // Get user
  
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
    messenger.sendAnswer(senderID, message.quick_reply.payload);
    
  }
  else if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'question':
        messenger.sendQuestion(senderID);
        break;

      default:
        //sendTextMessage(senderID, messageText);
        messenger.sendQuestion(senderID);
    }
  } else if (messageAttachments) {
    messenger.sendTextMessage(senderID, "Message with attachment received");
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
      messenger.sendQuestion(senderID);
      break;
    case 'get-started':
      //TODO
    default:
      messenger.sendTextMessage(senderID, "Postback called");
  }

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

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