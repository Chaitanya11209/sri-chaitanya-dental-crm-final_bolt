import { supabase } from '../supabaseClient';

// TODAY FOLLOWUPS

export const getTodayFollowups =
  async () => {

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .eq('next_visit', today)
        .neq('status', 'Completed')
        .neq('status', 'Cancelled')
        .neq('status', 'Deleted');

    if (error) {

      console.error(error);

      return [];
    }

    return data || [];
  };

// OVERDUE FOLLOWUPS

export const getOverdueFollowups =
  async () => {

    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .lt('next_visit', today)
        .neq('status', 'Completed')
        .neq('status', 'Cancelled')
        .neq('status', 'Deleted');

    if (error) {

      console.error(error);

      return [];
    }

    return data || [];
  };

// TOMORROW FOLLOWUPS

export const getTomorrowFollowups =
  async () => {

    const tomorrow =
      new Date();

    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const tomorrowDate =
      tomorrow
        .toISOString()
        .split('T')[0];

    const { data, error } =
      await supabase
        .from('appointments')
        .select('*')
        .eq(
          'next_visit',
          tomorrowDate
        )
        .neq('status', 'Completed')
        .neq('status', 'Cancelled')
        .neq('status', 'Deleted');

    if (error) {

      console.error(error);

      return [];
    }

    return data || [];
  };