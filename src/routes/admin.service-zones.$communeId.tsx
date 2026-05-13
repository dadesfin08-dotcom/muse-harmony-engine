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

export const Route = createFileRoute("/admin/service-zones/$communeId")({
  component: CommuneProfilePage,
});

function CommuneProfilePage() {
  const { i18n } = useTranslation();
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
    const lang = i18n.resolvedLanguage || i18n.language || "en";
    if (lang === "ar") return value.nameAr?.trim() || value.nameFr?.trim() || value.nameEn || value.name;
    if (lang === "fr") return value.nameFr?.trim() || value.nameEn || value.name;
    return value.nameEn || value.name;
  };
  const localizedNeighborhoodName = (neighborhood: { nameEn: string; nameFr: string | null; nameAr: string | null }) => {
    const lang = i18n.resolvedLanguage || i18n.language || "en";
    if (lang === "ar") return neighborhood.nameAr?.trim() || neighborhood.nameFr?.trim() || neighborhood.nameEn;
    if (lang === "fr") return neighborhood.nameFr?.trim() || neighborhood.nameEn;
    return neighborhood.nameEn;
  };

  const sortedNeighborhoods = useMemo(() => {
    return [...(commune?.neighborhoods ?? [])].sort((a, b) =>
      localizedNeighborhoodName(a).localeCompare(localizedNeighborhoodName(b)),
    );
  }, [commune?.neighborhoods, i18n.language, i18n.resolvedLanguage]);

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
      toast.error("Commune name (EN) is required.");
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

      toast.success("Commune name updated.");
      setIsEditingCommuneName(false);
    } catch (error) {
      console.error("Failed to update commune name:", error);
      toast.error("Failed to update commune name.");
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
      toast.error("Douar name (EN) is required.");
      return;
    }
    if (Number.isNaN(nextFee) || nextFee < 0) {
      toast.error("Delivery fee must be a valid non-negative number.");
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

      toast.success("Douar updated.");
      setEditingNeighborhoodId(null);
      setEditingNeighborhoodNameEn("");
      setEditingNeighborhoodNameFr("");
      setEditingNeighborhoodNameAr("");
      setEditingNeighborhoodFee("");
    } catch (error) {
      console.error("Failed to update douar:", error);
      toast.error("Failed to update douar.");
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

      toast.success("Douar deleted.");
    } catch (error) {
      console.error("Failed to delete douar:", error);
      toast.error("Failed to delete douar.");
    } finally {
      setDeletingNeighborhoodId(null);
    }
  };

  const handleQuickAddDouar = async () => {
    const nextNameEn = newDouarNameEn.trim();
    const nextFee = Number(newDouarFee);

    if (!nextNameEn) {
      toast.error("Douar name (EN) is required.");
      return;
    }
    if (Number.isNaN(nextFee) || nextFee < 0) {
      toast.error("Delivery fee must be a valid non-negative number.");
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
      toast.success("Douar added.");
    } catch (error) {
      console.error("Failed to add douar:", error);
      toast.error("Failed to add douar.");
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
      toast.success("Commune and all associated douars deleted.");
      await navigate({ to: "/admin", search: { tab: "service-zones" } });
    } catch (error) {
      console.error("Failed to delete commune:", error);
      toast.error("Failed to delete commune.");
    } finally {
      setIsDeletingCommune(false);
      setIsDeleteCommuneDialogOpen(false);
    }
  };

  if (communeQuery.isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Loading commune profile...</p>
      </main>
    );
  }

  if (communeQuery.error || !commune) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <p className="text-sm text-destructive">Unable to load this commune.</p>
        <Button asChild variant="outline" className="rounded-md">
          <Link to="/admin" search={{ tab: "service-zones" }}>
            Back to Service Zones
          </Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline" className="rounded-md">
          <Link to="/admin" search={{ tab: "service-zones" }}>
            <ArrowLeft className="size-4" />
            Back to Service Zones
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
                placeholder="Commune name (EN)"
              />
              <Input
                value={communeNameFrDraft}
                onChange={(event) => setCommuneNameFrDraft(event.target.value)}
                placeholder="Commune name (FR)"
              />
              <Input
                value={communeNameArDraft}
                onChange={(event) => setCommuneNameArDraft(event.target.value)}
                placeholder="Commune name (AR)"
              />
              <div className="flex gap-2">
                <Button className="rounded-md" onClick={saveCommuneName} disabled={isSavingCommuneName}>
                  {isSavingCommuneName ? "Saving..." : "Save names"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-md"
                  onClick={() => setIsEditingCommuneName(false)}
                  disabled={isSavingCommuneName}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-foreground">{localizedCommuneName(commune)}</h1>
              <p className="text-sm text-muted-foreground">Manage douars and delivery fees for this commune.</p>
            </div>
          )}

          {!isEditingCommuneName ? (
            <Button variant="outline" className="rounded-md" onClick={startEditCommuneName}>
              <Pencil className="size-4" />
              Edit Name
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-foreground">Douars</h2>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Douar Name</th>
                <th className="px-4 py-2 font-medium">Delivery Fee (MAD)</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedNeighborhoods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-muted-foreground">
                    No douars yet for this commune.
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
                              placeholder="Name (EN)"
                            />
                            <Input
                              value={editingNeighborhoodNameFr}
                              onChange={(event) => setEditingNeighborhoodNameFr(event.target.value)}
                              className="h-9"
                              placeholder="Name (FR)"
                            />
                            <Input
                              value={editingNeighborhoodNameAr}
                              onChange={(event) => setEditingNeighborhoodNameAr(event.target.value)}
                              className="h-9"
                              placeholder="Name (AR)"
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
                                {isSavingNeighborhood ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md"
                                onClick={() => setEditingNeighborhoodId(null)}
                                disabled={isSavingNeighborhood}
                              >
                                Cancel
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
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md border-destructive/40 text-destructive hover:bg-destructive/10"
                                disabled={deletingNeighborhoodId === douar.id}
                                onClick={() => {
                                  const confirmed = window.confirm(
                                      `Delete douar \"${localizedNeighborhoodName(douar)}\"? This action cannot be undone.`,
                                  );
                                  if (confirmed) {
                                    confirmDeleteNeighborhood(douar.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-4" />
                                {deletingNeighborhoodId === douar.id ? "Deleting..." : "Delete"}
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
          <p className="mb-2 text-sm font-medium text-foreground">Quick Add Douar</p>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={newDouarNameEn}
              onChange={(event) => setNewDouarNameEn(event.target.value)}
              placeholder="Douar name (EN)"
            />
            <Input
              value={newDouarNameFr}
              onChange={(event) => setNewDouarNameFr(event.target.value)}
              placeholder="Douar name (FR)"
            />
            <Input
              value={newDouarNameAr}
              onChange={(event) => setNewDouarNameAr(event.target.value)}
              placeholder="Douar name (AR)"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={newDouarFee}
              onChange={(event) => setNewDouarFee(event.target.value)}
              placeholder="Delivery fee"
            />
            <Button className="rounded-md" onClick={handleQuickAddDouar} disabled={isAddingDouar}>
              {isAddingDouar ? "Adding..." : "Add Douar"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 shadow-sm md:p-5">
        <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
        <p className="mt-1 text-sm text-destructive/90">
          Deleting this commune will permanently remove it and all associated douars.
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-md border-destructive text-destructive hover:bg-destructive/10"
          onClick={() => setIsDeleteCommuneDialogOpen(true)}
        >
          <Trash2 className="size-4" />
          Delete Entire Commune
        </Button>
      </section>

      <AlertDialog open={isDeleteCommuneDialogOpen} onOpenChange={setIsDeleteCommuneDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this commune permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{commune.name}</strong> and all its douars. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCommune}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingCommune}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteCommune();
              }}
            >
              {isDeletingCommune ? "Deleting..." : "Yes, Delete Commune"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}