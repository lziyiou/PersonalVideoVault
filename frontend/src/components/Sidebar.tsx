import { Film, Heart, Tags } from 'lucide-react';
import { tagCategory } from '../utils';
import type { TagInfo } from '../types';

export function Sidebar({
  tagCatalog,
  selectedTag,
  onlyFav,
  onSelectTag,
  onToggleFav,
  totalVideos,
}: {
  tagCatalog: TagInfo[];
  selectedTag: string | null;
  onlyFav: boolean;
  onSelectTag: (tag: string | null) => void;
  onToggleFav: () => void;
  totalVideos: number;
}) {
  const tagGroups = tagCatalog.reduce<Record<string, TagInfo[]>>((groups, tag) => {
    const category = tagCategory(tag.name);
    groups[category] = groups[category] || [];
    groups[category].push(tag);
    return groups;
  }, {});

  return (
    <nav className="sidebar">
      <div className="sidebarSection">
        <div className="sidebarLabel">浏览</div>
        <button
          className={`sidebarItem ${!selectedTag && !onlyFav ? 'active' : ''}`}
          onClick={() => { onSelectTag(null); if (onlyFav) onToggleFav(); }}
        >
          <Film size={16} />
          全部视频
          <span className="itemCount">{totalVideos}</span>
        </button>
        <button
          className={`sidebarItem ${onlyFav ? 'active' : ''}`}
          onClick={() => { if (!onlyFav) onToggleFav(); }}
        >
          <Heart size={16} />
          收藏视频
        </button>
      </div>

      {Object.keys(tagGroups).length > 0 && (
        <>
          <div className="sidebarDivider" />
          <div className="sidebarSection">
            <div className="sidebarLabel">标签分类</div>
            {Object.entries(tagGroups).map(([category, tags]) => (
              <div key={category}>
                {tags.map((tag) => (
                  <button
                    key={tag.name}
                    className={`sidebarItem ${selectedTag === tag.name ? 'active' : ''}`}
                    onClick={() => onSelectTag(selectedTag === tag.name ? null : tag.name)}
                  >
                    <Tags size={14} />
                    {tag.name}
                    <span className="itemCount">{tag.count}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
