import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
          borderRadius: 40,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Flame with upward momentum */}
          <path
            d="M16 2C16 2 6 10 6 18C6 24 10 28 16 30C16 30 12 24 12 20C12 16 14 12 16 10C18 12 20 16 20 20C20 24 16 30 16 30C22 28 26 24 26 18C26 10 16 2 16 2Z"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size }
  )
}
