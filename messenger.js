'use strict';

const _ = require('underscore');
const rp = require('request-promise');
const Promise = require('bluebird');

const data = require('./data.js');

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
    // TODO: picture if integer
    return callSendAPI({
      recipient: { id: recipientId },
      message: { text: item }
    });
  })
}


function prepQuestion(question) {  
  let letter;
  let returnObj = new Object();
  
  returnObj.id = question._id;
  
  let answer = Math.floor(Math.random() * 5);
  returnObj.rightAnswer = String.fromCharCode(65 + answer);
  
  let altOrder = _.sample(question.alts, 4);
  returnObj.questionText = question.question;

  for (let i = 0; i < 5; i++) {
    letter = String.fromCharCode(65 + i);
    returnObj.questionText += "\n" + letter + ": ";
    if (i === answer) {
      returnObj.questionText += question.answer;
      returnObj[letter] = true;
    }
    else {
      returnObj.questionText += altOrder.pop();
      returnObj[letter] = false;
    }
  }
  
  return returnObj;
}


function makePayload(qData, letter) {
  return {
    content_type: "text",
    title: letter,
    payload: JSON.stringify({
      id: qData.id,
      answer: letter,
      correct: qData[letter],
      rightAnswer: qData.rightAnswer
    })
  };
}


exports.sendQuestion = function (recipientId) {
  // TODO: Picture
  let question = data.getNextQuestion(recipientId).then((question) => {
    
    let qData = prepQuestion(question);
    return {
      recipient: {id: recipientId },
      message: {
        text: qData.questionText,
        quick_replies: [
          makePayload(qData, "A"),
          makePayload(qData, "B"),
          makePayload(qData, "C"),
          makePayload(qData, "D"),
          makePayload(qData, "E"),
          makePayload(qData, "?")
        ]
      }
    }
  }).then((messageData) => callSendAPI(messageData))
  .catch(data.NoMoreQuestionsError, () => {
    exports.sendTextMessage(recipientId, "Sorry, looks like you've answered all our questions right! Go ask Will to add some more questions! :)");
  });
}


exports.sendAnswer = function (recipientId, payload) {
  const payloadObj = JSON.parse(payload);
  let questionPromise = data.getQuestion(payloadObj.id);
  
  let messageString = "";
  let pass;
  
  if (payloadObj.answer === "?") {
    messageString += "OK, let's go over that one. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
    pass = false;
  } else if (payloadObj.correct) {
    messageString += "Yes, that's right! Here's why:";
    pass = true;
  } else {
    messageString += "No, that's not right. The right answer was " + payloadObj.rightAnswer + ". Here's why:";
    pass = false;
  }
  
  questionPromise.then((question) => {
    exports.sendTextMessage(recipientId, messageString)
      .then(() => {
        exports.sendTextArray(recipientId, question.explanation);
      });
  }).then(() => {
    if(!pass) {
      exports.sendTextMessage(recipientId, "I'll ask you that question again sometime.");
    }
  }).finally(() => data.logQuestion(recipientId, payloadObj.id, pass));
  
}


exports.sendPicture = function(picUrl) {
  
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