require('dotenv').config();

const http = require('http');
const connect = require('connect');
const bodyParser = require('body-parser');
const {sampleSize, uniq} = require('lodash');
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

	console.log(new Date(), req.body);

	if (req.body.token !== process.env.SLASH_COMMAND_TOKEN || req.body.team_id !== process.env.TEAM_ID) {
		res.writeHead(400, {'Content-Type': 'text/plain'});
		return res.end('400 Bad Request\nInvalid token.');
	}

	const args = req.body.text.trim().split(/\s+/);

	const {channel_id, timestamp} = (() => {
		const match = (args[0] || '').match(/^https:\/\/.+\/archives\/(.+?)\/p(\d+)$/);

		if (match) {
			const [_, channel_id, timestamp] = match;
			return {
				channel_id,
				timestamp: `${timestamp.slice(0, -6)}.${timestamp.slice(-6)}`,
			};
		}

		return {
			channel_id: req.body.channel_id,
			timestamp: null,
		}
	})();

	if (!req.body.channel_id.startsWith('C')) {
		res.writeHead(400, {'Content-Type': 'text/plain'});
		return res.end('400 Bad Request\nYou cannot bomb private messages.');
	}

	const emojiList = await slack.emoji.list();
	const customEmojis = Object.keys(emojiList.emoji);

	const allEmojis = [...defaultEmojis, ...customEmojis];

	const emojis = (() => {
		const message = (() => {
			if (args[1]) {
				return args[1];
			}

			if (args[0] && timestamp === null) {
				return args[0];
			}

			return null;
		})();

		if (message !== null) {
			return uniq(message.match(/:.+?:/g).map(s => s.slice(1, -1)));
		}

		return sampleSize(allEmojis, 25);
	})();

	let latestMessage = null;

	if (timestamp === null) {
		const latestMessageResponse = await slack.channels.history(req.body.channel_id, {
			inclusive: true,
			count: 1,
		});

		if (!latestMessageResponse.ok) {
			res.writeHead(500, {'Content-Type': 'text/plain'});
			return res.end('500 Internal Server Error');
		}

		latestMessage = latestMessageResponse.messages[0];
	}

	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('BOOM!!');

	let successes = 0, fails = 0, i = 0;

	for (let i = 0; successes < 20 && fails < 5 && i < emojis.length; i++) {
		const emoji = emojis[i];

		try {
			await slack.reactions.add(emoji, {
				channel: channel_id,
				timestamp: timestamp ? timestamp : latestMessage.ts,
			});
			successes++;
		} catch (error) {
			console.error(error.message);
			fails++;
		}
	}
});

http.createServer(app).listen(process.env.PORT || 4545);
