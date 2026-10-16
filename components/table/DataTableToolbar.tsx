import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DataTableToolbar({ title, searchValue, searchPlaceholder, onSearchChange, actions }: { title?: string; searchValue: string; searchPlaceholder: string; onSearchChange: (value: string) => void; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {title ? <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2> : <span />}
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <label className="relative block w-full sm:w-[26rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="h-9 rounded-xl pl-10 text-sm" type="search" placeholder={searchPlaceholder} value={searchValue} onChange={(event) => onSearchChange(event.target.value)} aria-label="Cari dalam tabel" />
        </label>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
