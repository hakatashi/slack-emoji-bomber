require('dotenv').config();

const http = require('http');
const connect = require('connect');
const bodyParser = require('body-parser');
const slackSDK = require('@slack/client');

const defaultEmojis = require('./default-emojis.js');

const slack = new slackSDK.WebClient(process.env.SLACK_TOKEN);

const app = connect();

app.use(bodyParser.urlencoded({ extended: true }));

app.use(async (req, res) => {
	if (req.url !== '/bomb-it' || req.method !== 'POST') {
		res.writeHead(404, {'Content-Type': 'text/plain'});
		return res.end('404 Not Found');
	}

	console.log(req.body);

	if (req.body.token !== process.env.SLASH_COMMAND_TOKEN || req.body.team_id !== process.env.TEAM_ID) {
		res.writeHead(400, {'Content-Type': 'text/plain'});
		return res.end('400 Bad Request');
	}

	const emojiList = await slack.emoji.list();
	const customEmojis = Object.keys(emojiList.emoji);

	const emojis = [...defaultEmojis, ...customEmojis];

	let successes = 0, fails = 0;

	const latestMessageResponse = await slack.channels.history(req.body.channel_id, {
		inclusive: true,
		count: 1,
	});

	if (!latestMessageResponse.ok) {
		res.writeHead(500, {'Content-Type': 'text/plain'});
		return res.end('500 Internal Server Error');
	}

	const {messages: [latestMessage]} = latestMessageResponse;

	while (successes < 20 && fails < 5) {
		const emoji = emojis[Math.floor(Math.random() * emojis.length)];

		try {
			await slack.reactions.add(emoji, {
				channel: req.body.channel_id,
				timestamp: latestMessage.ts,
			});
			successes++;
		} catch (error) {
			console.error(error.message);
			fails++;
		}
	}

	res.end('hoa');
});

http.createServer(app).listen(process.env.PORT || 4545);
