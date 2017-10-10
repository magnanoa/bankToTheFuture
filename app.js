require('dotenv-extended').load();

var restify = require('restify');
const bot = require('./bot-luis.js');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, ()=>console.log('%s Listening to %s', server.name, server.url));

server.post('/api/messages', bot.connector('*').listen());
server.listen(process.env.PORT || 3978, () => {
    console.log(`${server.name} listening to ${server.url}`);
});