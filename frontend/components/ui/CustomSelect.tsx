"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  label?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  disabled = false,
  className,
  id,
  name,
  label,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
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

      {/* Trigger Button */}
      <button
        id={selectId}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-xl border transition-all text-left outline-none",
          "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
          "dark:bg-black/40 dark:border-white/10 dark:text-white dark:focus:border-purple-500 dark:focus:ring-purple-500/20",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-gray-400 dark:text-gray-500")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "ml-2 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200",
            isOpen && "transform rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={cn(
            "absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto rounded-xl border p-1 shadow-xl outline-none backdrop-blur-md",
            "bg-white border-gray-200 text-gray-900 shadow-gray-200/50",
            "dark:bg-[#141417] dark:border-white/10 dark:text-white dark:shadow-black/60"
          )}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400 text-center">
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt) => {
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
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors",
                    opt.disabled && "opacity-40 cursor-not-allowed",
                    !opt.disabled && !isSelected && "hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-700 dark:text-gray-200",
                    isSelected && "bg-blue-50 text-blue-700 font-semibold dark:bg-purple-500/20 dark:text-purple-300"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="flex-shrink-0 text-blue-600 dark:text-purple-400" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
export default CustomSelect;

