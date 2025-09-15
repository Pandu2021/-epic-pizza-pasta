/*
	cPanel/Passenger startup file for the backend (NestJS)

	How this works on cPanel:
	- In cPanel > Setup Node.js App, set Application Root to the Back-End folder.
	- Set Startup File to deploy/cpanel/app.js
	- Click "Run NPM Install" and then "Restart" the app.

	This script loads environment variables and then requires the compiled Nest app at dist/main.js
	which starts the HTTP server by calling bootstrap().
*/

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');

// Try to load .env from Back-End/.env if present
const envCandidates = [
	path.join(__dirname, '..', '..', '.env'), // Back-End/.env
	path.join(__dirname, '..', '..', '..', '.env'), // repo root .env
];
for (const p of envCandidates) {
	if (fs.existsSync(p)) {
		require('dotenv').config({ path: p });
		break;
	}
}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ensure a PORT exists (cPanel will provide PORT via Passenger)
process.env.PORT = process.env.PORT || '4000';

// Start compiled Nest app
const distMain = path.join(__dirname, '..', '..', 'dist', 'main.js');
if (!fs.existsSync(distMain)) {
	// eslint-disable-next-line no-console
	console.error('dist/main.js not found. Did you run `npm install` (postinstall builds) or `npm run build`?');
}
require(distMain);

