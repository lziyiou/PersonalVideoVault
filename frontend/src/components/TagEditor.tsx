import { useState } from 'react';
import { Plus } from 'lucide-react';
import { normalizeTags } from '../utils';
import type { TagInfo } from '../types';
import { TagChip } from './TagChip';

export function TagEditor({
  value,
  catalog,
  onChange,
}: {
  value: string[];
  catalog: TagInfo[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const available = catalog.filter((tag) => !value.includes(tag.name)).slice(0, 16);

  function addTag(tag: string) {
    const clean = tag.trim();
    if (!clean) return;
    onChange(normalizeTags([...value, clean]));
    setDraft('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tagEditor">
      <div className="tagInputBox">
        {value.map((tag) => (
          <TagChip key={tag} tag={tag} onRemove={() => onChange(value.filter((item) => item !== tag))} />
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '继续添加标签' : '输入标签后按回车'}
        />
        <button type="button" onClick={() => addTag(draft)} title="添加标签"><Plus size={16} /></button>
      </div>
      {available.length > 0 && (
        <div className="tagSuggestions">
          {available.map((tag) => (
            <button key={tag.name} type="button" onClick={() => addTag(tag.name)}>
              {tag.name}<span>{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
