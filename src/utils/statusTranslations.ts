import type { AppLanguage } from "@/lib/i18n";

export type CustomerAlertState = "vip" | "warning_cancel" | "blocked_cod" | "blocked_spam";

export type CustomerAlertContent = {
  title: string;
  desc: string;
  color: string;
  icon: "ShieldCheck" | "AlertTriangle" | "Ban" | "XOctagon";
};

export const statusContent: Record<CustomerAlertState, Record<AppLanguage, CustomerAlertContent>> = {
  vip: {
    en: {
      title: "VIP Customer",
      desc: "Thank you for your loyalty! Enjoy priority support and exclusive offers.",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: "ShieldCheck",
    },
    fr: {
      title: "Client VIP",
      desc: "Merci pour votre fidélité ! Profitez d'un support prioritaire.",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: "ShieldCheck",
    },
    ar: {
      title: "زبون VIP",
      desc: "شكراً لولائك! استمتع بدعم أولوية وعروض حصرية.",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: "ShieldCheck",
    },
  },
  warning_cancel: {
    en: {
      title: "Account Notice",
      desc: "We noticed multiple recent cancellations. Please review your orders carefully before confirming.",
      color: "bg-orange-50 border-orange-200 text-orange-800",
      icon: "AlertTriangle",
    },
    fr: {
      title: "Avis de compte",
      desc: "Nous avons remarqué plusieurs annulations. Veuillez vérifier vos commandes.",
      color: "bg-orange-50 border-orange-200 text-orange-800",
      icon: "AlertTriangle",
    },
    ar: {
      title: "تنبيه الحساب",
      desc: "لاحظنا إلغاءات متكررة مؤخراً. يرجى مراجعة طلباتك بعناية قبل التأكيد.",
      color: "bg-orange-50 border-orange-200 text-orange-800",
      icon: "AlertTriangle",
    },
  },
  blocked_cod: {
    en: {
      title: "Feature Restricted",
      desc: "Cash on Delivery is disabled due to previous rejections. Please use online payment.",
      color: "bg-red-50 border-red-200 text-red-800",
      icon: "Ban",
    },
    fr: {
      title: "Fonctionnalité restreinte",
      desc: "Le paiement à la livraison est désactivé suite à des refus précédents.",
      color: "bg-red-50 border-red-200 text-red-800",
      icon: "Ban",
    },
    ar: {
      title: "خدمة مقيدة",
      desc: "تم إيقاف الدفع عند الاستلام بسبب رفض طلبات سابقة. يرجى الدفع عبر الإنترنت.",
      color: "bg-red-50 border-red-200 text-red-800",
      icon: "Ban",
    },
  },
  blocked_spam: {
    en: {
      title: "Account Suspended",
      desc: "Your account is temporarily restricted due to policy violations. Contact support.",
      color: "bg-red-100 border-red-300 text-red-900",
      icon: "XOctagon",
    },
    fr: {
      title: "Compte suspendu",
      desc: "Votre compte est restreint suite à des violations de politique.",
      color: "bg-red-100 border-red-300 text-red-900",
      icon: "XOctagon",
    },
    ar: {
      title: "حساب محظور",
      desc: "تم تقييد حسابك مؤقتاً بسبب مخالفة السياسات. تواصل مع الدعم.",
      color: "bg-red-100 border-red-300 text-red-900",
      icon: "XOctagon",
    },
  },
};
