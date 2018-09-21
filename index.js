const OFF = true;
const ON = false;

var Bleacon = require('bleacon');
var isArray = require('yow/is').isArray;
var Request = require('yow/request');
var Timer   = require('yow/timer');

var Service = null;
var Characteristic = null;


module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-tilt-hydrometer', 'Tilt Hydrometer', TiltHydrometer);
};


class TiltHydrometer {

    constructor(log, config) {
        this.log = log;
        this.config = config;
        this.name = config.name;
        this.tiltTimer = new Timer();
        this.requestTimer = new Timer();
        this.maxTemperature = config.maxTemperature || 30;
        this.minTemperature = config.minTemperature || 0;
        this.tilt = null;

        this.currentTemperature = 20;
        this.targetTemperature = 20;

        this.heatingThresholdTemperature = 18;
        this.coolingThresholdTemperature = 21;

        //Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
        //Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;
        this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;

        // The value property of CurrentHeatingCoolingState must be one of the following:
        //Characteristic.CurrentHeatingCoolingState.OFF = 0;
        //Characteristic.CurrentHeatingCoolingState.HEAT = 1;
        //Characteristic.CurrentHeatingCoolingState.COOL = 2;
        this.currentHeatingCoolingState = Characteristic.CurrentHeatingCoolingState.OFF;

        // The value property of TargetHeatingCoolingState must be one of the following:
        //Characteristic.TargetHeatingCoolingState.OFF = 0;
        //Characteristic.TargetHeatingCoolingState.HEAT = 1;
        //Characteristic.TargetHeatingCoolingState.COOL = 2;
        //Characteristic.TargetHeatingCoolingState.AUTO = 3;
        this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.OFF;

        this.service = new Service.Thermostat(this.name);

        this.service.getCharacteristic(Characteristic.Name).on('get', callback => {
            callback(null, this.name);
        });

        this.enableCurrentHeatingCoolingState();
        this.enableTargetHeatingCoolingState();
        this.enableCurrentTemperature();
        this.enableTargetTemperature();
        this.enableDisplayUnits();
        this.enableCoolingThresholdTemperature();
        this.enableHeatingThresholdTemperature();

        this.enableTilt();
        this.restartTiltTimer();
    }


    enableTilt() {

        Bleacon.on('discover', (bleacon) => {

            // Identifies the TILT Hydrometer available
            var tilt = {
                "a495bb10c5b14b44b5121370f02d74de": "red",
                "a495bb20c5b14b44b5121370f02d74de": "green",
                "a495bb30c5b14b44b5121370f02d74de": "black",
                "a495bb40c5b14b44b5121370f02d74de": "purple",
                "a495bb50c5b14b44b5121370f02d74de": "orange",
                "a495bb60c5b14b44b5121370f02d74de": "blue",
                "a495bb70c5b14b44b5121370f02d74de": "pink"
            };


            if (tilt[bleacon.uuid] == this.config.color) {
                var tilt = {};

                tilt.timestamp   = new Date();
                tilt.gravity     = bleacon.minor / 1000;
                tilt.rssi        = bleacon.rssi;
                tilt.temperature = {
                    F: bleacon.major,
                    C: (5/9) * (bleacon.major - 32)
                };

                this.tilt = tilt;
            }
        });

        Bleacon.startScanning();
    }



    restartTiltTimer() {

        if (this.tilt) {
            // Return in 15 minutes
            this.tiltTimer.setTimer(15 * 60000, this.restartTiltTimer.bind(this));

            this.log('Tilt:', JSON.stringify(this.tilt));

            if (this.tilt.temperature) {
                this.service.setCharacteristic(Characteristic.CurrentTemperature, this.temperatureDisplayUnits == Characteristic.TemperatureDisplayUnits.CELSIUS ? this.tilt.temperature.C : this.tilt.temperature.F);
            }


        }
        else {
            // Poll a little bit faster until connection to Tilt is completed
            this.tiltTimer.setTimer(1000, this.restartTiltTimer.bind(this));
        }
    }



    shouldTurnOnHeating() {

        switch (this.targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.AUTO:
                return this.currentTemperature < this.heatingThresholdTemperature;

            case Characteristic.TargetHeatingCoolingState.HEAT:
                return this.currentTemperature < this.targetTemperature;

        }

        return false;

    }

    shouldTurnOnCooling() {
        switch (this.targetHeatingCoolingState) {
            case Characteristic.TargetHeatingCoolingState.AUTO:
                return this.currentTemperature > this.coolingThresholdTemperature;

            case Characteristic.TargetHeatingCoolingState.COOL:
                return this.currentTemperature > this.targetTemperature;

        }

        return false;
    }



    fireRequests() {

        var calls = undefined;

        // Be silent if turned off
        if (this.targetHeatingCoolingState == Characteristic.TargetHeatingCoolingState.OFF)
            return;

        switch (this.currentHeatingCoolingState) {
            case Characteristic.CurrentHeatingCoolingState.OFF:
                {
                    calls = this.config.state.off;
                    break;
                };
            case Characteristic.CurrentHeatingCoolingState.HEAT:
                {
                    calls = this.config.state.heat;
                    break;
                };
            case Characteristic.CurrentHeatingCoolingState.COOL:
                {
                    calls = this.config.state.cool;
                    break;
                };
        }

        if (calls != undefined && !isArray(calls))
            calls = [calls];

        if (isArray(calls)) {

            calls.forEach((call, index) => {
                this.log('Making request:', call.url, JSON.stringify(call.options));

                var request = new Request(call.url);

                request.request(call.options).then(() => {

                })
                .catch((error) => {
                    this.log(error);
                })
            });
        }


    }

    fireRequestsWithDelay() {
        this.requestTimer.setTimer(2000, () => {
            this.fireRequests();
        });
    }

    updateCurrentHeatingCoolingState() {

        var state = this.currentHeatingCoolingState;

        if (this.shouldTurnOnHeating()) {
            state = Characteristic.CurrentHeatingCoolingState.HEAT;
        } else if (this.shouldTurnOnCooling()) {
            state = Characteristic.CurrentHeatingCoolingState.COOL;
        } else {
            state = Characteristic.CurrentHeatingCoolingState.OFF;
        }

        if (state != this.currentHeatingCoolingState) {
            if (state == Characteristic.CurrentHeatingCoolingState.OFF) {
                this.log('Turning off since current temperature is', this.currentTemperature);
            };
            if (state == Characteristic.CurrentHeatingCoolingState.HEAT) {
                this.log('Turning on heat since current temperature is', this.currentTemperature);
            };
            if (state == Characteristic.CurrentHeatingCoolingState.COOL) {
                this.log('Turning on cool since current temperature is', this.currentTemperature);
            };

            this.service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, state);
        }

    }



    enableCurrentHeatingCoolingState() {

        var characteristic = this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);

        characteristic.on('get', callback => {
            callback(null, this.currentHeatingCoolingState);
        });

        characteristic.on('set', (value, callback) => {
            this.currentHeatingCoolingState = value;
            this.updateCurrentHeatingCoolingState();
            this.fireRequestsWithDelay();
            callback(null);
        });
    }


    enableTargetHeatingCoolingState() {

        var characteristic = this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState);

        characteristic.on('get', callback => {
            callback(null, this.targetHeatingCoolingState);
        });

        characteristic.on('set', (value, callback) => {

            this.targetHeatingCoolingState = value;

            this.updateCurrentHeatingCoolingState();
            this.restartTiltTimer();

            callback(null);
        });

    }


    enableCurrentTemperature() {
        var currentTemperature = this.service.getCharacteristic(Characteristic.CurrentTemperature);

        currentTemperature.setProps({
            minValue: this.minTemperature,
            maxValue: this.maxTemperature,
            minStep: 0.1
        });
        currentTemperature.on('get', callback => {
            callback(null, this.currentTemperature);
        });
        currentTemperature.on('set', (value, callback) => {
            this.currentTemperature = value;
            this.updateCurrentHeatingCoolingState();
            this.fireRequestsWithDelay();
            callback(null);
        });
    }

    enableTargetTemperature() {
        var targetTemperature = this.service.getCharacteristic(Characteristic.TargetTemperature);

        targetTemperature.setProps({
            minValue: this.minTemperature,
            maxValue: this.maxTemperature,
            minStep: 0.1
        });

        targetTemperature.on('get', callback => {
            callback(null, this.targetTemperature);
        });

        targetTemperature.on('set', (value, callback) => {

            this.targetTemperature = value;

            this.updateCurrentHeatingCoolingState();
            this.restartTiltTimer();

            callback(null);
        });

    }

    enableDisplayUnits() {
        // °C or °F for units
        var displayUnits = this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits);

        displayUnits.on('get', callback => {
            callback(null, this.temperatureDisplayUnits);
        });
        displayUnits.on('set', (value, callback) => {
            this.temperatureDisplayUnits = value;
            callback(null);
        });
    }

    enableCoolingThresholdTemperature() {

        var thresholdTemperature = this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature);

        thresholdTemperature.on('get', callback => {
            callback(null, this.coolingThresholdTemperature);
        });
        thresholdTemperature.on('set', (value, callback) => {
            this.coolingThresholdTemperature = value;
            this.updateCurrentHeatingCoolingState();
            callback(null);
        });

    }

    enableHeatingThresholdTemperature() {
        // Auto min temperature
        var thresholdTemperature = this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature);

        thresholdTemperature.on('get', callback => {
            callback(null, this.heatingThresholdTemperature);
        });
        thresholdTemperature.on('set', (value, callback) => {
            this.heatingThresholdTemperature = value;

            this.updateCurrentHeatingCoolingState();
            callback(null);
        });

    }

    getServices() {

        const service = new Service.AccessoryInformation();

        service.setCharacteristic(Characteristic.Manufacturer, 'Tilt');
        service.setCharacteristic(Characteristic.Model, 'Tilt Hydrometer');
        service.setCharacteristic(Characteristic.SerialNumber, '1.0');


        return [service, this.service];
    }

}
