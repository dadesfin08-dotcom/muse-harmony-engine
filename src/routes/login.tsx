import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bike, Circle, Cloud, MapPin, MessageCircle, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import asugLogo from "@/assets/asug-logo.png";

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
    <main className="login-luxury-bg relative flex min-h-screen flex-col overflow-hidden p-4">
      <div className="mx-auto flex w-full max-w-md items-center justify-start pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full border border-border/70 bg-card/70 text-foreground shadow-sm backdrop-blur"
          onClick={() => {
            void navigate({ to: "/customer" });
          }}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
      </div>

      <section className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-start pb-10 pt-6">
        <div className="login-hero-zone pointer-events-none relative z-10 mx-auto mb-5 flex w-full justify-center">
          <div className="login-logo-glow absolute inset-x-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="login-logo-plate login-float relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full">
            <img
              src={asugLogo}
              alt="ASUG logo"
              className="login-logo-image h-[72%] w-[72%] object-contain object-center opacity-95"
            />
          </div>
        </div>

        <div className="pointer-events-none absolute left-0 top-18 z-20 flex items-start gap-2 login-float">
          <div className="login-soft-orb relative flex h-16 w-16 items-center justify-center">
            <MapPin className="size-8 text-primary" strokeWidth={2.15} />
          </div>
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-card/95 shadow-sm">
            <Cloud className="size-5 text-muted-foreground" />
          </div>
        </div>

        <div className="pointer-events-none absolute right-0 top-20 z-20 flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-card/95 shadow-lg login-float-delayed">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/80">
            <MessageCircle className="size-6 text-white" />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-2 z-20 flex h-24 w-24 items-center justify-center rounded-3xl border border-border/50 bg-secondary/95 shadow-[0_18px_26px_-22px_rgba(15,23,42,0.6)] login-float">
          <Bike className="size-8 text-foreground/70" strokeWidth={2} />
        </div>

        <div className="pointer-events-none absolute -bottom-1 right-0 z-20 flex h-28 w-28 items-center justify-center rounded-full border border-border/40 bg-accent/20 shadow-[0_18px_28px_-22px_rgba(15,23,42,0.5)] login-float-delayed">
          <ShoppingBasket className="size-11 text-accent-foreground/80" strokeWidth={1.8} />
        </div>

        <div className="login-particle pointer-events-none absolute left-8 top-30 z-10 opacity-40">
          <Circle className="size-3 fill-primary/30 text-primary/35" strokeWidth={1.2} />
        </div>
        <div className="login-particle pointer-events-none absolute right-8 top-40 z-10 opacity-35">
          <Circle className="size-2.5 fill-muted-foreground/35 text-muted-foreground/40" strokeWidth={1.2} />
        </div>
        <div className="login-particle pointer-events-none absolute right-24 bottom-24 z-10 opacity-30">
          <Circle className="size-2 fill-primary/25 text-primary/30" strokeWidth={1.2} />
        </div>
        <div className="pointer-events-none absolute bottom-10 left-14 z-0 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute right-6 top-22 z-0 h-24 w-24 rounded-full bg-primary/10 blur-[44px]" />

        <div className="login-glass-card relative z-30 mt-2 w-full rounded-[32px] p-6">
          <div className="mb-6 pt-1 text-center">
            <h1 className="text-[2rem] font-bold leading-[1.05] text-foreground">Welcome Back</h1>
            <p className="mt-2 text-base text-muted-foreground">Enter your phone number to continue</p>
          </div>

          {authStep === "phone" ? (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <label htmlFor="customer-auth-phone" className="text-sm font-medium text-foreground/85">
                  Phone Number
                </label>
                <div className="login-input-shell flex h-14 items-center overflow-hidden rounded-2xl border border-input bg-background/90 transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="px-3 text-base font-medium text-foreground/90">+212</span>
                  <input
                    id="customer-auth-phone"
                    value={authPhoneInput}
                    onChange={(event) => setAuthPhoneInput(normalizeMoroccoPhoneInput(event.target.value))}
                    placeholder="6XXXXXXXX"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground/80"
                  />
                </div>
              </div>

              <Button
                variant="hero"
                className="login-wa-button h-12 w-full rounded-full font-semibold text-primary-foreground"
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
                className="login-wa-button w-full rounded-full text-primary-foreground"
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