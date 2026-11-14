// Lets phones "Add to Home screen" with the BidArena icon and a standalone (no browser bar) window.
export default function manifest() {
  return {
    name: 'BidArena',
    short_name: 'BidArena',
    description: 'Live player auctions, fixtures, standings and stats.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060814',
    theme_color: '#060814',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
