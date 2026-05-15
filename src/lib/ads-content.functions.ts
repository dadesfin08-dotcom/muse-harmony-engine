import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const normalizeOptionalText = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeOptionalStringArray = (values?: Array<string | null | undefined> | null) => {
  if (!values) return [] as string[];
  return values.map((value) => value?.trim() ?? "").filter((value) => value.length > 0);
};

const parseOptionalDateTime = (value?: string | null) => {
  if (!value || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid datetime value.");
  }
  return date.toISOString();
};

const adBaseSchema = z.object({
  campaignName: z.string().trim().min(1).max(120),
  targetZoneIds: z.array(z.string().uuid()).max(300).optional().nullable(),
  campaignType: z.enum(["AD", "PROMO", "NEWS"]).default("AD"),
  imageAr: z.string().trim().url().max(2000).optional().nullable(),
  imageFr: z.string().trim().url().max(2000).optional().nullable(),
  imageEn: z.string().trim().url().max(2000).optional().nullable(),
  targetUrl: z.string().trim().url().max(2000).optional().nullable(),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
});

const adInputSchema = adBaseSchema.refine((input) => Boolean(input.imageAr || input.imageFr || input.imageEn), {
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

const updateAdInputSchema = adBaseSchema.extend({
  id: z.string().uuid(),
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

const announcementMessageSchema = z.string().trim().min(1).max(300);

const announcementBaseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  messagesEn: z.array(announcementMessageSchema).max(30).default([]),
  messagesFr: z.array(announcementMessageSchema).max(30).default([]),
  messagesAr: z.array(announcementMessageSchema).max(30).default([]),
  isActive: z.boolean().default(true),
  bgColor: z.string().trim().min(4).max(20).default("#deff9a"),
  textColor: z.string().trim().min(4).max(20).default("#000000"),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
});

const announcementInputSchema = announcementBaseSchema.refine(
  (input) => input.messagesAr.length > 0 || input.messagesFr.length > 0 || input.messagesEn.length > 0,
  {
    message: "At least one localized message is required.",
    path: ["messagesEn"],
  },
).refine(
  (input) => {
    if (!input.startDate || !input.endDate) return true;
    return new Date(input.endDate).getTime() >= new Date(input.startDate).getTime();
  },
  {
    message: "End date must be greater than or equal to start date.",
    path: ["endDate"],
  },
);

const updateAnnouncementInputSchema = announcementBaseSchema.extend({
  id: z.string().uuid(),
}).refine(
  (input) => input.messagesAr.length > 0 || input.messagesFr.length > 0 || input.messagesEn.length > 0,
  {
    message: "At least one localized message is required.",
    path: ["messagesEn"],
  },
).refine(
  (input) => {
    if (!input.startDate || !input.endDate) return true;
    return new Date(input.endDate).getTime() >= new Date(input.startDate).getTime();
  },
  {
    message: "End date must be greater than or equal to start date.",
    path: ["endDate"],
  },
);

const idInputSchema = z.object({
  id: z.string().uuid(),
});

const activeAdsFilterSchema = z.object({
  zoneId: z.string().uuid().optional().nullable(),
  campaignType: z.enum(["AD", "PROMO", "NEWS"]).optional().nullable(),
});

const normalizeTargetZoneIds = (ids?: string[] | null) => {
  if (!ids || ids.length === 0) return null;
  const unique = Array.from(new Set(ids.map((value) => value.trim()).filter((value) => value.length > 0)));
  return unique.length > 0 ? unique : null;
};

export const listSiteAds = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("site_ads")
    .select(
      "id, campaign_name, target_zone_ids, campaign_type, views_count, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => adInputSchema.parse(input))
  .handler(async ({ data }) => {
    const campaignName = data.campaignName.trim();
    const imageAr = normalizeOptionalText(data.imageAr);
    const imageFr = normalizeOptionalText(data.imageFr);
    const imageEn = normalizeOptionalText(data.imageEn);

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .insert({
        campaign_name: campaignName,
        content: campaignName,
        target_zone_ids: normalizeTargetZoneIds(data.targetZoneIds),
        campaign_type: data.campaignType,
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
      .select("id, campaign_name, target_zone_ids, campaign_type, views_count, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create ad.");
    return inserted;
  });

export const updateSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const campaignName = data.campaignName.trim();
    const imageAr = normalizeOptionalText(data.imageAr);
    const imageFr = normalizeOptionalText(data.imageFr);
    const imageEn = normalizeOptionalText(data.imageEn);

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .update({
        campaign_name: campaignName,
        content: campaignName,
        target_zone_ids: normalizeTargetZoneIds(data.targetZoneIds),
        campaign_type: data.campaignType,
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
      .select("id, campaign_name, target_zone_ids, campaign_type, views_count, image_ar, image_fr, image_en, target_url, start_date, end_date, is_active, created_at")
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
      "id, title, messages_en, messages_fr, messages_ar, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => announcementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const messagesEn = normalizeOptionalStringArray(data.messagesEn);
    const messagesFr = normalizeOptionalStringArray(data.messagesFr);
    const messagesAr = normalizeOptionalStringArray(data.messagesAr);

    const firstMessageEn = messagesEn[0] ?? null;
    const firstMessageFr = messagesFr[0] ?? null;
    const firstMessageAr = messagesAr[0] ?? null;

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("announcements")
      .insert({
        title: data.title.trim(),
        messages_en: messagesEn,
        messages_fr: messagesFr,
        messages_ar: messagesAr,
        message_en: firstMessageEn,
        message_fr: firstMessageFr,
        message_ar: firstMessageAr,
        content: firstMessageEn ?? firstMessageFr ?? firstMessageAr ?? "",
        content_fr: firstMessageFr,
        content_ar: firstMessageAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
      })
      .select("id, title, messages_en, messages_fr, messages_ar, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create announcement.");
    return inserted;
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAnnouncementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const messagesEn = normalizeOptionalStringArray(data.messagesEn);
    const messagesFr = normalizeOptionalStringArray(data.messagesFr);
    const messagesAr = normalizeOptionalStringArray(data.messagesAr);

    const firstMessageEn = messagesEn[0] ?? null;
    const firstMessageFr = messagesFr[0] ?? null;
    const firstMessageAr = messagesAr[0] ?? null;

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("announcements")
      .update({
        title: data.title.trim(),
        messages_en: messagesEn,
        messages_fr: messagesFr,
        messages_ar: messagesAr,
        message_en: firstMessageEn,
        message_fr: firstMessageFr,
        message_ar: firstMessageAr,
        content: firstMessageEn ?? firstMessageFr ?? firstMessageAr ?? "",
        content_fr: firstMessageFr,
        content_ar: firstMessageAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
        start_date: parseOptionalDateTime(data.startDate),
        end_date: parseOptionalDateTime(data.endDate),
      })
      .eq("id", data.id)
      .select("id, title, messages_en, messages_fr, messages_ar, message_en, message_fr, message_ar, bg_color, text_color, start_date, end_date, is_active, created_at")
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

export const getActiveAdsAndAnnouncements = createServerFn({ method: "GET" })
  .inputValidator((input) => activeAdsFilterSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
  const [adsResponse, announcementsResponse] = await Promise.all([
    (supabaseAdmin as any)
      .from("site_ads")
      .select(
        "id, image_ar, image_fr, image_en, image_url, target_url, link_url, campaign_name, campaign_type, zone_id, views_count, start_date, end_date, is_active, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any)
      .from("announcements")
      .select(
        "id, title, messages_en, messages_fr, messages_ar, message_en, message_fr, message_ar, content, content_fr, content_ar, bg_color, text_color, start_date, end_date, is_active, created_at",
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
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
    return nowMs >= startMs && nowMs <= endMs;
  };

  const normalizedZoneId = data.zoneId ?? null;
  const normalizedCampaignType = data.campaignType ?? null;

  const ads = (adsResponse.data ?? [])
    .filter((ad: any) => isWithinSchedule(ad.start_date, ad.end_date))
    .filter((ad: any) => normalizedZoneId === null || ad.zone_id === null || ad.zone_id === normalizedZoneId)
    .filter((ad: any) => normalizedCampaignType === null || ad.campaign_type === normalizedCampaignType)
    .map((ad: any) => ({
      id: ad.id,
      campaign_name: ad.campaign_name,
      campaign_type: ad.campaign_type ?? "AD",
      zone_id: ad.zone_id ?? null,
      views_count: Number(ad.views_count ?? 0),
      image_ar: ad.image_ar,
      image_fr: ad.image_fr,
      image_en: ad.image_en,
      image_url: ad.image_en ?? ad.image_fr ?? ad.image_ar ?? ad.image_url,
      target_url: ad.target_url ?? ad.link_url,
      link_url: ad.target_url ?? ad.link_url,
      start_date: ad.start_date,
      end_date: ad.end_date,
    }));

  const announcements = (announcementsResponse.data ?? [])
    .filter((announcement: any) => isWithinSchedule(announcement.start_date, announcement.end_date))
    .map((announcement: any) => ({
      id: announcement.id,
      title: announcement.title ?? "",
      messages_en: normalizeOptionalStringArray(announcement.messages_en).length > 0
        ? normalizeOptionalStringArray(announcement.messages_en)
        : normalizeOptionalStringArray([announcement.message_en ?? announcement.content]),
      messages_fr: normalizeOptionalStringArray(announcement.messages_fr).length > 0
        ? normalizeOptionalStringArray(announcement.messages_fr)
        : normalizeOptionalStringArray([announcement.message_fr ?? announcement.content_fr]),
      messages_ar: normalizeOptionalStringArray(announcement.messages_ar).length > 0
        ? normalizeOptionalStringArray(announcement.messages_ar)
        : normalizeOptionalStringArray([announcement.message_ar ?? announcement.content_ar]),
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