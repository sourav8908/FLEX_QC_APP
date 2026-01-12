import React, { useState, useEffect } from 'react';
import { AppStep, Stage, User, QCReport, CheckpointResult } from './types';
import { getStoredUsers, saveUsers, saveReport, getStoredReports } from './storage';
import { FQC_CHECKPOINTS, PACKAGING_CHECKPOINTS } from './constants.tsx';
import { 
  CameraIcon, 
  UserIcon, 
  ChevronRightIcon, 
  CheckIcon, 
  XIcon, 
  ArrowLeftIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  SaveIcon
} from './components/Icons';
import { suggestFailureReason } from './services/geminiService';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const ZoomableImage: React.FC<{ src: string; onRemove?: () => void }> = ({ src, onRemove }) => {
  const [scale, setScale] = useState(1);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale(prev => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden rounded-xl">
      <img
        src={src}
        alt="Uploaded Preview"
        style={{ transform: `scale(${scale})` }}
        className="max-w-full max-h-full object-contain transition-transform duration-200 ease-out"
      />
      <div className="absolute bottom-3 left-3 flex gap-2 z-10">
        <button 
          onClick={handleZoomOut}
          className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-lg border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
        >
          - Zoom
        </button>
        <button 
          onClick={handleZoomIn}
          className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-lg border border-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
        >
          + Zoom
        </button>
      </div>
      {onRemove && (
        <button 
          onClick={(e) => { e.preventDefault(); onRemove(); }}
          className="absolute top-3 right-3 bg-red-600/80 text-white p-2 rounded-full hover:bg-red-600 transition-colors z-10 shadow-lg"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.STAGE_SELECTION);
  const [selectedStage, setSelectedStage] = useState<Stage>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [deviceImage, setDeviceImage] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointResult[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleStageSelect = (stage: Stage) => {
    setSelectedStage(stage);
    if (currentUser && !currentUser.isAdmin) {
      if (currentUser.assignedStage !== stage) {
         setError(`Access denied. You are assigned to ${currentUser.assignedStage}.`);
         return;
      }
      setCurrentStep(AppStep.DEVICE_ID_ENTRY);
    } else {
      setCurrentStep(AppStep.LOGIN);
    }
    setError('');
  };

  const handleAdminAccess = () => {
    setSelectedStage(null); 
    if (currentUser?.isAdmin) {
      setCurrentStep(AppStep.ADMIN);
    } else {
      setCurrentStep(AppStep.LOGIN);
    }
    setError('');
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userId = formData.get('userId') as string;
    const password = formData.get('password') as string;

    const users = getStoredUsers();
    const user = users.find(u => u.userId === userId && u.password === password);

    if (user) {
      if (!user.isActive) {
        setError('Account is disabled. Please contact Admin.');
        return;
      }
      if (user.isAdmin) {
        setCurrentUser(user);
        setError('');
        setCurrentStep(AppStep.ADMIN);
      } else {
        if (!selectedStage) {
            setError('Please select a stage from the home screen first.');
            return;
        }
        if (user.assignedStage !== selectedStage) {
          setError(`Access denied. You are assigned to ${user.assignedStage}.`);
          return;
        }
        setCurrentUser(user);
        setError('');
        setCurrentStep(AppStep.DEVICE_ID_ENTRY);
      }
    } else {
      setError('Invalid User ID or Password.');
    }
  };

  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      setError('Device ID is required');
      return;
    }
    setError('');
    const baseCheckpoints = selectedStage === 'FQC' ? FQC_CHECKPOINTS : PACKAGING_CHECKPOINTS;
    setCheckpoints(baseCheckpoints.map(cp => ({ ...cp, status: null, image: null, reason: '' })));
    setCurrentStep(AppStep.CHECKLIST);
  };

  const handleCheckpointUpdate = (id: string, updates: Partial<CheckpointResult>) => {
    setCheckpoints(prev => prev.map(cp => cp.id === id ? { ...cp, ...updates } : cp));
  };

  const handleAddCheckpoint = () => {
    const newId = `custom_${Date.now()}`;
    setCheckpoints(prev => [...prev, { id: newId, label: 'New Checkpoint', status: null, image: null, reason: '' }]);
    setEditingId(newId);
  };

  const handleDeleteCheckpoint = (id: string) => {
    setCheckpoints(prev => prev.filter(cp => cp.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleAIReason = async (id: string, label: string) => {
    const reason = await suggestFailureReason(label, selectedStage || 'General');
    handleCheckpointUpdate(id, { reason });
  };

  const handleFinalSubmit = () => {
    const isComplete = checkpoints.every(cp => cp.status !== null && cp.image !== null && (cp.status === 'Pass' || (cp.status === 'Fail' && cp.reason.trim() !== '')));
    if (!isComplete) { alert('Please complete all checkpoints, images, and reasons.'); return; }
    setIsSubmitting(true);
    const report: QCReport = { id: `REP-${Date.now()}`, timestamp: new Date().toISOString(), stage: selectedStage, userId: currentUser?.userId || 'Unknown', deviceId, checkpoints };
    setTimeout(() => { saveReport(report); setIsSubmitting(false); setCurrentStep(AppStep.SUCCESS); }, 1500);
  };

  const resetApp = () => { setDeviceId(''); setDeviceImage(null); setCheckpoints([]); setCurrentStep(AppStep.DEVICE_ID_ENTRY); };
  const logout = () => { setCurrentUser(null); setSelectedStage(null); setDeviceId(''); setDeviceImage(null); setCheckpoints([]); setError(''); setCurrentStep(AppStep.STAGE_SELECTION); };

  const renderHeader = () => (
    <header className="factory-gradient text-white p-4 shadow-lg flex justify-between items-center">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => !currentUser && setCurrentStep(AppStep.STAGE_SELECTION)}>
        <div className="bg-white p-1 rounded">
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="10" fill="#1e293b"/><path d="M25 25H75V40H40V50H70V65H40V75H25V25Z" fill="white"/></svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight uppercase">Flex <span className="font-light">QC</span></h1>
      </div>
      {currentUser && (
        <div className="flex items-center gap-4">
          <div className="text-right border-r border-white/10 pr-4">
            <p className="text-[10px] text-blue-300 uppercase font-black tracking-widest leading-none">{selectedStage || (currentUser.isAdmin ? 'ADMIN' : 'CONSOLE')}</p>
            <p className="text-sm font-bold">{currentUser.userId}</p>
          </div>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-all font-black text-[10px] uppercase shadow-lg active:scale-95">Logout</button>
        </div>
      )}
    </header>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {renderHeader()}
      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
        {currentStep === AppStep.STAGE_SELECTION && (
          <div className="flex-1 flex flex-col justify-center gap-6 text-center animate-in fade-in duration-500">
            <div className="mb-4">
              <h2 className="text-3xl font-extrabold text-gray-900 uppercase">Stage Selection</h2>
              <p className="text-gray-500 font-medium">Select station to initiate quality check</p>
            </div>
            <div className="grid gap-4">
              <button onClick={() => handleStageSelect('FQC')} className="h-28 bg-white border-2 border-slate-200 hover:border-blue-600 rounded-2xl shadow-sm text-2xl font-black uppercase text-gray-800 transition-all active:scale-95">FQC</button>
              <button onClick={() => handleStageSelect('Packaging')} className="h-28 bg-white border-2 border-slate-200 hover:border-blue-600 rounded-2xl shadow-sm text-2xl font-black uppercase text-gray-800 transition-all active:scale-95">Packaging</button>
              <button onClick={handleAdminAccess} className="text-slate-400 font-bold uppercase text-xs hover:text-slate-600 mt-4 flex items-center justify-center gap-2 transition-colors"><UserIcon className="w-4 h-4" /> Admin Access</button>
            </div>
          </div>
        )}

        {currentStep === AppStep.LOGIN && (
          <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-left duration-300">
            <button onClick={() => setCurrentStep(AppStep.STAGE_SELECTION)} className="mb-6 flex items-center text-blue-600 font-bold text-sm gap-1 hover:text-blue-800 transition-colors"><ArrowLeftIcon className="w-4 h-4" /> BACK</button>
            <h2 className="text-2xl font-black uppercase mb-6">User Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">User ID</label>
                <input name="userId" required placeholder="Enter User ID" className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl font-bold text-lg text-black" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Password</label>
                <input name="password" type="password" required placeholder="••••••••" className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl font-bold text-lg text-black" />
              </div>
              {error && <div className="text-red-600 font-bold text-sm p-4 bg-red-50 rounded-xl border border-red-100">{error}</div>}
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest active:scale-[0.98] transition-transform">Login</button>
            </form>
          </div>
        )}

        {currentStep === AppStep.DEVICE_ID_ENTRY && (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-in slide-in-from-right duration-300">
            <button onClick={() => setCurrentStep(AppStep.STAGE_SELECTION)} className="self-start flex items-center text-blue-600 font-bold text-sm gap-1 hover:text-blue-800 transition-colors"><ArrowLeftIcon className="w-4 h-4" /> BACK</button>
            <h2 className="text-2xl font-black uppercase text-center">Device Identification</h2>
            
            <div className="space-y-4">
              <div className={`w-full h-64 rounded-2xl overflow-hidden transition-all border-2 ${deviceImage ? 'border-blue-500 shadow-md bg-slate-100' : 'border-dashed border-gray-300 hover:border-blue-400'}`}>
                {!deviceImage ? (
                  <label className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer text-gray-500">
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setDeviceImage(await fileToBase64(file)); }} />
                    <CameraIcon className="w-10 h-10 text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Device Photo Required</span>
                  </label>
                ) : (
                  <ZoomableImage src={deviceImage} onRemove={() => setDeviceImage(null)} />
                )}
              </div>

              {deviceImage && (
                <button 
                  type="button"
                  onClick={() => document.getElementById('serialNumberInput')?.focus()}
                  className="w-full py-2 bg-blue-50 text-blue-600 font-black text-[10px] uppercase rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  Continue to Serial Entry <ChevronRightIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Serial Number</label>
              <input 
                id="serialNumberInput"
                value={deviceId} 
                onChange={(e) => setDeviceId(e.target.value.toUpperCase())} 
                placeholder="FLEX-XXXX" 
                className="w-full px-4 py-4 bg-white border border-gray-200 rounded-xl text-center text-xl font-mono font-black tracking-widest text-black" 
              />
            </div>
            <button onClick={handleDeviceSubmit} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest active:scale-[0.98] transition-transform">Continue <ChevronRightIcon className="inline ml-1" /></button>
          </div>
        )}

        {currentStep === AppStep.CHECKLIST && (
          <div className="space-y-4 pb-28 animate-in slide-in-from-bottom duration-300">
            <button onClick={() => setCurrentStep(AppStep.DEVICE_ID_ENTRY)} className="mb-2 flex items-center text-blue-600 font-bold text-sm gap-1 hover:text-blue-800 transition-colors"><ArrowLeftIcon className="w-4 h-4" /> BACK</button>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 sticky top-4 z-20">
              <div className="flex-1">
                <p className="text-[9px] uppercase font-black text-gray-400">Device ID</p>
                <p className="text-lg font-mono font-black text-blue-600">{deviceId}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase font-black text-gray-400">Stage</p>
                <p className="text-xs font-black text-gray-700 uppercase">{selectedStage}</p>
              </div>
            </div>
            {checkpoints.map((cp, idx) => (
              <div key={cp.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-[9px] bg-gray-200 px-2 py-0.5 rounded-full font-black text-gray-500 uppercase">Checkpoint {idx + 1}</span>
                    {editingId === cp.id ? (
                      <input autoFocus className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 text-sm font-bold outline-none text-black" value={cp.label} onChange={(e) => handleCheckpointUpdate(cp.id, { label: e.target.value })} onBlur={() => setEditingId(null)} onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)} />
                    ) : (
                      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">{cp.label} <button onClick={() => setEditingId(cp.id)} className="text-gray-300 hover:text-blue-500 transition-colors"><EditIcon className="w-3.5 h-3.5" /></button></h3>
                    )}
                  </div>
                  <button onClick={() => handleDeleteCheckpoint(cp.id)} className="text-gray-300 hover:text-red-500 ml-2 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleCheckpointUpdate(cp.id, { status: 'Pass' })} className={`py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all ${cp.status === 'Pass' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><CheckIcon className="w-4 h-4" /> PASS</button>
                    <button onClick={() => handleCheckpointUpdate(cp.id, { status: 'Fail' })} className={`py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all ${cp.status === 'Fail' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><XIcon className="w-4 h-4" /> FAIL</button>
                  </div>
                  {!cp.image ? (
                    <label className="w-full py-4 bg-blue-50 text-blue-700 rounded-xl border-2 border-dashed border-blue-200 flex items-center justify-center gap-2 font-black text-[10px] uppercase cursor-pointer hover:bg-blue-100 transition-colors"><input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) handleCheckpointUpdate(cp.id, { image: await fileToBase64(file) }); }} /><CameraIcon className="w-4 h-4" /> Photo Required</label>
                  ) : (
                    <div className="h-56 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-slate-100">
                      <ZoomableImage src={cp.image} onRemove={() => handleCheckpointUpdate(cp.id, { image: null })} />
                    </div>
                  )}
                  {cp.status === 'Fail' && (
                    <div className="animate-in slide-in-from-top duration-300">
                      <div className="flex justify-between items-center mb-1.5"><label className="text-[10px] font-black text-red-600 uppercase tracking-widest">Failure Reason</label><button onClick={() => handleAIReason(cp.id, cp.label)} className="text-[9px] text-purple-600 font-black px-2 py-0.5 rounded border border-purple-100 uppercase hover:bg-purple-50 transition-colors">✨ AI Assist</button></div>
                      <textarea value={cp.reason} onChange={(e) => handleCheckpointUpdate(cp.id, { reason: e.target.value })} placeholder="Enter defect details..." className="w-full p-3 bg-red-50 border border-red-100 rounded-xl text-sm outline-none font-bold h-20 text-black" />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button onClick={handleAddCheckpoint} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 font-black text-[10px] uppercase hover:border-gray-400 hover:text-gray-500 transition-all"><PlusIcon className="w-4 h-4" /> Add Checkpoint</button>
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-30 max-w-2xl mx-auto w-full shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
               <button disabled={isSubmitting} onClick={handleFinalSubmit} className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] ${isSubmitting ? 'bg-gray-400' : 'bg-slate-900'} text-white shadow-xl`}>{isSubmitting ? 'Submitting...' : 'Submit Final Report'}</button>
            </div>
          </div>
        )}

        {currentStep === AppStep.SUCCESS && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner"><CheckIcon className="w-12 h-12" /></div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Report Submitted</h2>
            <button onClick={resetApp} className="w-full max-w-xs bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl uppercase text-sm active:scale-95 transition-transform">Next Device</button>
          </div>
        )}

        {currentStep === AppStep.ADMIN && <AdminPanel onBack={() => setCurrentStep(AppStep.STAGE_SELECTION)} onLogout={logout} />}
      </main>
    </div>
  );
};

const AdminPanel: React.FC<{ onBack: () => void, onLogout: () => void }> = ({ onBack, onLogout }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStage, setNewStage] = useState<Stage>('FQC');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStage, setSearchStage] = useState<Stage>('FQC');
  const [searchResult, setSearchResult] = useState<User | null | undefined>(undefined);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => setUsers(getStoredUsers()), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId || !newPassword) return;

    let updated: User[];
    if (editingUserId) {
      updated = users.map(u => u.userId === editingUserId ? { ...u, password: newPassword, assignedStage: newStage } : u);
      setEditingUserId(null);
    } else {
      const newUser: User = { 
        userId: newUserId, 
        password: newPassword, 
        isAdmin: false, 
        isActive: true, 
        assignedStage: newStage 
      };
      updated = [...users, newUser];
    }

    setUsers(updated);
    saveUsers(updated);
    setNewUserId('');
    setNewPassword('');
    setNewStage('FQC'); // Reset to default
    setHasSearched(false); 
  };

  const handleEdit = (user: User) => {
    setEditingUserId(user.userId);
    setNewUserId(user.userId);
    setNewPassword(user.password);
    setNewStage(user.assignedStage); // Correctly populate the stage toggle for editing
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setNewUserId('');
    setNewPassword('');
    setNewStage('FQC'); // Reset to default
  };

  const deleteUser = (userId: string) => {
    if (userId === 'admin') return;
    if (!confirm(`Confirm deletion of operator: ${userId}?`)) return;
    const updated = users.filter(u => u.userId !== userId);
    setUsers(updated);
    saveUsers(updated);
    if (searchResult?.userId === userId) setSearchResult(null);
  };

  const toggleStatus = (userId: string) => {
    if (userId === 'admin') return;
    const updated = users.map(u => u.userId === userId ? { ...u, isActive: !u.isActive } : u);
    setUsers(updated);
    saveUsers(updated);
    if (searchResult?.userId === userId) {
        setSearchResult(updated.find(u => u.userId === userId));
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
        setHasSearched(false);
        setSearchResult(undefined);
        return;
    }
    const found = users.find(u => u.userId.toLowerCase() === searchQuery.toLowerCase().trim() && u.assignedStage === searchStage);
    setSearchResult(found || null);
    setHasSearched(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setHasSearched(false);
    setSearchResult(undefined);
  };

  const handleExportCSV = () => {
    const reports = getStoredReports();
    if (reports.length === 0) {
      alert('No reports available to export.');
      return;
    }

    // Helper to escape CSV values safely
    const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

    const headers = ['Report ID', 'Timestamp', 'Stage', 'User ID', 'Device ID', 'Checkpoints Summary'];
    const rows = reports.map(r => {
      // Create a detailed summary of checkpoints for a single column
      const checkpointsSummary = r.checkpoints.map(cp => 
        `${cp.label}: ${cp.status || 'N/A'}${cp.status === 'Fail' ? ` (Reason: ${cp.reason || 'Not provided'})` : ''}`
      ).join(' | ');

      return [
        escape(r.id),
        escape(r.timestamp),
        escape(r.stage),
        escape(r.userId),
        escape(r.deviceId),
        escape(checkpointsSummary)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set timestamped filename
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Flex_QC_Export_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <button onClick={onBack} className="self-start flex items-center text-blue-600 font-bold text-sm gap-1 hover:text-blue-800 transition-colors"><ArrowLeftIcon className="w-4 h-4" /> BACK</button>
        
        <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="10" fill="#1e293b"/><path d="M25 25H75V40H40V50H70V65H40V75H25V25Z" fill="white"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight">Admin Console</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Export Reports Button */}
            <button 
              onClick={handleExportCSV}
              className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 group border border-blue-500"
              title="Download QC reports as CSV"
            >
              <SaveIcon className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
              <span className="text-[10px] font-black uppercase">Export Reports</span>
            </button>
            <button onClick={onLogout} className="text-red-500 font-black text-xs uppercase border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Logout</button>
          </div>
        </div>
      </div>
      
      {/* Search Block */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 space-y-4">
        <h3 className="text-slate-900 font-black uppercase text-xs tracking-widest mb-2 flex items-center gap-2">
            Search Operator
        </h3>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={() => setSearchStage('FQC')}
              className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${searchStage === 'FQC' ? 'bg-slate-900 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              FQC Inspection
            </button>
            <button 
              type="button"
              onClick={() => setSearchStage('Packaging')}
              className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${searchStage === 'Packaging' ? 'bg-slate-900 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              Packaging & QC
            </button>
          </div>
          
          <div className="flex gap-2">
            <input 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              placeholder="Enter Operator User ID..." 
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none font-bold text-black" 
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              onClick={handleSearch}
              className="bg-slate-900 text-white font-black px-6 py-3 rounded-xl hover:bg-black transition-colors uppercase text-[10px] tracking-widest active:scale-95"
            >
              Search
            </button>
          </div>
          
          {hasSearched && (
            <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50 animate-in slide-in-from-top duration-300">
              {searchResult ? (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Search Result</p>
                    <p className="text-lg font-black text-slate-900">{searchResult.userId}</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase">{searchResult.assignedStage === 'FQC' ? 'FQC Inspection' : 'Packaging & QC'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(searchResult)} className="text-blue-600 bg-white border border-blue-100 p-2 rounded-lg shadow-sm hover:bg-blue-50 transition-colors">
                      <EditIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => deleteUser(searchResult.userId)} className="text-red-600 bg-white border border-red-100 p-2 rounded-lg shadow-sm hover:bg-red-50 transition-colors">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm font-bold text-gray-700 uppercase">No operator found for the selected section.</p>
                  <button onClick={clearSearch} className="text-[10px] text-blue-600 font-black uppercase mt-1 underline hover:text-blue-800">Clear Search</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-black uppercase text-xs tracking-widest">
            {editingUserId ? `Updating Operator: ${editingUserId}` : 'Register New Operator'}
          </h3>
          {editingUserId && (
            <button onClick={cancelEdit} className="text-slate-400 text-[10px] font-black uppercase hover:text-white transition-colors underline">Cancel</button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input 
              value={newUserId} 
              onChange={e => setNewUserId(e.target.value)} 
              placeholder="Operator User ID" 
              disabled={!!editingUserId}
              className={`admin-input bg-slate-800 border-none rounded-xl px-4 py-3 outline-none ${editingUserId ? 'opacity-50 cursor-not-allowed' : 'focus:bg-slate-700'}`} 
            />
            <input 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Password" 
              type="password" 
              className="admin-input bg-slate-800 border-none rounded-xl px-4 py-3 outline-none focus:bg-slate-700" 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Section</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={() => setNewStage('FQC')}
                className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${newStage === 'FQC' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                FQC Inspection
              </button>
              <button 
                type="button"
                onClick={() => setNewStage('Packaging')}
                className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${newStage === 'Packaging' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                Packaging & QC
              </button>
            </div>
          </div>
          
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 uppercase text-xs rounded-xl hover:bg-blue-500 transition-colors shadow-lg active:scale-[0.99]">
            {editingUserId ? 'Update Operator Profile' : 'Add Operator'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Complete Operator Registry</h3>
            {hasSearched && <button onClick={clearSearch} className="text-[9px] text-blue-600 font-black uppercase hover:underline transition-all">Show All Records</button>}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-gray-200 text-slate-500 font-black uppercase tracking-widest">
                <tr><th className="px-4 py-3">Operator User ID</th><th className="px-4 py-3">Assigned Section</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold">
                {users.map(u => (
                  <tr key={u.userId} className={`hover:bg-slate-50 transition-colors ${editingUserId === u.userId ? 'bg-blue-50' : ''} ${hasSearched && searchResult?.userId !== u.userId ? 'opacity-30' : ''}`}>
                    <td className="px-4 py-4 text-gray-900 font-bold">{u.userId}</td>
                    <td className="px-4 py-4 uppercase text-[10px] text-gray-700 font-black">
                      {u.assignedStage === 'FQC' ? 'FQC Inspection' : 'Packaging & QC'}
                    </td>
                    <td className="px-4 py-4"><span className={`text-[10px] uppercase ${u.isActive ? 'text-green-600' : 'text-red-600'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                    <td className="px-4 py-4 text-right flex justify-end gap-2">
                      <button 
                        disabled={u.isAdmin} 
                        onClick={() => toggleStatus(u.userId)} 
                        className={`text-[9px] uppercase font-black px-2 py-1 rounded border transition-colors ${u.isAdmin ? 'opacity-0' : (u.isActive ? 'text-amber-600 border-amber-100 hover:bg-amber-50' : 'text-green-600 border-green-100 hover:bg-green-50')}`}
                      >
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                      {!u.isAdmin && (
                        <>
                          <button onClick={() => handleEdit(u)} title="Edit Operator" className="text-blue-600 border border-blue-100 p-1 rounded hover:bg-blue-50 transition-colors">
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteUser(u.userId)} title="Delete Operator" className="text-red-600 border border-red-100 p-1 rounded hover:bg-red-50 transition-colors">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default App;