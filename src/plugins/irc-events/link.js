"use strict";

const cheerio = require("cheerio");
const Msg = require("../../models/msg");
const request = require("request");
const Helper = require("../../helper");
const es = require("event-stream");

process.setMaxListeners(0);

module.exports = function(client, chan, originalMsg) {
	if (!Helper.config.prefetch) {
		return;
	}

	const links = originalMsg.text
		.replace(/\x02|\x1D|\x1F|\x16|\x0F|\x03(?:[0-9]{1,2}(?:,[0-9]{1,2})?)?/g, "")
		.split(" ")
		.filter((w) => /^https?:\/\//.test(w));

	if (links.length === 0) {
		return;
	}

	const msg = new Msg({
		type: Msg.Type.TOGGLE,
		time: originalMsg.time,
		self: originalMsg.self,
	});
	chan.pushMessage(client, msg);

	const link = escapeHeader(links[0]);
	fetch(link, function(res) {
		if (res === null) {
			return;
		}

		parse(msg, link, res, client);
	});
};

function parse(msg, url, res, client) {
	var toggle = msg.toggle = {
		id: msg.id,
		type: "",
		head: "",
		body: "",
		thumb: "",
		link: url,
	};

	switch (res.type) {
	case "text/html":
		var $ = cheerio.load(res.text);
		toggle.type = "link";
		toggle.head =
			$("meta[property=\"og:title\"]").attr("content")
			|| $("title").text()
			|| "";
		toggle.body =
			$("meta[property=\"og:description\"]").attr("content")
			|| $("meta[name=\"description\"]").attr("content")
			|| "";
		toggle.thumb =
			$("meta[property=\"og:image\"]").attr("content")
			|| $("meta[name=\"twitter:image:src\"]").attr("content")
			|| "";

		// Make sure thumbnail is a valid url
		if (!/^https?:\/\//.test(toggle.thumb)) {
			toggle.thumb = "";
		}

		// Verify that thumbnail pic exists and is under allowed size
		if (toggle.thumb.length) {
			fetch(escapeHeader(toggle.thumb), (resThumb) => {
				if (resThumb === null
				|| !(/^image\/.+/.test(resThumb.type))
				|| resThumb.size > (Helper.config.prefetchMaxImageSize * 1024)) {
					toggle.thumb = "";
				}

				emitToggle(client, toggle);
			});

			return;
		}

		break;

	case "image/png":
	case "image/gif":
	case "image/jpg":
	case "image/jpeg":
		if (res.size < (Helper.config.prefetchMaxImageSize * 1024)) {
			toggle.type = "image";
		} else {
			return;
		}
		break;

	default:
		return;
	}

	emitToggle(client, toggle);
}

function emitToggle(client, toggle) {
	// If there is no title but there is preview or description, set title
	// otherwise bail out and show no preview
	if (!toggle.head.length) {
		if (toggle.thumb.length || toggle.body.length) {
			toggle.head = "Untitled page";
		} else {
			return;
		}
	}

	client.emit("toggle", toggle);
}

function fetch(url, cb) {
	let req;
	try {
		req = request.get({
			url: url,
			maxRedirects: 5,
			timeout: 5000,
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; The Lounge IRC Client; +https://github.com/thelounge/lounge)"
			}
		});
	} catch (e) {
		return cb(null);
	}
	var length = 0;
	var limit = Helper.config.prefetchMaxImageSize * 1024;
	req
		.on("response", function(res) {
			if (!(/^image\/.+/.test(res.headers["content-type"]))) {
				// if not image, limit download to 50kb, since we need only meta tags
				// twitter.com sends opengraph meta tags within ~20kb of data for individual tweets
				limit = 1024 * 50;
			}
		})
		.on("error", function() {})
		.pipe(es.map(function(data, next) {
			length += data.length;
			if (length > limit) {
				req.response.req.abort();
			}
			next(null, data);
		}))
		.pipe(es.wait(function(err, data) {
			if (err) {
				return cb(null);
			}

			if (req.response.statusCode < 200 || req.response.statusCode > 299) {
				return cb(null);
			}

			let type;
			let size = parseInt(req.response.headers["content-length"], 10) || length;

			if (size < length) {
				size = length;
			}

			try {
				type = req.response.headers["content-type"].split(/ *; */).shift();
			} catch (e) {
				type = {};
			}
			data = {
				text: data,
				type: type,
				size: size
			};
			cb(data);
		}));
}

// https://github.com/request/request/issues/2120
// https://github.com/nodejs/node/issues/1693
// https://github.com/alexeyten/descript/commit/50ee540b30188324198176e445330294922665fc
function escapeHeader(header) {
	return header
		.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])+/g, encodeURI)
		.replace(/[\uD800-\uDFFF]/g, "")
		.replace(/[\u0000-\u001F\u007F-\uFFFF]+/g, encodeURI);
}
