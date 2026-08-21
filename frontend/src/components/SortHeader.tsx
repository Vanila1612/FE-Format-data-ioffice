import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

type SortHeaderProps = {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right' | 'center';
};

export function SortHeader({ label, active, dir, onClick, align = 'left' }: SortHeaderProps) {
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      className={`sort-header align-${align}${active ? ' active' : ''}`}
      onClick={onClick}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={active ? (dir === 'asc' ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần') : 'Nhấn để sắp xếp'}
    >
      <span className="sort-label">{label}</span>
      <Icon size={12} className="sort-icon" aria-hidden="true" />
    </button>
  );
}
