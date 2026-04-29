"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";

import { api } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r === "super_admin") return "Süper Admin";
  if (r === "admin") return "Admin";
  if (r === "support") return "Destek";
  return role || "—";
}

function roleBadgeClass(role) {
  const r = String(role || "").toLowerCase();
  if (r === "super_admin") return "bg-violet-600/20 text-violet-200 ring-violet-500/30";
  if (r === "admin") return "bg-sky-600/20 text-sky-200 ring-sky-500/30";
  return "bg-emerald-600/20 text-emerald-200 ring-emerald-500/30";
}

/** Silinemez: Admin ve Süper Admin */
function isProtectedRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

function formatDt(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function UsersManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "support",
  });

  const authUser = useMemo(() => getAuthUser(), []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listUsers();
      setRows(res?.data || []);
    } catch (e) {
      setError(e.message || "Liste alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function onCreateUser(e) {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const password = form.password;
    if (!email || password.length < 8) {
      setError("Geçerli e-posta ve en az 8 karakter şifre girin.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await api.createUser({
        email,
        password,
        role: form.role === "admin" ? "ADMIN" : "SUPPORT",
      });
      setSheetOpen(false);
      setForm({ email: "", password: "", role: "support" });
      await loadUsers();
    } catch (err) {
      setError(err.message || "Kullanıcı oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function onRoleChange(userId, nextLowerRole) {
    setRoleUpdatingId(userId);
    setError("");
    try {
      await api.updateUserRole(userId, {
        role: nextLowerRole === "admin" ? "admin" : "support",
      });
      await loadUsers();
    } catch (e) {
      setError(e.message || "Rol güncellenemedi");
    } finally {
      setRoleUpdatingId(null);
    }
  }

  async function onDelete(user) {
    if (isProtectedRole(user.role)) return;
    const ok = window.confirm(
      `${user.email} kullanıcısını kalıcı olarak silmek istediğinize emin misiniz?`,
    );
    if (!ok) return;
    setDeletingId(user.id);
    setError("");
    try {
      await api.deleteUser(user.id);
      await loadUsers();
    } catch (e) {
      setError(e.message || "Silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Kullanıcılar
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Operatör ve destek hesaplarını yönetin.
          </p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={<Button type="button" className="gap-2 shadow-sm" />}
          >
            <UserPlus className="size-4" />
            Yeni kullanıcı
          </SheetTrigger>
          <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
            <SheetHeader className="border-b border-border px-6 pb-4 pt-2">
              <SheetTitle>Yeni kullanıcı</SheetTitle>
              <SheetDescription>
                E-posta ile giriş yapılacak hesap oluşturun. Şifre en az 8 karakter
                olmalıdır.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={onCreateUser} className="flex flex-1 flex-col">
              <div className="flex flex-col gap-4 px-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="nu-email">E-posta</Label>
                  <Input
                    id="nu-email"
                    type="email"
                    autoComplete="email"
                    placeholder="isim@sirket.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nu-password">Şifre</Label>
                  <Input
                    id="nu-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nu-role">Rol</Label>
                  <select
                    id="nu-role"
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="support">Destek (Support)</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Süper admin hesapları yalnızca sistem komutları ile oluşturulabilir.
                  </p>
                </div>
              </div>
              <SheetFooter className="border-t border-border px-6 py-4">
                <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                  {creating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Oluşturuluyor
                    </>
                  ) : (
                    "Hesap oluştur"
                  )}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <Separator />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  E-posta
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  Rol
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  Durum
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  Kayıt
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  Son giriş
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-8 w-full max-w-md" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-12 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    Henüz kullanıcı yok.
                  </td>
                </tr>
              ) : (
                rows.map((u, idx) => {
                  const protectedRole = isProtectedRole(u.role);
                  const isSelf = authUser?.id && u.id === authUser.id;
                  const canDelete = !protectedRole && !isSelf;
                  let deleteReason = "";
                  if (protectedRole) deleteReason = "Admin rolleri silinemez";
                  else if (isSelf) deleteReason = "Kendi hesabınızı buradan silemezsiniz";

                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-b border-border/60 transition-colors hover:bg-muted/20",
                        idx % 2 === 1 && "bg-muted/5",
                      )}
                    >
                      <td className="max-w-[240px] truncate px-4 py-3 font-medium text-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        {protectedRole ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                              roleBadgeClass(u.role),
                            )}
                          >
                            {roleLabel(u.role)}
                          </span>
                        ) : (
                          <select
                            disabled={roleUpdatingId === u.id}
                            value={
                              String(u.role).toLowerCase() === "admin"
                                ? "admin"
                                : "support"
                            }
                            onChange={(e) => onRoleChange(u.id, e.target.value)}
                            className="h-9 max-w-[160px] rounded-md border border-input bg-background px-2 text-xs outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <option value="support">Destek</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            u.isActive
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
                          )}
                        >
                          {u.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDt(u.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDt(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            disabled={deletingId === u.id}
                            onClick={() => onDelete(u)}
                            aria-label="Sil"
                          >
                            {deletingId === u.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                          </Button>
                        ) : (
                          <span title={deleteReason} className="inline-flex cursor-not-allowed">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled
                              className="pointer-events-none opacity-40"
                              aria-label={deleteReason}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
