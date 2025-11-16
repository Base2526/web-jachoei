// graphql/subscriptions/time.ts
import { withFilter } from 'graphql-subscriptions';
// import { pubsub } from '@/realtime/pubsub';

import { pubsub } from '@/lib/pubsub';

export const timeSubscription = {
  time: {
    // ต้อง return AsyncIterator เท่านั้น
    subscribe: withFilter(
      () => {
        console.log('[Subscription.time] subscribe called');
        return pubsub.asyncIterator('TIME_TICK');
      },
      (payload, variables) => {
        console.log('[Subscription.time.filter] payload =', payload);
        // ตอนแรกให้ผ่านทุกเคสไปก่อน
        return true;
      }
    ),
    // payload ที่ publish มา → map เป็น field time
    resolve: (payload: any) => {
      console.log('[Subscription.time.resolve] payload =', payload);
      // เช่น publish แบบ { time: '2025-11-15T...' }
      return payload.time;
    },
  },
};
