import { useState } from "react";
import { Bookmark, Trash2, BookmarkPlus } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { ScrapeRequest } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface Preset {
  id: string;
  name: string;
  values: Partial<ScrapeRequest>;
  createdAt: string;
}

interface PresetMenuProps {
  currentValues: Partial<ScrapeRequest>;
  onApplyPreset: (values: Partial<ScrapeRequest>) => void;
}

export function PresetMenu({ currentValues, onApplyPreset }: PresetMenuProps) {
  const [presets, setPresets] = useLocalStorage<Preset[]>("scrape_presets", []);
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handleSaveCurrent = () => {
    if (!newPresetName.trim()) return;

    const newPreset: Preset = {
      id: `preset_${Date.now()}`,
      name: newPresetName.trim(),
      values: { ...currentValues },
      createdAt: new Date().toISOString(),
    };

    setPresets((prev) => [...prev, newPreset]);
    setNewPresetName("");
    setSaveDialogOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      <div className="relative inline-block text-left">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="gap-2 text-xs"
        >
          <Bookmark className="w-3.5 h-3.5 text-primary" />
          <span>Presets ({presets.length})</span>
        </Button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />

            {/* Menu */}
            <div className="absolute right-0 mt-2 w-72 rounded-lg border bg-popover text-popover-foreground shadow-lg z-30 p-2 text-xs">
              <div className="flex items-center justify-between px-2 py-1.5 border-b mb-1">
                <span className="font-semibold text-muted-foreground uppercase text-[10px]">
                  Tus presets guardados
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[11px] gap-1 text-primary"
                  onClick={() => {
                    setIsOpen(false);
                    setSaveDialogOpen(true);
                  }}
                >
                  <BookmarkPlus className="w-3 h-3" />
                  Guardar actual
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1">
                {presets.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-[11px]">
                    No tienes presets guardados aún.
                  </div>
                ) : (
                  presets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => {
                        onApplyPreset(preset.values);
                        setIsOpen(false);
                      }}
                      className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer group transition-colors"
                    >
                      <div className="truncate mr-2">
                        <div className="font-medium truncate">{preset.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {preset.values.country} · {preset.values.media_type || "all"} · {preset.values.limit || 50} ads
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(preset.id, e)}
                        title="Eliminar preset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar preset de scrape</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre descriptivo del preset
            </label>
            <Input
              placeholder="Ej: Odontología España Vídeos IG"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveCurrent();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCurrent}
              disabled={!newPresetName.trim()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
