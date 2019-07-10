const installer = require('electron-installer-windows');

const options = {
    "src": 'builds/sssync-win32-x64/',
    "dest": 'setup/installers/',
    "icon": "assets/icons/win/icon.ico",
    "name": "sssync",
    "productName": "ePlus Smart Sale Synchronizer",
    "description": "Database synchronizer to make local and remote database synchronized",
    "productDescription": "Database synchronizer to make local and remote database synchronized",
    "version": "0.1.4",
    "authors": ["Milestone Innovative Technologies"],
    "owners": ["Milestone Innovative Technologies"],
    "noMsi": true
};

console.log('Creating package (this may take a while)');

installer(options)
    .then(() => console.log(`Successfully created package at ${options.dest}`))
    .catch(err => {
        console.error(err, err.stack);
        process.exit(1);
    });