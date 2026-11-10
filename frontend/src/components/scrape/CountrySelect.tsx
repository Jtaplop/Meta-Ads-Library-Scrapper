import { useState, useMemo } from "react";
import { Globe, AlertCircle, Search, ChevronDown, Check } from "lucide-react";
import { useOptions } from "@/api/queries/useOptions";
import type { CountryGroup } from "@/api/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const DEFAULT_COUNTRY_GROUPS: CountryGroup[] = [
  {
    group: "Mercado Hispano",
    items: [
      { code: "ES", name: "España" },
      { code: "MX", name: "México" },
      { code: "CO", name: "Colombia" },
      { code: "AR", name: "Argentina" },
      { code: "CL", name: "Chile" },
      { code: "PE", name: "Perú" },
      { code: "UY", name: "Uruguay" },
      { code: "PA", name: "Panamá" },
      { code: "CR", name: "Costa Rica" },
    ],
  },
  {
    group: "Mercado Anglosajón",
    items: [
      { code: "US", name: "Estados Unidos" },
      { code: "GB", name: "Reino Unido" },
      { code: "CA", name: "Canadá" },
      { code: "AU", name: "Australia" },
      { code: "IE", name: "Irlanda" },
    ],
  },
  {
    group: "Europa Occidental y Otros",
    items: [
      { code: "DE", name: "Alemania" },
      { code: "AT", name: "Austria" },
      { code: "CH", name: "Suiza" },
      { code: "FR", name: "Francia" },
      { code: "IT", name: "Italia" },
      { code: "PT", name: "Portugal" },
      { code: "NL", name: "Países Bajos" },
      { code: "BE", name: "Bélgica" },
      { code: "SE", name: "Suecia" },
      { code: "AE", name: "Emiratos Árabes (Dubái)" },
      { code: "BR", name: "Brasil" },
    ],
  },
  {
    group: "Global",
    items: [{ code: "ALL", name: "Todo el mundo (Sin filtro)" }],
  },
];

export function CountrySelect({ value, onChange, disabled }: CountrySelectProps) {
  const { data: options } = useOptions();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const groups = options?.countries && options.countries.length > 0
    ? options.countries
    : DEFAULT_COUNTRY_GROUPS;

  const isUkWarning = search.trim().toUpperCase() === "UK";

  // Find currently selected label
  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const match = g.items.find((item) => item.code.toUpperCase() === value.toUpperCase());
      if (match) return `${match.name} (${match.code})`;
    }
    return value ? `País: ${value}` : "Seleccionar país";
  }, [groups, value]);

  // Filter items by search text
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.code.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full justify-between text-left font-normal h-9 text-xs"
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-50" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] rounded-md border bg-popover text-popover-foreground shadow-md z-50 p-2 space-y-2 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar país o código (ej. ES, México)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>

            {/* UK Special Warning */}
            {isUkWarning && (
              <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Usa <strong>GB</strong> para Reino Unido (Meta Ads Library utiliza código GB).</span>
              </div>
            )}

            {/* Grouped list */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {filteredGroups.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-xs">
                  No se encontraron países.
                </div>
              ) : (
                filteredGroups.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 rounded">
                      {group.group}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isSelected = item.code.toUpperCase() === value.toUpperCase();
                        return (
                          <div
                            key={item.code}
                            onClick={() => handleSelect(item.code)}
                            className={cn(
                              "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-xs hover:bg-accent",
                              isSelected && "bg-primary/10 font-medium text-primary"
                            )}
                          >
                            <span>
                              {item.name} <span className="text-muted-foreground font-mono">({item.code})</span>
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
