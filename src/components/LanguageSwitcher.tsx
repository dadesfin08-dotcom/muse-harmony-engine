import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import type { AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const languageOptions: Array<{ code: AppLanguage; label: string; flag: string }> = [
  { code: "ar", label: "العربية (المغربية)", flag: "🇲🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher({ className, menuClassName }: { className?: string; menuClassName?: string }) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeLanguage = useMemo(
    () => (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage,
    [i18n.language, i18n.resolvedLanguage],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const handleLanguageSelect = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={t("language.label")}
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
      >
        <Languages className="size-5" />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "absolute right-0 top-12 z-50 w-56 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
              menuClassName,
            )}
          >
            {languageOptions.map((option) => {
              const isActive = option.code === activeLanguage;

              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleLanguageSelect(option.code)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="text-base leading-none">{option.flag}</span>
                    <span>{option.label}</span>
                  </span>
                  {isActive ? <Check className="size-4" /> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
