import type { MockFrame } from './types'

export const MOCK_FRAMES: MockFrame[] = [
  { index: 0, src: '/mock-frames/page-1.jpg', objectPosition: '50% 8%', scale: 1.15, hint: 'Pan slowly. Pause on each section.', page: 1 },
  { index: 1, src: '/mock-frames/page-1.jpg', objectPosition: '50% 38%', scale: 1.2, hint: 'Hold still — filling in prices.', page: 1 },
  { index: 2, src: '/mock-frames/page-1.jpg', objectPosition: '50% 78%', scale: 1.18, hint: 'Flip the page when this side looks complete.', page: 1 },
  { index: 3, src: '/mock-frames/page-2.jpg', objectPosition: '50% 22%', scale: 1.16, hint: 'New page detected.', page: 2 },
  { index: 4, src: '/mock-frames/page-2.jpg', objectPosition: '50% 72%', scale: 1.18, hint: 'Drinks at the bottom. Tap Done when ready.', page: 2 },
]
