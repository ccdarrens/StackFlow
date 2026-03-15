# StackFlow

StackFlow is an offline-first poker session tracker for cash games and tournaments. It runs in a normal browser and can also be installed as a Progressive Web App on supported phones, tablets, and desktops.

## What It Does

- Track live cash and tournament sessions
- Record buy-ins, rebuys, add-ons, cashouts, payouts, and expenses
- Review session history with filters, sorting, and charts
- Export sessions to JSON or CSV
- Import JSON backups back into the app
- Keep your data locally in your browser for offline use

## Access and Install

You can use StackFlow in two ways:

1. Open it in your browser from the deployed GitHub Pages site for this repository
2. Install it as an app from a supported browser

### Install on iPhone or iPad

1. Open StackFlow in Safari
2. Tap the Share button
3. Tap `Add to Home Screen`
4. Launch it from your home screen like a normal app

### Install on Android

1. Open StackFlow in Chrome or another supported browser
2. Tap the browser menu
3. Tap `Install app` or `Add to Home screen`
4. Launch it from your app list or home screen

### Install on Desktop

1. Open StackFlow in Chrome or Edge
2. Use the install button in the address bar or browser menu
3. Install it
4. Launch it as a standalone app window if you want

### Open on Phone from Your Desktop

If you have StackFlow open on your desktop and want to jump to it on your phone, scan this QR code:

<img src="public/images/stackflow-qr.png" alt="StackFlow QR code" width="60" />

Direct link: `https://ccdarrens.github.io/StackFlow`

## Basic Use

1. Start a cash or tournament session
2. Record investments, returns, and expenses as you play
3. End the session when you are done
4. Review results in `Sessions`
5. Export JSON periodically as a backup

## Backups and Data Storage

StackFlow stores your session data in your browser on the current device. That means:

- your data stays local unless you export it
- clearing browser storage can remove your saved sessions
- using a different device or browser will not automatically show the same data

For safety, use JSON export as a backup and import it when needed.

## Browser and PWA Notes

- StackFlow still works as a regular website in a desktop browser
- Installing it as a PWA is optional
- Some device features, such as vibration, depend on browser support
- Offline support is best for previously loaded app assets on the same device

## Developer Docs

Developer setup, test commands, architecture notes, and release workflow are in [DEVELOPER.md](DEVELOPER.md).

## License

MIT - see [LICENSE](LICENSE).


