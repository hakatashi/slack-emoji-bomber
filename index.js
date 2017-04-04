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
		return res.end('not found');
	}

	const emojiList = await slack.emoji.list();
	const customEmojis = Object.keys(emojiList.emoji);

	const emojis = [...defaultEmojis, ...customEmojis];

	let successes = 0, fails = 0;

	while (successes < 20 && fails < 5) {
		const emoji = emojis[Math.floor(Math.random() * emojis.length)];

		try {
			await slack.reactions.add(emoji, {
				channel: 'C0MBE1YTW',
				timestamp: '1491202647.630213',
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
