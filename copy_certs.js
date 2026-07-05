const fs = require('fs');
if (!fs.existsSync('./ssl')) fs.mkdirSync('./ssl');
fs.copyFileSync('./backend/ssl/server.crt', './ssl/server.crt');
fs.copyFileSync('./backend/ssl/server.key', './ssl/server.key');
console.log('Certs copied to ./ssl');
