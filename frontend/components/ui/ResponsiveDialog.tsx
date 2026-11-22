"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export interface ResponsiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: DialogSize;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  confirmBeforeClose?: boolean;
  isDirty?: boolean;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  full: "max-w-[96vw]",
};

export default function ResponsiveDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "lg",
  className,
  bodyClassName,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  confirmBeforeClose = false,
  isDirty = false,
}: ResponsiveDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle safe close with unsaved changes check
  const handleAttemptClose = () => {
    if (confirmBeforeClose && isDirty) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Are you sure you want to discard them and close?"
      );
      if (!confirmDiscard) return;
    }
    onClose();
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleAttemptClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, confirmBeforeClose, isDirty]);

  // Lock body scroll while dialog is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 print:hidden"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          handleAttemptClose();
        }
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "responsive-dialog-title" : undefined}
        className={cn(
          "bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden w-full max-h-[92vh] max-w-[calc(100vw-1.5rem)] transition-all animate-in zoom-in-95 duration-200",
          sizeClasses[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              {icon && (
                <div className="p-2 bg-blue-50 dark:bg-white/5 rounded-xl text-blue-600 dark:text-purple-400 shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3
                    id="responsive-dialog-title"
                    className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate"
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={handleAttemptClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar",
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render into body portal if in browser, else fallback
  if (mounted && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}

export { ResponsiveDialog };
