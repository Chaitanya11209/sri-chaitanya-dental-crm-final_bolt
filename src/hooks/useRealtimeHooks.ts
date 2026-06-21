import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom Hook for Patients Realtime Synchronization
 * Database → Query → Hook → Component → UI
 */
export function usePatientsRealtime() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      console.info("[Database → Query → Hook] [Patients] Starting fetch from Supabase 'patients' table.");
      const { data, error: dbError } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      setPatients(data || []);
      setError(null);
      console.info(`[Database → Query → Hook → Component → UI] [Patients] Hook state updated successfully with ${data?.length || 0} records.`);
    } catch (err: any) {
      console.error("[Database → Query → Hook] [Patients] Fetch failed:", err);
      setError(err.message || 'Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();

    console.info("[Realtime Subscription] [Patients] Subscribing to postgres changes channel ('patients-realtime-hook').");
    const channel = supabase
      .channel('patients-realtime-hook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients' },
        (payload) => {
          console.info(`[Realtime Triggered] [Patients] Change registered in table 'patients'. Event: ${payload.eventType}. Initiating refetch...`, payload);
          fetchPatients();
        }
      )
      .subscribe((status) => {
        console.info(`[Realtime Subscription Status] [Patients] Channel state: ${status}`);
      });

    const handleForceSync = () => {
      console.info("[Global Force Sync] [Patients] Reacting to crm-force-sync event.");
      fetchPatients();
    };
    window.addEventListener('crm-force-sync', handleForceSync);

    return () => {
      console.info("[Realtime Subscription Cleanup] [Patients] Removing subscription channel.");
      supabase.removeChannel(channel);
      window.removeEventListener('crm-force-sync', handleForceSync);
    };
  }, [fetchPatients]);

  return { patients, loading, error, refetch: fetchPatients };
}

/**
 * Custom Hook for Appointments Realtime Synchronization
 * Database → Query → Hook → Component → UI
 */
export function useAppointmentsRealtime() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      console.info("[Database → Query → Hook] [Appointments] Starting fetch from Supabase 'appointments' table.");
      const { data, error: dbError } = await supabase
        .from('appointments')
        .select('*')
        .neq('status', 'Deleted')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      setAppointments(data || []);
      setError(null);
      console.info(`[Database → Query → Hook → Component → UI] [Appointments] Hook state updated successfully with ${data?.length || 0} records.`);
    } catch (err: any) {
      console.error("[Database → Query → Hook] [Appointments] Fetch failed:", err);
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();

    console.info("[Realtime Subscription] [Appointments] Subscribing to postgres changes channel ('appointments-realtime-hook').");
    const channel = supabase
      .channel('appointments-realtime-hook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.info(`[Realtime Triggered] [Appointments] Change registered in table 'appointments'. Event: ${payload.eventType}. Initiating refetch...`, payload);
          fetchAppointments();
        }
      )
      .subscribe((status) => {
        console.info(`[Realtime Subscription Status] [Appointments] Channel state: ${status}`);
      });

    const handleForceSync = () => {
      console.info("[Global Force Sync] [Appointments] Reacting to crm-force-sync event.");
      fetchAppointments();
    };
    window.addEventListener('crm-force-sync', handleForceSync);

    return () => {
      console.info("[Realtime Subscription Cleanup] [Appointments] Removing subscription channel.");
      supabase.removeChannel(channel);
      window.removeEventListener('crm-force-sync', handleForceSync);
    };
  }, [fetchAppointments]);

  return { appointments, loading, error, refetch: fetchAppointments };
}

/**
 * Custom Hook for Billing Realtime Synchronization
 * Database → Query → Hook → Component → UI
 */
export function useBillingRealtime() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      console.info("[Database → Query → Hook] [Billing] Starting fetch from Supabase 'appointments' table for billing/payments dataset.");
      const { data, error: dbError } = await supabase
        .from('appointments')
        .select('*')
        .neq('status', 'Deleted')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      setAppointments(data || []);
      setError(null);
      console.info(`[Database → Query → Hook → Component → UI] [Billing] Hook state updated successfully with ${data?.length || 0} records.`);
    } catch (err: any) {
      console.error("[Database → Query → Hook] [Billing] Fetch failed:", err);
      setError(err.message || 'Failed to fetch billing billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();

    console.info("[Realtime Subscription] [Billing] Subscribing to postgres changes channel ('billing-realtime-hook').");
    const channel = supabase
      .channel('billing-realtime-hook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.info(`[Realtime Triggered] [Billing] Change registered in table 'appointments' for billing data. Event: ${payload.eventType}. Initiating refetch...`, payload);
          fetchBilling();
        }
      )
      .subscribe((status) => {
        console.info(`[Realtime Subscription Status] [Billing] Channel state: ${status}`);
      });

    const handleForceSync = () => {
      console.info("[Global Force Sync] [Billing] Reacting to crm-force-sync event.");
      fetchBilling();
    };
    window.addEventListener('crm-force-sync', handleForceSync);

    return () => {
      console.info("[Realtime Subscription Cleanup] [Billing] Removing subscription channel.");
      supabase.removeChannel(channel);
      window.removeEventListener('crm-force-sync', handleForceSync);
    };
  }, [fetchBilling]);

  return { appointments, loading, error, refetch: fetchBilling };
}

/**
 * Custom Hook for Treatments Realtime Synchronization
 * Database → Query → Hook → Component → UI
 */
export function useTreatmentsRealtime() {
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTreatments = useCallback(async () => {
    try {
      console.info("[Database → Query → Hook] [Treatments] Starting fetch from Supabase 'treatments' table.");
      const { data, error: dbError } = await supabase
        .from('treatments')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      setTreatments(data || []);
      setError(null);
      console.info(`[Database → Query → Hook → Component → UI] [Treatments] Hook state updated successfully with ${data?.length || 0} records.`);
    } catch (err: any) {
      console.error("[Database → Query → Hook] [Treatments] Fetch failed:", err);
      setError(err.message || 'Failed to fetch treatments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTreatments();

    console.info("[Realtime Subscription] [Treatments] Subscribing to postgres changes channel ('treatments-realtime-hook').");
    const channel = supabase
      .channel('treatments-realtime-hook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treatments' },
        (payload) => {
          console.info(`[Realtime Triggered] [Treatments] Change registered in table 'treatments'. Event: ${payload.eventType}. Initiating refetch...`, payload);
          fetchTreatments();
        }
      )
      .subscribe((status) => {
        console.info(`[Realtime Subscription Status] [Treatments] Channel state: ${status}`);
      });

    const handleForceSync = () => {
      console.info("[Global Force Sync] [Treatments] Reacting to crm-force-sync event.");
      fetchTreatments();
    };
    window.addEventListener('crm-force-sync', handleForceSync);

    return () => {
      console.info("[Realtime Subscription Cleanup] [Treatments] Removing subscription channel.");
      supabase.removeChannel(channel);
      window.removeEventListener('crm-force-sync', handleForceSync);
    };
  }, [fetchTreatments]);

  return { treatments, loading, error, refetch: fetchTreatments };
}
