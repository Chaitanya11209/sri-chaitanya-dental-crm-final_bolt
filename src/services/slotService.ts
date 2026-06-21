import { supabase } from '../supabaseClient';

// AVAILABLE TIME SLOTS

export const timeSlots = [

  '09:00 AM',
  '09:30 AM',

  '10:00 AM',
  '10:30 AM',

  '11:00 AM',
  '11:30 AM',

  '12:00 PM',
  '12:30 PM',

  '01:00 PM',

  '04:00 PM',
  '04:30 PM',

  '05:00 PM',
  '05:30 PM',

  '06:00 PM',
  '06:30 PM',

  '07:00 PM',
  '07:30 PM',

];

// GET AVAILABLE SLOTS

export const getAvailableSlots =
  async (date: string) => {

    const { data, error } =
      await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('next_visit', date)
        .neq('status', 'Cancelled')
        .neq('status', 'Deleted');

    if (error) {

      console.error(error);

      return timeSlots;
    }

    const bookedSlots =
      data.map(
        (item) =>
          item.appointment_time
      );

    const availableSlots =
      timeSlots.filter(
        (slot) =>
          !bookedSlots.includes(slot)
      );

    return availableSlots;
  };