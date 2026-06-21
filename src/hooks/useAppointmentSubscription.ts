import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to subscribe to real-time INSERT and UPDATE events on the 'appointments' table.
 * Triggers the provided callback to update React state or re-fetch data.
 */
export function useAppointmentSubscription(onInsertOrUpdate: (payload: any) => void) {
  useEffect(() => {
    const channel = supabase
      .channel('use-appointment-subscription-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('[Realtime] Appointment INSERT detected:', payload);
          onInsertOrUpdate(payload);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('[Realtime] Appointment UPDATE detected:', payload);
          onInsertOrUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onInsertOrUpdate]);
}

/**
 * Broadcasts a custom queue change event to all authenticated clinic staff.
 */
export const broadcastQueueChange = (event: 'new-patient' | 'status-ready', name: string) => {
  const channel = supabase.channel('clinic-staff-queue-alerts');
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'alert',
        payload: { event, name, message: event === 'new-patient' 
          ? `New patient ${name} has joined the waiting queue!` 
          : `Patient ${name}'s appointment is now Ready!` }
      }).then(() => {
        // Clean up
        setTimeout(() => supabase.removeChannel(channel), 1000);
      });
    }
  });
};
