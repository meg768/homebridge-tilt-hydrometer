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

        this.config.tilts.forEach((config, index) => {
            this.log('ADDING', config.name);

            var tilt = new Tilt(this, config);
            this.tilts.push(tilt);
        });


    }

    generateUUID(id) {
        return this.homebridge.hap.uuid.generate(id.toString());
    }


    debug() {
    }

    accessories(callback) {
        this.log('CALLING ACCESSORIES', this.tilts.length);
        callback(this.tilts);

    }
}
