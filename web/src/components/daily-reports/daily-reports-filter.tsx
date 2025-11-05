"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Option = {
  value: string;
  label: string;
};

interface DailyReportsFilterProps {
  users: Option[];
  channels: Option[];
  tags: string[];
  selected: {
    user?: string;
    channel?: string;
    keyword?: string;
    tags?: string[];
  };
}

type FilterPatch = {
  user?: string | null;
  channel?: string | null;
  keyword?: string | null;
  tags?: string[] | null;
};

export const DailyReportsFilter = ({
  users,
  channels,
  tags,
  selected,
}: DailyReportsFilterProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const keywordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (keywordInputRef.current) {
      keywordInputRef.current.value = selected.keyword ?? "";
    }
  }, [selected.keyword]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => a.label.localeCompare(b.label, "ja")),
    [users],
  );

  const sortedChannels = useMemo(
    () =>
      [...channels].sort((a, b) => a.label.localeCompare(b.label, "ja")),
    [channels],
  );

  const sortedTags = useMemo(
    () =>
      [...tags].sort((a, b) => a.localeCompare(b, "ja")),
    [tags],
  );

  const updateQuery = useCallback(
    (patch: FilterPatch) => {
      const params = new URLSearchParams(searchParams.toString());

      if ("user" in patch) {
        const value = patch.user;
        if (value) {
          params.set("user", value);
        } else {
          params.delete("user");
        }
      }

      if ("channel" in patch) {
        const value = patch.channel;
        if (value) {
          params.set("channel", value);
        } else {
          params.delete("channel");
        }
      }

      if ("keyword" in patch) {
        const value = patch.keyword;
        if (value) {
          params.set("q", value);
        } else {
          params.delete("q");
        }
      }

      if ("tags" in patch) {
        const value = patch.tags ?? [];
        if (value.length > 0) {
          params.set("tags", value.join(","));
        } else {
          params.delete("tags");
        }
      }

      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  const handleKeywordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawValue = keywordInputRef.current?.value ?? "";
    updateQuery({ keyword: rawValue.trim() || null });
  };

  const toggleTag = (tag: string) => {
    const activeTags = selected.tags ?? [];
    const nextTags = activeTags.includes(tag)
      ? activeTags.filter((item) => item !== tag)
      : [...activeTags, tag];
    updateQuery({ tags: nextTags });
  };

  const resetFilters = () => {
    updateQuery({
      user: null,
      channel: null,
      keyword: null,
      tags: [],
    });
  };

  const tagButtonClass = (tag: string) => {
    const isActive = selected.tags?.includes(tag);
    return [
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
      isActive
        ? "border-[#c89b6d] bg-[#c89b6d]/10 text-[#ad7a46]"
        : "border-[#ead8c4] bg-white text-[#7f6b5a] hover:border-[#c89b6d] hover:text-[#ad7a46]",
      isPending ? "pointer-events-none opacity-70" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">ユーザー</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.user ?? ""}
            onChange={(event) =>
              updateQuery({ user: event.target.value || null })
            }
            disabled={isPending || sortedUsers.length === 0}
          >
            <option value="">すべて</option>
            {sortedUsers.map((user) => (
              <option key={user.value} value={user.value}>
                {user.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#ad7a46]">チャンネル</span>
          <select
            className="rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
            value={selected.channel ?? ""}
            onChange={(event) =>
              updateQuery({ channel: event.target.value || null })
            }
            disabled={isPending || sortedChannels.length === 0}
          >
            <option value="">すべて</option>
            {sortedChannels.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </select>
        </div>

        <form
          className="flex flex-col gap-1 text-sm"
          onSubmit={handleKeywordSubmit}
        >
          <span className="text-xs font-medium text-[#ad7a46]">キーワード</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-lg border border-[#ead8c4] bg-white px-3 py-2 text-sm text-[#3d3128] transition placeholder:text-[#b59b85] focus:border-[#c89b6d] focus:outline-none focus:ring-2 focus:ring-[#f1e6d8]"
              placeholder="テキスト・タグ・Doneなど"
              defaultValue={selected.keyword ?? ""}
              ref={keywordInputRef}
              disabled={isPending}
            />
            <Button
              type="submit"
              variant="secondary"
              className="px-3 py-2 text-xs"
              disabled={isPending}
            >
              適用
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#ad7a46]">タグ</span>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs text-[#ad7a46] hover:bg-[#f1e6d8]"
              onClick={resetFilters}
              disabled={isPending}
            >
              クリア
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedTags.length === 0 ? (
              <span className="text-xs text-[#b59b85]">タグがありません</span>
            ) : (
              sortedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={tagButtonClass(tag)}
                  onClick={() => toggleTag(tag)}
                  disabled={isPending}
                >
                  #{tag}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
