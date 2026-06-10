import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../../lib/supabase';
import { isAdmin, isLoggedIn } from '../../lib/auth';
import { Search, FileText, Download, Plus, X, Printer, ShieldX, Send, MessageSquare } from 'lucide-react';
import { sendSMS, getSMSTemplates } from '../../lib/sms';
import { useNotification } from '../../components/NotificationProvider';
import { startGlobalSync, stopGlobalSync } from '../../lib/syncState';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState({ amount_paid: '', balance_amount: '', payment_mode: 'Cash', payment_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch();

    const channel = supabase
      .channel('billing-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false });
    setAppointments(data || []);
    setLoading(false);
  };

  const openEdit = (a: any) => {
    setShowEdit(a);
    setEditForm({ amount_paid: a.amount_paid || '', balance_amount: a.balance_amount || '', payment_mode: a.payment_mode || 'Cash', payment_notes: a.payment_notes || '' });
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await supabase.from('appointments').update(editForm).eq('id', showEdit.id);
    setShowEdit(null); fetch(); setSaving(false);
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
      const invoiceNo = `INV-${a.id}-${Date.now().toString().slice(-6)}`;

      // ── Header (black & white) ──────────────────────────────────────────
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Sri Chaitanya Dental Care', 15, 18);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Multispeciality Dental Clinic  |  Ph: +91 8317575165', 15, 25);

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', 195, 18, { align: 'right' });

      // Divider
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.6);
      doc.line(15, 30, 195, 30);

      // ── Invoice meta ────────────────────────────────────────────────────
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice No: ${invoiceNo}`, 15, 38);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 15, 45);

      // ── Patient + Appointment ───────────────────────────────────────────
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Details', 15, 57);
      doc.text('Appointment Details', 115, 57);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const patientLines = [
        `Name   : ${a.name ?? '-'}`,
        `Phone  : ${a.phone ?? '-'}`,
        ...(a.email   ? [`Email  : ${a.email}`]       : []),
        ...(a.location? [`Area   : ${a.location}`]    : []),
      ];
      patientLines.forEach((l, i) => doc.text(l, 15, 64 + i * 7));

      const apptLines = [
        `Date   : ${a.next_visit ?? '-'}`,
        `Time   : ${a.appointment_time ?? '-'}`,
        `Type   : ${a.visit_type ?? 'New'}`,
      ];
      apptLines.forEach((l, i) => doc.text(l, 115, 64 + i * 7));

      // ── Treatment table ─────────────────────────────────────────────────
      const tableTop = 64 + Math.max(patientLines.length, apptLines.length) * 7 + 8;

      autoTable(doc, {
        startY: tableTop,
        head: [['Treatment / Service', 'Notes', 'Total Amount']],
        body: [
          [
            a.treatment ?? 'Dental Service',
            a.notes ?? '-',
            `Rs. ${Number(a.amount_paid || 0) + Number(a.balance_amount || 0)}`,
          ],
        ],
        foot: [
          ['', 'Amount Paid',  `Rs. ${a.amount_paid  ?? 0}`],
          ['', 'Balance Due',  `Rs. ${a.balance_amount ?? 0}`],
        ],
        headStyles: {
          fillColor:  [255, 255, 255],
          textColor:  [0, 0, 0],
          fontStyle:  'bold',
          lineWidth:  0.3,
          lineColor:  [0, 0, 0],
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.2,
          lineColor: [100, 100, 100],
        },
        footStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        theme: 'grid',
        columnStyles: { 2: { halign: 'right' } },
      });

      // ── Footer note ─────────────────────────────────────────────────────
      const endY = (doc as any).lastAutoTable.finalY + 14;
      doc.setLineWidth(0.3);
      doc.line(15, endY - 4, 195, endY - 4);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(60, 60, 60);
      doc.text('Thank you for choosing Sri Chaitanya Dental Care!', 105, endY + 2, { align: 'center' });
      doc.text('For queries call: +91 8317575165', 105, endY + 8, { align: 'center' });

      doc.save(`Invoice-${a.name?.replace(/\s+/g, '_')}-${invoiceNo}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
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

  const filtered = appointments.filter(a => {
    const s = search.toLowerCase();
    return !search || a.name?.toLowerCase().includes(s) || a.phone?.includes(s) || a.treatment?.toLowerCase().includes(s);
  });

  const totalCollected = appointments.reduce((t, a) => t + Number(a.amount_paid || 0), 0);
  const totalPending = appointments.reduce((t, a) => t + Number(a.balance_amount || 0), 0);

  return (
    <div className="space-y-4">
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
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or treatment…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
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
                            <a href={`https://wa.me/91${a.phone}?text=${encodeURIComponent(`Hi ${a.name}, your billing summary for ${a.treatment} treatment at Sri Chaitanya Dental Care: Total Bill: ₹${(Number(a.amount_paid || 0) + Number(a.balance_amount || 0)).toLocaleString('en-IN')}, Paid: ₹${Number(a.amount_paid || 0).toLocaleString('en-IN')}, Balance Due: ₹${Number(a.balance_amount || 0).toLocaleString('en-IN')}. Thank you!`)}`}
                              target="_blank" rel="noreferrer"
                              className="text-xs text-teal-600 hover:underline font-medium flex items-center gap-0.5"
                              title="Send WhatsApp Bill">
                              <Send size={11} className="text-teal-555" /> WhatsApp
                            </a>
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
                    <a href={`https://wa.me/91${a.phone}?text=${encodeURIComponent(`Hi ${a.name}, your billing summary for ${a.treatment} treatment at Sri Chaitanya Dental Care: Total Bill: ₹${(Number(a.amount_paid || 0) + Number(a.balance_amount || 0)).toLocaleString('en-IN')}, Paid: ₹${Number(a.amount_paid || 0).toLocaleString('en-IN')}, Balance Due: ₹${Number(a.balance_amount || 0).toLocaleString('en-IN')}. Thank you!`)}`}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-teal-600 hover:underline font-semibold flex items-center gap-1">
                      <Send size={11} className="text-teal-555" /> WhatsApp
                    </a>
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

      {/* Edit payment modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Update Payment</h3>
              <button onClick={() => setShowEdit(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={savePayment} className="p-5 space-y-3">
              <p className="text-sm text-slate-600 font-medium">{showEdit.name} — {showEdit.treatment}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Amount Paid (₹)</label>
                  <input type="number" value={editForm.amount_paid} onChange={e => setEditForm(f => ({ ...f, amount_paid: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Balance (₹)</label>
                  <input type="number" value={editForm.balance_amount} onChange={e => setEditForm(f => ({ ...f, balance_amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Payment Mode</label>
                <select value={editForm.payment_mode} onChange={e => setEditForm(f => ({ ...f, payment_mode: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
                  {['Cash', 'UPI', 'Card', 'Net Banking', 'EMI', 'Other'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
                <input value={editForm.payment_notes} onChange={e => setEditForm(f => ({ ...f, payment_notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
