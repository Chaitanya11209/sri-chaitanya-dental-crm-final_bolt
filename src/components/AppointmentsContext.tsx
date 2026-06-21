import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useNotification } from './NotificationProvider';
import { startGlobalSync, stopGlobalSync } from '../lib/syncState';
import { broadcastQueueChange } from '../hooks/useAppointmentSubscription';

export interface Appointment {
  id: number;
  name: string;
  phone: string;
  email: string;
  location: string;
  treatment: string;
  next_visit: string;
  appointment_time: string;
  patient_id?: number | null;
  status: string;
  visit_count: number;
  amount_paid: number;
  balance_amount: number;
  notes?: string;
  doctor_id?: number | string | null;
  doctor_name?: string | null;
  created_at?: string;
}

interface AppointmentsContextProps {
  todayAppointments: Appointment[];
  loading: boolean;
  error: string | null;
  todayTotal: number;
  todayPending: number;
  todayCompleted: number;
  updateAppointmentStatus: (id: number, status: string) => Promise<void>;
  refreshAppointments: () => Promise<void>;
}

const AppointmentsContext = createContext<AppointmentsContextProps | undefined>(undefined);

export const getLocalTodayDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AppointmentsProvider({ children }: { children: ReactNode }) {
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useNotification();

  const fetchTodayAppointments = async (showIndicator = false) => {
    if (showIndicator) {
      startGlobalSync();
    }
    try {
      const today = getLocalTodayDateString();
      console.info(`[AppointmentsContext] [DEBUG] Fetching today's appointments. User local time: ${new Date().toString()}, today (local date string): ${today}`);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('next_visit', today)
        .neq('status', 'Deleted');

      if (error) throw error;

      console.info(`[AppointmentsContext] [DEBUG] Successfully fetched ${data?.length || 0} today's appointments from table 'appointments' for date ${today}:`, data);

      // Sort chronological by appointment_time sequence
      const sorted = (data || []).sort((a: Appointment, b: Appointment) => {
        const timeA = a.appointment_time || '';
        const timeB = b.appointment_time || '';
        return timeA.localeCompare(timeB);
      });

      setTodayAppointments(sorted);
      setError(null);
    } catch (err: any) {
      console.error('[AppointmentsContext] [DEBUG] [ERROR] fetching today\'s appointments:', err);
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
      if (showIndicator) {
        stopGlobalSync();
      }
    }
  };

  const updateAppointmentStatus = async (id: number, status: string) => {
    // Keep backup for optimistic rollback
    const previousAppointments = [...todayAppointments];

    // Optimistic Update: Immediately reflect status in state
    setTodayAppointments((prev) =>
      prev.map((appt) => (appt.id === id ? { ...appt, status } : appt))
    );

    startGlobalSync();
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      notify('success', 'Workflow Status Updated', `Appointment status updated to "${status}".`);

      // Broadcast if status matches Ready
      if (status === 'Ready') {
        const targetAppt = previousAppointments.find((a) => a.id === id);
        const nameOfPatient = targetAppt?.name || 'Patient';
        broadcastQueueChange('status-ready', nameOfPatient);
      }

      await fetchTodayAppointments(false);
    } catch (err: any) {
      console.error('[AppointmentsContext] Error updating status:', err);
      notify('error', 'Status Change Failed', err.message || 'Could not update status');
      // Rollback to previous state
      setTodayAppointments(previousAppointments);
    } finally {
      stopGlobalSync();
    }
  };

  useEffect(() => {
    fetchTodayAppointments(true);

    // Set up active postgres changes listener so it syncs between Admin and Staff automatically
    const channel = supabase
      .channel('appointments-context-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetchTodayAppointments(true);
        }
      )
      .subscribe();

    // Listen to global force-sync
    const handleForceSync = () => {
      console.info("[AppointmentsContext] Force sync triggered. Refreshing today's appointments.");
      fetchTodayAppointments(true);
    };
    window.addEventListener('crm-force-sync', handleForceSync);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('crm-force-sync', handleForceSync);
    };
  }, []);

  // Compute stats on-the-fly from the single source of truth todayAppointments list
  const todayTotal = todayAppointments.filter(
    (a) => a.status !== 'Cancelled' && a.status !== 'Deleted'
  ).length;

  const todayPending = todayAppointments.filter(
    (a) => a.status === 'Pending'
  ).length;

  const todayCompleted = todayAppointments.filter(
    (a) => a.status === 'Completed'
  ).length;

  return (
    <AppointmentsContext.Provider
      value={{
        todayAppointments,
        loading,
        error,
        todayTotal,
        todayPending,
        todayCompleted,
        updateAppointmentStatus,
        refreshAppointments: () => fetchTodayAppointments(true),
      }}
    >
      {children}
    </AppointmentsContext.Provider>
  );
}

export function useAppointments() {
  const context = useContext(AppointmentsContext);
  if (context === undefined) {
    throw new Error('useAppointments must be used within an AppointmentsProvider');
  }
  return context;
}
