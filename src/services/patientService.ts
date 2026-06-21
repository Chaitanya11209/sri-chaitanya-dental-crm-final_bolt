import { supabase } from '../supabaseClient';

// GET ALL PATIENTS

export const getPatients = async () => {

  const { data, error } =
    await supabase
      .from('patients')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

  if (error) {
    throw error;
  }

  return data;
};

// GET SINGLE PATIENT

export const getPatientById =
  async (patientId: number) => {

    const { data, error } =
      await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

    if (error) {
      throw error;
    }

    return data;
  };

// GET PATIENT APPOINTMENTS

export const getPatientAppointments =
  async (patientId: number) => {

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .neq('status', 'Deleted')
        .order('created_at', {
          ascending: false,
        });

    if (error) {
      throw error;
    }

    return data;
  };

// GET LAST VISIT

export const getLastVisit =
  async (patientId: number) => {

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'Completed')
        .order('next_visit', {
          ascending: false,
        })
        .limit(1)
        .single();

    if (error) {

      return null;
    }

    return data;
  };

// GET UPCOMING VISIT

export const getUpcomingVisit =
  async (patientId: number) => {

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .gte('next_visit', today)
        .neq('status', 'Cancelled')
        .neq('status', 'Deleted')
        .order('next_visit', {
          ascending: true,
        })
        .limit(1)
        .single();

    if (error) {

      return null;
    }

    return data;
  };

// GET TOTAL VISITS

export const getVisitCount =
  async (patientId: number) => {

    const { count, error } =
      await supabase
        .from('appointments')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('patient_id', patientId)
        .neq('status', 'Deleted');

    if (error) {

      return 0;
    }

    return count || 0;
  };

// SEARCH PATIENTS

export const searchPatients =
  async (searchTerm: string) => {

    const { data, error } =
      await supabase
        .from('patients')
        .select('*')
        .or(`name.ilike.*${searchTerm}*,phone.ilike.*${searchTerm}*,location.ilike.*${searchTerm}*`)
        .order('created_at', {
          ascending: false,
        });

    if (error) {
      throw error;
    }

    return data;
  };