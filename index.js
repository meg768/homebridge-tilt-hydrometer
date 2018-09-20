const OFF = true;
const ON = false;

var Bleacon = require('bleacon');
var isArray = require('yow/is').isArray;
var Request = require('yow/request');

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
        this.timer = null;
        this.maxTemperature = config.maxTemperature || 30;
        this.minTemperature = config.minTemperature || 0;
        this.payload = {};

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

        this.enableTimer();

        this.enableTilt();



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
                var payload = {};
                payload.timestamp = new Date();
                payload.color = this.config.color;
                payload.temperature = bleacon.major;
                payload.gravity = bleacon.minor / 1000;
                payload.rssi = bleacon.rssi;
                this.payload = payload;
            }
        });

        Bleacon.startScanning();
    }

    toCelsius(f) {
        return (5/9) * (f-32);
    }

    disableTimer() {
        if (this.timer != null)
            clearTimeout(this.timer);

        this.timer = null;

    }

    enableTimer() {

        var random = require('yow/random');

        this.disableTimer();

        this.timer = setTimeout(() => {
            if (this.payload.temperature) {
                var temperature = this.payload.temperature;

                if (this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS)
                    temperature = this.toCelsius(temperature);

                this.log('Tilt status', this.payload);
                this.service.setCharacteristic(Characteristic.CurrentTemperature, temperature);

            }

            this.enableTimer();
        }, 5000);
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

    fireRequest(state) {

        var calls = undefined;

        switch (state) {
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
                //call.options = Object.assign({debug:true}, call.options);
                //this.log(call);

                var request = new Request(call.url);

                request.request(call.options).then(() => {})
                    .catch((error) => {
                        this.log(error);
                    })
            });
        }


    }
    updateSystem() {

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

            this.fireRequest(state);

        }

    }


    getAccessoryInformation() {}

    enableCurrentHeatingCoolingState() {

        var characteristic = this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState);

        characteristic.on('get', callback => {
            callback(null, this.currentHeatingCoolingState);
        });

        characteristic.on('set', (value, callback) => {
            this.currentHeatingCoolingState = value;
            this.updateSystem();
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
            this.updateSystem();
            callback(null);
        });

    }

    enableCurrentTemperature() {
        var currentTemperature = this.service.getCharacteristic(Characteristic.CurrentTemperature);

        currentTemperature.setProps({
            minValue: this.minTemperature,
            maxValue: this.maxTemperature,
            minStep: 0.5
        });
        currentTemperature.on('get', callback => {
            callback(null, this.currentTemperature);
        });
        currentTemperature.on('set', (value, callback) => {
            this.currentTemperature = value;
            this.updateSystem();
            callback(null);
        });
    }

    enableTargetTemperature() {
        var targetTemperature = this.service.getCharacteristic(Characteristic.TargetTemperature);

        targetTemperature.setProps({
            minValue: this.minTemperature,
            maxValue: this.maxTemperature,
            minStep: 0.5
        });

        targetTemperature.on('get', callback => {
            callback(null, this.targetTemperature);
        });
        targetTemperature.on('set', (value, callback) => {
            this.targetTemperature = value;
            this.updateSystem();
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
            this.updateSystem();
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
            this.updateSystem();
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
