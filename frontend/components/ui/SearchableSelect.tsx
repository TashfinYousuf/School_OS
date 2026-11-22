"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { Search, ChevronDown, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string, option?: SearchableOption) => void;
  options: (SearchableOption | string)[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  label?: string;
  allowClear?: boolean;
  loading?: boolean;
  onSearchChange?: (query: string) => void;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  className,
  id,
  name,
  label,
  allowClear = true,
  loading = false,
  onSearchChange,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalize options
  const normalizedOptions: SearchableOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value);
  }, [normalizedOptions, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      if (onSearchChange) onSearchChange("");
    }
  }, [isOpen, onSearchChange]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (onSearchChange) {
      onSearchChange(q);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-400"
        >
          {label}
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        role="button"
        id={selectId}
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-xl border transition-all cursor-pointer outline-none select-none",
          "bg-gray-50 border-gray-200 text-gray-900 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20",
          "dark:bg-black/40 dark:border-white/10 dark:text-white dark:focus-within:border-purple-500 dark:focus-within:ring-purple-500/20",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-purple-500/20 dark:text-purple-300 font-mono">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {allowClear && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            className={cn(
              "text-gray-400 dark:text-gray-500 transition-transform duration-200",
              isOpen && "transform rotate-180"
            )}
          />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={cn(
            "absolute z-50 w-full mt-1.5 rounded-xl border p-1.5 shadow-xl outline-none backdrop-blur-md max-h-72 flex flex-col",
            "bg-white border-gray-200 text-gray-900 shadow-gray-200/50",
            "dark:bg-[#141417] dark:border-white/10 dark:text-white dark:shadow-black/60"
          )}
        >
          {/* Search Field */}
          <div className="relative mb-1 px-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder={searchPlaceholder}
              className={cn(
                "w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none font-medium",
                "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500",
                "dark:bg-black/30 dark:border-white/10 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-purple-500"
              )}
            />
          </div>

          {/* List Options */}
          <div className="overflow-y-auto max-h-56 space-y-0.5 pr-0.5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin text-blue-500 dark:text-purple-400" />
                <span>Searching records...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-gray-400 dark:text-gray-500">
                No matching records found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value, opt);
                        setIsOpen(false);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-2 text-xs font-medium rounded-lg text-left transition-colors",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                      !opt.disabled && !isSelected && "hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-200",
                      isSelected && "bg-blue-50 text-blue-700 font-semibold dark:bg-purple-500/20 dark:text-purple-300"
                    )}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="truncate font-semibold">{opt.label}</div>
                      {opt.subtitle && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {opt.subtitle}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 font-mono">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={14} className="text-blue-600 dark:text-purple-400" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default SearchableSelect;

