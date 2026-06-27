import { useEffect, useState, useRef } from 'react';
import { Camera, Play, Square, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getContrastColor } from '../lib/utils';

export default function Shift() {
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState('');
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const primaryColor = import.meta.env.VITE_PRIMARY_COLOR || '#000000';

  useEffect(() => {
    fetchAttendanceStatus();
  }, []);

  const fetchAttendanceStatus = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    
    if (userData.user) {
      // Find active attendance log for this user
      const { data } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', userData.user.id)
        .is('clock_out_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      setAttendance(data || null);
    }
    setLoading(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      alert("Cannot access camera");
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const url = canvas.toDataURL('image/jpeg');
    setPhotoUrl(url);
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const handleClockIn = async () => {
    if (!photoUrl || !openingCash) {
      alert("Please take a selfie and enter opening cash.");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase.from("users").select("outlet_id").eq("id", userData.user?.id).single();

      // Convert Base64 to Blob
      const fetchResponse = await fetch(photoUrl);
      const blob = await fetchResponse.blob();
      
      const fileName = `attendance/${userData.user?.id}_${Date.now()}.jpg`;
      
      // Upload to InsForge storage bucket named 'foto'
      const { error: uploadError } = await supabase.storage
        .from('foto')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('foto')
        .getPublicUrl(fileName);

      const actualPhotoUrl = publicUrlData?.publicUrl || '';

      const response = await supabase.functions.invoke('manage-business-cycle', {
        body: {
          action: 'clock_in',
          outletId: userRecord?.outlet_id,
          userId: userData.user?.id,
          openingCash: parseInt(openingCash),
          photoUrl: actualPhotoUrl
        }
      });

      if (response.error) throw response.error;
      
      alert("Clock-in successful!");
      setPhotoUrl(null);
      setOpeningCash('');
      fetchAttendanceStatus();
    } catch (err: any) {
      alert(err.message || "Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;
    if (!confirm("Are you sure you want to end your shift?")) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('manage-business-cycle', {
        body: {
          action: 'clock_out',
          userId: userData.user?.id,
          outletId: attendance.outlet_id
        }
      });
      
      if (response.error) throw response.error;
      
      alert("Clock-out successful! Shift closed.");
      fetchAttendanceStatus();
    } catch (err: any) {
      alert(err.message || "Failed to clock out");
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <h1 className="text-2xl font-bold mb-6">Shift / Attendance</h1>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : attendance ? (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-green-100 p-4 text-green-600">
            <Clock className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Shift Active</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Started: {new Date(attendance.clock_in_at || attendance.created_at).toLocaleString('id-ID')}
          </p>
          <div className="mt-8">
            <button 
              onClick={handleClockOut}
              className="flex w-full items-center justify-center rounded-lg bg-red-500 py-4 text-white font-bold shadow-md active:scale-95 transition-transform"
            >
              <Square className="mr-2 h-5 w-5 fill-current" />
              End Shift (Clock Out)
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-center mb-6">Start New Shift</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Selfie Verification</label>
              
              {photoUrl ? (
                <div className="relative">
                  <img src={photoUrl} alt="Selfie" className="w-full rounded-lg aspect-[3/4] object-cover" />
                  <button 
                    onClick={() => setPhotoUrl(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 text-xs"
                  >
                    Retake
                  </button>
                </div>
              ) : isCameraActive ? (
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg aspect-[3/4] object-cover bg-black" />
                  <button 
                    onClick={takePhoto}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white p-4 shadow-lg"
                  >
                    <Camera className="h-6 w-6 text-black" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={startCamera}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center text-gray-500"
                >
                  <Camera className="h-8 w-8 mb-2" />
                  <span>Tap to open camera</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Opening Cash (Rp)</label>
              <input 
                type="number" 
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-4 py-3 outline-none focus:ring-2"
                style={{ '--tw-ring-color': primaryColor } as any}
                placeholder="e.g. 500000"
              />
            </div>

            <button 
              onClick={handleClockIn}
              disabled={!photoUrl || !openingCash}
              className="flex w-full items-center justify-center rounded-lg py-4 font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
              style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Start Shift (Clock In)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
