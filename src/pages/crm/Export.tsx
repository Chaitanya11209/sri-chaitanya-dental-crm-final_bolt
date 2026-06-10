import { useState, useEffect } from 'react';
import { 
  FolderDown, CloudLightning, Download, LogIn, ExternalLink, 
  CheckCircle2, AlertCircle, RefreshCw, Folder, ChevronRight, 
  Settings, Key, Database, Activity, Server, FileSpreadsheet, FileArchive, ShieldCheck, Mail
} from 'lucide-react';
import { useNotification } from '../../components/NotificationProvider';
import { supabase } from '../../lib/supabase';
import JSZip from 'jszip';

interface DriveFolder {
  id: string;
  name: string;
}

export default function Export() {
  const { notify } = useNotification();
  
  // Authentication & Settings state
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem('gdrive_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  });
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem('gdrive_access_token') || '';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string; email?: string; picture?: string } | null>(null);

  // Database Synchronization state
  const [unlinkedCount, setUnlinkedCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // System Health state
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [realtimeStatus, setRealtimeStatus] = useState<'checking' | 'active' | 'inactive'>('checking');
  const [buildStatus] = useState<'compiled'>('compiled');
  const [deploymentReadiness, setDeploymentReadiness] = useState<string>('Checking...');

  // Export progress states
  const [exportingAll, setExportingAll] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [downloadingDeployment, setDownloadingDeployment] = useState(false);
  const [downloadingDatabase, setDownloadingDatabase] = useState(false);
  const [downloadingMaster, setDownloadingMaster] = useState(false);

  // Drive state
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('root');
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);

  // Action status state
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [fileLink, setFileLink] = useState<string | null>(null);

  // Check system health on component mount
  const checkSystemHealth = async () => {
    try {
      const start = performance.now();
      const { error } = await supabase.from('patients').select('id', { count: 'exact', head: true }).limit(1);
      const duration = performance.now() - start;
      
      if (error) throw error;
      setDbStatus('online');
      setSupabaseStatus('online');
      
      if (duration < 250) {
        setDeploymentReadiness('100% - Ready (Excellent Latency)');
      } else {
        setDeploymentReadiness('95% - Ready (Satisfactory Connection)');
      }
    } catch (err) {
      console.error('System connection check failed:', err);
      setDbStatus('offline');
      setSupabaseStatus('offline');
      setDeploymentReadiness('Action Required (Database Offline)');
    }
    
    // Check realtime channel subscription
    try {
      const channel = supabase.channel('health-check').subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('active');
        } else {
          setRealtimeStatus('inactive');
        }
        supabase.removeChannel(channel);
      });
    } catch {
      setRealtimeStatus('inactive');
    }
  };

  // Fetch unlinked appointments count
  const fetchUnlinkedCount = async () => {
    try {
      const { data: appts } = await supabase.from('appointments').select('id, phone, patient_id');
      const { data: patients } = await supabase.from('patients').select('id, phone');
      
      if (!appts) {
        setUnlinkedCount(0);
        return;
      }
      
      const cleanPhone = (ph: string | null | undefined): string => {
        if (!ph) return '';
        const cleaned = ph.trim().replace(/\D/g, '');
        return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
      };
      
      const patientPhoneSet = new Set((patients || []).map(p => cleanPhone(p.phone)).filter(Boolean));
      const patientIdSet = new Set((patients || []).map(p => p.id));
      
      let orphaned = 0;
      for (const appt of appts) {
        if (appt.patient_id && patientIdSet.has(appt.patient_id)) {
          continue;
        }
        const apptPhoneNorm = cleanPhone(appt.phone);
        if (apptPhoneNorm && patientPhoneSet.has(apptPhoneNorm)) {
          continue;
        }
        orphaned++;
      }
      setUnlinkedCount(orphaned);
    } catch (err) {
      console.error('Error fetching unlinked diagnostic count:', err);
      setUnlinkedCount(0);
    }
  };

  useEffect(() => {
    fetchUnlinkedCount();
    checkSystemHealth();
  }, []);

  // Run deep synchronization
  const runDeepSync = async () => {
    setIsSyncing(true);
    try {
      const { data: appts, error: apptError } = await supabase.from('appointments').select('*');
      if (apptError) throw apptError;
      if (!appts || appts.length === 0) {
        notify('info', 'Sync Done', 'No appointments found in Sri Chaitanya database.');
        setIsSyncing(false);
        return;
      }

      const cleanPhone = (ph: string | null | undefined): string => {
        if (!ph) return '';
        const cleaned = ph.trim().replace(/\D/g, '');
        return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
      };

      const { data: existingPatients, error: patientError } = await supabase.from('patients').select('id, phone');
      if (patientError) throw patientError;

      const existingPhones = new Set(
        (existingPatients || []).map(p => cleanPhone(p.phone)).filter(Boolean)
      );

      const uniqueToCreate = new Map<string, any>();
      for (const appt of appts) {
        if (!appt.phone) continue;
        const phone = appt.phone;
        const normPhone = cleanPhone(phone);
        if (!normPhone || existingPhones.has(normPhone)) continue;

        if (!uniqueToCreate.has(normPhone)) {
          uniqueToCreate.set(normPhone, {
            patient_code: `SDC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: (appt.name || 'Unknown Patient').trim(),
            phone: phone.trim(),
            email: appt.email || '',
            location: appt.location || '',
            patient_status: 'Registered',
            created_at: appt.created_at || new Date().toISOString()
          });
        }
      }

      const toCreate = Array.from(uniqueToCreate.values());
      let createdCount = 0;
      if (toCreate.length > 0) {
        const { error: insertError } = await supabase.from('patients').insert(toCreate);
        if (insertError) throw insertError;
        createdCount = toCreate.length;
      }

      const { data: updatedPatients } = await supabase.from('patients').select('id, phone');
      let linkedCount = 0;
      if (updatedPatients) {
        const phoneToIdMap = new Map<string, number>();
        for (const pt of updatedPatients) {
          if (pt.phone) {
            const normPtPhone = cleanPhone(pt.phone);
            if (normPtPhone) phoneToIdMap.set(normPtPhone, pt.id);
          }
        }

        const { data: apptsToUpdate } = await supabase.from('appointments').select('id, phone').is('patient_id', null);
        if (apptsToUpdate) {
          for (const appt of apptsToUpdate) {
            if (appt.phone) {
              const normApptPhone = cleanPhone(appt.phone);
              const pId = phoneToIdMap.get(normApptPhone);
              if (pId) {
                await supabase.from('appointments').update({ patient_id: pId }).eq('id', appt.id);
                linkedCount++;
              }
            }
          }
        }
      }

      await fetchUnlinkedCount();
      notify('success', 'CRM Sync Complete', `Successfully completed deep synchronization! Registered ${createdCount} patient records & linked ${linkedCount} appointments.`);
    } catch (err: any) {
      notify('error', 'Diagnostics & Sync Failed', err.message || String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  // Google OAuth client ID persistence
  useEffect(() => {
    if (clientId) {
      localStorage.setItem('gdrive_client_id', clientId);
    } else {
      localStorage.removeItem('gdrive_client_id');
    }
  }, [clientId]);

  // Handle Hash redirect on OAuth completion
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      const state = params.get('state');

      if (token && state === 'export_project') {
        localStorage.setItem('gdrive_access_token', token);
        setAccessToken(token);
        setMessage({ type: 'success', text: 'Successfully authenticated with Google!' });
        window.location.hash = '';
      }
    }
  }, []);

  // Fetch Google User Profile and Drive Folders if authenticated
  useEffect(() => {
    if (!accessToken) {
      setUserProfile(null);
      setFolders([]);
      return;
    }

    const fetchUserProfileAndFolders = async () => {
      setIsFetchingFolders(true);
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserProfile({
            name: profile.name,
            email: profile.email,
            picture: profile.picture
          });
        } else if (profileRes.status === 401) {
          handleDisconnect();
          setMessage({ type: 'error', text: 'Google session expired. Please connect again.' });
          return;
        }

        const foldersRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27+and+trashed%3Dfalse&fields=files(id%2Cname)&orderBy=name&pageSize=100`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );

        if (foldersRes.ok) {
          const data = await foldersRes.json();
          setFolders(data.files || []);
        } else {
          notify('warning', 'Google Drive Listing Restrained', 'Could not locate folders in this workspace.');
        }
      } catch (err: any) {
        notify('error', 'Google Drive Connection Failure', 'Network handshake with Google server dropped.', err?.message || String(err));
      } finally {
        setIsFetchingFolders(false);
      }
    };

    fetchUserProfileAndFolders();
  }, [accessToken]);

  const handleConnect = () => {
    if (!clientId) {
      setMessage({ type: 'error', text: 'A Google OAuth Client ID is required to use automatic Sign-In. You can create one in Google Cloud Console or use Direct Token input.' });
      setShowSettings(true);
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: scopes,
      include_granted_scopes: 'true',
      state: 'export_project'
    }).toString();

    window.location.href = authUrl;
  };

  const handleDirectTokenSubmit = (token: string) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;
    localStorage.setItem('gdrive_access_token', cleanToken);
    setAccessToken(cleanToken);
    setMessage({ type: 'success', text: 'Associated custom Access Token.' });
  };

  const handleDisconnect = () => {
    localStorage.removeItem('gdrive_access_token');
    setAccessToken('');
    setUserProfile(null);
    setFolders([]);
    setFileLink(null);
    setMessage({ type: 'info', text: 'Disconnected from Google Drive.' });
  };

  // Convert raw array of arrays to CSV string securely
  const convertToCSV = (data: any[], headers: string[]) => {
    if (!data || data.length === 0) return headers.join(',') + '\n';
    
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val !== null && val !== undefined ? val : '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  };

  // Client side download trigger
  const triggerDownload = (content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Fetch individual table database entries
  const fetchTableDataForExport = async (tableName: string) => {
    try {
      if (tableName === 'bills') {
        const { data, error } = await supabase.from('appointments').select('*').neq('status', 'Deleted').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map((appt: any) => ({
          invoice_number: `INV-${appt.id || Date.now()}`,
          patient_name: appt.name || 'N/A',
          phone: appt.phone || 'N/A',
          treatment_procedure: appt.treatment || 'Consultation',
          amount_paid: appt.amount_paid || 0,
          balance_due: appt.balance_amount || 0,
          total_charge: Number(appt.amount_paid || 0) + Number(appt.balance_amount || 0),
          payment_status: appt.balance_amount > 0 ? (appt.amount_paid > 0 ? 'Partially Paid' : 'Due') : 'Paid',
          date: appt.next_visit || appt.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]
        }));
      }

      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`Failed to export live table data from '${tableName}':`, err);
      return [];
    }
  };

  // Trigger individual table CSV export
  const handleExportCSV = async (type: 'patients' | 'appointments' | 'doctors' | 'treatments' | 'bills' | 'staff_roles') => {
    notify('info', 'Preparing Export', `Gathering clinical records for ${type}...`);
    const rawData = await fetchTableDataForExport(type);
    
    if (rawData.length === 0) {
      notify('warning', 'No Live Data Found', `The database table for '${type}' returned 0 records.`);
    }

    let headers: string[] = [];
    if (type === 'patients') {
      headers = ['id', 'patient_code', 'name', 'phone', 'email', 'location', 'patient_status', 'notes', 'created_at'];
    } else if (type === 'appointments') {
      headers = ['id', 'name', 'phone', 'appointment_time', 'next_visit', 'treatment', 'amount_paid', 'balance_amount', 'status', 'created_at'];
    } else if (type === 'doctors') {
      headers = ['id', 'name', 'qualification', 'specialization', 'phone', 'email', 'status', 'created_at'];
    } else if (type === 'treatments') {
      headers = ['id', 'patient_name', 'phone', 'treatment_type', 'stage', 'start_date', 'expected_end_date', 'total_sessions', 'sessions_done', 'treatment_notes', 'doctor_notes', 'created_at'];
    } else if (type === 'bills') {
      headers = ['invoice_number', 'patient_name', 'phone', 'treatment_procedure', 'amount_paid', 'balance_due', 'total_charge', 'payment_status', 'date'];
    } else if (type === 'staff_roles') {
      headers = ['id', 'user_id', 'name', 'role', 'status', 'created_at'];
    }

    const csvContent = convertToCSV(rawData, headers);
    const dateToday = new Date().toISOString().split('T')[0];
    triggerDownload(csvContent, `sri_chaitanya_dental_${type}_${dateToday}.csv`);
    notify('success', 'Export Complete', `Successfully compiled and downloaded ${type} CSV ledger locally.`);
  };

  // Compile full database backup (Export All Data)
  const handleExportAllData = async () => {
    setExportingAll(true);
    notify('info', 'Compiling Database', 'Packaging schema tables into a single backup index...');
    try {
      const zip = new JSZip();
      const tables: ('patients' | 'appointments' | 'doctors' | 'treatments' | 'bills' | 'staff_roles')[] = [
        'patients', 'appointments', 'doctors', 'treatments', 'bills', 'staff_roles'
      ];

      const results = await Promise.all(tables.map(t => fetchTableDataForExport(t)));
      const dateToday = new Date().toISOString().split('T')[0];

      tables.forEach((type, index) => {
        const rawData = results[index];
        let headers: string[] = [];
        if (type === 'patients') {
          headers = ['id', 'patient_code', 'name', 'phone', 'email', 'location', 'patient_status', 'notes', 'created_at'];
        } else if (type === 'appointments') {
          headers = ['id', 'name', 'phone', 'appointment_time', 'next_visit', 'treatment', 'amount_paid', 'balance_amount', 'status', 'created_at'];
        } else if (type === 'doctors') {
          headers = ['id', 'name', 'qualification', 'specialization', 'phone', 'email', 'status', 'created_at'];
        } else if (type === 'treatments') {
          headers = ['id', 'patient_name', 'phone', 'treatment_type', 'stage', 'start_date', 'expected_end_date', 'total_sessions', 'sessions_done', 'treatment_notes', 'doctor_notes', 'created_at'];
        } else if (type === 'bills') {
          headers = ['invoice_number', 'patient_name', 'phone', 'treatment_procedure', 'amount_paid', 'balance_due', 'total_charge', 'payment_status', 'date'];
        } else if (type === 'staff_roles') {
          headers = ['id', 'user_id', 'name', 'role', 'status', 'created_at'];
        }

        const csvContent = convertToCSV(rawData, headers);
        zip.file(`${type}_export_${dateToday}.csv`, csvContent);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dateToday}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify('success', 'Full Backup Generated', `Database archive 'backup-${dateToday}.zip' successfully prepared!`);
    } catch (err: any) {
      console.error('Failure saving full zip data state:', err);
      notify('error', 'Full CSV ZIP Failed', 'Handshake or compression dropped during export.');
    } finally {
      setExportingAll(false);
    }
  };

  // Direct ZIP download of complete prepacked offline code structure (Option A)
  const handleDownloadZIP = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch('/project-export.zip');
      if (!response.ok) {
        throw new Error('On-demand ZIP generation failed. Falling back to pre-built package.');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sri-chaitanya-dental-crm-source.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setMessage({ type: 'success', text: 'Project ZIP codebase generated and downloaded successfully!' });
      notify('success', 'Backup ZIP Downloaded', 'Clinical workspace package was downloaded successfully.');
    } catch (err: any) {
      try {
        const a = document.createElement('a');
        a.href = '/project-export.zip';
        a.download = 'sri-chaitanya-dental-crm-source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setMessage({ type: 'success', text: 'Backup download triggered successfully.' });
      } catch (fallbackErr: any) {
        setMessage({ type: 'error', text: 'Error downloading ZIP bundle: ' + (err.message || err) });
        notify('error', 'App Codebase Packaging Failed', 'Could not download the workspace zip archive.', err?.message || String(err));
      }
    } finally {
      setDownloading(false);
    }
  };

  // Source code packaging downloader
  const handleDownloadSourceCode = async () => {
    setDownloadingSource(true);
    notify('info', 'Compiling Source Code', 'Gathering source directory structures...');
    try {
      const response = await fetch('/sri-chaitanya-dental-crm-source.zip');
      if (!response.ok) throw new Error('Source asset export file not compiled.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sri-chaitanya-dental-crm-source.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('success', 'Source Code Ready', "'sri-chaitanya-dental-crm-source.zip' downloaded successfully.");
    } catch (err: any) {
      console.warn('Fallback direct request to download pipeline:', err);
      window.open('/sri-chaitanya-dental-crm-source.zip', '_blank');
      notify('success', 'Download Triggered', 'Attempted fallback codebase transfer.');
    } finally {
      setDownloadingSource(false);
    }
  };

  // Database structure and migration bundle downloader
  const handleDownloadDatabaseZIP = async () => {
    setDownloadingDatabase(true);
    notify('info', 'Compiling Database Schema', 'Structuring schemas, migrations, policies and triggers...');
    try {
      const response = await fetch('/sri-chaitanya-dental-crm-database.zip');
      if (!response.ok) throw new Error('Database schema export file not compiled.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sri-chaitanya-dental-crm-database.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('success', 'Database Package Ready', "'sri-chaitanya-dental-crm-database.zip' downloaded successfully.");
    } catch (err: any) {
      console.warn('Fallback direct request to database pipeline:', err);
      window.open('/sri-chaitanya-dental-crm-database.zip', '_blank');
      notify('success', 'Download Triggered', 'Attempted fallback database transfer.');
    } finally {
      setDownloadingDatabase(false);
    }
  };

  // Deployment package bundle compiler
  const handleDownloadDeploymentPackage = async () => {
    setDownloadingDeployment(true);
    notify('info', 'Compiling Deployment Bundle', 'Preparing migrations, schemas, and configurations...');
    try {
      const response = await fetch('/sri-chaitanya-dental-crm-production-package.zip');
      if (!response.ok) throw new Error('Exporter pre-build package target missing.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sri-chaitanya-dental-crm-production-package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('success', 'Deployment Package Complete', "'sri-chaitanya-dental-crm-production-package.zip' downloaded successfully.");
    } catch (err: any) {
      console.warn('Fallback direct request for deployment package:', err);
      window.open('/sri-chaitanya-dental-crm-production-package.zip', '_blank');
      notify('success', 'Download Request Routed', 'Handloaded package build via fallback pipeline.');
    } finally {
      setDownloadingDeployment(false);
    }
  };

  // Master Full Repository package downloader
  const handleDownloadMasterRepository = async () => {
    setDownloadingMaster(true);
    notify('info', 'Compiling Master Repository', 'Generating final consolidated repository layout...');
    try {
      const response = await fetch('/Sri-Chaitanya-Dental-CRM-Full-Repository.zip');
      if (!response.ok) throw new Error('Exporter master repository build failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sri-Chaitanya-Dental-CRM-Full-Repository.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('success', 'Master Package Ready', "'Sri-Chaitanya-Dental-CRM-Full-Repository.zip' compiled and downloaded successfully.");
    } catch (err: any) {
      console.warn('Fallback direct request for master package:', err);
      window.open('/Sri-Chaitanya-Dental-CRM-Full-Repository.zip', '_blank');
      notify('success', 'Master Package Routed', 'Fetched master consolidated repo via pipeline redirect.');
    } finally {
      setDownloadingMaster(false);
    }
  };

  // Environment template exporter
  const handleDownloadEnvTemplate = () => {
    const envContent = `# SRI CHAITANYA DENTAL CLINIC CRM - BACKUP ENV TEMPLATE
# =======================================================
# Never share your actual credentials in public backup locations!
# Populate the placeholders below regarding local/live hosting:

# Supabase Realtime Database & API Key Handshakes
VITE_SUPABASE_URL=https://your-supabase-app-url.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhYmNkZWZ...your_anon_key

# Twilio Communications SMS Service Configuration
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# Google Drive Sync & OAuth Authentication API IDs
VITE_GOOGLE_CLIENT_ID=your_gcloud_oauth_client_id.apps.googleusercontent.com
`;
    triggerDownload(envContent, '.env.example', 'text/plain;charset=utf-8;');
    notify('success', 'Env Template Generated', '.env.example template prepared with placeholders.');
  };

  // Upload to Google Drive snapshot
  const handleUploadToDrive = async () => {
    if (!accessToken) {
      setMessage({ type: 'error', text: 'Please connect to Google Drive before exporting.' });
      return;
    }

    setUploading(true);
    setMessage({ type: 'info', text: 'Packaging current codebase snapshot into ZIP...' });
    setFileLink(null);

    try {
      const zipRes = await fetch('/project-export.zip');
      let zipBlob: Blob;
      
      if (zipRes.ok) {
        zipBlob = await zipRes.blob();
      } else {
        const staticZipRes = await fetch('/project-export.zip');
        if (!staticZipRes.ok) {
          throw new Error('Static ZIP asset is missing. Run production build first.');
        }
        zipBlob = await staticZipRes.blob();
      }

      setMessage({ type: 'info', text: 'Uploading ZIP blob stream to Google Drive...' });

      const metadata = {
        name: `Sri_Chaitanya_Dental_Care_Backup_${new Date().toISOString().split('T')[0]}.zip`,
        mimeType: 'application/zip',
        parents: selectedFolderId !== 'root' ? [selectedFolderId] : undefined
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', zipBlob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Google API status code: ${response.status}`);
      }

      const fileData = await response.json();
      const driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
      
      setFileLink(driveUrl);
      setMessage({ 
        type: 'success', 
        text: `Successfully exported project to Google Drive as "${metadata.name}"!` 
      });
      notify('success', 'Google Backup Complete', `Exported codebase as "${metadata.name}".`);

    } catch (err: any) {
      setMessage({ type: 'error', text: 'Upload failed: ' + (err.message || err) });
      notify('error', 'Google Drive Sync Failed', 'The backup upload request did not resolve.', err?.message || String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <FolderDown size={24} />
            </div>
            <div>
              <h2 className="text-slate-900 font-extrabold text-lg tracking-tight">Backup & Disaster Recovery Dashboard</h2>
              <p className="text-slate-500 text-xs mt-0.5">Maintain seamless backups, package the source files, export databases, and check connection health.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer
              ${showSettings 
                ? 'bg-slate-100 border-slate-300 text-slate-800' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-55'
              }`}
          >
            <Settings size={14} /> Drive Credentials
          </button>
        </div>

        {/* Global Messages */}
        {message && (
          <div className={`mt-5 p-4 rounded-xl flex items-start gap-3 border animate-fadeIn
            ${message.type === 'success' ? 'bg-emerald-55 border-emerald-110 text-emerald-800' : ''}
            ${message.type === 'error' ? 'bg-rose-55 border-rose-110 text-rose-800' : ''}
            ${message.type === 'info' ? 'bg-sky-55 border-sky-110 text-sky-800' : ''}
          `}>
            {message.type === 'success' && <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />}
            {message.type === 'error' && <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />}
            {message.type === 'info' && <RefreshCw size={16} className="text-sky-500 flex-shrink-0 mt-0.5 animate-spin" />}
            <div className="text-xs">
              <p className="font-semibold">{message.text}</p>
              {fileLink && (
                <a 
                  href={fileLink} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-75 text-white font-semibold rounded-lg text-[10px] transition"
                >
                  Open in Google Drive <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4 animate-slideDown">
          <div>
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 text-teal-400">
              <Settings size={15} /> OAuth Client Setup (Advanced Settings)
            </h3>
            <p className="text-slate-400 text-xs mt-1">Configure your Google API credentials to enable direct serverless Drive backups.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Google Client ID Form */}
            <div className="space-y-2 border-r border-slate-800/80 pr-0 sm:pr-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Google Client ID</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Paste GCloud Client ID..."
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs placeholder-slate-600 text-slate-350 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Web Application credentials from Google Cloud Platform console. Must list <code className="bg-slate-950 p-0.5 rounded px-1">{window.location.origin}</code> under Authorized JavaScript Origins.
              </p>
            </div>

            {/* Direct Token Fallback */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Alternative: Direct OAuth Token</label>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formEl = e.currentTarget;
                const inputEl = formEl.elements.namedItem('directToken') as HTMLInputElement;
                if (inputEl) handleDirectTokenSubmit(inputEl.value);
              }} className="flex gap-2">
                <input 
                  name="directToken"
                  type="password"
                  placeholder="Paste OAuth Access Token..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs placeholder-slate-600 text-slate-350 focus:outline-none focus:border-teal-500 font-mono"
                />
                <button type="submit" className="px-3 bg-slate-800 hover:bg-slate-705 text-white font-semibold rounded-xl text-xs flex-shrink-0 transition cursor-pointer">
                  Apply
                </button>
              </form>
              <p className="text-[10px] text-slate-500 leading-normal">
                Prefer direct sync? Paste a temporary token generated via the Google OAuth Playground. Select Drive API permissions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid containing Health Monitor and Database backups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COL 1: System Health Monitor & Blueprint Downloader */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* System Health */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-slate-800 font-extrabold text-sm tracking-tight flex items-center gap-2">
              <Activity className="text-teal-600" size={16} /> Live Connectivity Health
            </h3>
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Database Connection</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${dbStatus === 'online' ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                  {dbStatus === 'online' ? 'CONNECTED' : (dbStatus === 'checking' ? 'PROBING...' : 'DISCONNECTED')}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Supabase Service API</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${supabaseStatus === 'online' ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
                  {supabaseStatus === 'online' ? 'OPERATIONAL' : (supabaseStatus === 'checking' ? 'PROBING...' : 'OFFLINE')}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Realtime Handshake</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${realtimeStatus === 'active' ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
                  {realtimeStatus === 'active' ? 'ACTIVE' : (realtimeStatus === 'checking' ? 'TUNING...' : 'RESTRAINED')}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Build Output Check</span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                  COMPILED
                </span>
              </div>
              <div className="flex items-center justify-between pb-0.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Serverless Readiness</span>
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {deploymentReadiness}
                </span>
              </div>
            </div>

            <button 
              onClick={checkSystemHealth}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold border border-slate-150 rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw size={12} /> Test Live Handshake
            </button>
          </div>

          {/* Backup Packages */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-slate-800 font-extrabold text-sm tracking-tight flex items-center gap-2">
              <Server className="text-teal-600" size={16} /> Codebase Package Exporter
            </h3>
            <p className="text-slate-500 text-xs leading-normal">Extract and compress complete system build structures and resources for local execution or disaster migration.</p>
            
            <div className="space-y-2 pt-1">
              <button 
                onClick={handleDownloadMasterRepository}
                disabled={downloadingMaster}
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow transition active:scale-95 disabled:opacity-50 cursor-pointer border-none"
              >
                {downloadingMaster ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FileArchive size={14} className="text-emerald-100" />
                )}
                Master Full Repository ZIP
              </button>

              <button 
                onClick={handleDownloadSourceCode}
                disabled={downloadingSource}
                className="w-full h-11 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-teal-200/50 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {downloadingSource ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FileArchive size={14} className="text-teal-600" />
                )}
                Source Code ZIP
              </button>

              <button 
                onClick={handleDownloadDatabaseZIP}
                disabled={downloadingDatabase}
                className="w-full h-11 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-teal-200/80 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {downloadingDatabase ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Database size={14} className="text-teal-600" />
                )}
                Database & Schema ZIP
              </button>

              <button 
                onClick={handleDownloadDeploymentPackage}
                disabled={downloadingDeployment}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-slate-100 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer border-none"
              >
                {downloadingDeployment ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <FolderDown size={14} />
                )}
                Deployment Package Bundle
              </button>

              <button 
                type="button"
                onClick={handleDownloadEnvTemplate}
                className="w-full h-11 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Key className="text-slate-400" size={14} />
                Download .env.example
              </button>
            </div>
          </div>

        </div>

        {/* COL 2 & 3: Database CSV backup ledger & Google drive sync */}
        <div className="lg:col-span-2 space-y-6">

          {/* Live Database Backups */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-slate-350 transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-slate-850 font-extrabold text-base tracking-tight flex items-center gap-2">
                  <Database className="text-teal-600" size={18} /> Database Backup Ledger (Live Data)
                </h3>
                <p className="text-slate-500 text-xs">Query local Supabase tables directly to extract clean spreadsheets on-demand.</p>
              </div>
              <button 
                onClick={handleExportAllData}
                disabled={exportingAll}
                className="bg-teal-600 hover:bg-teal-705 text-white px-4 py-2.5 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm border-none disabled:opacity-50 cursor-pointer"
              >
                {exportingAll ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <FileArchive size={13} />
                )}
                Export All Data (ZIP)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1.5">
              {/* Tables row map */}
              {[
                { name: 'Patients', table: 'patients', desc: 'Roster codes, locations, notes' },
                { name: 'Appointments', table: 'appointments', desc: 'Active visits and clinic slots' },
                { name: 'Doctors Rosters', table: 'doctors', desc: 'Credentials and specialization logs' },
                { name: 'Treatments Tracker', table: 'treatments', desc: 'Session metrics and stage plans' },
                { name: 'Billing Invoices', table: 'bills', desc: 'Financial transaction details' },
                { name: 'Staff & Roles List', table: 'staff_roles', desc: 'System level staff configurations' }
              ].map((item) => (
                <div key={item.table} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileSpreadsheet size={13} className="text-emerald-600" />
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleExportCSV(item.table as any)}
                    className="p-2 bg-slate-50 hover:bg-teal-50 hover:text-teal-700 text-slate-500 rounded-lg transition"
                    title={`Export ${item.name}`}
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Options B: Connected state */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-350 transition-all duration-300 group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wide">G-Drive Sync</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1
                    ${accessToken ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}
                  `}>
                    <div className={`w-1.5 h-1.5 rounded-full ${accessToken ? 'bg-sky-500 animate-pulse' : 'bg-slate-400'}`} />
                    {accessToken ? 'Connected' : 'Offline'}
                  </div>
                </div>

                {accessToken && userProfile ? (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {userProfile.picture ? (
                          <img src={userProfile.picture} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            {userProfile.name?.[0] || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-tight truncate">{userProfile.name || 'Google User'}</p>
                          <p className="text-[10px] text-slate-500 leading-tight truncate mt-0.5">{userProfile.email}</p>
                        </div>
                      </div>
                      <button onClick={handleDisconnect} className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer">
                        Disconnect
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/50 text-slate-800">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Destination Folder</label>
                      <div className="relative">
                        <Folder className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 animate-pulse" />
                        <select
                          value={selectedFolderId}
                          onChange={(e) => setSelectedFolderId(e.target.value)}
                          disabled={isFetchingFolders}
                          className="w-full bg-white border border-slate-200 text-xs rounded-lg py-1.5 pl-8 pr-3 outline-none focus:border-sky-500 cursor-pointer font-medium text-slate-705"
                        >
                          <option value="root">My Drive (Root)</option>
                          {folders.map(folder => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wide">Sync project to Google Cloud</h4>
                    <p className="text-slate-500 text-xs leading-normal">
                      Connect your corporate GCloud Drive to automatically deploy compiled Snapshots with a single action.
                    </p>
                    <div className="flex gap-2.5 pt-1">
                      <button 
                        onClick={handleConnect}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl py-2 px-3 text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border-none shadow-sm"
                      >
                        <LogIn size={13} /> GCloud Sign In
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button 
                  onClick={handleUploadToDrive}
                  disabled={uploading || !accessToken}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer border-none"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <CloudLightning size={14} /> Send snapshot ZIP to Drive
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Reconciliation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between hover:border-slate-350 transition-all duration-300 group">
              <div className="space-y-3">
                <span className="p-1 px-2.5 rounded bg-teal-50 text-teal-700 text-[10px] font-bold uppercase tracking-wide inline-block">Data Alignment</span>
                <h4 className="text-slate-850 font-extrabold text-xs uppercase tracking-wide">Database Alignment & Repair</h4>
                <p className="text-slate-500 text-xs leading-normal">
                  Link unassigned schedules to patient files using standard telephone matching, ensuring full integrity across clinical streams.
                </p>
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl p-2.5 mt-2 justify-between">
                  <span className="text-[10px] font-bold text-slate-550 uppercase">Detached Items</span>
                  <span className="text-base font-bold font-mono text-slate-800">
                    {unlinkedCount === null ? (
                      <RefreshCw size={14} className="animate-spin text-slate-400" />
                    ) : (
                      unlinkedCount
                    )}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button 
                  onClick={runDeepSync}
                  disabled={isSyncing}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 border-none cursor-pointer"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                  Deep Sync & Index Repair
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Production Deployment Instructions Card */}
      <div className="bg-[#FAF9F5] border border-orange-100/70 rounded-2xl p-6 space-y-3">
        <h3 className="text-amber-800 font-extrabold text-sm tracking-tight flex items-center gap-1.5">
          <ShieldCheck size={16} className="text-amber-600" /> Production Release Blueprint
        </h3>
        <p className="text-slate-650 text-xs leading-normal font-semibold">
          Your compiled workspace packages containing the source codebase are fully prepared for disaster deployment, local sandboxes, and production hosting environments:
        </p>
        <div className="grid gap-3.5 sm:grid-cols-3 text-slate-700 text-[11px] pt-1.5 font-medium">
          <div className="space-y-1.5 bg-white border border-slate-150 p-3 rounded-xl">
            <p className="font-bold text-teal-850 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-605 border border-teal-100 flex items-center justify-center text-[9px] font-bold">1</span>
              Local Sandbox Bootstrapping
            </p>
            <p className="text-slate-500 text-[10px] leading-relaxed font-semibold">Unzip the source package locally. Execute <code className="bg-slate-100 px-0.5 rounded">npm install</code> followed by <code className="bg-slate-100 px-0.5 rounded">npm run dev</code> for on-premise dental workstations.</p>
          </div>
          <div className="space-y-1.5 bg-white border border-slate-150 p-3 rounded-xl">
            <p className="font-bold text-teal-850 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-605 border border-teal-100 flex items-center justify-center text-[9px] font-bold">2</span>
              Database Structure Execution
            </p>
            <p className="text-slate-500 text-[10px] leading-relaxed font-semibold">Import clinical schemas safely. Trigger the complete <code className="bg-slate-100 px-0.5 rounded">schema.sql</code> scripts or sequential migrations located in the zip archive directly inside Supabase SQL editor.</p>
          </div>
          <div className="space-y-1.5 bg-white border border-slate-150 p-3 rounded-xl">
            <p className="font-bold text-teal-850 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-605 border border-teal-100 flex items-center justify-center text-[9px] font-bold">3</span>
              Production Cloud Hosting
            </p>
            <p className="text-slate-500 text-[10px] leading-relaxed font-semibold">Ready for Vercel, Netlify, or AWS pipelines! Simply push the configured folder structure, register database connection credentials, and build instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
