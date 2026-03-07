const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const out = path.join(__dirname, '..', 'www', 'version.json');
fs.writeFileSync(out, JSON.stringify({ version: pkg.version || '0.0.0' }));
