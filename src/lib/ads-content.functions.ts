import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const normalizeOptionalText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const parseOptionalDateTime = (value?: string | null) => {
  if (!value || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid datetime value.");
  }
  return date.toISOString();
};

const adInputSchema = z.object({
  campaignName: z.string().trim().min(1).max(120),
  imageAr: z.string().trim().url().max(2000).optional().nullable(),
  imageFr: z.string().trim().url().max(2000).optional().nullable(),
  imageEn: z.string().trim().url().max(2000).optional().nullable(),
  targetUrl: z.string().trim().url().max(2000).optional().nullable(),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
}).refine((input) => Boolean(input.imageAr || input.imageFr || input.imageEn), {
  message: "At least one localized image is required.",
  path: ["imageEn"],
}).refine(
  (input) => {
    if (!input.startDate || !input.endDate) return true;
    return new Date(input.endDate).getTime() >= new Date(input.startDate).getTime();
  },
  {
    message: "End date must be greater than or equal to start date.",
    path: ["endDate"],
  },
);

const updateAdInputSchema = adInputSchema.extend({
  id: z.string().uuid(),
});

const announcementInputSchema = z.object({
  messageEn: z.string().trim().max(300).optional().nullable(),
  messageFr: z.string().trim().max(300).optional().nullable(),
  messageAr: z.string().trim().max(300).optional().nullable(),
  isActive: z.boolean().default(true),
  bgColor: z.string().trim().min(4).max(20).default("#deff9a"),
  textColor: z.string().trim().min(4).max(20).default("#000000"),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
}).refine((input) => Boolean(input.messageAr || input.messageFr || input.messageEn), {
  message: "At least one localized message is required.",
  path: ["messageEn"],
}).refine(
  (input) => {
    if (!input.startDate || !input.endDate) return true;
    return new Date(input.endDate).getTime() >= new Date(input.startDate).getTime();
  },
  {
    message: "End date must be greater than or equal to start date.",
    path: ["endDate"],
  },
);

const updateAnnouncementInputSchema = announcementInputSchema.extend({
  id: z.string().uuid(),
});

const idInputSchema = z.object({
  id: z.string().uuid(),
});

export const listSiteAds = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("site_ads")
    .select(
      "id, campaign_name, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => adInputSchema.parse(input))
  .handler(async ({ data }) => {
    const imageAr = normalizeOptionalText(data.imageAr);
    const imageFr = normalizeOptionalText(data.imageFr);
    const imageEn = normalizeOptionalText(data.imageEn);

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .insert({
        campaign_name: data.campaignName.trim(),
        image_ar: imageAr,
        image_fr: imageFr,
        image_en: imageEn,
        image_url: imageEn ?? imageFr ?? imageAr,
        target_url: normalizeOptionalText(data.targetUrl),
        link_url: normalizeOptionalText(data.targetUrl),
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
        is_active: data.isActive,
      })
      .select("id, campaign_name, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create ad.");
    return inserted;
  });

export const updateSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const imageAr = normalizeOptionalText(data.imageAr);
    const imageFr = normalizeOptionalText(data.imageFr);
    const imageEn = normalizeOptionalText(data.imageEn);

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .update({
        campaign_name: data.campaignName.trim(),
        image_ar: imageAr,
        image_fr: imageFr,
        image_en: imageEn,
        image_url: imageEn ?? imageFr ?? imageAr,
        target_url: normalizeOptionalText(data.targetUrl),
        link_url: normalizeOptionalText(data.targetUrl),
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .select("id, campaign_name, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Failed to update ad.");
    return updated;
  });

export const deleteSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("site_ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("announcements")
    .select(
      "id, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => announcementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const messageEn = normalizeOptionalText(data.messageEn);
    const messageFr = normalizeOptionalText(data.messageFr);
    const messageAr = normalizeOptionalText(data.messageAr);

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("announcements")
      .insert({
        message_en: messageEn,
        message_fr: messageFr,
        message_ar: messageAr,
        content: messageEn ?? messageFr ?? messageAr ?? "",
        content_fr: messageFr,
        content_ar: messageAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
      })
      .select("id, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create announcement.");
    return inserted;
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAnnouncementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const messageEn = normalizeOptionalText(data.messageEn);
    const messageFr = normalizeOptionalText(data.messageFr);
    const messageAr = normalizeOptionalText(data.messageAr);

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("announcements")
      .update({
        message_en: messageEn,
        message_fr: messageFr,
        message_ar: messageAr,
        content: messageEn ?? messageFr ?? messageAr ?? "",
        content_fr: messageFr,
        content_ar: messageAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
      })
      .eq("id", data.id)
      .select("id, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Failed to update announcement.");
    return updated;
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getActiveAdsAndAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const [adsResponse, announcementsResponse] = await Promise.all([
    (supabaseAdmin as any)
      .from("site_ads")
      .select(
        "id, image_ar, image_fr, image_en, image_url, target_url, link_url, campaign_name, start_date, end_date, is_active, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any)
      .from("announcements")
      .select(
        "id, message_en, message_fr, message_ar, content, content_fr, content_ar, bg_color, text_color, start_date, end_date, is_active, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (adsResponse.error) throw new Error(adsResponse.error.message);
  if (announcementsResponse.error) throw new Error(announcementsResponse.error.message);

  const nowMs = Date.now();
  const isWithinSchedule = (startDate?: string | null, endDate?: string | null) => {
    const startMs = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const endMs = endDate ? new Date(endDate).getTime() : Number.POSITIVE_INFINITY;
    return nowMs >= startMs && nowMs <= endMs;
  };

  const ads = (adsResponse.data ?? [])
    .filter((ad: any) => isWithinSchedule(ad.start_date, ad.end_date))
    .map((ad: any) => ({
      id: ad.id,
      campaign_name: ad.campaign_name,
      image_ar: ad.image_ar,
      image_fr: ad.image_fr,
      image_en: ad.image_en,
      image_url: ad.image_en ?? ad.image_fr ?? ad.image_ar ?? ad.image_url,
      target_url: ad.target_url ?? ad.link_url,
      start_date: ad.start_date,
      end_date: ad.end_date,
    }));

  const announcements = (announcementsResponse.data ?? [])
    .filter((announcement: any) => isWithinSchedule(announcement.start_date, announcement.end_date))
    .map((announcement: any) => ({
      id: announcement.id,
      message_en: announcement.message_en ?? announcement.content,
      message_fr: announcement.message_fr ?? announcement.content_fr ?? announcement.content,
      message_ar: announcement.message_ar ?? announcement.content_ar ?? announcement.content,
      content: announcement.message_en ?? announcement.content,
      content_fr: announcement.message_fr ?? announcement.content_fr ?? announcement.content,
      content_ar: announcement.message_ar ?? announcement.content_ar ?? announcement.content,
      bg_color: announcement.bg_color,
      text_color: announcement.text_color,
      start_date: announcement.start_date,
      end_date: announcement.end_date,
    }));

  return {
    ads,
    announcements,
  };
});