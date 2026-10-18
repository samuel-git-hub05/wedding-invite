# Aarav & Ananya — Wedding Invitation

A premium, responsive wedding invitation experience built with Vite and vanilla JavaScript. It features a CSS-powered 3D envelope reveal, original Web Audio ambience, editorial wedding photography, a live countdown, calendar download, and an interactive RSVP confirmation.

## Run locally

```bash
npm install
npm run dev
```

Build for production with `npm run build`.

## Personalize the invitation

The names, wording, date, venue, schedule, RSVP deadline, and contact address are sample details. Update them in `index.html` and the matching event data in `src/main.js`. Replace the two locally stored images in `public/images/` with your own licensed photographs. The RSVP currently confirms in the browser only; connect the form handler in `src/main.js` to a form service or backend before collecting real replies.
