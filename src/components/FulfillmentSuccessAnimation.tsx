import { motion } from "framer-motion";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type FulfillmentSuccessAnimationProps = {
  open: boolean;
  title: string;
  subtitle: string;
};

export function FulfillmentSuccessAnimation({
  open,
  title,
  subtitle,
}: FulfillmentSuccessAnimationProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm rounded-2xl border-border p-8 [&>button]:hidden">
        <div className="flex flex-col items-center justify-center text-center">
          <motion.svg
            width="108"
            height="108"
            viewBox="0 0 108 108"
            fill="none"
            className="text-success"
            initial="hidden"
            animate="visible"
          >
            <motion.circle
              cx="54"
              cy="54"
              r="42"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0.7 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
            <motion.path
              d="M34 56L48 70L76 42"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={{
                hidden: { pathLength: 0, opacity: 0 },
                visible: { pathLength: 1, opacity: 1 },
              }}
              transition={{ duration: 0.45, delay: 0.4, ease: "easeOut" }}
            />
          </motion.svg>

          <p className="mt-5 text-lg font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}