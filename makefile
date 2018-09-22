
all:
	@echo Specify 'pull', 'config', 'install' or 'run'

pull:
	git pull

config:
	node ./scripts/install-config.js

install:
	sudo npm install -g

undo:
	git reset --hard HEAD

restart:
	sudo pm2 restart homebridge

stop:
	sudo pm2 stop homebridge

run:
	sudo homebridge
