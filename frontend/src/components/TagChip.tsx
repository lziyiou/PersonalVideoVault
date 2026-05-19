import { Tags, X } from 'lucide-react';

export function TagChip({
  tag,
  active,
  count,
  onClick,
  onRemove,
}: {
  tag: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span className={`tagChip ${active ? 'active' : ''}`}>
      <button type="button" onClick={onClick} title={onClick ? `筛选 ${tag}` : tag}>
        <Tags size={13} />
        <span>{tag}</span>
        {typeof count === 'number' && <em>{count}</em>}
      </button>
      {onRemove && (
        <button className="tagRemove" type="button" onClick={onRemove} title={`移除 ${tag}`}>
          <X size={13} />
        </button>
      )}
    </span>
  );
}
