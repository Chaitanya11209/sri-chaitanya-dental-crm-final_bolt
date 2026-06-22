import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn } from '../../lib/auth';
import { Search, FileText, Download, Plus, X, Printer, ShieldX, Send, MessageSquare } from 'lucide-react';
import { sendSMS, getSMSTemplates } from '../../lib/sms';
import { useNotification } from '../../components/NotificationProvider';
import { startGlobalSync, stopGlobalSync } from '../../lib/syncState';
import { useBillingRealtime } from '../../hooks/useRealtimeHooks';
import { openWhatsApp } from '../../utils/whatsapp';

const TREATMENTS = ['Dental Implants', 'Root Canal', 'Teeth Whitening', 'Braces & Aligners', 'Scaling & Polishing', 'Tooth Extraction', 'Fillings', 'Crowns & Bridges', 'Pediatric Dentistry', 'Emergency Care', 'Consultation', 'Other'];

export default function Billing() {
  const [, setLocation] = useLocation();
  const admin = isAdmin();
  const { notify } = useNotification();

  useEffect(() => {
    if (!isLoggedIn()) {
      setLocation('/admin');
      return;
    }
  }, [setLocation]);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [showPatientsDropdown, setShowPatientsDropdown] = useState(false);

  const [billForm, setBillForm] = useState<{
    id?: any;
    isNew?: boolean;
    name: string;
    phone: string;
    email: string;
    location: string;
    invoice_no: string;
    items: { treatment_type: string; notes: string; qty: number; rate: number; discount: number }[];
    general_discount: number;
    gst_percent: number;
    amount_paid: number;
    payment_mode: string;
    doctor_notes: string;
    doctor_name: string;
  }>({
    name: '',
    phone: '',
    email: '',
    location: '',
    invoice_no: '',
    items: [{ treatment_type: 'Consultation', notes: '', qty: 1, rate: 250, discount: 0 }],
    general_discount: 0,
    gst_percent: 18,
    amount_paid: 250,
    payment_mode: 'UPI',
    doctor_notes: '',
    doctor_name: 'Dr. Bhavani'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPatients = async () => {
      const { data, error } = await supabase.from('patients').select('id, name, phone, email, location').order('name', { ascending: true });
      if (!error && data) {
        setPatientsList(data);
      }
    };
    loadPatients();
  }, [showEdit]);

  const { appointments: realtimeAppointments, loading: realtimeLoading, refetch: refetchBillingHook } = useBillingRealtime();

  useEffect(() => {
    if (realtimeAppointments) {
      console.info("[Billing] [UI] Reacting to updated realtimeAppointments from Hook.", realtimeAppointments.length);
      setAppointments(realtimeAppointments);
    }
  }, [realtimeAppointments]);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(realtimeLoading);
  }, [realtimeLoading]);

  const fetch = async () => {
    console.info("[Database → Query → Hook] Refetching billing via Hook from Billing.tsx");
    await refetchBillingHook();
  };

  const openEdit = (a: any) => {
    const details = parseBilling(a);
    setBillForm({
      id: a.id,
      isNew: false,
      name: a.name || '',
      phone: a.phone || '',
      email: a.email || '',
      location: a.location || '',
      invoice_no: a.invoice_no || details.invoice_no,
      items: (details.items && details.items.length > 0) ? details.items : [{ treatment_type: a.treatment || 'Consultation', notes: '', qty: 1, rate: Number(a.amount_paid || 0) + Number(a.balance_amount || 0), discount: 0 }],
      general_discount: Number(details.discount || 0),
      gst_percent: Number(details.gst_percent ?? 18),
      amount_paid: Number(a.amount_paid || 0),
      payment_mode: a.payment_mode || 'Cash',
      doctor_notes: a.notes || '',
      doctor_name: a.doctor_name || 'Dr. Bhavani'
    });
    setShowEdit(true);
  };

  const handleOpenNewInvoice = () => {
    const yr = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    const invoiceNo = `SCDC-${yr}-${rand}`;

    setBillForm({
      isNew: true,
      name: '',
      phone: '',
      email: '',
      location: '',
      invoice_no: invoiceNo,
      items: [{ treatment_type: 'Consultation', notes: '', qty: 1, rate: 500, discount: 0 }],
      general_discount: 0,
      gst_percent: 18,
      amount_paid: 500,
      payment_mode: 'UPI',
      doctor_notes: '',
      doctor_name: 'Dr. Bhavani'
    });
    setPatientQuery('');
    setShowEdit(true);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!billForm.name || !billForm.phone) {
      notify('error', 'Validation Failure', 'Please provide a patient name and mobile number.');
      return;
    }

    // Comprehensive numeric validations preventing negative values
    if (billForm.general_discount < 0) {
      notify('error', 'Validation Error', 'Discount cannot be negative.');
      return;
    }
    if (billForm.gst_percent < 0) {
      notify('error', 'Validation Error', 'GST percentage cannot be negative.');
      return;
    }
    if (billForm.amount_paid < 0) {
      notify('error', 'Validation Error', 'Amount paid cannot be negative.');
      return;
    }

    for (let i = 0; i < billForm.items.length; i++) {
      const it = billForm.items[i];
      if (it.qty < 1) {
        notify('error', 'Validation Error', 'Quantity must be at least 1.');
        return;
      }
      if (it.rate < 0) {
        notify('error', 'Validation Error', 'Item rate/charges cannot be negative.');
        return;
      }
      if (it.discount < 0) {
        notify('error', 'Validation Error', 'Item discount cannot be negative.');
        return;
      }
    }

    setSaving(true);
    try {
      const subtotalVal = billForm.items.reduce((sum, item) => sum + (Number(item.rate || 0) * Number(item.qty || 1) - Number(item.discount || 0)), 0);
      const taxableText = Math.max(0, subtotalVal - Number(billForm.general_discount || 0));
      const gstAmtVal = taxableText * (Number(billForm.gst_percent ?? 18) / 100);
      const grandTotalVal = Math.round(taxableText + gstAmtVal);
      const balanceDueVal = Math.max(0, grandTotalVal - Number(billForm.amount_paid || 0));

      const primaryTreatment = billForm.items.map(it => it.treatment_type).join(', ') || 'Dental Service';

      const paymentNotesJSON = JSON.stringify({
        items: billForm.items,
        total_gross: subtotalVal,
        discount: Number(billForm.general_discount || 0),
        net_amount: grandTotalVal,
        amount_paid: Number(billForm.amount_paid || 0),
        balance_due: balanceDueVal,
        doctor_notes: billForm.doctor_notes,
        doctor_name: billForm.doctor_name,
        invoice_no: billForm.invoice_no,
        gst_percent: Number(billForm.gst_percent ?? 18),
        gst_amount: gstAmtVal
      });

      if (billForm.isNew) {
        // Create manual bill entry by inserting a completed slot row in appointments
        const { error } = await supabase.from('appointments').insert([{
          name: billForm.name.trim(),
          phone: billForm.phone.trim(),
          email: billForm.email.trim(),
          location: billForm.location.trim(),
          treatment: primaryTreatment,
          next_visit: new Date().toLocaleDateString('en-CA'),
          appointment_time: '12:00',
          status: 'Completed',
          amount_paid: Number(billForm.amount_paid || 0),
          balance_amount: balanceDueVal,
          payment_mode: billForm.payment_mode,
          payment_notes: paymentNotesJSON,
          doctor_name: billForm.doctor_name,
          notes: billForm.doctor_notes
        }]);

        if (error) throw error;
        notify('success', 'Bill Created', `Manually raised Invoice ${billForm.invoice_no} successfully.`);
      } else {
        // Update existing invoice
        const { error } = await supabase.from('appointments').update({
          name: billForm.name.trim(),
          phone: billForm.phone.trim(),
          email: billForm.email.trim(),
          location: billForm.location.trim(),
          treatment: primaryTreatment,
          amount_paid: Number(billForm.amount_paid || 0),
          balance_amount: balanceDueVal,
          payment_mode: billForm.payment_mode,
          payment_notes: paymentNotesJSON,
          doctor_name: billForm.doctor_name,
          notes: billForm.doctor_notes
        }).eq('id', billForm.id);

        if (error) {
          if (error.message && (error.message.includes('payment_notes') || error.message.includes('column'))) {
            // Fallback: merge into notes
            const retryRes = await supabase.from('appointments').update({
              name: billForm.name.trim(),
              phone: billForm.phone.trim(),
              email: billForm.email.trim(),
              location: billForm.location.trim(),
              treatment: primaryTreatment,
              amount_paid: Number(billForm.amount_paid || 0),
              balance_amount: balanceDueVal,
              payment_mode: billForm.payment_mode,
              doctor_name: billForm.doctor_name,
              notes: `${billForm.doctor_notes}\n[Billing JSON: ${paymentNotesJSON}]`.trim()
            }).eq('id', billForm.id);

            if (retryRes.error) throw retryRes.error;
            notify('warning', 'Bill Saved', 'Updated invoice. (Detailed metadata appended to notes due to schema limitation).');
          } else {
            throw error;
          }
        } else {
          notify('success', 'Bill Updated', `Invoice ${billForm.invoice_no} updated successfully.`);
        }
      }

      setShowEdit(false);
      fetch();
    } catch (err: any) {
      console.error(err);
      notify('error', 'Save Failed', err.message || 'Unable to store invoice data.');
    } finally {
      setSaving(false);
    }
  };

  const handleBillingSMS = async (a: any) => {
    const total = Number(a.amount_paid || 0) + Number(a.balance_amount || 0);
    const templates = getSMSTemplates();
    const text = templates.payment
      .replace('[Name]', a.name || '')
      .replace('[Treatment]', a.treatment || '')
      .replace('[Total]', total.toLocaleString('en-IN'))
      .replace('[Paid]', Number(a.amount_paid || 0).toLocaleString('en-IN'))
      .replace('[Balance]', Number(a.balance_amount || 0).toLocaleString('en-IN'));
    try {
      const res = await sendSMS({
        phone: a.phone,
        name: a.name,
        message: text
      });

      if (res.success) {
        notify('success', 'SMS Message Dispatched', `Billing SMS successfully sent to ${a.name}! ${res.simulated ? ' (Simulated)' : ''}`);
      } else {
        notify('error', 'SMS Dispatch Failed', `Failed to send SMS to ${a.name}: ${res.error}`);
      }
    } catch (err: any) {
      notify('error', 'SMS Dispatch Error', `Error sending SMS: ${err.message || err}`);
    }
  };

  const generatePDF = async (a: any) => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      
      const bill = parseBilling(a);
      const invoiceNo = a.invoice_no || bill.invoice_no || `SCDC-${new Date().getFullYear()}-${String(a.id || '1000').padStart(6, '0')}`;

      // Resolve complete patient details for professional billing printout (Age, Gender, Address, Patient Code)
      let resolvedAge = 'N/A';
      let resolvedGender = 'Unknown';
      let resolvedLocation = a.location || 'Ameenpur, Hyderabad';
      let resolvedPatientCode = 'SCDC-PT-NEW';
      try {
        const { data: ptData } = await supabase
          .from('patients')
          .select('*')
          .or(`phone.eq.${a.phone},id.eq.${a.patient_id}`);
        if (ptData && ptData.length > 0) {
          const pt = ptData[0];
          resolvedAge = pt.age || resolvedAge;
          resolvedGender = pt.gender || resolvedGender;
          resolvedLocation = pt.location || resolvedLocation;
          if (pt.patient_code) {
            resolvedPatientCode = pt.patient_code;
          }
        }
      } catch (err) {
        console.warn("Patient context fetch bypassed:", err);
      }

      // Header block with clinical colors (Sri Chaitanya Multispeciality Dental Care CRM)
      doc.setTextColor(4, 120, 87); // #047857 Emerald Green
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Sri Chaitanya Multispeciality Dental Care', 15, 20);
      
      doc.setTextColor(110, 87, 234); // Purple Accent
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Dr. J. Durga Bhavani, Cosmetic Dental Surgeon', 15, 26);
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'italic');
      doc.text('"We Care For Your Smile"', 15, 31);
      
      doc.setFont('helvetica', 'normal');
      doc.text('Ameenpur, Hyderabad  |  Ph: +91 8317575165', 15, 37);

      // INVOICE text on right
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('BILL CUM RECEIPT', 195, 20, { align: 'right' });

      // Emerald Accent thin divider
      doc.setDrawColor(4, 120, 87);
      doc.setLineWidth(0.8);
      doc.line(15, 42, 195, 42);

      // Meta attributes (Invoicing coordinates)
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice No     : ${invoiceNo}`, 15, 50);
      doc.text(`Billing Date    : ${a.next_visit || new Date().toLocaleDateString('en-IN')}`, 15, 56);
      doc.text(`Payment Mode   : ${a.payment_mode || 'UPI'}`, 15, 62);
      doc.text(`Attending Surgeon: ${a.doctor_name || 'Dr. Sri Chaitanya'}`, 15, 68);

      // Patient demographics table format
      doc.setTextColor(4, 120, 87);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Demographics / Profile', 110, 50);
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Full Name    : ${a.name ?? '-'}`, 110, 56);
      doc.text(`Patient ID   : ${resolvedPatientCode}`, 110, 62);
      doc.text(`Age / Gender : ${resolvedAge} / ${resolvedGender}`, 110, 68);
      doc.text(`Address Area : ${resolvedLocation}`, 110, 74);
      doc.text(`Contact No   : ${a.phone ?? '-'}`, 110, 80);

      // Parse items
      const tableHead = [['Sl.', 'Treatment / Clinical Service', 'Qty', 'Unit Rate', 'Item Discount', 'Net Value']];
      const itemsList = bill.items && bill.items.length > 0 ? bill.items : [{ treatment_type: a.treatment || 'Treatment Service', notes: '', qty: 1, rate: Number(a.amount_paid || 0) + Number(a.balance_amount || 0), discount: 0 }];
      
      const tableBody = itemsList.map((it: any, index: number) => {
        const rate = Number(it.rate || 0);
        const qty = Number(it.qty || 1);
        const discount = Number(it.discount || 0);
        const itemNet = rate * qty - discount;
        return [
          index + 1,
          it.treatment_type || 'Dental Service',
          qty,
          `Rs. ${rate.toLocaleString('en-IN')}`,
          `Rs. ${discount.toLocaleString('en-IN')}`,
          `Rs. ${itemNet.toLocaleString('en-IN')}`
        ];
      });

      const subtotalTotal = itemsList.reduce((sum: number, it: any) => sum + (Number(it.rate || 0) * Number(it.qty || 1) - Number(it.discount || 0)), 0);
      const discountVal = Number(bill.discount || bill.general_discount || 0);
      const taxableVal = Math.max(0, subtotalTotal - discountVal);
      const gstPercentVal = Number(bill.gst_percent ?? 18);
      const gstAmtVal = taxableVal * (gstPercentVal / 100);
      const grandTotalVal = Math.round(taxableVal + gstAmtVal);
      const amtPaidVal = Number(a.amount_paid || 0);
      const balDueVal = Number(a.balance_amount || 0);

      autoTable(doc, {
        startY: 90,
        head: tableHead,
        body: tableBody,
        foot: [
          ['', '', '', '', 'Subtotal', `Rs. ${subtotalTotal.toLocaleString('en-IN')}`],
          ['', '', '', '', 'Discount', `Rs. ${discountVal.toLocaleString('en-IN')}`],
          ['', '', '', '', `GST (${gstPercentVal}%)`, `Rs. ${gstAmtVal.toLocaleString('en-IN')}`],
          ['', '', '', '', 'Grand Total', `Rs. ${grandTotalVal.toLocaleString('en-IN')}`],
          ['', '', '', '', 'Amount Paid', `Rs. ${amtPaidVal.toLocaleString('en-IN')}`],
          ['', '', '', '', 'Balance Due', `Rs. ${balDueVal.toLocaleString('en-IN')}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255] },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontStyle: 'bold' },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setDrawColor(226, 232, 240);
      doc.line(15, finalY - 4, 195, finalY - 4);
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('Thank you for trusting Sri Chaitanya Dental Care!', 105, finalY + 2, { align: 'center' });
      doc.text('This is a computer generated invoice and serves as an official clinical transaction statement.', 105, finalY + 7, { align: 'center' });

      doc.save(`Invoice-${a.name?.replace(/\s+/g, '_')}-${invoiceNo}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      notify('error', 'PDF Generation Failure', 'Unable to create PDF invoice.');
    }
  };

  const printBill = (a: any) => {
    const invoiceNo = `INV-${a.id}-${Date.now().toString().slice(-6)}`;
    const total = Number(a.amount_paid || 0) + Number(a.balance_amount || 0);

    // Create a print-friendly HTML invoice
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${a.name || 'Patient'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #000;
            background: #fff;
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .clinic-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .clinic-tagline {
            font-size: 10px;
            color: #555;
          }
          .invoice-title {
            font-size: 20px;
            font-weight: bold;
          }
          .meta {
            display: flex;
            gap: 40px;
            margin-bottom: 20px;
          }
          .meta-section h3 {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-section p {
            font-size: 11px;
            margin-bottom: 4px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #000;
            padding: 10px 12px;
            text-align: left;
          }
          th {
            background: #f5f5f5;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
          }
          td {
            font-size: 11px;
          }
          .amount-cell {
            text-align: right;
          }
          .total-row td {
            font-weight: bold;
            background: #f9f9f9;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #555;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          .footer p {
            margin-bottom: 3px;
          }
          @media print {
            body { padding: 0; }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="clinic-name">Sri Chaitanya Dental Care</div>
            <div class="clinic-tagline">Multispeciality Dental Clinic | Ph: +91 8317575165</div>
          </div>
          <div class="invoice-title">INVOICE</div>
        </div>

        <div class="meta">
          <div class="meta-section">
            <h3>Patient Details</h3>
            <p><strong>Name:</strong> ${a.name || '-'}</p>
            <p><strong>Phone:</strong> ${a.phone || '-'}</p>
            ${a.email ? `<p><strong>Email:</strong> ${a.email}</p>` : ''}
            ${a.location ? `<p><strong>Area:</strong> ${a.location}</p>` : ''}
          </div>
          <div class="meta-section">
            <h3>Invoice Details</h3>
            <p><strong>Invoice No:</strong> ${invoiceNo}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
            <p><strong>Appointment:</strong> ${a.next_visit || '-'}${a.appointment_time ? ` at ${a.appointment_time}` : ''}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Treatment / Service</th>
              <th>Notes</th>
              <th style="width: 120px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${a.treatment || 'Dental Service'}</td>
              <td>${a.notes || '-'}</td>
              <td class="amount-cell">₹${total.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2"><strong>Amount Paid</strong></td>
              <td class="amount-cell">₹${Number(a.amount_paid || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr class="total-row">
              <td colspan="2"><strong>Balance Due</strong></td>
              <td class="amount-cell">₹${Number(a.balance_amount || 0).toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <p><strong>Thank you for choosing Sri Chaitanya Dental Care!</strong></p>
          <p>For queries, please call: +91 8317575165</p>
        </div>
      </body>
      </html>
    `;

    // Open new window and print
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const printPatientFullInvoice = async (a: any) => {
    startGlobalSync();
    try {
      // Find all appointments for this patient (by phone)
      const { data: allSessions, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('phone', a.phone)
        .neq('status', 'Deleted')
        .order('next_visit', { ascending: true });

      if (error) throw error;

      const sessions = allSessions && allSessions.length > 0 ? allSessions : [a];
      
      const totalPaid = sessions.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
      const totalBalance = sessions.reduce((sum, s) => sum + Number(s.balance_amount || 0), 0);
      const totalBill = totalPaid + totalBalance;
      const invoiceNo = `PAT-${a.id || '0'}-${Date.now().toString().slice(-6)}`;

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Patient Treatment History & Cumulative Statement - ${a.name || 'Patient'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #1e293b;
              background: #fff;
              padding: 24px;
              max-width: 210mm;
              margin: 0 auto;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #0f766e;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .clinic-title {
              font-size: 22px;
              font-weight: 800;
              color: #0f766e;
              margin-bottom: 4px;
              text-transform: uppercase;
              letter-spacing: -0.5px;
            }
            .clinic-tagline {
              font-size: 11px;
              color: #64748b;
              font-weight: 500;
            }
            .invoice-badge {
              text-align: right;
            }
            .invoice-badge h1 {
              font-size: 18px;
              font-weight: 900;
              color: #1e293b;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .invoice-badge p {
              font-size: 10px;
              color: #64748b;
              font-family: monospace;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 24px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 16px;
              border-radius: 8px;
            }
            .info-section h3 {
              font-size: 10px;
              font-weight: 800;
              color: #0f766e;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.8px;
            }
            .info-section p {
              font-size: 11px;
              margin-bottom: 4px;
              color: #334155;
            }
            .info-section p strong {
              color: #0c1524;
              width: 120px;
              display: inline-block;
            }
            .section-title {
              font-size: 11px;
              font-weight: 800;
              color: #0f766e;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              margin-bottom: 8px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
            }
            th {
              background: #0f766e;
              color: #ffffff;
              font-weight: 700;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 8px 10px;
              text-align: left;
              border: 1px solid #0f766e;
            }
            td {
              padding: 8px 10px;
              border: 1px solid #e2e8f0;
              font-size: 10.5px;
              color: #334155;
            }
            tr:nth-child(even) {
              background: #f8fafc;
            }
            .amount-col {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            .summary-box {
              display: flex;
              justify-content: flex-end;
              margin-bottom: 30px;
            }
            .summary-table {
              width: 50%;
              margin-bottom: 0;
            }
            .summary-table td {
              border: none;
              padding: 6px 10px;
              border-bottom: 1px solid #f1f5f9;
            }
            .summary-table tr.grand-total td {
              font-weight: 800;
              font-size: 12px;
              color: #0f766e;
              border-bottom: 2px double #0f766e;
              background: #f0fdfa;
            }
            .summary-table tr.due-total td {
              color: #e11d48;
              font-weight: 700;
            }
            .footer-notes {
              margin-top: 40px;
              text-align: center;
              font-size: 10px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
              padding-top: 16px;
            }
            .footer-notes p {
              margin-bottom: 4px;
            }
            @media print {
              body { padding: 0; }
              @page {
                size: A4;
                margin: 15mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <div class="clinic-title">Sri Chaitanya Dental Care</div>
              <div class="clinic-tagline">Multispeciality Dental Clinic  |  Ph: +91 8317575165</div>
            </div>
            <div class="invoice-badge">
              <h1>CUMULATIVE TREATMENT INVOICE</h1>
              <p>Statement ID: ${invoiceNo}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-section">
              <h3>Patient Profile</h3>
              <p><strong>Full Name:</strong> ${a.name || '-'}</p>
              <p><strong>Phone Connection:</strong> ${a.phone || '-'}</p>
              ${a.email ? `<p><strong>Email Address:</strong> ${a.email}</p>` : ''}
              ${a.location ? `<p><strong>Location:</strong> ${a.location}</p>` : ''}
            </div>
            <div class="info-section">
              <h3>Statement Summary</h3>
              <p><strong>Generated Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
              <p><strong>Total Treatments:</strong> ${sessions.length} visit(s)</p>
              <p><strong>Outstanding Balance:</strong> <span style="color: #e11d48; font-weight: bold;">₹${totalBalance.toLocaleString('en-IN')}</span></p>
            </div>
          </div>

          <div class="section-title">Clinical Treatment History & Ledger</div>
          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Visit Date</th>
                <th>Treatment Procedure</th>
                <th>Clinical Notes</th>
                <th style="width: 80px;">Status</th>
                <th style="width: 90px;" class="amount-col">Subtotal</th>
                <th style="width: 90px;" class="amount-col">Paid Amount</th>
                <th style="width: 90px;" class="amount-col">Pending Balance</th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(s => {
                const sub = Number(s.amount_paid || 0) + Number(s.balance_amount || 0);
                return `
                  <tr>
                    <td>${s.next_visit || '-'}</td>
                    <td style="font-weight: 600; color: #0f766e;">${s.treatment || 'Dental Service'}</td>
                    <td style="font-style: italic; color: #64748b; font-size: 9.5px;">${s.notes || '-'}</td>
                    <td style="font-weight: bold; text-transform: uppercase; font-size: 9px; color: ${s.status === 'Completed' ? '#10b981' : '#f59e0b'};">${s.status || 'Pending'}</td>
                    <td class="amount-col">₹${sub.toLocaleString('en-IN')}</td>
                    <td class="amount-col" style="color: #10b981;">₹${Number(s.amount_paid || 0).toLocaleString('en-IN')}</td>
                    <td class="amount-col" style="${Number(s.balance_amount || 0) > 0 ? 'color: #ef4444; font-weight: 600;' : ''}">₹${Number(s.balance_amount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="section-title" style="text-align: right; width: 50%; margin-left: auto;">Financial Breakdown</div>
          <div class="summary-box">
            <table class="summary-table">
              <tr>
                <td style="font-weight: 600;">Total Charged (Gross Cost)</td>
                <td class="amount-col">₹${totalBill.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td style="font-weight: 600; color: #0f766e;">Total Received Payments</td>
                <td class="amount-col" style="color: #0f766e; font-weight: bold;">₹${totalPaid.toLocaleString('en-IN')}</td>
              </tr>
              <tr class="grand-total ${totalBalance > 0 ? 'due-total' : ''}">
                <td>Net Balanced Owing (Pending)</td>
                <td class="amount-col">₹${totalBalance.toLocaleString('en-IN')}</td>
              </tr>
            </table>
          </div>

          <div class="footer-notes">
            <p><strong>Thank you for choosing Sri Chaitanya Dental Care!</strong></p>
            <p>Our multispeciality practitioners strive to deliver elite dental health care.</p>
            <p style="font-size: 9px; margin-top: 10px;">This statement aggregates your clinical records as of ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}.</p>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=900,height=950');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (err: any) {
      console.error('Error generating cumulative patient statement:', err);
      notify('error', 'Execution Error', 'Failed to retrieve patient medical statement.');
    } finally {
      stopGlobalSync();
    }
  };

  const parseBilling = (appt: any) => {
    try {
      if (appt.payment_notes && appt.payment_notes.startsWith('{') && appt.payment_notes.endsWith('}')) {
        return JSON.parse(appt.payment_notes);
      }
    } catch (e) {
      console.error(e);
    }
    const cost = Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0);
    return {
      items: [{
        treatment_type: appt.treatment || 'Dental Service',
        notes: appt.notes || 'Dental Care Treatment',
        qty: 1,
        rate: cost,
        discount: 0,
        net_amt: cost
      }],
      total_gross: cost,
      discount: 0,
      net_amount: cost,
      amount_paid: Number(appt.amount_paid || 0),
      balance_due: Number(appt.balance_amount || 0),
      doctor_notes: appt.notes || '',
      follow_up_date: '',
      instructions: '',
      doctor_name: appt.doctor_name || 'Dr. Sri Chaitanya',
      invoice_no: appt.invoice_no || `SCDC-BILL-${appt.id || '0'}`
    };
  };

  const filtered = appointments.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    
    // Check invoice_no
    const billDetails = parseBilling(a);
    const invoiceNo = (a.invoice_no || billDetails.invoice_no || '').toLowerCase();
    const matchesInvoice = invoiceNo.includes(s) || `inv-${a.id}`.includes(s) || `sdc-bill-${a.id}`.includes(s);
    
    // Check status
    const isPending = Number(a.balance_amount || 0) > 0;
    const matchesPending = 'pending'.includes(s) || 'due'.includes(s) || 'unpaid'.includes(s);
    const matchesPaid = 'paid'.includes(s) || 'settled'.includes(s) || 'clear'.includes(s);
    const matchesStatus = (isPending && matchesPending) || (!isPending && matchesPaid);

    // Check amount thresholds
    const totalAmount = Number(a.amount_paid || 0) + Number(a.balance_amount || 0);
    let matchesAmount = false;
    if (s.startsWith('>') || s.startsWith('<') || s.startsWith('=')) {
      const op = s[0];
      const val = parseFloat(s.slice(1).trim());
      if (!isNaN(val)) {
        if (op === '>') matchesAmount = totalAmount > val;
        else if (op === '<') matchesAmount = totalAmount < val;
        else if (op === '=') matchesAmount = totalAmount === val;
      }
    } else {
      const possibleNum = parseFloat(s);
      if (!isNaN(possibleNum)) {
        matchesAmount = totalAmount === possibleNum || Number(a.amount_paid || 0) === possibleNum || Number(a.balance_amount || 0) === possibleNum;
      }
    }

    // Check patient details & treatment
    const matchesPatient = a.name?.toLowerCase().includes(s) || a.phone?.includes(s) || a.treatment?.toLowerCase().includes(s);

    return matchesInvoice || matchesStatus || matchesAmount || matchesPatient;
  });

  const totalCollected = appointments.reduce((t, a) => t + Number(a.amount_paid || 0), 0);
  const totalPending = appointments.reduce((t, a) => t + Number(a.balance_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Specialized Print-Only CSS Styles for Clean, Professional Invoice Printing */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide navigation sidebar, CRM header, page indicators, action panels, and buttons */
          aside,
          header,
          footer,
          nav,
          .no-print,
          button,
          a,
          span.text-slate-300, /* divider lines */
          .text-rose-500, /* delete line-item button action */
          thead th:last-child, /* Action header in table */
          tbody td:last-child, /* Action cells in table */
          .grid.grid-cols-1.sm\\:grid-cols-3.gap-3, /* Collected statistics card row */
          .flex.flex-col.sm\\:flex-row.gap-3, /* Search inputs & "New Invoice" buttons row */
          .flex.items-center.gap-3.justify-end, /* Modal footer buttons block */
          .flex.items-center.justify-between.border-b.pb-1\\.5.border-slate-200 button /* "Add Clinical Line Item" button */ {
            display: none !important;
          }

          /* Set layout dimensions to fill the printable A4 boundaries */
          body, html, main, #root {
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Force full opacity, discard default shadows, and un-nest the modal container for absolute document printing */
          #comprehensive-invoice-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: block !important;
            overflow: visible !important;
            z-index: 9999 !important;
          }

          #comprehensive-invoice-modal .rounded-2xl {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            max-height: none !important;
          }

          /* Reformat modal layout header for brand identity printed on paper */
          #comprehensive-invoice-modal .bg-gradient-to-r {
            background: none !important;
            color: #000000 !important;
            border-bottom: 2px solid #000000 !important;
            padding: 10px 0 !important;
            margin-bottom: 20px !important;
          }
          
          #comprehensive-invoice-modal .bg-gradient-to-r * {
            color: #000000 !important;
          }

          /* Flatten interactive inputs/selects/textareas to behave like normal text labels */
          input, select, textarea,
          #comprehensive-invoice-modal input,
          #comprehensive-invoice-modal select,
          #comprehensive-invoice-modal textarea {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            font-size: 12.5px !important;
            font-weight: bold !important;
            appearance: none !important;
            box-shadow: none !important;
            pointer-events: none !important;
            padding: 0 !important;
            width: auto !important;
          }

          #comprehensive-invoice-modal form {
            overflow: visible !important;
            max-height: none !important;
            padding: 0 !important;
          }

          #comprehensive-invoice-modal .bg-slate-50,
          #comprehensive-invoice-modal .bg-slate-50\\/60 {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
          }
          
          .grid {
            display: grid !important;
          }
        }
      `}} />
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Collected</p>
          <p className="text-2xl font-black text-emerald-600">₹{totalCollected.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Pending</p>
          <p className="text-2xl font-black text-red-500">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-blue-600">₹{(totalCollected + totalPending).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, treatment, or invoice seq…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <button
          type="button"
          onClick={handleOpenNewInvoice}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm cursor-pointer whitespace-nowrap transition shadow-xs"
        >
          <Plus size={16} />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Patient', 'Treatment', 'Date', 'Total', 'Paid', 'Balance', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(a => {
                    const total = Number(a.amount_paid || 0) + Number(a.balance_amount || 0);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 text-sm">{a.name}</p>
                          <p className="text-xs text-slate-400">{a.phone}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.treatment}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{a.next_visit}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-medium">₹{total.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600 font-medium">₹{Number(a.amount_paid || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${Number(a.balance_amount || 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            ₹{Number(a.balance_amount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => openEdit(a)} className="text-xs text-teal-600 hover:underline font-medium cursor-pointer">Edit</button>
                            <button onClick={() => generatePDF(a)} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5 cursor-pointer">
                              <Download size={12} />PDF
                            </button>
                            <button onClick={() => printBill(a)} className="text-xs text-slate-600 hover:underline font-medium flex items-center gap-0.5 cursor-pointer">
                              <Printer size={12} />Receipt
                            </button>
                            <button onClick={() => printPatientFullInvoice(a)} className="text-[10px] bg-teal-50 border border-teal-150 hover:bg-teal-100/80 text-teal-700 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs" title="Print full patient treatment ledger & balance">
                              <Printer size={11} className="text-teal-600" /> Print Invoice
                            </button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => {
                              const msg = `Hi ${a.name}, your billing summary for ${a.treatment} treatment at Sri Chaitanya Dental Care: Total Bill: Rs. ${(Number(a.amount_paid || 0) + Number(a.balance_amount || 0)).toLocaleString('en-IN')}, Paid: Rs. ${Number(a.amount_paid || 0).toLocaleString('en-IN')}, Balance Due: Rs. ${Number(a.balance_amount || 0).toLocaleString('en-IN')}. Thank you!`;
                              openWhatsApp(a.phone, msg);
                            }}
                              className="text-xs text-teal-600 hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                              title="Send WhatsApp Bill">
                              <Send size={11} className="text-teal-555" /> WhatsApp
                            </button>
                            <button onClick={() => handleBillingSMS(a)}
                              className="text-xs text-sky-600 hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                              title="Send SMS Bill">
                              <MessageSquare size={11} className="text-sky-505" /> SMS
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(a => (
                <div key={a.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.treatment} · {a.next_visit}</p>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <button onClick={() => generatePDF(a)} className="p-2 bg-blue-50 text-blue-600 rounded-xl" title="Download PDF">
                        <Download size={14} />
                      </button>
                      <button onClick={() => printBill(a)} className="p-2 bg-slate-50 text-slate-600 rounded-xl" title="Print Single Receipt">
                        <Printer size={14} />
                      </button>
                      <button onClick={() => printPatientFullInvoice(a)} className="py-1 px-2.5 bg-teal-50 border border-teal-150 text-teal-700 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs" title="Print Patient Statement">
                        <Printer size={12} className="text-teal-650" /> Invoice
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm mb-2">
                    <span className="text-emerald-600">Paid: ₹{a.amount_paid || 0}</span>
                    <span className="text-red-500">Due: ₹{a.balance_amount || 0}</span>
                  </div>
                  <div className="flex gap-3 pt-2.5 mt-2 border-t border-slate-100 flex-wrap items-center">
                    <button onClick={() => openEdit(a)} className="text-xs text-teal-600 underline font-semibold mr-auto cursor-pointer">Update Payment</button>
                    <button onClick={() => {
                      const msg = `Hi ${a.name}, your billing summary for ${a.treatment} treatment at Sri Chaitanya Dental Care: Total Bill: Rs. ${(Number(a.amount_paid || 0) + Number(a.balance_amount || 0)).toLocaleString('en-IN')}, Paid: Rs. ${Number(a.amount_paid || 0).toLocaleString('en-IN')}, Balance Due: Rs. ${Number(a.balance_amount || 0).toLocaleString('en-IN')}. Thank you!`;
                      openWhatsApp(a.phone, msg);
                    }}
                      className="text-xs text-teal-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                      <Send size={11} className="text-teal-555" /> WhatsApp
                    </button>
                    <span className="text-slate-200">|</span>
                    <button onClick={() => handleBillingSMS(a)}
                      className="text-xs text-sky-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                      <MessageSquare size={11} className="text-sky-500" /> SMS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Comprehensive Invoice Creator & Editor Modal */}
      {showEdit && (
        <div id="comprehensive-invoice-modal" className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl border border-slate-100 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 to-teal-900 text-white flex items-center justify-between shadow-xs">
              <div>
                <h3 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                  <FileText size={18} className="text-teal-400" />
                  <span>{billForm.isNew ? 'Generate Sri Chaitanya Clinical Invoice' : 'Modify Itemized Clinical Invoice'}</span>
                </h3>
                <p className="text-[11px] text-slate-300 font-medium">Auto-calculates Subtotal, GST percentage, and client balance</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 hover:bg-white/15 text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs font-bold border border-white/20 select-none mr-2"
                >
                  <Printer size={13} />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={savePayment} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Patient Lookup Demographics Area */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-700 tracking-wider font-mono uppercase">
                    👤 Demographics & Clinic Info
                  </h4>
                  {billForm.isNew && (
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                      Lookup Enabled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Patient Name with lookup suggestion dropdown */}
                  <div className="relative md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Patient Full Name *</label>
                    <input
                      type="text"
                      required
                      value={billForm.name}
                      placeholder="Type full patient name or select suggestion..."
                      onChange={e => {
                        const val = e.target.value;
                        setBillForm(f => ({ ...f, name: val }));
                        setPatientQuery(val);
                        setShowPatientsDropdown(true);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />

                    {/* Suggestions dropdown dropdown list */}
                    {billForm.isNew && showPatientsDropdown && patientQuery.trim() && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-50">
                        {patientsList
                          .filter(p => p.name?.toLowerCase().includes(patientQuery.toLowerCase()) || p.phone?.includes(patientQuery))
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setBillForm(f => ({
                                  ...f,
                                  name: p.name || '',
                                  phone: p.phone || '',
                                  email: p.email || '',
                                  location: p.location || ''
                                }));
                                setShowPatientsDropdown(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-xs text-slate-700 transition font-medium flex items-center justify-between"
                            >
                              <span>{p.name} <span className="text-slate-400 font-mono">({p.phone})</span></span>
                              {p.location && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{p.location}</span>}
                            </button>
                          ))}
                        {patientsList.filter(p => p.name?.toLowerCase().includes(patientQuery.toLowerCase()) || p.phone?.includes(patientQuery)).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400 font-medium">
                            No match found. Free writing clinical card details...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Patient Phone */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Phone Connection *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={billForm.phone}
                      onChange={e => setBillForm(f => ({ ...f, phone: e.target.value.replace(/\s+/g, '') }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>

                  {/* Invoice ID Sequence */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Invoice sequence ID</label>
                    <input
                      type="text"
                      value={billForm.invoice_no}
                      onChange={e => setBillForm(f => ({ ...f, invoice_no: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-slate-100 text-slate-600 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  {/* Email address */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Email address</label>
                    <input
                      type="email"
                      value={billForm.email}
                      placeholder="Optional patient email"
                      onChange={e => setBillForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>

                  {/* Clinic Area */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Location / Area</label>
                    <input
                      type="text"
                      value={billForm.location}
                      placeholder="Optional patient locality"
                      onChange={e => setBillForm(f => ({ ...f, location: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>

                  {/* Specialist */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Specialist Consultant</label>
                    <input
                      type="text"
                      value={billForm.doctor_name}
                      onChange={e => setBillForm(f => ({ ...f, doctor_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Itemized Treatments Block */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                  <h4 className="text-xs font-extrabold text-slate-700 tracking-wider font-mono uppercase">
                    🦷 Medical Treatments & Charges List
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setBillForm(f => ({
                        ...f,
                        items: [...f.items, { treatment_type: 'Other', notes: '', qty: 1, rate: 0, discount: 0 }]
                      }));
                    }}
                    className="flex items-center gap-1.5 text-xs text-teal-650 hover:text-teal-800 font-extrabold transition cursor-pointer"
                  >
                    <Plus size={14} /> Add Clinical Line Item
                  </button>
                </div>

                <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
                  {billForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center bg-slate-50/60 p-3.5 rounded-xl border border-slate-100 transition hover:bg-slate-50">
                      
                      {/* Clinical selection type */}
                      <div className="md:col-span-3">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-0.5 block">Procedure Type</label>
                        <select
                          value={item.treatment_type}
                          onChange={e => {
                            const newItems = [...billForm.items];
                            newItems[index].treatment_type = e.target.value;
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/10"
                        >
                          {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      {/* Clinical notes */}
                      <div className="md:col-span-3">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-0.5 block">Item Notes</label>
                        <input
                          type="text"
                          value={item.notes}
                          placeholder="Teeth Whitening etc"
                          onChange={e => {
                            const newItems = [...billForm.items];
                            newItems[index].notes = e.target.value;
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/10"
                        />
                      </div>

                      {/* Item Rate */}
                      <div className="md:col-span-2">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-0.5 block">Charges (₹)</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.rate}
                          onChange={e => {
                            const newItems = [...billForm.items];
                            newItems[index].rate = Number(e.target.value);
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-teal-500/10 font-bold"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-0.5 block">Qty</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.qty}
                          onChange={e => {
                            const newItems = [...billForm.items];
                            newItems[index].qty = Number(e.target.value);
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-teal-500/10 font-bold"
                        />
                      </div>

                      {/* Discount of item */}
                      <div className="md:col-span-2">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-500 mb-0.5 block">Discount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={e => {
                            const newItems = [...billForm.items];
                            newItems[index].discount = Number(e.target.value);
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-teal-500/10 font-bold"
                        />
                      </div>

                      {/* Remove Line Button */}
                      <div className="md:col-span-1 text-right">
                        <label className="max-md:hidden text-[10px] uppercase font-mono font-bold text-transparent mb-0.5 block">Del</label>
                        <button
                          type="button"
                          disabled={billForm.items.length === 1}
                          onClick={() => {
                            const newItems = billForm.items.filter((_, i) => i !== index);
                            setBillForm(f => ({ ...f, items: newItems }));
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aggregation Totals calculations Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                
                {/* Free clinical description notes */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-extrabold text-slate-650 mb-1 block uppercase font-mono">
                      📋 Diagnostic / Prescription Notes
                    </label>
                    <textarea
                      rows={3}
                      value={billForm.doctor_notes}
                      placeholder="Add diagnostic findings, follow ups, or notes..."
                      onChange={e => setBillForm(f => ({ ...f, doctor_notes: e.target.value }))}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/10 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Choose mode of payment */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">Payment Mode</label>
                      <select
                        value={billForm.payment_mode}
                        onChange={e => setBillForm(f => ({ ...f, payment_mode: e.target.value }))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white cursor-pointer"
                      >
                        {['UPI', 'Cash', 'Card', 'Net Banking', 'EMI', 'Other'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dynamic custom GST selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1 block">GST Percent (%)</label>
                      <input
                        type="number"
                        min="0"
                        value={billForm.gst_percent}
                        onChange={e => setBillForm(f => ({ ...f, gst_percent: Number(e.target.value) }))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Totals panel */}
                <div className="bg-white p-4.5 rounded-xl border border-slate-100 divide-y divide-slate-100 space-y-2.5">
                  {/* Calculation operations mapping */}
                  {(() => {
                    const subtotal = billForm.items.reduce((sum, item) => sum + (Number(item.rate || 0) * Number(item.qty || 1) - Number(item.discount || 0)), 0);
                    
                    const itemizedDiscounts = billForm.items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
                    
                    const taxable = Math.max(0, subtotal - Number(billForm.general_discount || 0));
                    const gstAmount = taxable * (Number(billForm.gst_percent ?? 18) / 100);
                    const grandTotal = Math.round(taxable + gstAmount);
                    const balanceDue = Math.max(0, grandTotal - Number(billForm.amount_paid || 0));

                    return (
                      <>
                        {/* Subtotal charges */}
                        <div className="flex items-center justify-between text-xs pb-1 text-slate-600">
                          <span className="font-semibold">Treatment Subtotal</span>
                          <span className="font-mono font-bold">₹{subtotal.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Additional flat discount input */}
                        <div className="flex items-center justify-between text-xs py-2 text-slate-600">
                          <span className="font-semibold text-rose-600">Additional Discount (₹)</span>
                          <input
                            type="number"
                            min="0"
                            value={billForm.general_discount}
                            onChange={e => setBillForm(f => ({ ...f, general_discount: Number(e.target.value) }))}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-right font-bold text-xs"
                          />
                        </div>

                        {/* Taxable value */}
                        <div className="flex items-center justify-between text-xs py-2 text-slate-500">
                          <span className="font-medium">Taxable Value</span>
                          <span className="font-mono">₹{taxable.toLocaleString('en-IN')}</span>
                        </div>

                        {/* GST taxes */}
                        <div className="flex items-center justify-between text-xs py-2 text-slate-500">
                          <span className="font-medium">Calculated GST ({billForm.gst_percent}%)</span>
                          <span className="font-mono">₹{gstAmount.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Grand Total net bill */}
                        <div className="flex items-center justify-between text-sm py-2 bg-slate-50/40 px-1 text-slate-800 font-extrabold border-t border-b">
                          <span>Grand Total Bill (Inc. GST)</span>
                          <span className="font-mono text-emerald-700">₹{grandTotal.toLocaleString('en-IN')}</span>
                        </div>

                        {/* Amount paid slider/input */}
                        <div className="flex items-center justify-between text-xs py-2 text-slate-700 font-bold">
                          <span className="font-extrabold flex items-center gap-1.5 text-teal-750">
                            💰 Amount Paid (₹)
                          </span>
                          <input
                            type="number"
                            min="0"
                            required
                            value={billForm.amount_paid}
                            onChange={e => setBillForm(f => ({ ...f, amount_paid: Number(e.target.value) }))}
                            className="w-28 bg-emerald-50/40 border-2 border-emerald-300 rounded-lg px-2.5 py-1 text-right font-black text-xs text-emerald-800 focus:ring-emerald-400 focus:outline-none"
                          />
                        </div>

                        {/* Remaining balance due */}
                        <div className="flex items-center justify-between text-xs pt-2 text-slate-700 font-semibold">
                          <span>Outstanding Balance Due</span>
                          <span className={`font-mono font-black ${balanceDue > 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                            ₹{balanceDue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Action operations row */}
              <div className="flex items-center gap-3 justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-650 hover:bg-slate-50 text-sm font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm tracking-wide transition shadow-sm disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Invoice...</span>
                    </>
                  ) : (
                    <span>Save & Generate Invoice</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
