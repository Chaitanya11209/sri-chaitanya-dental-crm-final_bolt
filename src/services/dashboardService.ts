import { supabase } from '../supabaseClient';

export const getDashboardStats =
  async () => {

    try {

      // TOTAL PATIENTS

      const {
        count: totalPatients,
        error: patientsError,
      } = await supabase
        .from('patients')
        .select('*', {
          count: 'exact',
          head: true,
        });

      // TODAY DATE

      const today =
        new Date()
          .toISOString()
          .split('T')[0];

      // TODAY APPOINTMENTS

      const {
        count: todayAppointments,
      } = await supabase
        .from('appointments')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('next_visit', today);

      // RETURNING PATIENTS

      const {
        count: returningPatients,
      } = await supabase
        .from('appointments')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .gt('visit_count', 1);

      // PENDING FOLLOWUPS

      const {
        count: pendingFollowups,
      } = await supabase
        .from('appointments')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'Pending');

      return {

        totalPatients:
          totalPatients || 0,

        todayAppointments:
          todayAppointments || 0,

        returningPatients:
          returningPatients || 0,

        pendingFollowups:
          pendingFollowups || 0,
      };

    } catch (error) {

      console.error(
        'Dashboard Error:',
        error
      );

      return {

        totalPatients: 0,

        todayAppointments: 0,

        returningPatients: 0,

        pendingFollowups: 0,
      };
    }
  };