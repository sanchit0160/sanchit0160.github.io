var storedHrefValue = localStorage.getItem('hrefInput');
if (storedHrefValue) {
    $('#hrefInput').val(storedHrefValue);
}

var storedTextValue = localStorage.getItem('textInput');
if (storedTextValue) {
    $('#textInput').val(storedTextValue);
}

async function submit() {
    var line = $("#list").val();
    var href = $("#hrefInput").val();
    var text = $("#textInput").val();
    localStorage.setItem('hrefInput', href);
    localStorage.setItem('textInput', text);
    var send = line.split("\n");
    var total = send.length;
    var rev = 0;
    var revdec = 0;
    let count = 0;

    var temp = updateTempValue();

    for (let index = 0; index < send.length; index++) {
        let value = send[index];
        
        const linkRegex = /https/;
        const isLink = linkRegex.test(value);

        value = value.replace(/.*?(https)/, 'https');
        value = value.replace(/(https:\/\/[^ ]*).*/, '$1');
        
        if (!isLink || ((value.includes(href) && value == href) && temp == 0)) {
            removeline();
            continue;
        }

        count++


        const slug = value.split('/').pop();
        const requestOptions = {
            method: "GET",
            headers: {
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://www.codingninjas.com",
                "Referer": "https://www.codingninjas.com/"
            }
        };

        try {
            const url = `https://api.codingninjas.com/api/v3/public_section/resource_details?slug=${slug}`;
            const response = await fetch(url, requestOptions);
            if (!response.ok) {
                removeline();
                throw new Error('Network response was not OK');
            }
            const data = await response.json();
            const content = data.data.article.content;
            const indexOfHref = content.indexOf(href);

            const tempElement = document.createElement('div');
            tempElement.innerHTML = content;

            const matches = tempElement.innerHTML.includes(`${href}"`);

            if (matches) {
                const targetIndex = indexOfHref + text.length + 750;
                const startIndex = indexOfHref - 2000;
                const trimmedPart = content.substring(startIndex, targetIndex).trim()
                    .replace(`<a href="${href}">`, `<a style="background-color: yellow;" href="${href}">`);
                    /**
                      *  Uncomment the next line if you do no want
                      *  images to get rendered 
                      */
                    //.replace(/<img[^>]*>/g, '');
                rev++;
                reviewed(`${count}. <a href="${value}">${value}</a>`);
                reviewed(`<div class="box">${trimmedPart}</div>`);
                reviewed(`<br>`);
                removeline();
            } else {
                revdec++;
                declined(`${count}. <a style="color: red; text-decoration: underline;" href="${value}">${value}</a>`);
                removeline();
            }

            const ttl = rev + revdec;
            $('#revid').html(rev);
            $('#reviddec').html(revdec);
            $('#total').html(ttl);
            $('#loaded').html(total);
            $('#revid2').html(rev);
            $('#revid2dec').html(revdec);
        } catch (error) {
            removeline();
            if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
                console.log('Request timed out');
            } else {
                console.log('Error:', error.message);
            }
        }
    }
}

function reviewed(str) {
    $(".approved").append(str + "<br>");
}

function declined(str) {
    $(".declined").append(str + "<br>");
}

function removeline() {
    var lines = $("#list").val().split('\n');
    lines.splice(0, 1);
    $("#list").val(lines.join("\n"));
}

function changedState(el) {
    var display = document.getElementById(el).style.display;
    if (display === "none")
        document.getElementById(el).style.display = 'block';
    else
        document.getElementById(el).style.display = 'none';
}

function updateTempValue() {
    var checkbox = document.getElementById("checkBoxID");
    var temp = checkbox.checked ? 1 : 0;
    return temp;
}

var myVar = setInterval(myTimer, 1000);

function myTimer() {
    var d = new Date();
    document.getElementById("time").innerHTML = d;
}