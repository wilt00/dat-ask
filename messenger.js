'use strict';

const _ = require('underscore');
const rp = require('request-promise');
const Promise = require('bluebird');

const questions = require('./questions.json');

//////////////////////////
// Sending helpers
//////////////////////////



exports.sendTextMessage = function (recipientId, messageText) {
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


exports.sendTextArray = function (recipientId, messagesArray) {
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


exports.sendQuestion = function (recipientId) {
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

  //return exports.sendTextMessage(recipientId, "Hi, {{user_first_name}}! Here's a question for you:")
  //  .then( () => callSendAPI(messageData));
  callSendAPI(messageData);
}


exports.sendAnswer = function (recipientId, payload) {
  let messageString = "";
  let payloadObj = JSON.parse(payload);
  
  if (payloadObj.answer === "?") {
    messageString += "OK, let's go over that one. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
  } else if (payloadObj.correct) {
    messageString += "Yes, that's right! Here's why:";
  } else {
    messageString += "No, that's not right. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
  }
  
  exports.sendTextMessage(recipientId, messageString)
    .then(() => exports.sendTextArray(recipientId, questions[payloadObj.question].explanation))
    .then(() => {
      if(!payloadObj.correct) {
        exports.sendTextMessage(recipientId, "I'll ask you that question again sometime.");
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
      console.error(messageData);
  });
}