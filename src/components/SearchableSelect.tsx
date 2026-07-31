import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string | number;
  label: string;
  detail?: string;
  searchText?: string;
}

interface SearchableSelectProps {
  value: string | number | "";
  options: SearchableOption[];
  onChange: (value: string | number | "") => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Escribe para buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => String(option.value) === String(value));

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => `${option.label} ${option.detail || ""} ${option.searchText || ""}`.toLocaleLowerCase().includes(normalizedQuery));
  }, [options, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const choose = (nextValue: string | number) => {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-250 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>{selected?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                  if (event.key === "Enter" && filteredOptions.length === 1) choose(filteredOptions[0].value);
                }}
                placeholder={searchPlaceholder}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              {query && <button type="button" onClick={() => setQuery("")} className="p-1 text-slate-400" aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></button>}
            </div>
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto overscroll-contain p-1">
            {filteredOptions.length ? filteredOptions.map((option) => {
              const isSelected = String(option.value) === String(value);
              return <button type="button" role="option" aria-selected={isSelected} key={option.value} onClick={() => choose(option.value)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${isSelected ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{option.label}</span>{option.detail && <span className="block truncate text-[11px] text-slate-500">{option.detail}</span>}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>;
            }) : <p className="px-3 py-5 text-center text-xs text-slate-400">{emptyMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
