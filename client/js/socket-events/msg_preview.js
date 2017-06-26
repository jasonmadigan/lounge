"use strict";

const $ = require("jquery");
const socket = require("../socket");
const templates = require("../../views");
const options = require("../options");

socket.on("msg:preview", function(data) {
	data.preview.shown =
		(options.links && data.preview.type === "link") ||
		(options.thumbnails && data.preview.type === "image");

	const toggle = $("#msg-" + data.id);
	toggle.find(".text").append(templates.toggle({preview: data.preview}));

	toggle.parent(".messages").trigger("keepToBottom");
});

$("#chat").on("click", ".toggle-button", function() {
	var self = $(this);
	var localChat = self.closest(".chat");
	var bottom = localChat.isScrollBottom();
	var content = self.parent().next(".toggle-content");
	if (bottom && !content.hasClass("show")) {
		var img = content.find("img");
		if (img.length !== 0 && !img.width()) {
			img.on("load", function() {
				localChat.scrollBottom();
			});
		}
	}
	content.toggleClass("show");
	if (bottom) {
		localChat.scrollBottom();
	}
});
