import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { useCreateJob, useJob } from "@/api/queries/useJobs";
import { useOptions } from "@/api/queries/useOptions";
import type { Recipe, ScrapeRequest } from "@/api/types";
import { PageHeader } from "@/components/common/PageHeader";
import { RecipePicker } from "@/components/scrape/RecipePicker";
import { ScrapeForm } from "@/components/scrape/ScrapeForm";

export function NewScrapePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const recipeParam = searchParams.get("recipe");
  const fromJobId = searchParams.get("from");

  const { data: options } = useOptions();
  const { data: sourceJob } = useJob(fromJobId);
  const createJob = useCreateJob();

  const [formValues, setFormValues] = useState<Partial<ScrapeRequest>>({});
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(recipeParam);

  // If cloned from an existing job
  useEffect(() => {
    if (sourceJob?.request) {
      setFormValues({ ...sourceJob.request });
      toast.info(`Configuración cargada desde el trabajo ${sourceJob.id}`);
    }
  }, [sourceJob]);

  // If recipe query param is set
  useEffect(() => {
    if (recipeParam && options?.recipes) {
      const found = options.recipes.find((r) => r.id === recipeParam);
      if (found) {
        setSelectedRecipeId(found.id);
        setFormValues((prev) => ({
          ...prev,
          ...(found.params as Partial<ScrapeRequest>),
        }));
      }
    }
  }, [recipeParam, options?.recipes]);

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    setFormValues((prev) => ({
      ...prev,
      ...(recipe.params as Partial<ScrapeRequest>),
    }));
    toast.success(`Receta aplicada: ${recipe.name || recipe.title}`);
  };

  const handleApplyPreset = (presetValues: Partial<ScrapeRequest>) => {
    setSelectedRecipeId(null);
    setFormValues(presetValues);
    toast.success("Preset aplicado");
  };

  const handleSubmit = async (request: ScrapeRequest) => {
    try {
      const created = await createJob.mutateAsync(request);
      toast.success("Trabajo creado con éxito");
      navigate(`/jobs/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar el scrape";
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Search className="w-5 h-5 text-primary" />
            <span>Configurar nuevo scrape</span>
          </div>
        }
        description="Define los parámetros de búsqueda para extraer anuncios verificados de Meta Ads Library y volcarlos a CSV o JSON."
      />

      {/* Recommended Recipes Cards */}
      <RecipePicker
        currentValues={formValues}
        selectedRecipeId={selectedRecipeId}
        onSelectRecipe={handleSelectRecipe}
        onApplyPreset={handleApplyPreset}
      />

      {/* Main Scrape Form */}
      <ScrapeForm
        initialValues={formValues}
        onSubmit={handleSubmit}
        isSubmitting={createJob.isPending}
      />
    </div>
  );
}
export default NewScrapePage;
