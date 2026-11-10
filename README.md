# Soundstamp

[![Netlify Status](https://api.netlify.com/api/v1/badges/10f3cc1b-d8b4-44dc-be33-19cf796a6375/deploy-status)](https://app.netlify.com/projects/soundstamp/deploys)

Turn your last.fm listening history into a passport: a world map of where your music comes from, a stamp for every country you've "visited", and a suggestion for somewhere new.

## Setup

```sh
npm install
cp .env.example .env
```

Fill in `.env`:

- `LASTFM_API_KEY`: create one at https://www.last.fm/api/account/create
- `MB_CONTACT`: a contact URL or email for the MusicBrainz `User-Agent` header (required by their API rules)

## Develop

```sh
npx netlify dev   # runs SvelteKit with Netlify Blobs available locally
npm test          # unit and component tests
npm run check     # type check
```

## Licence

Soundstamp is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 2 of the License, or (at your option) any later version. See [`LICENSE`](LICENSE).

Third-party libraries shipped to browsers are listed with their licences at `/licenses.txt`, generated at build time. The DM Serif Display font used for link-preview images is under the SIL Open Font License ([`src/lib/server/og/DMSerifDisplay-OFL.txt`](src/lib/server/og/DMSerifDisplay-OFL.txt)). Country data comes from [MusicBrainz](https://musicbrainz.org) (CC0); map shapes from [Natural Earth](https://www.naturalearthdata.com) via world-atlas (public domain).
