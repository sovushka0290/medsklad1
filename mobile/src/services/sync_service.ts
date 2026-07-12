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

    for (const tx of queue) {
      try {
        // Send request with X-Sync-Retry header to bypass interceptor offline capture
        await api.request({
          url: tx.url,
          method: tx.method,
          data: tx.data,
          headers: {
            'X-Sync-Retry': 'true',
          },
          // Add custom attribute to skip showing alerts for each synced transaction
          ...({ skipErrorAlerts: true } as any),
        });

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
