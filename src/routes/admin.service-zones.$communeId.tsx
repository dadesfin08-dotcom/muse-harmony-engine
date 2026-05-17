import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createNeighborhood,
  deleteCommune,
  deleteNeighborhood,
  getCommuneById,
  updateCommune,
  updateNeighborhood,
} from "@/lib/locations.functions";
import { useAppLanguage } from "@/hooks/use-localization";
import { localizeText } from "@/lib/localization";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/service-zones/$communeId")({
  component: CommuneProfilePage,
});

function CommuneProfilePage() {
  const { t } = useTranslation();
  const { language, isRtl } = useAppLanguage();
  const { communeId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchCommune = useServerFn(getCommuneById);
  const editCommune = useServerFn(updateCommune);
  const addNeighborhood = useServerFn(createNeighborhood);
  const editNeighborhood = useServerFn(updateNeighborhood);
  const removeNeighborhood = useServerFn(deleteNeighborhood);
  const removeCommune = useServerFn(deleteCommune);

  const communeQuery = useQuery({
    queryKey: ["admin", "service-zones", "commune", communeId],
    queryFn: () => fetchCommune({ data: { communeId } }),
  });

  const commune = communeQuery.data;
  const localizedCommuneName = (value: { nameEn: string; nameFr: string | null; nameAr: string | null; name: string }) => {
    return localizeText(
      language,
      { en: value.nameEn || value.name, fr: value.nameFr, ar: value.nameAr },
      value.name,
    );
  };
  const localizedNeighborhoodName = (neighborhood: { nameEn: string; nameFr: string | null; nameAr: string | null }) => {
    return localizeText(language, {
      en: neighborhood.nameEn,
      fr: neighborhood.nameFr,
      ar: neighborhood.nameAr,
    });
  };

  const sortedNeighborhoods = useMemo(() => {
    return [...(commune?.neighborhoods ?? [])].sort((a, b) =>
      localizedNeighborhoodName(a).localeCompare(localizedNeighborhoodName(b)),
    );
  }, [commune?.neighborhoods, language]);

  const [isEditingCommuneName, setIsEditingCommuneName] = useState(false);
  const [communeNameEnDraft, setCommuneNameEnDraft] = useState("");
  const [communeNameFrDraft, setCommuneNameFrDraft] = useState("");
  const [communeNameArDraft, setCommuneNameArDraft] = useState("");
  const [isSavingCommuneName, setIsSavingCommuneName] = useState(false);

  const [editingNeighborhoodId, setEditingNeighborhoodId] = useState<string | null>(null);
  const [editingNeighborhoodNameEn, setEditingNeighborhoodNameEn] = useState("");
  const [editingNeighborhoodNameFr, setEditingNeighborhoodNameFr] = useState("");
  const [editingNeighborhoodNameAr, setEditingNeighborhoodNameAr] = useState("");
  const [editingNeighborhoodFee, setEditingNeighborhoodFee] = useState("");
  const [isSavingNeighborhood, setIsSavingNeighborhood] = useState(false);
  const [deletingNeighborhoodId, setDeletingNeighborhoodId] = useState<string | null>(null);

  const [newDouarNameEn, setNewDouarNameEn] = useState("");
  const [newDouarNameFr, setNewDouarNameFr] = useState("");
  const [newDouarNameAr, setNewDouarNameAr] = useState("");
  const [newDouarFee, setNewDouarFee] = useState("0");
  const [isAddingDouar, setIsAddingDouar] = useState(false);

  const [isDeleteCommuneDialogOpen, setIsDeleteCommuneDialogOpen] = useState(false);
  const [isDeletingCommune, setIsDeletingCommune] = useState(false);

  const startEditCommuneName = () => {
    if (!commune) return;
    setCommuneNameEnDraft(commune.nameEn || commune.name);
    setCommuneNameFrDraft(commune.nameFr ?? "");
    setCommuneNameArDraft(commune.nameAr ?? "");
    setIsEditingCommuneName(true);
  };

  const saveCommuneName = async () => {
    if (!commune) return;

    const nextNameEn = communeNameEnDraft.trim();
    const nextNameFr = communeNameFrDraft.trim() || null;
    const nextNameAr = communeNameArDraft.trim() || null;

    if (!nextNameEn) {
      toast.error(t("admin.toast.communeNameRequired"));
      return;
    }
    if (
      nextNameEn === (commune.nameEn || commune.name) &&
      nextNameFr === (commune.nameFr ?? null) &&
      nextNameAr === (commune.nameAr ?? null)
    ) {
      setIsEditingCommuneName(false);
      return;
    }

    try {
      setIsSavingCommuneName(true);
      await editCommune({ data: { id: commune.id, nameEn: nextNameEn, nameFr: nextNameFr, nameAr: nextNameAr } });

      queryClient.setQueryData(["admin", "service-zones", "commune", communeId], (current: typeof commune | undefined) =>
        current
          ? {
              ...current,
              name: nextNameEn,
              nameEn: nextNameEn,
              nameFr: nextNameFr,
              nameAr: nextNameAr,
            }
          : current,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });

      toast.success(t("admin.toast.communeNameUpdated"));
      setIsEditingCommuneName(false);
    } catch (error) {
      console.error("Failed to update commune name:", error);
      toast.error(t("admin.toast.communeNameUpdateFailed"));
    } finally {
      setIsSavingCommuneName(false);
    }
  };

  const startEditNeighborhood = (
    id: string,
    currentNameEn: string,
    currentNameFr: string | null,
    currentNameAr: string | null,
    currentFee: number,
  ) => {
    setEditingNeighborhoodId(id);
    setEditingNeighborhoodNameEn(currentNameEn);
    setEditingNeighborhoodNameFr(currentNameFr ?? "");
    setEditingNeighborhoodNameAr(currentNameAr ?? "");
    setEditingNeighborhoodFee(String(currentFee));
  };

  const saveNeighborhood = async () => {
    if (!editingNeighborhoodId) return;

    const nextNameEn = editingNeighborhoodNameEn.trim();
    const nextFee = Number(editingNeighborhoodFee);

    if (!nextNameEn) {
      toast.error(t("admin.toast.douarNameRequired"));
      return;
    }
    if (Number.isNaN(nextFee) || nextFee < 0) {
      toast.error(t("admin.toast.deliveryFeeInvalid"));
      return;
    }

    try {
      setIsSavingNeighborhood(true);
      const updated = await editNeighborhood({
        data: {
          id: editingNeighborhoodId,
          nameEn: nextNameEn,
          nameFr: editingNeighborhoodNameFr.trim() || null,
          nameAr: editingNeighborhoodNameAr.trim() || null,
          deliveryFee: nextFee,
        },
      });

      queryClient.setQueryData(["admin", "service-zones", "commune", communeId], (current: typeof commune | undefined) => {
        if (!current) return current;
        return {
          ...current,
          neighborhoods: current.neighborhoods.map((douar) =>
            douar.id === editingNeighborhoodId
              ? {
                  ...douar,
                  name: updated.name,
                  nameEn: updated.nameEn,
                  nameFr: updated.nameFr,
                  nameAr: updated.nameAr,
                  deliveryFee: Number(updated.deliveryFee ?? 0),
                }
              : douar,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });

      toast.success(t("admin.toast.douarUpdated"));
      setEditingNeighborhoodId(null);
      setEditingNeighborhoodNameEn("");
      setEditingNeighborhoodNameFr("");
      setEditingNeighborhoodNameAr("");
      setEditingNeighborhoodFee("");
    } catch (error) {
      console.error("Failed to update douar:", error);
      toast.error(t("admin.toast.douarUpdateFailed"));
    } finally {
      setIsSavingNeighborhood(false);
    }
  };

  const confirmDeleteNeighborhood = async (neighborhoodId: string) => {
    try {
      setDeletingNeighborhoodId(neighborhoodId);
      await removeNeighborhood({ data: { id: neighborhoodId } });

      queryClient.setQueryData(["admin", "service-zones", "commune", communeId], (current: typeof commune | undefined) => {
        if (!current) return current;
        return {
          ...current,
          neighborhoods: current.neighborhoods.filter((douar) => douar.id !== neighborhoodId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });

      toast.success(t("admin.toast.douarDeleted"));
    } catch (error) {
      console.error("Failed to delete douar:", error);
      toast.error(t("admin.toast.douarDeleteFailed"));
    } finally {
      setDeletingNeighborhoodId(null);
    }
  };

  const handleQuickAddDouar = async () => {
    const nextNameEn = newDouarNameEn.trim();
    const nextFee = Number(newDouarFee);

    if (!nextNameEn) {
      toast.error(t("admin.toast.douarNameRequired"));
      return;
    }
    if (Number.isNaN(nextFee) || nextFee < 0) {
      toast.error(t("admin.toast.deliveryFeeInvalid"));
      return;
    }

    try {
      setIsAddingDouar(true);
      const inserted = await addNeighborhood({
        data: {
          communeId,
          nameEn: nextNameEn,
          nameFr: newDouarNameFr.trim() || null,
          nameAr: newDouarNameAr.trim() || null,
          deliveryFee: nextFee,
        },
      });

      queryClient.setQueryData(["admin", "service-zones", "commune", communeId], (current: typeof commune | undefined) => {
        if (!current) return current;
        return {
          ...current,
          neighborhoods: [...current.neighborhoods, { ...inserted, vendorId: null }],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });

      setNewDouarNameEn("");
      setNewDouarNameFr("");
      setNewDouarNameAr("");
      setNewDouarFee("0");
      toast.success(t("admin.toast.douarAdded"));
    } catch (error) {
      console.error("Failed to add douar:", error);
      toast.error(t("admin.toast.douarAddFailed"));
    } finally {
      setIsAddingDouar(false);
    }
  };

  const handleDeleteCommune = async () => {
    if (!commune) return;

    try {
      setIsDeletingCommune(true);
      await removeCommune({ data: { id: commune.id } });
      queryClient.invalidateQueries({ queryKey: ["admin", "service-zones"] });
      toast.success(t("admin.toast.communeDeletedWithDouars"));
      await navigate({ to: "/admin", search: { tab: "service-zones" } });
    } catch (error) {
      console.error("Failed to delete commune:", error);
      toast.error(t("admin.toast.communeDeleteFailed"));
    } finally {
      setIsDeletingCommune(false);
      setIsDeleteCommuneDialogOpen(false);
    }
  };

  if (communeQuery.isLoading) {
    return (
      <main dir={isRtl ? "rtl" : "ltr"} className={cn("mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6", isRtl && "text-right")}>
        <p className="text-sm text-muted-foreground">{t("admin.serviceZones.communeProfileLoading")}</p>
      </main>
    );
  }

  if (communeQuery.error || !commune) {
    return (
      <main dir={isRtl ? "rtl" : "ltr"} className={cn("mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6", isRtl && "text-right")}>
        <p className="text-sm text-destructive">{t("admin.serviceZones.communeProfileLoadFailed")}</p>
        <Button asChild variant="outline" className="rounded-md">
          <Link to="/admin" search={{ tab: "service-zones" }}>
            {t("admin.serviceZones.backToServiceZones")}
          </Link>
        </Button>
      </main>
    );
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6",
        isRtl &&
          "text-right [&_table]:[direction:rtl] [&_table]:text-right [&_thead]:text-right [&_th]:text-right [&_td]:text-right [&_th:last-child]:text-left [&_td:last-child]:text-left [&_input]:text-right [&_label]:text-right",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline" className="rounded-md">
          <Link to="/admin" search={{ tab: "service-zones" }} className={cn("inline-flex items-center gap-2", isRtl && "flex-row-reverse")}>
            <ArrowLeft className={cn("size-4", isRtl && "rotate-180")} />
            {t("admin.serviceZones.backToServiceZones")}
          </Link>
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {isEditingCommuneName ? (
            <div className="flex w-full flex-col gap-2 md:max-w-md">
              <Input
                value={communeNameEnDraft}
                onChange={(event) => setCommuneNameEnDraft(event.target.value)}
                placeholder={t("admin.serviceZones.placeholders.communeNameEn")}
              />
              <Input
                value={communeNameFrDraft}
                onChange={(event) => setCommuneNameFrDraft(event.target.value)}
                placeholder={t("admin.serviceZones.placeholders.communeNameFr")}
              />
              <Input
                value={communeNameArDraft}
                onChange={(event) => setCommuneNameArDraft(event.target.value)}
                placeholder={t("admin.serviceZones.placeholders.communeNameAr")}
              />
              <div className="flex gap-2">
                <Button className="rounded-md" onClick={saveCommuneName} disabled={isSavingCommuneName}>
                  {isSavingCommuneName ? t("admin.common.saving") : t("admin.serviceZones.saveNames")}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setIsEditingCommuneName(false)}
                  disabled={isSavingCommuneName}
                >
                  {t("admin.common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-foreground">{localizedCommuneName(commune)}</h1>
               <p className="text-sm text-muted-foreground">{t("admin.serviceZones.manageDouarsHint")}</p>
            </div>
          )}

          {!isEditingCommuneName ? (
            <Button variant="outline" className="rounded-md" onClick={startEditCommuneName}>
              <Pencil className="size-4" />
              {t("admin.serviceZones.editName")}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-3">
           <h2 className="text-base font-semibold text-foreground">{t("admin.serviceZones.douarsTitle")}</h2>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                 <th className="px-4 py-2 font-medium">{t("admin.serviceZones.douarName")}</th>
                 <th className="px-4 py-2 font-medium">{t("admin.serviceZones.deliveryFeeMad")}</th>
                 <th className="px-4 py-2 font-medium text-right">{t("admin.common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedNeighborhoods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-muted-foreground">
                     {t("admin.serviceZones.noDouarsForCommune")}
                  </td>
                </tr>
              ) : (
                sortedNeighborhoods.map((douar) => {
                  const isEditing = editingNeighborhoodId === douar.id;
                  return (
                    <tr key={douar.id} className="border-t border-border">
                      <td className="px-4 py-2 align-middle">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              value={editingNeighborhoodNameEn}
                              onChange={(event) => setEditingNeighborhoodNameEn(event.target.value)}
                              className="h-9"
                               placeholder={t("admin.serviceZones.placeholders.nameEn")}
                            />
                            <Input
                              value={editingNeighborhoodNameFr}
                              onChange={(event) => setEditingNeighborhoodNameFr(event.target.value)}
                              className="h-9"
                               placeholder={t("admin.serviceZones.placeholders.nameFr")}
                            />
                            <Input
                              value={editingNeighborhoodNameAr}
                              onChange={(event) => setEditingNeighborhoodNameAr(event.target.value)}
                              className="h-9"
                               placeholder={t("admin.serviceZones.placeholders.nameAr")}
                            />
                          </div>
                        ) : (
                          <span className="text-foreground">{localizedNeighborhoodName(douar)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingNeighborhoodFee}
                            onChange={(event) => setEditingNeighborhoodFee(event.target.value)}
                            className="h-9"
                          />
                        ) : (
                          <span className="text-foreground">{Number(douar.deliveryFee ?? 0).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                className="rounded-md"
                                onClick={saveNeighborhood}
                                disabled={isSavingNeighborhood}
                              >
                                 {isSavingNeighborhood ? t("admin.common.saving") : t("admin.common.save")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md"
                                onClick={() => setEditingNeighborhoodId(null)}
                                disabled={isSavingNeighborhood}
                              >
                                 {t("admin.common.cancel")}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md"
                                onClick={() =>
                                  startEditNeighborhood(
                                    douar.id,
                                    douar.nameEn,
                                    douar.nameFr,
                                    douar.nameAr,
                                    Number(douar.deliveryFee ?? 0),
                                  )
                                }
                              >
                                 {t("admin.common.edit")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md border-destructive/40 text-destructive hover:bg-destructive/10"
                                disabled={deletingNeighborhoodId === douar.id}
                                onClick={() => {
                                   const confirmed = window.confirm(
                                     t("admin.confirm.deleteDouar", { name: localizedNeighborhoodName(douar) }),
                                   );
                                  if (confirmed) {
                                    confirmDeleteNeighborhood(douar.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-4" />
                                 {deletingNeighborhoodId === douar.id ? t("admin.common.deleting") : t("admin.common.delete")}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-md border border-border bg-background p-3">
           <p className="mb-2 text-sm font-medium text-foreground">{t("admin.serviceZones.quickAddDouar")}</p>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={newDouarNameEn}
              onChange={(event) => setNewDouarNameEn(event.target.value)}
               placeholder={t("admin.serviceZones.placeholders.douarNameEn")}
            />
            <Input
              value={newDouarNameFr}
              onChange={(event) => setNewDouarNameFr(event.target.value)}
               placeholder={t("admin.serviceZones.placeholders.douarNameFr")}
            />
            <Input
              value={newDouarNameAr}
              onChange={(event) => setNewDouarNameAr(event.target.value)}
               placeholder={t("admin.serviceZones.placeholders.douarNameAr")}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={newDouarFee}
              onChange={(event) => setNewDouarFee(event.target.value)}
               placeholder={t("admin.serviceZones.placeholders.deliveryFee")}
            />
            <Button className="rounded-md" onClick={handleQuickAddDouar} disabled={isAddingDouar}>
               {isAddingDouar ? t("admin.common.adding") : t("admin.serviceZones.addDouar")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 shadow-sm md:p-5">
         <h2 className="text-base font-semibold text-destructive">{t("admin.serviceZones.dangerZone")}</h2>
        <p className="mt-1 text-sm text-destructive/90">
           {t("admin.serviceZones.deleteCommuneWarning")}
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-md border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => setIsDeleteCommuneDialogOpen(true)}
        >
          <Trash2 className="size-4" />
           {t("admin.serviceZones.deleteEntireCommune")}
        </Button>
      </section>

      <AlertDialog open={isDeleteCommuneDialogOpen} onOpenChange={setIsDeleteCommuneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
             <AlertDialogTitle>{t("admin.serviceZones.deleteCommuneDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
               {t("admin.serviceZones.deleteCommuneDialogDescriptionPrefix")} <strong>{localizedCommuneName(commune)}</strong> {t("admin.serviceZones.deleteCommuneDialogDescriptionSuffix")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
             <AlertDialogCancel disabled={isDeletingCommune}>{t("admin.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingCommune}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteCommune();
              }}
            >
               {isDeletingCommune ? t("admin.common.deleting") : t("admin.serviceZones.confirmDeleteCommune")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}