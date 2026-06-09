import sharp from 'sharp'

function makeSvg(size) {
  const r = size * 0.22

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0a0a"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
      <linearGradient id="broGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#818cf8"/>
        <stop offset="50%" stop-color="#a78bfa"/>
        <stop offset="100%" stop-color="#ec4899"/>
      </linearGradient>
      <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#a78bfa"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${size * 0.015}" stdDeviation="${size * 0.025}" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
    </defs>

    <!-- Main gradient background -->
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>

    <!-- AI label -->
    <text
      x="50%" y="39%"
      font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Helvetica, sans-serif"
      font-size="${size * 0.21}px"
      font-weight="400"
      fill="url(#aiGrad)"
      text-anchor="middle"
      dominant-baseline="middle"
      letter-spacing="${size * 0.055}"
    >AI</text>

    <!-- BRO main text -->
    <text
      x="50%" y="67%"
      font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Helvetica, sans-serif"
      font-size="${size * 0.295}px"
      font-weight="800"
      fill="url(#broGrad)"
      text-anchor="middle"
      dominant-baseline="middle"
      letter-spacing="${size * 0.01}"
      filter="url(#shadow)"
    >BRO</text>

  </svg>`
}

await sharp(Buffer.from(makeSvg(192))).png().toFile('public/icon-192x192.png')
await sharp(Buffer.from(makeSvg(512))).png().toFile('public/icon-512x512.png')
await sharp(Buffer.from(makeSvg(180))).png().toFile('public/apple-touch-icon.png')

console.log('Icons generated!')
