import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string | number;
  label: string;
  detail?: string;
  searchText?: string;
}

interface SearchableMultiSelectProps {
  value: string[]; // Selected values
  options: SearchableOption[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  compact?: boolean;
  allLabel?: string;
}

export function SearchableMultiSelect({
  value = [],
  options = [],
  onChange,
  placeholder,
  searchPlaceholder = "Escribe para buscar...",
  emptyMessage = "No se encontraron resultados.",
  disabled = false,
  compact = false,
  allLabel,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedValuesSet = useMemo(() => new Set(value.map(String)), [value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label} ${option.detail || ""} ${option.searchText || ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [options, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const toggleOption = (optVal: string | number) => {
    const stringVal = String(optVal);
    let nextValue: string[];
    if (selectedValuesSet.has(stringVal)) {
      nextValue = value.filter((v) => String(v) !== stringVal);
    } else {
      nextValue = [...value, stringVal];
    }
    onChange(nextValue);
  };

  const selectAllFiltered = () => {
    const filteredVals = filteredOptions.map((o) => String(o.value));
    const nextSet = new Set(value.map(String));
    filteredVals.forEach((v) => nextSet.add(v));
    onChange(Array.from(nextSet));
  };

  const deselectAllFiltered = () => {
    const filteredValsSet = new Set(filteredOptions.map((o) => String(o.value)));
    const nextValue = value.filter((v) => !filteredValsSet.has(String(v)));
    onChange(nextValue);
  };

  // Label display logic
  const displayLabel = useMemo(() => {
    if (value.length === 0) {
      return allLabel || placeholder;
    }
    if (value.length === options.length && allLabel) {
      return allLabel;
    }

    const selectedOptions = options.filter((o) => selectedValuesSet.has(String(o.value)));
    const selectedLabels = selectedOptions.map((o) => o.label);

    if (selectedLabels.length === 0) {
      return allLabel || placeholder;
    }
    if (selectedLabels.length <= 2) {
      return selectedLabels.join(", ");
    }
    return `${selectedLabels.slice(0, 2).join(", ")} (+${selectedLabels.length - 2})`;
  }, [value, options, selectedValuesSet, placeholder, allLabel]);

  const buttonPaddingClass = compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-sm";
  const buttonHeightClass = compact ? "min-h-[32px]" : "min-h-[44px]";

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex ${buttonHeightClass} w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-white ${buttonPaddingClass} text-left font-medium text-slate-650 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate pr-1 block">{displayLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180 text-blue-500" : ""
          }`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false);
                }}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400 py-0.5 border-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-0.5 text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Actions for Select All / Deselect All */}
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-blue-600 font-semibold select-none">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600"
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                onClick={deselectAllFiltered}
                className="hover:underline cursor-pointer bg-transparent border-none p-0 text-blue-600"
              >
                Limpiar todos
              </button>
            </div>
          </div>

          <div role="listbox" className="max-h-56 overflow-y-auto overscroll-contain p-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = selectedValuesSet.has(String(option.value));
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-blue-50/70 transition-colors cursor-pointer border-none bg-transparent ${
                      isSelected ? "bg-blue-50/50 text-blue-700 font-medium" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // toggling is handled by button click
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer accent-blue-600 border-slate-300"
                      />
                      <span className="block truncate text-xs">{option.label}</span>
                    </span>
                    {option.detail && (
                      <span className="block truncate text-[10px] text-slate-400">
                        {option.detail}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">{emptyMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
