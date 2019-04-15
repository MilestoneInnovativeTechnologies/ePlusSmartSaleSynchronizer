const electron = require('electron');
const url = require('url'); const path = require('path');
const fs = require('fs'); const _ = require('lodash');

const { app,BrowserWindow,ipcMain } = electron;

process.env.NODE_ENV = 'development';

let configFile = 'ss-config.json', dbFile = 'ss-up.enc',
    userPath, configFilePath, DBFilePath, initWindow = null, ssConfig = null, mysql = null,
    mainWindowOptions = { frame: false, width: 600, height: 400 }, browserWindow = null,
    configWindowUrl = url.format({ pathname: path.join(__dirname, 'loadConfigWindow.html'), protocol: 'file:', slashes: true }),
    initWindowUrl = url.format({ pathname: path.join(__dirname, 'initWindow.html'), protocol: 'file:', slashes: true }),
    mainWindowUrl = url.format({ pathname: path.join(__dirname, 'mainWindow.html'), protocol: 'file:', slashes: true })
    ;

app.on('ready',() => {
    userPath = app.getPath('userData'); configFilePath = path.join(userPath,configFile); DBFilePath = path.join(userPath,dbFile);
    browserWindow = new BrowserWindow(mainWindowOptions)
    fs.access(configFilePath, fs.constants.R_OK, (error) => {
        if (error) launchConfigWindow();
        else launchInitWindow();
    });
});


ipcMain.on('config-file-path',function(event){ event.returnValue = configFilePath; });
ipcMain.on('quit-app',function(){ app.quit() });
ipcMain.on('launch-init',launchInitWindow);
ipcMain.on('delete-config',function(){ deleteConfigurations(); launchConfigWindow(); });
ipcMain.on('get-config',function(event){ event.returnValue = ssConfig; });
ipcMain.on('get-db-file',function(event){ event.returnValue = DBFilePath; });
ipcMain.on('set-connection',function(event,connection){ mysql = connection; });

function launchConfigWindow(){
    browserWindow.loadURL(configWindowUrl);
    browserWindow.webContents.on('did-finish-load',function(){ browserWindow.webContents.send('ss-window-ready',browserWindow.id); });
}
function launchInitWindow(){
    fs.readFile(configFilePath,function(err,data){
        if(err) return console.log('read config error');
        ssConfig = JSON.parse(data);
        browserWindow.loadURL(initWindowUrl);
        //browserWindow.webContents.on('did-finish-load',function(){ browserWindow.webContents.send('ss-config',ssConfig,browserWindow.id); });
    });
}

function deleteConfigurations(){
    fs.access(configFilePath, fs.constants.R_OK, (err) => {
        if(!err) fs.unlink(configFilePath,(err) => (err) ? console.log('Configuration file cannot be deleted..') : '');
        else console.log('Configuration file is not accessible..');
    });
    fs.access(DBFilePath, fs.constants.R_OK, (err) => {
        if(!err) fs.unlink(DBFilePath,(err) => (err) ? console.log('DB Config file cannot be deleted..') : '');
        else console.log('DB Config file is not accessible..');
    });
}