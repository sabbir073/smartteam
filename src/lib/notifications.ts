import { supabase } from "./db";
import { NOTIFICATION_TYPES } from "./constants";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Create a notification for a specific user
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

/**
 * Create notifications for multiple users
 */
export async function createNotifications(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const notifications = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      data: data || {},
    }));

    await supabase.from("notifications").insert(notifications);
  } catch (error) {
    console.error("Failed to create notifications:", error);
  }
}

// ============================================================
// Notification Helper Functions (Hardcoded Triggers)
// ============================================================

export async function notifyOrderCreated(
  assignedTo: string | null,
  teamLeaderId: string | null,
  orderNumber: string,
  orderId: string
): Promise<void> {
  const recipients = [assignedTo, teamLeaderId].filter(Boolean) as string[];
  await createNotifications(
    recipients,
    NOTIFICATION_TYPES.ORDER_CREATED,
    "New Order Created",
    `Order ${orderNumber} has been created.`,
    { orderId, orderNumber }
  );
}

export async function notifyOrderAssigned(
  assignedTo: string,
  orderNumber: string,
  orderId: string
): Promise<void> {
  await createNotification({
    userId: assignedTo,
    type: NOTIFICATION_TYPES.ORDER_ASSIGNED,
    title: "Order Assigned",
    message: `Order ${orderNumber} has been assigned to you.`,
    data: { orderId, orderNumber },
  });
}

export async function notifyOrderStatusChanged(
  recipientIds: string[],
  orderNumber: string,
  orderId: string,
  newStatus: string
): Promise<void> {
  await createNotifications(
    recipientIds,
    NOTIFICATION_TYPES.ORDER_STATUS_CHANGED,
    "Order Status Updated",
    `Order ${orderNumber} status changed to ${newStatus}.`,
    { orderId, orderNumber, newStatus }
  );
}

export async function notifyTargetSet(
  userId: string,
  targetAmount: number,
  periodType: string
): Promise<void> {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TARGET_SET,
    title: "New Target Set",
    message: `A ${periodType} target of $${targetAmount.toLocaleString()} has been set for you.`,
    data: { targetAmount, periodType },
  });
}

export async function notifyRequisitionSubmitted(
  reviewerIds: string[],
  requesterName: string,
  itemDescription: string,
  requisitionId: string
): Promise<void> {
  await createNotifications(
    reviewerIds,
    NOTIFICATION_TYPES.REQUISITION_SUBMITTED,
    "New Tech Requisition",
    `${requesterName} requested: ${itemDescription}`,
    { requisitionId },
  );
}

export async function notifyRequisitionReviewed(
  requesterId: string,
  status: "approved" | "rejected",
  itemDescription: string,
  requisitionId: string
): Promise<void> {
  await createNotification({
    userId: requesterId,
    type: NOTIFICATION_TYPES.REQUISITION_REVIEWED,
    title: `Requisition ${status === "approved" ? "Approved" : "Rejected"}`,
    message: `Your requisition for "${itemDescription}" has been ${status}.`,
    data: { requisitionId, status },
  });
}

export async function notifyUserCreated(
  userId: string,
  userName: string
): Promise<void> {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.USER_CREATED,
    title: "Welcome to SmartTeam",
    message: `Welcome ${userName}! Your account has been created.`,
  });
}

export async function notifyRoleChanged(
  userId: string,
  newRoleName: string
): Promise<void> {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.ROLE_CHANGED,
    title: "Role Updated",
    message: `Your role has been changed to ${newRoleName}.`,
    data: { newRoleName },
  });
}
