#!/usr/bin/env node

var Path = require('path');
var fs = require('fs');


var fileExists = module.exports.fileExists = function(path) {

	try {
		fs.accessSync(path);
		return true;
	}
	catch (error) {
	}

	return false;
}

function install() {

    var homebridgeConfig = Path.join(process.env.HOME, '.homebridge/config.json');
    var thisConfig = Path.join('.', 'config.json');

    var homebridge = {};
    var config = JSON.parse(fs.readFileSync(thisConfig));

    if (fileExists(homebridgeConfig)) {
        homebridge = JSON.parse(fs.readFileSync(homebridgeConfig));
    }

    if (!homebridge.bridge)
        homebridge.bridge = config.bridge;

    if (!homebridge.accessories)
        homebridge.accessories = [];

    if (!homebridge.platforms)
        homebridge.platforms = [];

    if (config.accessories) {
        config.accessories.forEach((accessory) => {

            // Remove existing
            homebridge.accessories = homebridge.accessories.filter((item) => {
                return item.accessory.toLowerCase() != accessory.accessory.toLowerCase();
            });

            // And add this one
            homebridge.accessories.push(accessory);

        });

    }

    if (config.platforms) {
        config.platforms.forEach((platform) => {

            // Remove existing platform from homebridge
            homebridge.platforms = homebridge.platforms.filter((item) => {
                return item.platform.toLowerCase() != platform.platform.toLowerCase();
            });

            // And add this one
            homebridge.platforms.push(platform);

        });


    }

    fs.writeFileSync(homebridgeConfig, JSON.stringify(homebridge, null, '    '));
}

install();
