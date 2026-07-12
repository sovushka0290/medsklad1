let ExpoClass: any;
let expoInstance: any;

const getExpo = async () => {
  if (!expoInstance) {
    const mod = await (new Function('return import("expo-server-sdk")')() as Promise<any>);
    ExpoClass = mod.Expo;
    expoInstance = new ExpoClass();
  }
  return { Expo: ExpoClass, expo: expoInstance };
};

export const sendPushNotification = async (
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
) => {
  const { Expo, expo } = await getExpo();

  // Create the messages that you want to send to clients
  const messages = [];
  for (const pushToken of pushTokens) {
    // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound: 'default' as const,
      title,
      body,
      data: data || {},
    });
  }

  // The Expo push notification service accepts batches of notifications so
  // that you don't need to send 1000 requests to send 1000 notifications. We
  // recommend you batch your notifications to reduce the number of requests
  // and to compress them (notifications with similar content will get
  // compressed).
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
      // NOTE: If a ticket contains an error code in ticket.details.error, you
      // must handle it appropriately. The error codes are listed in the Expo
      // documentation.
    } catch (error) {
      console.error(error);
    }
  }

  return tickets;
};
