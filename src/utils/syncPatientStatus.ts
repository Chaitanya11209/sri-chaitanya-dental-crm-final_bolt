import { supabase } from '../lib/supabase';

export async function syncPatientStatus(patientId: number | string | null | undefined) {
  if (!patientId) {
    console.warn('[Sync] Cannot sync patient status: patientId is null or empty');
    return;
  }

  try {
    const idNum = typeof patientId === 'string' ? parseInt(patientId, 10) : patientId;
    if (isNaN(idNum)) return;

    // Fetch all active appointments for this patient
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('status, treatment, next_visit')
      .eq('patient_id', idNum)
      .neq('status', 'Deleted');

    if (apptError) throw apptError;

    let newStatus = 'Registered';
    const activeAppts = appointments || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const hasPendingFollowup = activeAppts.some(a => 
      ['Confirmed', 'Pending', 'Reminder Sent'].includes(a.status || '') && 
      ((a.next_visit && a.next_visit < todayStr) ||
       a.treatment?.toLowerCase().includes('follow-up') || 
       a.treatment?.toLowerCase().includes('recall') || 
       a.treatment?.toLowerCase().includes('review'))
    );

    const hasAnyActiveAppt = activeAppts.some(a => 
      ['Confirmed', 'Pending', 'Reminder Sent', 'In Treatment'].includes(a.status || '')
    );

    const hasCompletedAppt = activeAppts.some(a => a.status === 'Completed');

    if (hasPendingFollowup) {
      newStatus = 'Follow-up Required';
    } else if (hasAnyActiveAppt) {
      newStatus = 'In Treatment';
    } else if (hasCompletedAppt) {
      newStatus = 'Completed';
    } else {
      newStatus = 'Registered';
    }

    console.info(`[Sync] Recalculating status for Patient ID ${idNum}: ${newStatus}`);

    const { error: updateError } = await supabase
      .from('patients')
      .update({ patient_status: newStatus })
      .eq('id', idNum);

    if (updateError) throw updateError;

    // Trigger a live re-render of components subscribing to database
    window.dispatchEvent(new CustomEvent('crm-force-sync'));
  } catch (err) {
    console.error('[Sync] Error syncing patient status:', err);
  }
}

export async function syncPatientStatusByAppointment(appointmentId: number | string | null | undefined) {
  if (!appointmentId) return;
  try {
    const apptId = typeof appointmentId === 'string' ? parseInt(appointmentId, 10) : appointmentId;
    if (isNaN(apptId)) return;

    const { data, error } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('id', apptId)
      .single();

    if (error) throw error;
    if (data?.patient_id) {
      await syncPatientStatus(data.patient_id);
    }
  } catch (err) {
    console.error('[Sync] Error syncing patient status by appointment:', err);
  }
}
