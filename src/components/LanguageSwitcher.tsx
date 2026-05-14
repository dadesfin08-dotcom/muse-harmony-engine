import { useMemo, useState } from "react";
import { Check, Languages } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import type { AppLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const languageOptions: Array<{ code: AppLanguage; label: string; flag: string }> = [
  { code: "ar", label: "العربية (المغربية)", flag: "🇲🇦" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const activeLanguage = useMemo(
    () => (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage,
    [i18n.language, i18n.resolvedLanguage],
  );

  const handleLanguageSelect = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("language.label")}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <Languages className="size-5" />
        </button>
      </DialogTrigger>

      <DialogContent
        className="w-[92vw] max-w-sm border-border bg-card p-4 shadow-2xl sm:p-5"
        overlayClassName="bg-black/20 backdrop-blur-sm"
      >
        <DialogTitle className="mb-2 text-center text-base font-semibold sm:text-lg">{t("language.label")}</DialogTitle>

        <AnimatePresence mode="wait">
          <motion.div
            key="language-modal-list"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-2"
          >
            {languageOptions.map((option) => {
              const isActive = option.code === activeLanguage;

              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleLanguageSelect(option.code)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border/70 hover:bg-accent/40",
                  )}
                >
                  <span className="inline-flex items-center gap-3 text-base">
                    <span className="text-lg leading-none">{option.flag}</span>
                    <span className="font-medium">{option.label}</span>
                  </span>
                  {isActive ? <Check className="size-5 text-primary" /> : null}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
