# Soundstamp

Turn your last.fm listening history into a passport: a world map of where your music comes from, a stamp for every country you've "visited", and a suggestion for somewhere new.

Design: [`docs/superpowers/specs/2026-11-10-musical-passport-design.md`](docs/superpowers/specs/2026-11-10-musical-passport-design.md)

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

If `netlify dev` shows "Could not proxy request" or pages load without working scripts, a leftover production build is being served. Delete it with `rm -rf build .netlify/v1 .netlify/functions-internal` and restart.

Each production deploy on Netlify's free plan costs 15 of its 300 credits, so do most work locally and deploy in batches.

## Before going public

- [ ] Email partners@last.fm with a description of the site, asking for page approval (API ToS cl. 2.7)
- [ ] Ask whether showing last.fm avatars is allowed (cl. 5.1.8); until then the ID strip uses generated initials
- [ ] Ask whether opt-in "taste pen pals" matching would be allowed
- [ ] Make sure the domain name doesn't contain "lastfm" or "last.fm"
- [ ] Don't announce or promote the site until last.fm has replied (API ToS cl. 8.2)
- [ ] Ask last.fm whether a text "powered by AudioScrobbler" link is enough, or they want their badge
- [ ] Check whether you need to pay the ICO data protection fee (ico.org.uk self-assessment)
- [ ] Check your employer's policy on side projects
- [ ] Search UK IPO / EUIPO for "Soundstamp" trademarks
- [ ] Set `LASTFM_API_KEY` and `MB_CONTACT` in Netlify's environment variables

## Licence

Soundstamp is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 2 of the License, or (at your option) any later version. See [`LICENSE`](LICENSE).

Third-party libraries shipped to browsers are listed with their licences at `/licenses.txt`, generated at build time. The DM Serif Display font used for link-preview images is under the SIL Open Font License ([`src/lib/server/og/DMSerifDisplay-OFL.txt`](src/lib/server/og/DMSerifDisplay-OFL.txt)). Country data comes from [MusicBrainz](https://musicbrainz.org) (CC0); map shapes from [Natural Earth](https://www.naturalearthdata.com) via world-atlas (public domain).
