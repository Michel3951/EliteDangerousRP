const moment = require('moment');
const fs = require('fs');
const {showShipNickname} = require('../config/config.json');
const exec = require('child_process').exec;

module.exports = {
    log: function (message) {
        console.log(`\x1b[32m[Client]\x1b[0m[${moment().format("L hh:mm:ss")}] ${message}`);
    },
    error: function (message) {
        console.log(`\x1b[31m[Error]\x1b[0m[${moment().format("L hh:mm:ss")}] ${message}`);
    },
    warn: function (message) {
        console.log(`\x1b[33m[Warn]\x1b[0m[${moment().format("L hh:mm:ss")}] ${message}`);
    },
    debug: function (message) {
        console.log(`\x1b[35m[Debug]\x1b[0m[${moment().format("L hh:mm:ss")}] ${message}`);
    },
    updateLoadout: function (ship = null, system = null, jumping = false, jumpTarget = null, docking = null, docked = null, cmdr = null) {
        module.exports.createFileIfNotExists('./latest.json', '{}');
        let oldState = JSON.parse(fs.readFileSync('./latest.json', 'utf-8'));
        if (oldState.ship === ship && oldState.system === system) return;
        fs.writeFileSync('latest.json', `{"cmdr": ${cmdr ? `"${cmdr}"` : oldState.cmdr ? `"${oldState.cmdr}"` : null}, "ship": ${ship ? `"${ship}"` : oldState.ship ? `"${oldState.ship}"` : null}, "system": ${system ? `"${system}"` : oldState.system ? `"${oldState.system}"` : null}, "jumping": ${jumping}, "jumpTarget": ${jumpTarget ? `"${jumpTarget}"` : null}, "docking": ${docking ? `"${docking}"` : null}, "docked": ${docked ? `"${docked}"` : null}}`)
    },
    setup: function (gameFile, withHook = false) {
        module.exports.createFileIfNotExists('./latest.json', '{}');
        module.exports.createFileIfNotExists('./webhook.json', '{"id": null, "token": null, "enabled": false, "jumpOnly": true}');
        const {ship, cmdr} = JSON.parse(fs.readFileSync('./latest.json', 'utf-8'));
        if (!ship || !cmdr) {
            let watched = ['LoadGame'];
            let files = fs.readdirSync(gameFile);
            let latest = files.filter(file => file.endsWith('.log')).reverse()[0];
            if (!latest) return warn('No log file found!');
            let file = fs.readFileSync(gameFile + '\\' + latest, 'utf-8');
            let lines = file.split('\n').filter(line => line).reverse();
            if (!lines.filter(line => watched.includes(JSON.parse(line).event))[0]) return;
            let json = JSON.parse(lines.filter(line => watched.includes(JSON.parse(line).event))[0]);
            module.exports.updateEvent(json);
        }
        if (withHook) {
            let hook = JSON.parse(fs.readFileSync('./webhook.json', 'utf-8'));
            if (hook.token && hook.id && hook.enabled) {
                module.exports.log("Webhook is enabled!");
                return {token: hook.token, id: hook.id}
            } else {
                module.exports.log("Webhook has been disabled, Enter credentials in webhook.json to get started!");
                return false
            }
        }
    },
    createFileIfNotExists: function (path, data = null) {
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, data, 'utf-8');
        }
    },
    logEvent: function (event) {
        switch (event.type) {
            case 'FSDJump':
                module.exports.log(`Jumped to ${event.system}`);
                break;
            case 'StartJump':
                if (event.jumpType === 'Hyperspace') {
                    module.exports.log(`Framshift Drive charging for hyperspace jump to ${event.system}.`);
                }
                break;
            case 'DockingGranted':
                module.exports.log(`Docking request for ${event.station} granted.`);
                break;
            case 'Docked':
                module.exports.log(`Docked at ${event.station}.`);
                break;
            case 'Undocked':
                module.exports.log(`Undocked from ${event.station}.`);
                break;

        }
    },
    updateEvent: function (json) {
        if (json.event === 'LoadGame') {
            if (showShipNickname) {
                module.exports.updateLoadout(`${json.ShipName} (${json.Ship})`, null, false, null, null, null, json.Commander)
            } else {
                module.exports.updateLoadout(json.Ship)
            }
            return {type: json.event, ship: json.Ship}
        } else if (json.event === 'FSDJump') {
            module.exports.updateLoadout(null, json.StarSystem,);
            return {type: json.event, system: json.StarSystem}
        } else if (json.event === 'StartJump') {
            if (json.JumpType === 'Hyperspace') {
                module.exports.updateLoadout(null, null, true, json.StarSystem);
                return {type: json.event, system: json.StarSystem, jumpType: json.JumpType}
            } else {
                return {type: json.event, jumpType: json.JumpType}
            }
        } else if (json.event === 'Location') {
            module.exports.updateLoadout(null, json.StarSystem);
            return {type: json.event, system: json.StarSystem}
        } else if (json.event === "DockingGranted") {
            module.exports.updateLoadout(null, null, false, null, json.StationName);
            return {type: json.event, station: json.StationName}
        } else if (json.event === "Docked") {
            module.exports.updateLoadout(null, json.StarSystem, false, null, null, json.StationName);
            return {type: json.event, station: json.StationName}
        } else if (json.event === "Undocked") {
            module.exports.updateLoadout();
            return {type: json.event, station: json.StationName}
        }
    },
    isRunning: function (query, cb) {
        let platform = process.platform;
        let cmd = '';
        switch (platform) {
            case 'win32' :
                cmd = `tasklist`;
                break;
            case 'darwin' :
                cmd = `ps -ax | grep ${query}`;
                break;
            case 'linux' :
                cmd = `ps -A`;
                break;
            default:
                break;
        }
        exec(cmd, (err, stdout, stderr) => {
            cb(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
        });
    }
};