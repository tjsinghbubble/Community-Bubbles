import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { getIoniconAsLucide } from "@/lib/ionicon-map";

export type CategoryNode = {
  id: number;
  name: string;
  displayName: string | null;
  icon: string | null;
  parentId: number | null;
  children?: CategoryNode[];
};

export function CategorySidebar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: CategoryNode[];
  selectedId: number | "all";
  onSelect: (category: CategoryNode | "all") => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [, navigate] = useLocation();

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className="hidden w-64 shrink-0 self-stretch bg-[#F5F6F8] px-4 md:block"
      data-testid="sidebar-categories"
    >
      <div className="sticky top-[68px] flex max-h-[calc(100dvh-88px)] flex-col pt-6">
        <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-widest text-black/40">
          Categories
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto pb-2">
          {categories.map((cat) => {
            const isExpanded = expanded.has(cat.id);
            const Icon = getIoniconAsLucide(cat.icon);
            const hasChildren = (cat.children?.length ?? 0) > 0;
            const isSelected = selectedId === cat.id;

            return (
              <div key={cat.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-lg pr-1 transition-colors",
                    isSelected ? "bg-[#35A8F7]/10" : "hover:bg-black/5",
                  )}
                >
                  <button
                    onClick={() => onSelect(cat)}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-2 py-2 text-left text-[13px] font-semibold",
                      isSelected ? "text-[#35A8F7]" : "text-black/75",
                    )}
                    data-testid={`category-${cat.id}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cat.displayName || cat.name}</span>
                  </button>
                  {hasChildren && (
                    <button
                      onClick={() => toggle(cat.id)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-black/40 hover:text-black/70"
                      data-testid={`category-toggle-${cat.id}`}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && (
                  <div className="ml-6 space-y-0.5 border-l border-black/8 pl-2">
                    {cat.children!.map((child) => {
                      const childSelected = selectedId === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => onSelect(child)}
                          className={cn(
                            "block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                            childSelected ? "bg-[#35A8F7]/10 font-semibold text-[#35A8F7]" : "text-black/60 hover:bg-black/5",
                          )}
                          data-testid={`category-${child.id}`}
                        >
                          {child.displayName || child.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 border-t border-black/8 pt-3">
          <button
            onClick={() => navigate("/create")}
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: "#35A8F7" }}
            data-testid="button-sidebar-create"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>
      </div>
    </aside>
  );
}
