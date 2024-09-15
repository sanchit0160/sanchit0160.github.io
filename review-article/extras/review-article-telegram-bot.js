// Run this code after deployment

const TelegramBot = require('node-telegram-bot-api');
const { JSDOM } = require('jsdom');
require('dotenv').config();
const axios = require('axios');
const imageSize = require('image-size');
const YOUR_BOT_TOKEN = process.env.YOUR_BOT_TOKEN;
const bot = new TelegramBot(YOUR_BOT_TOKEN, {polling: true});

bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, 'Send me production Link');
});

bot.on('message', (msg) => {
	const chatId = msg.chat.id;

	if (msg.entities && msg.entities.some(entity => entity.type === 'url')) {
		const link = msg.text;
		productionLink(link, chatId);
		bot.sendMessage(chatId, 'Processing...');
	}
});


function productionLink(link, chatId) {
	console.log('Received production link:', link);
	const slug = link.split('/').pop();

	let requestOptions = {
		method: "GET",
		headers: {
			"Accept": "application/json, text/plain, */*",
			"Origin": "https://www.codingninjas.com",
			"Referer": "https://www.codingninjas.com/"
		}
	};
	let url = `https://api.codingninjas.com/api/v3/public_section/resource_details?slug=${slug}`;

	fetch(url, requestOptions)
	.then(response => {
		return response.json();
	})
	.then(data => {
		const articleId = data.data.article.id;
		const articleTitle = data.data.article.title;
		let faqs = data.data.article.static_data.faqs;
		const metaDescription = data.data.article.static_data.meta_description;
		const metaTitle = data.data.article.static_data.meta_title;
		const articleImageUrl = data.data.article.static_data.article_image_url;
		const content = data.data.article.content;
		const authorId = data.data.article.author.id;
		const authorUuid = data.data.article.author.uuid;
		const authorName = data.data.article.author.name;
		const authorImage = data.data.article.author.image;
		const authorScreenName = data.data.article.author.screen_name;
		const slug = data.data.article.slug;
		let updatedAt = data.data.article.updated_at;
		const publishedAt = data.data.article.published_at;
		const publishStatus = data.data.article.publish_status;
		const upvoteCount = data.data.article.upvote_count;
		const isUpvoted = data.data.article.is_upvoted;
		let difficultyLevel = data.data.article.difficulty_level;
		const breadcrumbs = data.data.article.breadcrumbs;
		let placedCategory = breadcrumbs[breadcrumbs.length - 2];

		if (placedCategory != undefined) {
			placedCategory = placedCategory.name;
		}
		const dom = new JSDOM(content);
		const document = dom.window.document;
		const tempElement = document.createElement('div');
		tempElement.innerHTML = content;
		const extractedText = tempElement.textContent;
		

		let metaDescriptionLength = metaDescription.length;
		updatedAt = new Date(updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

		if(difficultyLevel == null) {
			difficultyLevel = 'NONE';
		}

		let imageFileSize;
		let imageWidth, imageHeight;		

		(async () => {
			try {
				const readabilityScore = await readability(extractedText);
				imageFileSize = await getFileSize(articleImageUrl);
				const imageDimensions = await getImageDimensions(articleImageUrl);
				imageWidth = imageDimensions.width, imageHeight = imageDimensions.height;
				console.log('File Size:', imageFileSize, 'bytes');
				console.log('Dimensions:', imageDimensions.width, 'x', imageDimensions.height);

				const message = 
					`<a href="${link}">${link}</a>\n` +
					`<b>Article ID:</b> <a href="https://admin.codingninjas.com/public_section_articles/${articleId}/edit">${articleId}</a> → [Last Updated: ${updatedAt}]\n` +
					`<b>Article Title:</b> ${articleTitle} [Difficulty Level → <b>${difficultyLevel}</b>]\n` +
					`<b>Flesch-Kincaid Reading Ease:</b> ${readabilityScore}\n` +
					`<b>Author Name:</b> ${authorName}\n` +
					`<b>Meta Title:</b> ${metaTitle}\n` +
					`<b>Meta Description:</b> ${metaDescription} [${metaDescriptionLength} characters]\n` +
					`<b>Placed Category:</b> ${placedCategory}\n` +
					`<b>Open Graph Image URL:</b> ${imageFileSize} KB`;
				bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
			}
			catch (error) {
				console.error('Error:', error);
			}
		})();
	})
	.catch(error => {
		console.log(error);
	});
}

const getFileSize = async (url) => {
	try {
		const response = await axios.head(url);
		const fileSizeKB = (response.headers['content-length']) / 1024;
		return fileSizeKB.toFixed(2);
	} 
	catch (error) {
		throw error;
	}
};

const getImageDimensions = async (url) => {
	try {
		const response = await axios.get(url, { responseType: 'arraybuffer' });
		const dimensions = imageSize(Buffer.from(response.data));
		return {
			width: dimensions.width,
			height: dimensions.height
		};
	} catch (error) {
		throw error;
	}

async function readability(input) {
	let readingEaseScore;
	function calculate(text) {
        const cleanText = text.replace(/[,;:`'"<({[|_\-.]/g, ' ').toLowerCase();
        const words = cleanText.split(/\s+/);
        const wordCount = words.length;
        console.log('Number of words:', wordCount);

        const sentenceCount = text.split(/[.!\?]+/).filter(sentence => sentence.trim() !== '').length;
        console.log('Number of sentences:', sentenceCount);

        const syllableCount = countSyllables(input);
        console.log('Number of syllables:', syllableCount);

        if (wordCount === 0 || sentenceCount === 0 || syllableCount === 0) {
            return 'N/A';
        }

        const averageWordsPerSentence = wordCount / sentenceCount;
        const averageSyllablesPerWord = syllableCount / wordCount;
        console.log('Average Syllables Per Word:', averageSyllablesPerWord);
        console.log('Average Words Per Sentence:', averageWordsPerSentence);

        const gradeLevel = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59;
        readingEaseScore = 206.835 - 1.015 * averageWordsPerSentence - 84.6 * averageSyllablesPerWord;
        console.log('Flesch-Kincaid Grade Level:', gradeLevel);
        console.log('Flesch-Kincaid Reading Ease:', readingEaseScore);
    }

    function countSyllables(text) {
        const syllablePrefixes = ['auto', 'bi', 'di', 'dis', 'pre', 're', 'un', 'semi', 'tri'];
        const syllableSuffixes = ['ed', 'es', 'ing', 'ion', 'ious', 'ly', 'ment', 'ness', 'tion'];
        const lowercaseText = text.toLowerCase();
        let syllableCount = 0;

        lowercaseText.split(/\s+/).forEach(function(word) {
            syllablePrefixes.forEach(function(prefix) {
                if (word.startsWith(prefix)) {
                    word = word.slice(prefix.length);
                }
            });

            syllableSuffixes.forEach(function(suffix) {
                if (word.endsWith(suffix)) {
                    word = word.slice(0, -suffix.length);
                }
            });

            const vowelPattern = /[aeiouy]+/g;
            const matches = word.match(vowelPattern);
            if (matches) {
                syllableCount += matches.length;
            }
        });
        return syllableCount;
    }

    calculate(input);
    return readingEaseScore.toFixed(2);
}
