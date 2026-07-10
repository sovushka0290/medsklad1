import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@offline_transactions_queue';

export interface OfflineTransaction {
  id: string;
  url: string;
  method: string;
  data: any;
  timestamp: number;
}

export const getOfflineQueue = async (): Promise<OfflineTransaction[]> => {
  try {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  } catch (e) {
    return [];
  }
};

export const enqueueTransaction = async (url: string, method: string, data: any) => {
  const queue = await getOfflineQueue();
  const newTx: OfflineTransaction = {
    id: Date.now().toString() + Math.random().toString(),
    url,
    method,
    data,
    timestamp: Date.now(),
  };
  queue.push(newTx);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const dequeueTransaction = async (id: string) => {
  const queue = await getOfflineQueue();
  const newQueue = queue.filter(tx => tx.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
