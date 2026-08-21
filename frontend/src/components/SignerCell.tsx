type SignerCellProps = {
  name?: string | null;
};

const AVATAR_PALETTE = [
  { bg: '#dfece8', fg: '#184b40' },
  { bg: '#e6edc4', fg: '#4b5518' },
  { bg: '#fde6cf', fg: '#8a4513' },
  { bg: '#e3e8fa', fg: '#2a3a82' },
  { bg: '#f7dde6', fg: '#8b2a48' },
  { bg: '#dceee9', fg: '#0f5a4a' },
  { bg: '#f0e7f7', fg: '#5a2a82' },
  { bg: '#e7f0d6', fg: '#3f5a18' }
];

function hashColor(value: string): { bg: string; fg: string } {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  const cleaned = name.replace(/[._\-]+/g, ' ').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function SignerCell({ name }: SignerCellProps) {
  const trimmed = (name || '').trim();
  if (!trimmed) return <span className="signer-missing">—</span>;
  const tone = hashColor(trimmed);
  return (
    <span className="signer-chip" title={trimmed}>
      <span className="signer-avatar" style={{ background: tone.bg, color: tone.fg }}>{initials(trimmed)}</span>
      <span className="signer-name">{trimmed}</span>
    </span>
  );
}
