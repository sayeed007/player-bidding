/** @type {import('next').NextConfig} */
const nextConfig = {
  // `NEXT_DIST_DIR=.next-build npm run build` builds somewhere else, so a running `npm run dev` is never disturbed.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The live screens poll these every ~1.5s: keep them out of the dev terminal so real problems stay visible.
  logging: {
    incomingRequests: {
      ignore: [/\/api\/t\/[^/]+\/auction\/state/, /\/api\/t\/[^/]+\/notifications/, /\/api\/auth\/me/, /\/api\/t\/[^/]+\/(matches|standings)/],
    },
  },
};
export default nextConfig;
