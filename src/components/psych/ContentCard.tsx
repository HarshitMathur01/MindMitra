import { memo } from "react";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, Star } from "lucide-react";
import {
  type ContentItem,
  categoryLabel,
  formatCount,
  formatTypeLabel,
  typeIconMap,
} from "@/data/psychologicalContent";

interface Props {
  item: ContentItem;
  bookmarked: boolean;
  onOpen: (item: ContentItem) => void;
  onToggleBookmark: (id: string, e: React.MouseEvent) => void;
}

function ContentCardImpl({ item, bookmarked, onOpen, onToggleBookmark }: Props) {
  const TypeIcon = typeIconMap[item.type];
  const tags = item.tags.slice(0, 2);
  const extra = item.tags.length - tags.length;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card text-left",
        "shadow-soft transition-all duration-200",
        "hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/10 to-transparent" />
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/85 text-lg shadow-soft backdrop-blur-sm" aria-hidden>
          {item.imageEmoji}
        </span>
        <button
          type="button"
          onClick={(e) => onToggleBookmark(item.id, e)}
          aria-label={bookmarked ? "Remove from saved" : "Save for later"}
          className={cn(
            "absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/85 backdrop-blur-sm transition-colors",
            "hover:bg-card",
            bookmarked ? "text-accent" : "text-muted-foreground",
          )}
        >
          {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <span>{categoryLabel(item.category)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <TypeIcon className="h-3 w-3" />
            {formatTypeLabel(item.type)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight text-foreground">
          {item.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground/70"
            >
              {tag.replace(/-/g, " ")}
            </span>
          ))}
          {extra > 0 ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              +{extra}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-accent text-accent" />
          <span className="font-medium text-foreground/80">{item.rating.toFixed(1)}</span>
          <span aria-hidden>·</span>
          <span>{formatCount(item.readCount)} reads</span>
          <span aria-hidden>·</span>
          <span>{item.duration}</span>
        </div>
      </div>
      </div>
    </article>
  );
}

export const ContentCard = memo(ContentCardImpl);
export default ContentCard;