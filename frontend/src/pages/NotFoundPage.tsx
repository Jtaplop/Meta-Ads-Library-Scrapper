import { useNavigate } from "react-router-dom";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">404</h1>
      <h2 className="text-base font-semibold text-foreground mb-2">Página no encontrada</h2>
      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        La ruta que has solicitado no existe o ha sido movida. Puedes volver al panel principal
        o comprobar la dirección.
      </p>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 text-xs h-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver atrás</span>
        </Button>

        <Button
          size="sm"
          onClick={() => navigate("/")}
          className="gap-1.5 text-xs h-8 font-semibold shadow-sm"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Ir al Dashboard</span>
        </Button>
      </div>
    </div>
  );
}
export default NotFoundPage;
