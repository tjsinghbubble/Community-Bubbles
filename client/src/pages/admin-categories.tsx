import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Category {
  id: number;
  name: string;
  displayName: string | null;
  header: string | null;
  icon: string | null;
  image: string | null;
  parentId: number | null;
  displayOrder: number;
  children?: Category[];
}

interface CategoryFormData {
  displayName: string;
  name: string;
  icon: string;
  displayOrder: number;
  parentId: number | null;
  header: string;
}

const EMPTY_FORM: CategoryFormData = {
  displayName: "",
  name: "",
  icon: "",
  displayOrder: 0,
  parentId: null,
  header: "",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-4">
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/6" data-testid="modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-black/60">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-xl border border-black/12 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none focus:border-[#35A8F7] focus:ring-2 focus:ring-[#35A8F7]/20"
      {...rest}
    />
  );
}

export default function AdminCategories() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user && !meLoading) navigate("/profile");
    if (me && !me.isSuperAdmin) navigate("/profile");
  }, [user, me, meLoading, navigate]);

  if (!user || meLoading || (me && !me.isSuperAdmin)) return null;

  return <CategoriesUI />;
}

function CategoriesUI() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<
    | { type: "create-parent" }
    | { type: "create-child"; parentId: number; parentName: string }
    | { type: "edit"; category: Category; parentName?: string }
    | { type: "delete"; category: Category; hasChildren: boolean }
    | null
  >(null);

  const [form, setForm] = useState<CategoryFormData>(EMPTY_FORM);
  const [autoSlug, setAutoSlug] = useState(true);

  const { data: rawCategories, isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories/flat"],
    queryFn: () => apiRequest("GET", "/api/categories/flat").then((r) => r.json()),
  });

  // Build the tree
  const tree: Category[] = (() => {
    if (!rawCategories) return [];
    const parents = rawCategories
      .filter((c) => c.parentId === null)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return parents.map((p) => ({
      ...p,
      children: rawCategories
        .filter((c) => c.parentId === p.id)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    }));
  })();

  const parentCategories = rawCategories?.filter((c) => c.parentId === null) ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<CategoryFormData>) =>
      apiRequest("POST", "/api/categories", data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/categories"] }); qc.invalidateQueries({ queryKey: ["/api/categories/flat"] }); setModal(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoryFormData> }) =>
      apiRequest("PUT", `/api/categories/${id}`, data).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/categories"] }); qc.invalidateQueries({ queryKey: ["/api/categories/flat"] }); setModal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/categories"] }); qc.invalidateQueries({ queryKey: ["/api/categories/flat"] }); setModal(null); },
  });

  function openCreateParent() {
    setForm({ ...EMPTY_FORM });
    setAutoSlug(true);
    setModal({ type: "create-parent" });
  }

  function openCreateChild(parentId: number, parentName: string) {
    setForm({ ...EMPTY_FORM, parentId });
    setAutoSlug(true);
    setModal({ type: "create-child", parentId, parentName });
  }

  function openEdit(category: Category) {
    const parentName = parentCategories.find((p) => p.id === category.parentId)?.displayName ?? undefined;
    setForm({
      displayName: category.displayName ?? "",
      name: category.name,
      icon: category.icon ?? "",
      displayOrder: category.displayOrder,
      parentId: category.parentId,
      header: category.header ?? "",
    });
    setAutoSlug(false);
    setModal({ type: "edit", category, parentName });
  }

  function openDelete(category: Category) {
    const hasChildren = !!tree.find((p) => p.id === category.id)?.children?.length;
    setModal({ type: "delete", category, hasChildren });
  }

  function handleDisplayNameChange(val: string) {
    setForm((f) => ({
      ...f,
      displayName: val,
      name: autoSlug ? slugify(val) : f.name,
    }));
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      displayName: form.displayName,
      name: form.name || slugify(form.displayName),
      icon: form.icon || undefined,
      displayOrder: form.displayOrder,
      parentId: form.parentId ?? null,
    };
    if (!form.parentId) payload.header = form.header || undefined;

    if (modal?.type === "edit") {
      updateMutation.mutate({ id: modal.category.id, data: payload as Partial<CategoryFormData> });
    } else {
      createMutation.mutate(payload as Partial<CategoryFormData>);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error?.message || updateMutation.error?.message;

  const isEdit = modal?.type === "edit";
  const modalTitle =
    modal?.type === "create-parent" ? "New Parent Category"
    : modal?.type === "create-child" ? `New Subcategory under "${modal.parentName}"`
    : modal?.type === "edit" ? `Edit "${modal.category.displayName ?? modal.category.name}"`
    : "";

  function toggle(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <AppShell active="profile">
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 md:pb-8">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => navigate("/profile")}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/6 text-muted-foreground transition hover:bg-black/10"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-[22px] font-bold tracking-tight">Manage Categories</h1>
            <p className="text-[12px] text-muted-foreground">
              {rawCategories ? `${tree.length} parent categories · ${rawCategories.filter((c) => c.parentId !== null).length} subcategories` : "Loading…"}
            </p>
          </div>
          <button
            onClick={openCreateParent}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-white"
            style={{ background: "#35A8F7" }}
            data-testid="button-add-parent"
          >
            <Plus className="h-3.5 w-3.5" />
            Parent
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#35A8F7]" />
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 py-16 text-center ring-1 ring-black/8">
            <FolderOpen className="h-8 w-8 text-black/20" />
            <p className="text-[13px] text-muted-foreground">No categories yet</p>
            <button
              onClick={openCreateParent}
              className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
              style={{ background: "#35A8F7" }}
            >
              Add first category
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tree.map((parent) => {
              const isOpen = expandedIds.has(parent.id);
              return (
                <div key={parent.id} className="overflow-hidden rounded-2xl bg-white/70 ring-1 ring-black/8">
                  {/* Parent row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggle(parent.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/6 transition"
                      data-testid={`toggle-${parent.id}`}
                    >
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-black/40" />
                        : <ChevronRight className="h-4 w-4 text-black/40" />
                      }
                    </button>
                    <FolderOpen className="h-4 w-4 shrink-0 text-[#35A8F7]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-semibold">{parent.displayName ?? parent.name}</span>
                      {parent.header && (
                        <span className="ml-2 text-[11px] text-muted-foreground">"{parent.header}"</span>
                      )}
                      <span className="ml-2 rounded-full bg-black/6 px-2 py-0.5 text-[10px] font-medium text-black/50">
                        {parent.children?.length ?? 0} sub
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openCreateChild(parent.id, parent.displayName ?? parent.name)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#35A8F7] transition hover:bg-[#35A8F7]/10"
                        title="Add subcategory"
                        data-testid={`add-child-${parent.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(parent)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-black/40 transition hover:bg-black/6 hover:text-black"
                        title="Edit"
                        data-testid={`edit-${parent.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openDelete(parent)}
                        className="grid h-8 w-8 place-items-center rounded-lg text-black/30 transition hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                        data-testid={`delete-${parent.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  {isOpen && (
                    <div className="border-t border-black/5">
                      {(parent.children ?? []).length === 0 ? (
                        <div className="px-10 py-3 text-[12px] text-muted-foreground">
                          No subcategories yet.{" "}
                          <button
                            onClick={() => openCreateChild(parent.id, parent.displayName ?? parent.name)}
                            className="font-semibold text-[#35A8F7] hover:underline"
                          >
                            Add one
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-black/5">
                          {(parent.children ?? []).map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-3 py-2.5 pl-10 pr-4"
                              data-testid={`child-row-${child.id}`}
                            >
                              <Tag className="h-3.5 w-3.5 shrink-0 text-black/30" />
                              <span className="flex-1 text-[13px]">{child.displayName ?? child.name}</span>
                              {child.icon && (
                                <span className="text-[11px] text-muted-foreground font-mono">{child.icon}</span>
                              )}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEdit(child)}
                                  className="grid h-7 w-7 place-items-center rounded-lg text-black/40 transition hover:bg-black/6 hover:text-black"
                                  data-testid={`edit-${child.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => openDelete(child)}
                                  className="grid h-7 w-7 place-items-center rounded-lg text-black/30 transition hover:bg-red-50 hover:text-red-500"
                                  data-testid={`delete-${child.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {(modal?.type === "create-parent" || modal?.type === "create-child" || modal?.type === "edit") && (
        <Modal title={modalTitle} onClose={() => setModal(null)}>
          <div className="flex flex-col gap-4">
            <Field label="Display Name *" hint="Shown to users in the app">
              <Input
                value={form.displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="e.g., Coffee Meetups"
                data-testid="input-display-name"
              />
            </Field>

            <Field label="Slug (auto-generated)" hint="Internal identifier — lowercase with underscores">
              <Input
                value={form.name}
                onChange={(e) => { setAutoSlug(false); setForm((f) => ({ ...f, name: e.target.value })); }}
                placeholder="e.g., coffee_meetups"
                data-testid="input-name"
              />
            </Field>

            {/* Show "header" field only for parent categories */}
            {form.parentId === null && (
              <Field label="Section Header" hint="Short heading shown above the group (e.g., 'Eat & Meet')">
                <Input
                  value={form.header}
                  onChange={(e) => setForm((f) => ({ ...f, header: e.target.value }))}
                  placeholder="e.g., Eat & Meet"
                  data-testid="input-header"
                />
              </Field>
            )}

            {/* For existing subcategories: allow changing parent */}
            {isEdit && (
              <Field label="Parent Category" hint="Set to 'None' to make this a top-level category">
                <select
                  value={form.parentId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value === "" ? null : Number(e.target.value) }))}
                  className="w-full rounded-xl border border-black/12 bg-[#FAFAFA] px-3 py-2.5 text-[13px] outline-none focus:border-[#35A8F7] focus:ring-2 focus:ring-[#35A8F7]/20"
                  data-testid="select-parent"
                >
                  <option value="">— None (top-level) —</option>
                  {parentCategories
                    .filter((p) => p.id !== (modal as { category: Category }).category.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.displayName ?? p.name}</option>
                    ))}
                </select>
              </Field>
            )}

            <Field label="Icon" hint="Ionicons name (e.g., cafe, barbell, leaf)">
              <Input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="e.g., cafe"
                data-testid="input-icon"
              />
            </Field>

            <Field label="Display Order" hint="Lower numbers appear first">
              <Input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                data-testid="input-order"
              />
            </Field>

            {saveError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600" data-testid="save-error">
                {saveError}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-xl border border-black/12 py-2.5 text-[13px] font-semibold text-black/60 transition hover:bg-black/4"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.displayName.trim() || isSaving}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white transition",
                  (!form.displayName.trim() || isSaving) ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"
                )}
                style={{ background: "#35A8F7" }}
                data-testid="button-save"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {modal?.type === "delete" && (
        <Modal
          title={`Delete "${modal.category.displayName ?? modal.category.name}"?`}
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-4">
            {modal.hasChildren ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                This parent category has subcategories. Deleting it will also remove all its subcategories and may affect bubbles that use them.
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                This action cannot be undone. Bubbles that reference this category will lose their category assignment.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-xl border border-black/12 py-2.5 text-[13px] font-semibold text-black/60 transition hover:bg-black/4"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(modal.category.id)}
                disabled={deleteMutation.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
