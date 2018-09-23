"use strict";

var Path = require('path');
var Events = require('events');
var Tilt = require('./tilt.js');

var sprintf = require('yow/sprintf');
var isString = require('yow/is').isString;



module.exports = class Platform {

    constructor(log, config, homebridge) {

        this.config = config;
        this.log = log;
        this.homebridge = homebridge;
        this.tilts = [];

        // Load .env
        require('dotenv').config({
            path: Path.join(process.env.HOME, '.homebridge/.env')
        });

        if (process.env.PUSHOVER_USER == undefined || process.env.PUSHOVER_TOKEN == undefined) {
    		this.log('Environment variables PUSHOVER_USER and/or PUSHOVER_TOKEN not defined. Push notifications will not be able to be sent.');
    	}

        this.config.tilts.forEach((config, index) => {
            this.tilts.push(new Tilt(this, config));
        });


    }


    pushover() {

        var util    = require('util');
    	var user    = process.env.PUSHOVER_USER;
    	var token   = process.env.PUSHOVER_TOKEN;
        var message = util.format.apply(util.format, arguments);

    	if (process.env.PUSHOVER_USER && process.env.PUSHOVER_TOKEN) {
			try {

                var PushoverNotifications = require('pushover-notifications');
				var push = new PushoverNotifications({user:user, token:token});
                var payload = {priority:0, message:message};

				push.send(payload, function(error, result) {
					if (error) {
						this.log(error.stack);
					}
				});
			}
			catch(error) {
				this.log('Failed to send Pushover notification.', error.message);
    		};

    	}

    };

    generateUUID(id) {
        return this.homebridge.hap.uuid.generate(id.toString());
    }


    debug() {
    }

    accessories(callback) {
        callback(this.tilts);

    }
}
