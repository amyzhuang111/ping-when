# Deploy Ping When

Next.js app (`next` 16.4.2). Vercel framework preset is `nextjs`. The build command is `npm run build` (`next build`). The output directory is `.next`. This is not a static export, so `cleanUrls` is not set.

No GitHub connection. Deploy from this directory with the Vercel CLI. A `VERCEL_TOKEN` or an interactive `vercel login` is required at deploy time. Do not commit `.vercel` or `.env*`.

## Commands

From the project root:

```bash
npm install
npm run build
npx vercel link --scope amys-projects-d3dfb125 --project ping-when
npx vercel deploy --prod
```

`npx vercel link` attaches this folder to team `amys-projects-d3dfb125` and project `ping-when`. `npx vercel deploy --prod` ships that linked project. Both commands prompt for a login when no token is present.

With a token already in the environment:

```bash
npx vercel link --scope amys-projects-d3dfb125 --project ping-when --token "$VERCEL_TOKEN"
npx vercel deploy --prod --token "$VERCEL_TOKEN"
```

Confirm the local build before linking:

```bash
npm test
npm run build
```

`npm test` checks the case-study scores and the CSV import. Candidate files stay in the browser (`localStorage`). There is still no API key and no server database.
