import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ember - Your AI Integrator'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Ember logo/mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 30,
              background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="80"
              height="80"
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
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#f8fafc',
            marginBottom: 16,
          }}
        >
          Ember
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: '#94a3b8',
          }}
        >
          Your AI Integrator
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 20,
            color: '#64748b',
          }}
        >
          by Caldera
        </div>
      </div>
    ),
    { ...size }
  )
}
