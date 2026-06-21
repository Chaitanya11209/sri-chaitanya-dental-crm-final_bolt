import { supabase } from '../supabaseClient';

export const createAppointment = async (formData: any) => {
  // Service-Level Validation (Server-Side equivalent)
  if (!formData.name || formData.name.trim().length < 2) {
    throw new Error('Name must be at least 2 characters.');
  }
  if (!/^[A-Za-z\s.]+$/.test(formData.name.trim())) {
    throw new Error('Name can only contain letters, spaces, and dots.');
  }
  const strippedPhone = (formData.phone || '').replace(/[\s\-()]/g, '');
  if (!formData.phone || !/^(?:\+?91|0)?[6-9]\d{9}$/.test(strippedPhone)) {
    throw new Error('Please provide a valid 10-digit Indian phone number.');
  }
  if (formData.email && formData.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      throw new Error('Please provide a valid email address.');
    }
  }
  if (!formData.location || formData.location.trim().length < 2) {
    throw new Error('Location must be at least 2 characters.');
  }
  if (!formData.service) {
    throw new Error('Please select a valid service.');
  }
  if (!formData.date) {
    throw new Error('Appointment date is required.');
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(formData.date);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      throw new Error('Appointment date cannot be in the past.');
    }
  }
  if (!formData.time) {
    throw new Error('Preferred time is required.');
  }

  // STEP 1
  // Check existing patient by phone

  const { data: existingPatient } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', formData.phone)
    .maybeSingle();

  let patientId = null;

  // STEP 2
  // Existing patient

  if (existingPatient) {

    patientId = existingPatient.id;

  } else {

    // STEP 3
    // Create new patient

    const patientCode = `SDC-${Date.now()}`;

    const { data: newPatients, error } = await supabase
      .from('patients')
      .insert([
        {
          patient_code: patientCode,
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          location: formData.location,
          patient_status: 'Registered'
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    if (newPatients && newPatients.length > 0) {
      patientId = newPatients[0].id;
    } else {
      // Re-query if select somehow returned empty range
      const { data: reQuery } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', formData.phone)
        .maybeSingle();
      patientId = reQuery?.id;
    }
  }

  // STEP 4
  // Count visits

  const { count } = await supabase
    .from('appointments')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('patient_id', patientId);

  const visitCount = (count || 0) + 1;

  // STEP 5
  // Create appointment

  const { data, error } = await supabase
    .from('appointments')
    .insert([
      {
        patient_id: patientId,

        name: formData.name,

        phone: formData.phone,

        email: formData.email,

        treatment: formData.service,

        next_visit: formData.date,

        appointment_time: formData.time,

        location: formData.location,

        notes: formData.message,

        visit_count: visitCount,

        visit_type:
          visitCount > 1
            ? 'Returning'
            : 'New',

        status: 'Pending',
      },
    ]);

  if (error) {
    throw error;
  }

  return data;
};