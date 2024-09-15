function submit() {
	var line = $("#list").val();
	var send = line.split("\n");
	var total = send.length;
	var rev = 0;
	send.forEach(function(value, index) {
		const slug = value.split('/').pop();
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
			url = `https://api.codingninjas.com/api/v3/public_section/sibling_article_details?slug=${slug}&request_differentiator`;
			fetch(url, requestOptions)
			.then(response => {
				return response.json();
			})
			.then(sibling => {

				/*if(sibling.data.left_sibling.title) {
					const leftSiblingTitle = sibling.data.left_sibling.title;
				}
				if(sibling.data.right_sibling.title) {
					const rightSiblingTitle = sibling.data.left_sibling.title;
				}*/

				const articleId = data.data.article.id;
				const articleTitle = data.data.article.title;
				let faqs = data.data.article.static_data.faqs;
				const metaDescription = data.data.article.static_data.meta_description;
				const articleImageUrl = data.data.article.static_data.article_image_url;
				const content = data.data.article.content;
				const authorId = data.data.article.author.id;
				const authorUuid = data.data.article.author.uuid;
				const authorName = data.data.article.author.name;
				const authorImage = data.data.article.author.image;
				const authorScreenName = data.data.article.author.screen_name;
				const slug = data.data.article.slug;
				const updatedAt = data.data.article.updated_at;
				const publishedAt = data.data.article.published_at;
				const publishStatus = data.data.article.publish_status;
				const upvoteCount = data.data.article.upvote_count;
				const isUpvoted = data.data.article.is_upvoted;
				const difficultyLevel = data.data.article.difficulty_level;
				const breadcrumbs = data.data.article.breadcrumbs;
				let placedCategory = breadcrumbs[breadcrumbs.length - 2];
				if(placedCategory != undefined) {
					placedCategory = placedCategory.name;
				}

				//console.log(content);
				var tempElement = document.createElement('div');
				tempElement.innerHTML = content;

				// Extract the text content
				var extractedText = tempElement.textContent;
				//console.log(extractedText);
				let readabilityScore = readability(extractedText);
				extractedText = `<b>Readability:</b> ${readabilityScore}`;


				var questions = [];
				var answers = [];
				var output = "";

				for (var i = 0; i < faqs.length; i++) {
				  var question = faqs[i].question;
				  question = question.replace(/\n/g, '<span style="color: red;">\n</span>');
				  var answer = faqs[i].answer;

				  questions.push(question);
				  answers.push(answer);

				  output += question + "<br>";
				}

				// Print the output to the console or display it on the web page
				console.log(output);

				console.log("Questions:", questions);
				console.log("Answers:", answers);

				var tempContainer = document.createElement("div");
        tempContainer.innerHTML = content;
        var images = tempContainer.getElementsByTagName("img");
        var imageData = [];

        function loadImageData(image) {
          return new Promise(function(resolve) {
            var img = new Image();
            img.onload = function() {
              resolve({
                src: image.src,
                alt: image.alt,
                width: img.naturalWidth,
                height: img.naturalHeight
              });
            };
            img.src = image.src;
          });
        }

        var imagePromises = Array.from(images).map(loadImageData);
        Promise.all(imagePromises)
        .then(function(data) {
          imageData = data;
        })
        .catch(function(error) {
          console.error('Error loading image data:', error);
        });

				var image = new Image();
				image.src = articleImageUrl;
				image.onload = function() {
					var articleImageUrlWidth = image.naturalWidth;
					var articleImageUrlHeight = image.naturalHeight;

					questions = JSON.stringify(questions);
					//reviewed(questions);
					answers = JSON.stringify(answers);
					imageData = JSON.stringify(imageData);

					var payload = {
						articleId: articleId,
						articleTitle: articleTitle,
						questions: questions,
						answers: answers,
						metaDescription: metaDescription,
						articleImageUrl: articleImageUrl,
						articleImageUrlWidth: articleImageUrlWidth,
						articleImageUrlHeight: articleImageUrlHeight,
						content: content,
						authorId: authorId,
						authorUuid: authorUuid,
						authorName: authorName,
						authorImage: authorImage,
						authorScreenName: authorScreenName,
						slug: slug,
						updatedAt: updatedAt,
						publishedAt: publishedAt,
						publishStatus: publishStatus,
						upvoteCount: upvoteCount,
						isUpvoted: isUpvoted,
						difficultyLevel: difficultyLevel,
						placedCategory: placedCategory,
						//leftSiblingTitle: leftSiblingTitle,
						//rightSiblingTitle: rightSiblingTitle,
						imageData: imageData
					};

					var xhr = new XMLHttpRequest();
					xhr.open('POST', 'process.php', true);
					xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
					  
					xhr.onreadystatechange = function() {
						if (xhr.readyState === XMLHttpRequest.DONE) {
							if (xhr.status === 200) {
								var response = xhr.responseText;
								reviewed(response);
								reviewed(extractedText);
								removeline();
								rev++;
								var ttl = parseInt(rev);
								$('#revid').html(rev);
								$('#total').html(ttl);
								$('#loaded').html(total);
								$('#revid2').html(rev);
							} 
							else {
								console.log('Error: ' + xhr.status);
							}
						}
					};
					xhr.send('data=' + encodeURIComponent(JSON.stringify(payload)));
				};

			})
		})
		.catch(error => {
			console.log(error);
		});
	});
}
		
function reviewed(str) {
	$(".approved").append(str + "<br>");
}

function removeline() {
	var lines = $("#list").val().split('\n');
	lines.splice(0, 1);
	$("#list").val(lines.join("\n"));
}

function changed_state(el) {
	var display = document.getElementById(el).style.display;
	if (display === "none")
		document.getElementById(el).style.display = 'block';
	else
		document.getElementById(el).style.display = 'none';
}

var myVar = setInterval(function() {
	myTimer()
}, 1000);
		
function myTimer() {
	var d = new Date();
	document.getElementById("time").innerHTML = d;
}

function readability(content) {
	const cleanText = content.replace(/[,;:`'"<({[|_\-.]/g, ' ').toLowerCase();
	const words = cleanText.split(/\s+/);
	const wordCount = words.length;
	const sentenceCount = content.split(/[.!\?]+/).filter(sentence => sentence.trim() !== '').length;
	const syllableCount = countSyllables(content);
	
	if (wordCount === 0 || sentenceCount === 0 || syllableCount === 0) 
		return 'N/A';

	const averageWordsPerSentence = wordCount / sentenceCount;
	const averageSyllablesPerWord = syllableCount / wordCount;
	//const gradeLevel = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59;
	const readingEaseScore = 206.835 - 1.015 * averageWordsPerSentence - 84.6 * averageSyllablesPerWord;
	return readingEaseScore;

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
}