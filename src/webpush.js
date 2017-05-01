"use strict";

const fs = require("fs");
const path = require("path");
const WebPushAPI = require("web-push");
const Helper = require("./helper");

class WebPush {
	constructor() {
		const vapidPath = path.join(Helper.HOME, "vapid.json");

		if (fs.existsSync(vapidPath)) {
			const data = fs.readFileSync(vapidPath, "utf-8");
			const parsedData = JSON.parse(data);

			if (typeof parsedData.publicKey === "string" && typeof parsedData.privateKey === "string") {
				this.vapidKeys = {
					publicKey: parsedData.publicKey,
					privateKey: parsedData.privateKey,
				};
			}
		}

		if (!this.vapidKeys) {
			this.vapidKeys = WebPushAPI.generateVAPIDKeys();

			fs.writeFileSync(vapidPath, JSON.stringify(this.vapidKeys, null, "\t"));

			log.info("New VAPID key pair has been generated for use with push subscription.");
		}

		WebPushAPI.setVapidDetails(
			"https://github.com/thelounge/lounge",
			this.vapidKeys.publicKey,
			this.vapidKeys.privateKey
		);
	}

	push(client, payload) {
		const now = Date.now();

		// TODO: Currently, limit to 5 notifications in a minute
		if (client.push.lastPushDate + 60000 > now) {
			if (++client.push.currentCount > 5) {
				return;
			}
		} else {
			client.push.lastPushDate = now;
			client.push.currentCount = 0;
		}

		client.push.subscriptions.forEach((subscription) => this.pushSingle(client, subscription, payload));
	}

	pushSingle(client, subscription, payload) {
		WebPushAPI
			.sendNotification(subscription, JSON.stringify(payload))
			.catch((error) => {
				log.error("WebPush Error", error);
			});
	}
}

module.exports = WebPush;
