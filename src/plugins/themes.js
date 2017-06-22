"use strict";

const fs = require("fs");
const Helper = require("../helper");
const requireg = require("requireg");
const colors = require("colors/safe");
const path = require("path");
const themes = new Map();

module.exports = {
	get: get,
	fileName: fileName
};

fs.readdir("client/themes/", (err, dirThemes) => {
	if (err) {
		return;
	}
	dirThemes
		.filter((theme) => theme.endsWith(".css"))
		.map(makeLocalThemeObject)
		.forEach((theme) => themes.set(theme.name, theme));
});

Helper.config.plugins
	.map(getModuleInfo)
	.filter((module) => module !== undefined)
	.filter((module) => module.type === "theme")
	.map(makeModuleThemeObject)
	.filter((module) => module !== undefined)
	.forEach((theme) => themes.set(theme.module, theme));

function get() {
	return Array.from(themes.values());
}

function fileName(module) {
	if (themes.has(module)) {
		return themes.get(module).filename;
	}
}

function makeLocalThemeObject(css) {
	const filename = css.slice(0, -4);
	return {
		name: filename.charAt(0).toUpperCase() + filename.slice(1),
		filename: filename,
		url: `/themes/${filename}.css`
	};
}

function getModuleInfo(moduleName) {
	let module;
	try {
		module = requireg(moduleName);
	} catch (e) {
		log.warn(`Specified theme ${colors.yellow(moduleName)} is not installed globally`);
		return;
	}
	module.lounge.name = moduleName;
	return module.lounge;
}

function makeModuleThemeObject(module) {
	const modulePath = requireg.resolve(module.name);
	modulePath.substring(0, modulePath.lastIndexOf("/"));
	const displayName = capitalizeFirstLetter(module.name.replace(/lounge-theme-/, ""));
	const filename = path.join(modulePath.substring(0, modulePath.lastIndexOf("/")), module.css);
	return {
		module: module.name,
		name: displayName,
		filename: filename,
		url: `/plugins/themes/${module.name}.css`
	};
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}
