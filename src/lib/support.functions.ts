import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUser } from "@/lib/push-notifications.server";

const supportCategorySchema = z.enum([
  "order_problem",
  "payment_problem",
  "delivery_delay",
  "product_quality",
  "refund_request",
  "technical_issue",
  "other",
]);

const supportStatusSchema = z.enum(["open", "resolved", "closed", "archived"]);

const phoneSchema = z.string().trim().regex(/^\+212[0-9]{9}$/);

const imageDataUrlSchema = z
  .string()
  .trim()
  .max(12_000_000)
  .refine((value) => value.startsWith("data:image/"), "Image must be a data URL")
  .nullable()
  .optional();

const createTicketInputSchema = z.object({
  phoneNumber: phoneSchema,
  subject: z.string().trim().min(3).max(180),
  category: supportCategorySchema,
  message: z.string().trim().min(3).max(3000),
  imageDataUrl: imageDataUrlSchema,
  orderId: z.string().uuid().nullable().optional(),
});

const customerTicketListInputSchema = z.object({
  phoneNumber: phoneSchema,
});

const customerTicketMessagesInputSchema = z.object({
  phoneNumber: phoneSchema,
  ticketId: z.string().uuid(),
});

const sendCustomerMessageInputSchema = z.object({
  phoneNumber: phoneSchema,
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1).max(3000),
  imageDataUrl: imageDataUrlSchema,
});

const listAdminTicketsInputSchema = z.object({
  status: supportStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

const adminTicketMessagesInputSchema = z.object({
  ticketId: z.string().uuid(),
});

const sendAdminMessageInputSchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1).max(3000),
  imageDataUrl: imageDataUrlSchema,
});

const updateTicketStatusInputSchema = z.object({
  ticketId: z.string().uuid(),
  status: supportStatusSchema,
});

async function markCustomerMessagesDeliveredForSupport(ticketId?: string) {
  let query = (supabaseAdmin as any)
    .from("support_messages")
    .update({ delivered_at: new Date().toISOString() })
    .eq("sender_type", "user")
    .is("delivered_at", null);

  if (ticketId) {
    query = query.eq("ticket_id", ticketId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function markCustomerMessagesReadForSupport(ticketId: string) {
  const timestamp = new Date().toISOString();

  const { error } = await (supabaseAdmin as any)
    .from("support_messages")
    .update({
      delivered_at: timestamp,
      read_at: timestamp,
    })
    .eq("ticket_id", ticketId)
    .eq("sender_type", "user")
    .is("read_at", null);

  if (error) throw new Error(error.message);
}

async function resolveProfileByPhone(phoneNumber: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, full_name, display_name")
    .eq("phone", phoneNumber)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Customer session is invalid.");

  return {
    id: String(data.id),
    name: String(data.full_name ?? data.display_name ?? "Customer"),
  };
}

async function uploadSupportImage(dataUrl: string, filePrefix: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return null;

  const mimeMatch = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const extension = mimeType.includes("jpeg") ? "jpg" : mimeType.split("/")[1] ?? "png";
  const base64Payload = dataUrl.slice(commaIndex + 1);
  const bytes = Buffer.from(base64Payload, "base64");
  const path = `${filePrefix}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await (supabaseAdmin as any).storage
    .from("public-assets")
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = (supabaseAdmin as any).storage.from("public-assets").getPublicUrl(path);
  return publicUrlData.publicUrl;
}

async function notifyAdminsAboutCustomerTicket(subject: string, ticketId: string) {
  const { data, error } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (error) return;

  const adminIds = Array.from(
    new Set(((data ?? []) as Array<{ user_id: string | null }>).map((row) => row.user_id).filter(Boolean) as string[]),
  );

  await Promise.all(
    adminIds.map((adminId) =>
      sendPushToUser("customer", adminId, {
        role: "customer",
        title: "New support ticket",
        body: subject,
        url: "/admin?tab=support",
        tag: `support-ticket-${ticketId}`,
      }).catch(() => ({ sent: 0, skipped: true as const })),
    ),
  );
}

export const createSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input) => createTicketInputSchema.parse(input))
  .handler(async ({ data }) => {
    const profile = await resolveProfileByPhone(data.phoneNumber);
    const uploadedImageUrl = data.imageDataUrl
      ? await uploadSupportImage(data.imageDataUrl, `support/customer/${profile.id}`)
      : null;

    const { data: ticketRow, error: ticketError } = await (supabaseAdmin as any)
      .from("support_tickets")
      .insert({
        user_id: profile.id,
        subject: data.subject,
        category: data.category,
        message: data.message,
        image_url: uploadedImageUrl,
        status: "open",
        order_id: data.orderId ?? null,
      })
      .select("id, status, subject, category, message, image_url, created_at, updated_at, last_reply_at, last_sender_type")
      .single();

    if (ticketError) throw new Error(ticketError.message);

    const { error: messageError } = await (supabaseAdmin as any).from("support_messages").insert({
      ticket_id: ticketRow.id,
      sender_type: "user",
      sender_id: profile.id,
      message: data.message,
      image_url: uploadedImageUrl,
    });

    if (messageError) throw new Error(messageError.message);

    await notifyAdminsAboutCustomerTicket(data.subject, ticketRow.id);

    return {
      id: String(ticketRow.id),
      status: String(ticketRow.status),
      subject: String(ticketRow.subject),
      category: String(ticketRow.category),
      message: String(ticketRow.message),
      imageUrl: ticketRow.image_url ? String(ticketRow.image_url) : null,
      createdAt: String(ticketRow.created_at),
      updatedAt: String(ticketRow.updated_at),
      lastReplyAt: ticketRow.last_reply_at ? String(ticketRow.last_reply_at) : null,
      lastSenderType: ticketRow.last_sender_type ? String(ticketRow.last_sender_type) : null,
    };
  });

export const listCustomerSupportTickets = createServerFn({ method: "POST" })
  .inputValidator((input) => customerTicketListInputSchema.parse(input))
  .handler(async ({ data }) => {
    const profile = await resolveProfileByPhone(data.phoneNumber);

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, subject, category, message, image_url, status, created_at, updated_at, last_reply_at, last_sender_type, order_id")
      .eq("user_id", profile.id)
      .order("last_reply_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return ((rows ?? []) as Array<any>).map((row) => ({
      id: String(row.id),
      subject: String(row.subject),
      category: String(row.category),
      message: String(row.message),
      imageUrl: row.image_url ? String(row.image_url) : null,
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      lastReplyAt: row.last_reply_at ? String(row.last_reply_at) : null,
      lastSenderType: row.last_sender_type ? String(row.last_sender_type) : null,
      orderId: row.order_id ? String(row.order_id) : null,
    }));
  });

export const listCustomerSupportMessages = createServerFn({ method: "POST" })
  .inputValidator((input) => customerTicketMessagesInputSchema.parse(input))
  .handler(async ({ data }) => {
    const profile = await resolveProfileByPhone(data.phoneNumber);

    const { data: ticket, error: ticketError } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("id")
      .eq("id", data.ticketId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (ticketError) throw new Error(ticketError.message);
    if (!ticket?.id) throw new Error("Support ticket not found.");

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .select("id, ticket_id, sender_type, sender_id, message, image_url, created_at, delivered_at, read_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return ((rows ?? []) as Array<any>).map((row) => ({
      id: String(row.id),
      ticketId: String(row.ticket_id),
      senderType: String(row.sender_type),
      senderId: row.sender_id ? String(row.sender_id) : null,
      message: String(row.message),
      imageUrl: row.image_url ? String(row.image_url) : null,
      createdAt: String(row.created_at),
      deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
      readAt: row.read_at ? String(row.read_at) : null,
    }));
  });

export const sendCustomerSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => sendCustomerMessageInputSchema.parse(input))
  .handler(async ({ data }) => {
    const profile = await resolveProfileByPhone(data.phoneNumber);

    const { data: ticket, error: ticketError } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, subject")
      .eq("id", data.ticketId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (ticketError) throw new Error(ticketError.message);
    if (!ticket?.id) throw new Error("Support ticket not found.");

    const uploadedImageUrl = data.imageDataUrl
      ? await uploadSupportImage(data.imageDataUrl, `support/customer/${profile.id}`)
      : null;

    const { data: insertedRow, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .insert({
        ticket_id: data.ticketId,
        sender_type: "user",
        sender_id: profile.id,
        message: data.message,
        image_url: uploadedImageUrl,
      })
      .select("id, ticket_id, sender_type, sender_id, message, image_url, created_at, delivered_at, read_at")
      .single();

    if (error) throw new Error(error.message);

    await notifyAdminsAboutCustomerTicket(String(ticket.subject ?? "Support message"), data.ticketId);

    return {
      id: String(insertedRow.id),
      ticketId: String(insertedRow.ticket_id),
      senderType: String(insertedRow.sender_type),
      senderId: insertedRow.sender_id ? String(insertedRow.sender_id) : null,
      message: String(insertedRow.message),
      imageUrl: insertedRow.image_url ? String(insertedRow.image_url) : null,
      createdAt: String(insertedRow.created_at),
      deliveredAt: insertedRow.delivered_at ? String(insertedRow.delivered_at) : null,
      readAt: insertedRow.read_at ? String(insertedRow.read_at) : null,
    };
  });

export const listAdminSupportTickets = createServerFn({ method: "POST" })
  .inputValidator((input) => listAdminTicketsInputSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    await markCustomerMessagesDeliveredForSupport();

    let query = (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, user_id, subject, category, message, image_url, status, created_at, updated_at, last_reply_at, last_sender_type, order_id")
      .order("last_reply_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (data.status) {
      query = query.eq("status", data.status);
    }

    if (data.search) {
      query = query.or(`subject.ilike.%${data.search}%,message.ilike.%${data.search}%`);
    }

    const { data: tickets, error } = await query;
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set(((tickets ?? []) as Array<any>).map((row) => row.user_id).filter(Boolean) as string[]),
    );

    const { data: usersData, error: usersError } = userIds.length
      ? await (supabaseAdmin as any).from("profiles").select("id, full_name, display_name, phone").in("id", userIds)
      : { data: [], error: null };

    if (usersError) throw new Error(usersError.message);

    const userMap = new Map(
      ((usersData ?? []) as Array<any>).map((row) => [
        String(row.id),
        {
          fullName: String(row.full_name ?? row.display_name ?? "Customer"),
          phone: String(row.phone ?? ""),
        },
      ]),
    );

    const orderIds = Array.from(
      new Set(((tickets ?? []) as Array<any>).map((row) => row.order_id).filter(Boolean) as string[]),
    );

    const { data: orderRows, error: orderError } = orderIds.length
      ? await (supabaseAdmin as any)
          .from("orders")
          .select("id, status")
          .in("id", orderIds)
      : { data: [], error: null };

    if (orderError) throw new Error(orderError.message);

    const orderMap = new Map(
      ((orderRows ?? []) as Array<any>).map((row) => [
        String(row.id),
        {
          status: String(row.status ?? "pending"),
          pickupCode: `#${String(row.id).slice(-4).toUpperCase()}`,
        },
      ]),
    );

    return ((tickets ?? []) as Array<any>).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      userName: userMap.get(String(row.user_id))?.fullName ?? "Customer",
      userPhone: userMap.get(String(row.user_id))?.phone ?? "",
      subject: String(row.subject),
      category: String(row.category),
      message: String(row.message),
      imageUrl: row.image_url ? String(row.image_url) : null,
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      lastReplyAt: row.last_reply_at ? String(row.last_reply_at) : null,
      lastSenderType: row.last_sender_type ? String(row.last_sender_type) : null,
      orderId: row.order_id ? String(row.order_id) : null,
      orderStatus: row.order_id ? orderMap.get(String(row.order_id))?.status ?? null : null,
      pickupCode: row.order_id ? orderMap.get(String(row.order_id))?.pickupCode ?? null : null,
    }));
  });

export const listAdminSupportMessages = createServerFn({ method: "POST" })
  .inputValidator((input) => adminTicketMessagesInputSchema.parse(input))
  .handler(async ({ data }) => {
    await markCustomerMessagesReadForSupport(data.ticketId);

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .select("id, ticket_id, sender_type, sender_id, message, image_url, created_at, delivered_at, read_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return ((rows ?? []) as Array<any>).map((row) => ({
      id: String(row.id),
      ticketId: String(row.ticket_id),
      senderType: String(row.sender_type),
      senderId: row.sender_id ? String(row.sender_id) : null,
      message: String(row.message),
      imageUrl: row.image_url ? String(row.image_url) : null,
      createdAt: String(row.created_at),
      deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
      readAt: row.read_at ? String(row.read_at) : null,
    }));
  });

export const sendAdminSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => sendAdminMessageInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: ticket, error: ticketError } = await (supabaseAdmin as any)
      .from("support_tickets")
      .select("id, user_id")
      .eq("id", data.ticketId)
      .maybeSingle();

    if (ticketError) throw new Error(ticketError.message);
    if (!ticket?.id) throw new Error("Support ticket not found.");

    const uploadedImageUrl = data.imageDataUrl
      ? await uploadSupportImage(data.imageDataUrl, `support/admin/${data.ticketId}`)
      : null;

    const { data: insertedRow, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .insert({
        ticket_id: data.ticketId,
        sender_type: "admin",
        sender_id: null,
        message: data.message,
        image_url: uploadedImageUrl,
      })
      .select("id, ticket_id, sender_type, sender_id, message, image_url, created_at")
      .single();

    if (error) throw new Error(error.message);

    await sendPushToUser("customer", String(ticket.user_id), {
      role: "customer",
      title: "Support reply",
      body: data.message.slice(0, 120),
      url: "/customer",
      tag: `support-reply-${data.ticketId}`,
    }).catch(() => ({ sent: 0, skipped: true as const }));

    return {
      id: String(insertedRow.id),
      ticketId: String(insertedRow.ticket_id),
      senderType: String(insertedRow.sender_type),
      senderId: insertedRow.sender_id ? String(insertedRow.sender_id) : null,
      message: String(insertedRow.message),
      imageUrl: insertedRow.image_url ? String(insertedRow.image_url) : null,
      createdAt: String(insertedRow.created_at),
    };
  });

export const updateSupportTicketStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updateTicketStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.ticketId)
      .select("id, status")
      .single();

    if (error) throw new Error(error.message);

    return {
      id: String(row.id),
      status: String(row.status),
    };
  });