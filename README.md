# homebridge-tilt-thermostat
Homebridge plugin for Tilt Hydrometer to act as a thermostat for homebrewers.


## Starting from scratch
* sudo raspi-config
* curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash
* sudo apt-get install -y nodejs
* sudo npm config set unsafe-perm true
* sudo npm install homebridge -g
* sudo apt install git
* git clone https://github.com/meg768/homebridge-tilt-thermostat.git
* cd homebridge-tilt-thermostat
* npm install
* npm install -g
* npm install pm2 -g
* pm2 start homebridge
* pm2 save

