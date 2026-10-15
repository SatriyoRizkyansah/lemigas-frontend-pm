"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "cn";

type FilterOption = { label: string; value: string };

type FilterComboboxProps = {
  options: FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
};

export function FilterCombobox({ options, value, onValueChange, label }: FilterComboboxProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox.Root
      items={options}
      value={selectedOption}
      onValueChange={(option) => {
        if (option) onValueChange(option.value);
      }}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={`Filter ${label.toLocaleLowerCase("id-ID")}`}
        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/30"
      >
        <Combobox.Value>{(selected) => <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? label}</span>}</Combobox.Value>
        <Combobox.Icon>
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner side="bottom" sideOffset={4} align="start" className="z-50 w-[var(--anchor-width)] min-w-0">
          <Combobox.Popup className="max-h-80 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
            <div className="border-b border-border p-1.5">
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/30">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <Combobox.Input
                  aria-label={`Cari opsi ${label.toLocaleLowerCase("id-ID")}`}
                  placeholder="Search..."
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <Combobox.List className="max-h-64 overflow-y-auto p-1">
              {(option: FilterOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option}
                  className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <Combobox.ItemIndicator>
                    <Check className={cn("h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada opsi ditemukan.</Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
