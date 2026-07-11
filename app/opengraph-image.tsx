import { ImageResponse } from 'next/server';

export const runtime = 'edge';
export const alt = 'LedgerOne cash disbursement register dashboard preview';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#f8f8f8',
          color: '#21255b',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: 64,
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #f1f2f3',
            borderRadius: 28,
            boxShadow: '0 24px 80px rgba(33, 37, 91, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 34,
            height: '100%',
            justifyContent: 'space-between',
            padding: 56,
            width: '100%',
          }}
        >
          <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
            <div
              style={{
                alignItems: 'center',
                background: '#21255b',
                borderRadius: 14,
                color: '#ffffff',
                display: 'flex',
                fontSize: 34,
                fontWeight: 800,
                height: 64,
                justifyContent: 'center',
                width: 64,
              }}
            >
              L
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>
                LedgerOne
              </div>
              <div
                style={{
                  color: '#21255b',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 3,
                  opacity: 0.72,
                  textTransform: 'uppercase',
                }}
              >
                Cash Disbursement Register
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1,
                maxWidth: 860,
              }}
            >
              School finance records, organized.
            </div>
            <div
              style={{
                color: '#21255b',
                fontSize: 28,
                lineHeight: 1.35,
                maxWidth: 820,
                opacity: 0.78,
              }}
            >
              Manage disbursements, approvals, and reports in one secure portal.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18 }}>
            {['Schools', 'Transactions', 'Reports'].map((label) => (
              <div
                key={label}
                style={{
                  background: '#b8edfd',
                  borderRadius: 999,
                  color: '#21255b',
                  fontSize: 22,
                  fontWeight: 700,
                  padding: '14px 24px',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
