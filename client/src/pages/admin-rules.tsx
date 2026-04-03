import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

type RuleItem = {
  id: number;
  ruleId?: number;
  name: string;
  description?: string;
  position: number;
};

type Category = {
  id: number;
  name: string;
  displayName: string;
  parentId: number | null;
  children?: Category[];
};

function parseRule(r: any): RuleItem {
  const rName = r.rule?.name || r.name || "";
  const rDesc = r.rule?.description || r.description || "";
  const rText = r.rule?.text || r.text || "";
  if (rName) return { id: r.id, ruleId: r.ruleId, name: rName, description: rDesc, position: r.position ?? 0 };
  const dotIdx = rText.indexOf(". ");
  if (dotIdx > 0)
    return {
      id: r.id,
      ruleId: r.ruleId,
      name: rText.substring(0, dotIdx),
      description: rText.substring(dotIdx + 2),
      position: r.position ?? 0,
    };
  return { id: r.id, ruleId: r.ruleId, name: rText, description: "", position: r.position ?? 0 };
}

function RuleModal({
  title,
  initial,
  onSave,
  onClose,
  loading,
}: {
  title: string;
  initial?: { name: string; description: string };
  onSave: (name: string, description: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-black/6 text-muted-foreground hover:bg-black/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Rule Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Be Respectful"
              className="w-full rounded-xl border border-black/10 bg-black/4 px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#35A8F7]/40"
              data-testid="input-rule-name"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional detail…"
              rows={3}
              className="w-full rounded-xl border border-black/10 bg-black/4 px-4 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#35A8F7]/40"
              data-testid="input-rule-description"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-black/10 py-3 text-[13px] font-semibold text-muted-foreground transition hover:bg-black/5"
            data-testid="button-rule-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name.trim(), description.trim())}
            disabled={!name.trim() || loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold text-white transition disabled:opacity-60"
            style={{ background: "#35A8F7" }}
            data-testid="button-rule-save"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  deleting,
}: {
  rule: RuleItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-black/8" data-testid={`card-rule-${rule.id}`}>
      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-black/20" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold">{rule.name}</div>
        {rule.description && (
          <div className="mt-0.5 text-[12px] text-muted-foreground">{rule.description}</div>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center rounded-xl bg-[#35A8F7]/10 text-[#35A8F7] transition hover:bg-[#35A8F7]/20"
          data-testid={`button-edit-rule-${rule.id}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="grid h-8 w-8 place-items-center rounded-xl bg-red-100 text-red-500 transition hover:bg-red-200 disabled:opacity-60"
          data-testid={`button-delete-rule-${rule.id}`}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function AppRulesTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<RuleItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: raw = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/rules/app"],
    queryFn: () => apiRequest("GET", "/api/rules/app").then((r) => r.json()),
  });

  const rules: RuleItem[] = raw.map(parseRule).sort((a, b) => a.position - b.position);

  const addMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      apiRequest("POST", "/api/rules/app", { name, description, position: rules.length + 1 }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/app"] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description: string }) =>
      apiRequest("PUT", `/api/rules/app/${id}`, { name, description }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/app"] });
      setEditRule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/rules/app/${id}`).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/app"] });
      setDeletingId(null);
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
      </div>
    );

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {rules.length} global rule{rules.length !== 1 ? "s" : ""} applied to every bubble
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition"
          style={{ background: "#35A8F7" }}
          data-testid="button-add-app-rule"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-muted-foreground">No app-level rules yet.</div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => setEditRule(rule)}
              onDelete={() => {
                setDeletingId(rule.id);
                deleteMutation.mutate(rule.id);
              }}
              deleting={deletingId === rule.id && deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <RuleModal
          title="Add App Rule"
          loading={addMutation.isPending}
          onClose={() => setShowAdd(false)}
          onSave={(name, description) => addMutation.mutate({ name, description })}
        />
      )}
      {editRule && (
        <RuleModal
          title="Edit Rule"
          initial={{ name: editRule.name, description: editRule.description || "" }}
          loading={editMutation.isPending}
          onClose={() => setEditRule(null)}
          onSave={(name, description) => editMutation.mutate({ id: editRule.id, name, description })}
        />
      )}
    </>
  );
}

function CategoryRulesTab() {
  const qc = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editRule, setEditRule] = useState<RuleItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: categoriesRaw = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
  });

  const subcategories = categoriesRaw.flatMap((c) => c.children || []);

  useEffect(() => {
    if (subcategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(subcategories[0].id);
    }
  }, [subcategories.length]);

  const { data: rawRules = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/rules/category", selectedCategoryId],
    queryFn: () =>
      apiRequest("GET", `/api/rules/category/${selectedCategoryId}`).then((r) => r.json()),
    enabled: !!selectedCategoryId,
  });

  const rules: RuleItem[] = rawRules.map(parseRule).sort((a, b) => a.position - b.position);

  const addMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      apiRequest("POST", `/api/rules/category/${selectedCategoryId}`, {
        name,
        description,
        position: rules.length + 1,
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/category", selectedCategoryId] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description: string }) =>
      apiRequest("PUT", `/api/rules/category/${selectedCategoryId}/${id}`, { name, description }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/category", selectedCategoryId] });
      setEditRule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/rules/category/${selectedCategoryId}/${id}`).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rules/category", selectedCategoryId] });
      setDeletingId(null);
    },
  });

  return (
    <>
      <div className="mb-4">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Select Category
        </label>
        <select
          value={selectedCategoryId ?? ""}
          onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[13px] font-semibold outline-none focus:ring-2 focus:ring-[#35A8F7]/40"
          data-testid="select-category"
        >
          {categoriesRaw.map((parent) =>
            (parent.children || []).map((child) => (
              <option key={child.id} value={child.id}>
                {parent.displayName} › {child.displayName}
              </option>
            ))
          )}
        </select>
      </div>

      {selectedCategoryId && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] text-muted-foreground">
              {rules.length} rule{rules.length !== 1 ? "s" : ""} for this category
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white transition"
              style={{ background: "#35A8F7" }}
              data-testid="button-add-category-rule"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#35A8F7]" />
            </div>
          ) : rules.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">
              No rules for this category yet.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => setEditRule(rule)}
                  onDelete={() => {
                    setDeletingId(rule.id);
                    deleteMutation.mutate(rule.id);
                  }}
                  deleting={deletingId === rule.id && deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <RuleModal
          title="Add Category Rule"
          loading={addMutation.isPending}
          onClose={() => setShowAdd(false)}
          onSave={(name, description) => addMutation.mutate({ name, description })}
        />
      )}
      {editRule && (
        <RuleModal
          title="Edit Rule"
          initial={{ name: editRule.name, description: editRule.description || "" }}
          loading={editMutation.isPending}
          onClose={() => setEditRule(null)}
          onSave={(name, description) => editMutation.mutate({ id: editRule.id, name, description })}
        />
      )}
    </>
  );
}

export default function AdminRules() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"app" | "category">("app");

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  if (me && !me.isSuperAdmin) {
    navigate("/profile");
    return null;
  }

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-tight">Manage Rules</h1>
            <p className="text-[12px] text-muted-foreground">Global and category-level rules</p>
          </div>
        </div>

        <div className="mb-5 flex gap-1 rounded-2xl bg-black/6 p-1">
          {(["app", "category"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-xl py-2 text-[13px] font-semibold transition",
                tab === t
                  ? "bg-white shadow-sm text-[#35A8F7]"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${t}`}
            >
              {t === "app" ? "App-wide" : "By Category"}
            </button>
          ))}
        </div>

        {tab === "app" ? <AppRulesTab /> : <CategoryRulesTab />}
      </div>
    </AppShell>
  );
}
