const DiscordRPC = require('discord-rpc');
const {WebhookClient} = require('discord.js');
const auth = require('./config/auth.json');
const fs = require('fs');
const path = require('path');
const {debugMode, debugAllEvents} = require('./config/config.json');
const {log, warn, error, updateEvent, setup, debug, logEvent, isRunning} = require('./functions/functions.js');

const gameFile = path.join(process.env.USERPROFILE, '\\Saved Games\\Frontier Developments\\Elite Dangerous');

let hook = setup(gameFile, true);

if (debugMode) {
    debug('Debug mode is on.')
}

let webHook = null;
let oldLine = null;

if (hook) {
    webHook = new WebhookClient(hook.id, hook.token);
}

let watched = ['Loadout', 'FSDJump', 'Location', 'StartJump', 'DockingGranted', 'Docked', 'Undocked'];

setInterval(() => {
    let files = fs.readdirSync(gameFile);
    let latest = files.filter(file => file.endsWith('.log')).reverse()[0];
    if (!latest) return warn('No log file found!');
    let file = fs.readFileSync(gameFile + '\\' + latest, 'utf-8');
    let lines = file.split('\n').filter(line => line).reverse();
    let curFile = JSON.parse(fs.readFileSync('./latest.json', 'utf-8'));
    if (debugAllEvents && debugMode) {
        debug('debugAllEvents: true');
        console.log(lines[0])
    }
    if (!lines.filter(line => watched.includes(JSON.parse(line).event))[0]) return updateEvent({event: 'MainMenu'});
    let json = JSON.parse(lines.filter(line => watched.includes(JSON.parse(line).event))[0]);
    let event = updateEvent(json);
    if (debugMode) {
        debug('JSON Object');
        console.log(event);
    }
    if (oldLine && oldLine.ts !== json.timestamp && oldLine.event !== json.event) {
        logEvent(event);
        if (json.event === 'FSDJump' && webHook) {
            webHook.send(`CMDR ${curFile.cmdr} jumped to \`${curFile.jumpTarget}\``)
        }
    }
    oldLine = {ts: json.timestamp, event: json.event}
}, 5000);

const clientId = auth.id;
if (clientId) {
    DiscordRPC.register(clientId);
}

const rpc = new DiscordRPC.Client({transport: 'ipc'});
const startTimestamp = new Date();

let prevJump = false;

async function setActivity() {
    let status = JSON.parse(fs.readFileSync('latest.json', 'utf-8'));
    if (!status.cmdr || !status.ship) {
        setup(gameFile);
    }
    if (!rpc) return;
    if (status.jumping) {
        rpc.setActivity({
            details: 'Hyperspace Jump to',
            state: status.jumpTarget,
            startTimestamp,
            largeImageKey: 'ed',
            largeImageText: 'Elite Dangerous',
            instance: false,
        });
    } else if (status.docking) {
        rpc.setActivity({
            details: `Docking at ${status.docking}`,
            state: status.system || '???',
            startTimestamp,
            largeImageKey: 'ed',
            largeImageText: 'Elite Dangerous',
            instance: false,
        });
    } else if (status.docked) {
        rpc.setActivity({
            details: `Docked at ${status.docked}`,
            state: status.system || '???',
            startTimestamp,
            largeImageKey: 'ed',
            largeImageText: 'Elite Dangerous',
            instance: false,
        });
    } else {
        rpc.setActivity({
            details: status.ship || 'In Main Menu',
            state: status.system || 'Idling...',
            startTimestamp,
            largeImageKey: 'ed',
            largeImageText: 'Elite Dangerous',
            instance: false,
        });
    }
}

rpc.on('ready', async () => {
    if (clientId) {
        log('Successfully connected to Discord.');
        setActivity(webHook);
        setInterval(() => {
            setActivity(webHook);
        }, 15e3);
    }
});

isRunning('EliteDangerous64.exe', (status) => {
    if (status) {
        rpc.login({clientId}).catch(async err => {
            error('Could not connect to the Discord API: ${err.code} - ${err.message}');
        });
    } else {
        warn('Cannot find Elite Dangerous Process, Make sure Elite Dangerous is running.')
    }
});