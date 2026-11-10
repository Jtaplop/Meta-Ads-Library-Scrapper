import { Sparkles, Video, MessageSquare, Instagram, Layers } from "lucide-react";
import { useOptions } from "@/api/queries/useOptions";
import type { Recipe, ScrapeRequest } from "@/api/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PresetMenu } from "./PresetMenu";
import { cn } from "@/lib/cn";

interface RecipePickerProps {
  currentValues: Partial<ScrapeRequest>;
  selectedRecipeId?: string | null;
  onSelectRecipe: (recipe: Recipe) => void;
  onApplyPreset: (values: Partial<ScrapeRequest>) => void;
}

const RECIPE_ICONS: Record<string, React.ElementType> = {
  ig_lead_gen: Instagram,
  winning_ads: Video,
  pain_sweep: Layers,
  external_funnels: MessageSquare,
};

export function RecipePicker({
  currentValues,
  selectedRecipeId,
  onSelectRecipe,
  onApplyPreset,
}: RecipePickerProps) {
  const { data: options } = useOptions();
  const recipes = options?.recipes || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recetas recomendadas
          </span>
        </div>
        <PresetMenu currentValues={currentValues} onApplyPreset={onApplyPreset} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {recipes.map((recipe) => {
          const Icon = RECIPE_ICONS[recipe.id] || Sparkles;
          const isSelected = selectedRecipeId === recipe.id;

          return (
            <Card
              key={recipe.id}
              onClick={() => onSelectRecipe(recipe)}
              className={cn(
                "p-3.5 cursor-pointer transition-all border text-left flex flex-col justify-between hover:border-primary/60 hover:shadow-sm",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "bg-card hover:bg-accent/30"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-xs text-foreground leading-tight">
                      {recipe.name || recipe.title}
                    </span>
                  </div>
                  {recipe.is_batch && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      Batch
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {recipe.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {String(recipe.params.country ?? "ALL")} · {String(recipe.params.media_type ?? "all")}
                </span>
                <span className="font-medium text-primary">Aplicar →</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
