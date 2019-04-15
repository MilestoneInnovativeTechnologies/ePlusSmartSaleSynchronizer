const electron = require('electron');
const url = require('url'); const path = require('path');
const _ = require('lodash');
const $ = require('jquery');

const { ipcRenderer } = electron;
const { dialog,BrowserWindow } = electron.remote;

let maxLog = 10, currentWindow, ssConfig, tables;
let invisibleWindowOption = { show: false, width: 200, height: 200 },
    connectWindowUrl = url.format({ pathname: path.join(__dirname,'sessions', 'tryConnectMysql.html'), protocol: 'file:', slashes: true })
;

window.onload = function(){
    currentWindow = electron.remote.getCurrentWindow();
    ssConfig = ipcRenderer.sendSync('request-ss-config'); log('SS Config Written');
    $('#company_name').text(ssConfig.name); $('#application').text(ssConfig.application);
    tables = _(ssConfig.tables).mapKeys('table').mapValues((obj)=>_.pick(obj,['sync_from_ttl','sync_to_ttl'])).value(); log('Tables arranged');
    ipcRenderer.send('set-tables',tables);
    let connection_bw = new BrowserWindow(invisibleWindowOption); connection_bw.loadURL(connectWindowUrl);
    connection_bw.webContents.on('did-finish-load',function(){ connection_bw.webContents.send('settings',ssConfig,currentWindow.id); });
    connection_bw.webContents.on('destroyed',function(){ $("#sync").removeClass('d-none'); });
};

let quitConfirmOptions = { type: 'info', title: 'Confirm Quit', message: 'Are you sure, you want to quit ?', buttons: ['Yes, Quit','No, go Back'] };
let delConfigOptions = { type: 'info', title: 'Confirm Deleting Current Configuration', message: 'Are you sure, you want to delete the current loaded configuration file. This process is irreversible. Make sure you have proper configuration file with you to relaunch synchronizer.', buttons: ['Yes, Delete config file','No, go Back'] };


function quitApp(){ dialog.showMessageBox(quitConfirmOptions,(index) => { if(!index) ipcRenderer.send('quit-app'); }) }
function delConf(){ dialog.showMessageBox(delConfigOptions,(index) => { if(!index) ipcRenderer.send('delete-config'); }) }
function log(text) { $('#log').prepend($('<pre>').text(`${new Date().getTime()} :: ${text}`)).children(`:gt(${maxLog})`).remove(); }

ipcRenderer.on('log',function(event,text){ log(text) });
//ipcRenderer.on('connect-success',function(){ $("#sync").removeClass('d-none'); });