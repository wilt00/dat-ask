const assert = require('assert');
const cheerio = require('cheerio');
const rq = require('request');
const _ = require('underscore');

const data = require('./data.js')

const options = {
    url: "http://datquestionoftheday.com/",
    headers: {
        'User-Agent': "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36"
    }
}

// TODO: Promisify this function?
exports.doScrape = function() {
  rq(options, (err, resp, body) => {
        if(err || resp.statusCode !== 200) {
            console.log(err);
            console.log(resp);
        } else {
            data.insertQuestion(getQuestion(body));
        }
    });
}

function getQuestion(body) {
    const $ = cheerio.load(body);
    const question = $('div .entry').children().first().text();

    let answers = $('.wp-polls-ul').find('label').map((i, el) => el.firstChild.data)

    // <em> is only used once, in giving the correct answer
    const rightAnswer = $('em').first().text();

    let rightAnswerIndex = -1;
    
    for(let i = 0; i < answers.length; i++) {
        console.log(answers[i]);
        answers[i] = answers[i].substr(answers[i].indexOf(' ') + 1);
        if (answers[i] === rightAnswer) {
            answers[i] = "";
            rightAnswerIndex = i;
        }
    }
    assert(rightAnswerIndex >= 0);

    answers = _.filter(answers, (val) => val !== "");

    let explanationString = $('em').parent().next().text();

    // Break explanation into array of strings of 500 chars or less, along word boundaries
    const explanation = [];
    while(explanationString.length > 500) {
        let breakAt = explanationString.lastIndexOf(' ', 500);
        if (breakAt <= 0) {
            explanation.push(explanationString);
            break;
        }
        explanation.push(explanationString.substring(0, breakAt))
        explanationString = explanationString.substring(breakAt + 1);
    }
    explanation.push(explanationString);
  
    const categoryString = $('.type-post')[0].attribs.class;
    const categoryRegex = /category-(\S+)/g;
    const category = categoryRegex.exec(categoryString)[1];

    return {
        //id
        type: 'text',
        subject: category,
        question: question,
        answer: rightAnswer,
        alts: answers,
        explanation: explanation,
        rawHtml: body
    }
}
