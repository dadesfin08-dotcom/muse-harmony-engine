import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bike, Cloud, MapPin, MessageCircle, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  createOtpRequest,
  verifyOtpCode,
} from "@/lib/customers.functions";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";

const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

export const Route = createFileRoute("/login")({
  component: CustomerLoginPage,
});

type AuthStep = "phone" | "otp";

function CustomerLoginPage() {
  const navigate = useNavigate({ from: "/login" });
  const createOtpRequestFn = useServerFn(createOtpRequest);
  const verifyOtpCodeFn = useServerFn(verifyOtpCode);

  const [authStep, setAuthStep] = useState<AuthStep>("phone");
  const [authPhoneInput, setAuthPhoneInput] = useState("");
  const [authPhoneForOtp, setAuthPhoneForOtp] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [isSendingAuthCode, setIsSendingAuthCode] = useState(false);
  const [isVerifyingAuthOtp, setIsVerifyingAuthOtp] = useState(false);

  const normalizedAuthPhone = useMemo(
    () => normalizeMoroccoPhoneInput(authPhoneInput),
    [authPhoneInput],
  );
  const isAuthPhoneValid = isValidMoroccoPhone(normalizedAuthPhone);

  const sendCustomerOtp = async () => {
    if (!isAuthPhoneValid) {
      toast.error("Please enter a valid Moroccan phone number.");
      return;
    }

    setIsSendingAuthCode(true);
    try {
      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const otpPayload = await createOtpRequestFn({
        data: { phoneNumber: fullPhoneNumber },
      });

      setAuthPhoneForOtp(fullPhoneNumber);
      setAuthStep("otp");
      toast.success("Code sent on WhatsApp.");

      fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: otpPayload.phoneNumber,
          otpCode: otpPayload.otpCode,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Webhook request failed with status ${response.status}`);
          }
        })
        .catch((error) => {
          console.error("OTP webhook trigger failed:", error);
          toast.error("Code generated, but WhatsApp delivery is delayed. Please retry in a moment.");
        });
    } catch {
      toast.error("Unable to send code right now. Please try again.");
    } finally {
      setIsSendingAuthCode(false);
    }
  };

  const verifyCustomerOtpAndLogin = async () => {
    if (authOtpCode.length !== 4) {
      toast.error("Please enter the 4-digit code.");
      return;
    }

    setIsVerifyingAuthOtp(true);
    try {
      const phoneNumberToVerify = authPhoneForOtp || formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const verification = await verifyOtpCodeFn({
        data: {
          phoneNumber: phoneNumberToVerify,
          otpCode: authOtpCode,
        },
      });

      if (!verification.verified) {
        toast.error("Wrong Code");
        return;
      }

      localStorage.setItem(
        CUSTOMER_SESSION_STORAGE_KEY,
        JSON.stringify({ phoneNumber: phoneNumberToVerify }),
      );

      toast.success("Logged in successfully.");
      await navigate({ to: "/customer" });
    } catch {
      toast.error("Unable to verify code right now. Please try again.");
    } finally {
      setIsVerifyingAuthOtp(false);
    }
  };

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden bg-background p-4"
      style={{
        background:
          "radial-gradient(42% 28% at 86% 10%, rgba(132,204,166,0.22) 0%, rgba(252,251,244,0) 80%), radial-gradient(36% 24% at 10% 92%, rgba(132,204,166,0.2) 0%, rgba(252,251,244,0) 80%), #FCFBF4",
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-start pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-foreground"
          onClick={() => {
            void navigate({ to: "/customer" });
          }}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
      </div>

      <section className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center pb-10 pt-8">
        <div className="pointer-events-none absolute -left-1 top-8 z-20 flex items-start gap-2">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-200/85 shadow-[0_14px_24px_-18px_rgba(16,185,129,0.7)]">
            <MapPin className="size-8 text-emerald-500" strokeWidth={2.2} />
          </div>
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-sm">
            <Cloud className="size-5 text-muted-foreground" />
          </div>
        </div>

        <div className="pointer-events-none absolute -right-1 top-10 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-lg">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/90">
            <MessageCircle className="size-6 text-white" />
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-1 left-2 z-20 flex h-24 w-24 items-center justify-center rounded-2xl bg-amber-200/90 shadow-[0_20px_24px_-20px_rgba(120,53,15,0.7)]">
          <Bike className="size-8 text-amber-950/75" strokeWidth={2} />
        </div>

        <div className="pointer-events-none absolute -bottom-2 right-0 z-20 flex h-28 w-28 items-center justify-center rounded-full bg-orange-100/95 shadow-[0_22px_30px_-24px_rgba(185,28,28,0.7)]">
          <ShoppingBasket className="size-11 text-orange-700/80" strokeWidth={1.8} />
        </div>

        <div className="w-full rounded-[2rem] border border-border/60 bg-card/95 p-5 shadow-[0_28px_42px_-28px_rgba(15,23,42,0.4)] backdrop-blur-[1px]">
          <div className="mb-5 pt-1 text-center">
            <h1 className="text-xl font-bold text-foreground">Welcome Back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your phone number to continue</p>
          </div>

          {authStep === "phone" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="customer-auth-phone" className="text-xs font-medium text-muted-foreground">
                  Phone Number
                </label>
                <div className="flex h-14 items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                  <input
                    id="customer-auth-phone"
                    value={authPhoneInput}
                    onChange={(event) => setAuthPhoneInput(normalizeMoroccoPhoneInput(event.target.value))}
                    placeholder="6XXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-base outline-none"
                  />
                </div>
              </div>

              <Button
                variant="hero"
                className="h-12 w-full rounded-full font-semibold shadow-[0_16px_24px_-20px_rgba(22,163,74,0.8)]"
                onClick={sendCustomerOtp}
                disabled={!isAuthPhoneValid || isSendingAuthCode}
              >
                <MessageCircle className="size-4" />
                {isSendingAuthCode ? "Sending..." : "Send Code via WhatsApp"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">Enter the 4-digit code sent to WhatsApp</p>
              <div className="flex justify-center">
                <InputOTP
                  value={authOtpCode}
                  onChange={(value) => setAuthOtpCode(value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="h-12 w-12 rounded-lg border border-input text-base" />
                    <InputOTPSlot index={1} className="h-12 w-12 rounded-lg border border-input text-base" />
                    <InputOTPSlot index={2} className="h-12 w-12 rounded-lg border border-input text-base" />
                    <InputOTPSlot index={3} className="h-12 w-12 rounded-lg border border-input text-base" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                variant="hero"
                className="w-full rounded-full shadow-[0_16px_24px_-20px_rgba(22,163,74,0.8)]"
                onClick={verifyCustomerOtpAndLogin}
                disabled={authOtpCode.length !== 4 || isVerifyingAuthOtp}
              >
                {isVerifyingAuthOtp ? "Verifying..." : "Verify & Login"}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setAuthStep("phone");
                  setAuthPhoneForOtp("");
                  setAuthOtpCode("");
                }}
              >
                Change phone number
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}