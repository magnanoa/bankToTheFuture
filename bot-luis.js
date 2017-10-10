const builder = require('botbuilder');

var luis = require('./luis.json');

const connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

const bot = module.exports = new builder.UniversalBot(connector, function (session) {
    session.send('Sorry, the OMS autobot didn\'t understand \'%s\'. Type \'order\' if you would like to place an order.', session.message.text);
});

console.log(process.env.LUIS_MODEL_URL)
var recognizer = new builder.LuisRecognizer(process.env.LUIS_MODEL_URL);
bot.recognizer(recognizer);

bot.dialog('Order', [
    function (session, args, next) {
        var order = session.dialogData.order = {}

        if (args && args.isReprompt && args.dialogData && args.dialogData.order){
            // We were sent here to revalidate some user input
            // Reinitialise the order data using the args
            order = session.dialogData.order = args.dialogData.order
        }
        else if (args && args.intent && args.intent.entities){
            // LUIS recognizer triggered dialog
            // Scrape out all intent entities
            var {intent} = args
            console.log(intent.entities)

            var stock = builder.EntityRecognizer.findEntity(intent.entities, 'Stocks')
            if (stock && stock.resolution){
                order.stock = stock.resolution.values[0]
            }

            var quantity = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.number')
            if (quantity && quantity.resolution){
                order.qty = quantity.resolution.value
            }

            var direction = builder.EntityRecognizer.findEntity(intent.entities, 'OrderDirection')
            if (direction && direction.entity){
                order.direction = direction.entity
            }
        }

        if (!order.stock) {
            builder.Prompts.text(session, 'What stock would you like to order?', {
                speak: 'What stock would you like to order?',
                retrySpeak: 'What stock would you like to order? Say cancel to dismiss me',
                inputHint: builder.InputHint.expectingInput
            })
        } else {
            next()
        }

    },
    /*
        --1-- Validate stock
     */
    function (session, results, next) {
        var {dialogData} = session
        var {order} = dialogData

        if (!order.stock) {
            // Example response: { index: 0, entity: 'Apple', score: 0.8 }
            const bestMatch = builder.EntityRecognizer.findBestMatch(getStockListFromLuisConfig(), results.response, 0.7)
            console.log(bestMatch)
            if (bestMatch){
                order.stock = bestMatch.entity
            }
        }

        if (!order.stock) {
            // Unable to validate stock, send back to the start...
            session.replaceDialog('Order', {dialogData: dialogData, isReprompt: true});
        }
        else if (!order.qty){
            builder.Prompts.number(session, 'How many '+order.stock+' would you like to order?')
        } else {
            next()
        }

    },
    /*
        --2-- Validate qty
     */
    function (session, results, next) {
        var {dialogData} = session
        var {order} = dialogData

        if (!order.qty) {
            order.qty=results.response
        }

        if (!order.direction){
            builder.Prompts.choice(session, 'Would you like to buy or sell '+order.stock+'?', ['Buy','Sell'],
                { listStyle: builder.ListStyle.button })
        } else {
            next()
        }

    },
    /*
        --3-- Validate direction
     */
    function (session, results) {
        var {dialogData} = session
        var {order} = dialogData

        if (!order.direction) {
            // check the confirmation response
            console.log(results.response)
            if (results.response.entity){
                order.direction=results.response.entity
            }
            else {
                console.log('Something went wrong, I shouldn\'t end up here')
            }

        }

        builder.Prompts.text(session, 'Placing a ['+order.direction+'] order for ['+order.qty+'] of ['+order.stock+']...');

    }
]).triggerAction({
    matches: 'Order',
    /*TODO:: disable confirmation prompt to avoid 'ibm'/'microsoft' stock confirmation triggering unwanted new dialog confirmation*/
    //confirmPrompt: "This will cancel the creation of order you started. Are you sure?"
}).cancelAction('cancelCreateNote', "Order canceled.", {
    matches: /^(cancel|nevermind)/i,
    confirmPrompt: "Are you sure you want to stop ordering?"
});



/*
* "closedLists": [
    {
      "name": "Stocks",
      "subLists": [
        {
          "canonicalForm": "Apple",
          "list": []
        },
        {
          "canonicalForm": "Optus",
          "list": []
        },
        {
          "canonicalForm": "Microsoft",
          "list": []
        },
        {
          "canonicalForm": "sony",
          "list": []
        },
        {
          "canonicalForm": "dell",
          "list": []
        },
        {
          "canonicalForm": "ibm",
          "list": []
        }
      ]
    }*/
function getStockListFromLuisConfig() {
    const stockList = luis.closedLists.filter(list=>list.name === 'Stocks')[0]
    return stockList.subLists.map(element=>element.canonicalForm)
}