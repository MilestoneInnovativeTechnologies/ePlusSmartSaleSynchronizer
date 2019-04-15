const electron = require('electron');
const url = require('url'); const path = require('path');
const fs = require('fs');

const { app,BrowserWindow,ipcMain } = electron;

let configFilePath = path.join(app.getAppPath(), 'ss-config.json'),
    DBFilePath = path.join(app.getAppPath(), 'ss-up.enc'),
    mainWindowOptions = { frame: false, width: 600, height: 400 },
    configUrl = url.format({ pathname: path.join(__dirname, 'loadConfigWindow.html'), protocol: 'file:', slashes: true }),
    initWindowUrl = url.format({ pathname: path.join(__dirname, 'initWindow.html'), protocol: 'file:', slashes: true }),
    mainWindowUrl = url.format({ pathname: path.join(__dirname, 'mainWindow.html'), protocol: 'file:', slashes: true }),
    initWindow = null, ssConfig = null, mysql = null, tables = null;

app.on('ready',() => {
    initWindow = new BrowserWindow(mainWindowOptions);
    ipcMain.on('launch-main',function(){ initWindow.loadURL(initWindowUrl) });
    fs.access(configFilePath, fs.constants.R_OK, (error) => {
        if (error) return initWindow.loadURL(configUrl);
        fs.readFile(configFilePath,function(err,data){
            ssConfig = JSON.parse(data);
            initWindow.loadURL(initWindowUrl);
        });
    });
});

ipcMain.on('request-app-path',function(event){ event.returnValue = app.getAppPath(); });
ipcMain.on('quit-app',function(){ app.quit() });
ipcMain.on('delete-config',function(){
    fs.unlink(configFilePath,(error) => {
        if(error) return alert('Error in deleting file, Please contact Milestone Support!!');
        fs.unlink(DBFilePath,(error) => {
            if(error) return alert('Error in deleting DB File, Please contact Milestone Support!!');
        });
        initWindow.loadURL(configUrl);
    });
});
ipcMain.on('request-ss-config',function(event){ event.returnValue = ssConfig;  });
ipcMain.on('set-tables',function(event,schema){ tables = schema; });
ipcMain.on('set-connection',function(event,connection){ mysql = connection; });
// let mainWindow = new BrowserWindow(mainWindowOptions);
// mainWindow.loadURL(mainWindowUrl); mainWindow.webContents.send('data',mysql,tables,ssConfig);
