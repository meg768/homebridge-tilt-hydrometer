# homebridge-tilt-thermostat
Homebridge plugin for Tilt Hydrometer to act as a thermostat for homebrewers.

## Personal notes

### Starting from scratch
* sudo raspi-config
* curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash
* sudo apt-get install -y nodejs
* sudo npm config set unsafe-perm true
* sudo npm install homebridge -g
* sudo apt install git

### Cloning repository
* git clone https://github.com/meg768/homebridge-tilt-thermostat.git
* cd homebridge-tilt-thermostat
* sudo npm install
* sudo npm install -g
* sudo make config

### Installing PM2
* sudo npm install pm2 -g
* sudo pm2 start homebridge
* sudo pm2 save

