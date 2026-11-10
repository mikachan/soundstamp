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

Each production deploy on Netlify's free plan costs 15 of its 300 credits, so do most work locally and deploy in batches.

## Before going public

- [ ] Email partners@last.fm with a description of the site, asking for page approval (API ToS cl. 2.7)
- [ ] Ask whether showing last.fm avatars is allowed (cl. 5.1.8); until then the ID strip uses generated initials
- [ ] Ask whether opt-in "taste pen pals" matching would be allowed
- [ ] Make sure the domain name doesn't contain "lastfm" or "last.fm"
