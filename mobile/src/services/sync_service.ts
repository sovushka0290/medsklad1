import NetInfo from '@react-native-community/netinfo';
import { api } from './api_service';
import { getOfflineQueue, dequeueTransaction, OfflineTransaction } from './offline_queue';
import { Alert } from 'react-native';

let isSyncing = false;

export const syncOfflineTransactions = async () => {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[Sync] Starting sync of ${queue.length} offline transactions...`);

    const sessionIdMap: Record<string, number> = {};

    for (const tx of queue) {
      try {
        let payload = tx.data ? { ...tx.data, allowOverdraft: true } : tx.data;
        let cleanUrl = tx.url;

        // Replace any local session ID in URL with real server ID
        for (const [locId, realId] of Object.entries(sessionIdMap)) {
          if (cleanUrl.includes(locId)) {
            cleanUrl = cleanUrl.replace(locId, String(realId));
          }
          if (payload && typeof payload === 'object') {
            for (const key of Object.keys(payload)) {
              if (payload[key] === locId) {
                payload[key] = realId;
              }
            }
          }
        }

        // Clean localId from payload before sending to prevent server validation errors
        let localIdUsed = '';
        if (payload && payload.localId) {
          localIdUsed = payload.localId;
          const { localId, ...rest } = payload;
          payload = rest;
        }

        // Send request with X-Sync-Retry header to bypass interceptor offline capture
        const res = await api.request({
          url: cleanUrl,
          method: tx.method,
          data: payload,
          headers: {
            'X-Sync-Retry': 'true',
          },
          // Add custom attribute to skip showing alerts for each synced transaction
          ...({ skipErrorAlerts: true } as any),
        });

        // If it was inventory start and we had a localId, record the mapping
        if (localIdUsed && (cleanUrl.includes('/inventory/start') || (cleanUrl.includes('/inventory') && tx.method.toLowerCase() === 'post'))) {
          const realId = res.data?.data?.id || res.data?.id;
          if (realId) {
            sessionIdMap[localIdUsed] = realId;
            console.log(`[Sync] Mapped local session ${localIdUsed} to server session ${realId}`);
          }
        }

        // Dequeue upon successful sync
        await dequeueTransaction(tx.id);
        console.log(`[Sync] Transaction ${tx.id} synced successfully.`);
      } catch (err: any) {
        // If it's a validation/client error (e.g. 400 Bad Request), remove it from queue but notify the user
        if (err.response && err.response.status >= 400 && err.response.status < 500) {
          console.warn(`[Sync] Transaction ${tx.id} failed due to client error (${err.response.status}). Removing from queue.`);
          await dequeueTransaction(tx.id);
          
          const medName = tx.data?.medicationName || 'препарата';
          Alert.alert(
            'Ошибка синхронизации',
            `Сохраненная оффлайн-операция для ${medName} отклонена сервером: ${err.response?.data?.error || 'Неверные данные'}.`
          );
        } else {
          // Server error or network connection lost during sync, abort loop to retry later
          console.error(`[Sync] Temporary error during sync: ${err.message}. Aborting sync loop.`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('[Sync] Error during sync offline queue:', error);
  } finally {
    isSyncing = false;
  }
};

// Initialize connectivity listener to trigger sync automatically when online
export const initSyncScheduler = () => {
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      console.log('[Sync] Network connection is online. Triggering sync...');
      syncOfflineTransactions();
    }
  });
};
