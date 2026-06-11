import React, { useState, useEffect, useRef } from 'react';
import { api } from './api';
import {
  Dumbbell,
  Calendar,
  MapPin,
  History,
  User,
  TrendingUp,
  LogOut,
  Compass,
  Brain,
  Clock,
  Plus,
  Play,
  Square,
  CheckCircle,
  Goal,
  Award,
  ChevronRight,
  ChevronDown,
  Check
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function App() {
  // Navigation & User State
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // login, register, onboarding
  const [activeTab, setActiveTab] = useState('dashboard');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');

  // Onboarding & Profile Fields
  const [onboardName, setOnboardName] = useState('');
  const [onboardGoal, setOnboardGoal] = useState('5K');
  const [onboardLevel, setOnboardLevel] = useState('Beginner');
  const [onboardWeeklyGoal, setOnboardWeeklyGoal] = useState('20');
  const [onboardWeight, setOnboardWeight] = useState('');
  const [onboardHeight, setOnboardHeight] = useState('');
  const [onboardAge, setOnboardAge] = useState('');

  // Profile Edit States
  const [profileName, setProfileName] = useState('');
  const [profileGoal, setProfileGoal] = useState('General Health / Cardio');
  const [profileLevel, setProfileLevel] = useState('Beginner');
  const [profileWeeklyGoal, setProfileWeeklyGoal] = useState('20');
  const [profileWeight, setProfileWeight] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Application Data States
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({
    totalDistance: 0,
    weeklyDistance: 0,
    monthlyDistance: 0,
    averagePace: 0,
    pb5k: 0,
    pb10k: 0,
    pbHalfMarathon: 0,
    totalActivities: 0
  });
  
  // AI Coach Chat
  const [chatMessages, setChatMessages] = useState([
    { role: 'coach', text: 'Hello! I am your AI Running Coach. How is your training going today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [workoutSuggestion, setWorkoutSuggestion] = useState(null);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  // Marathon Plan
  const [marathonPlan, setMarathonPlan] = useState(null);
  const [marathonStart, setMarathonStart] = useState('');
  const [marathonTarget, setMarathonTarget] = useState('');
  const [marathonGoalDist, setMarathonGoalDist] = useState('Full Marathon');
  const [marathonLoading, setMarathonLoading] = useState(false);
  const [checkedMarathonDays, setCheckedMarathonDays] = useState({});
  const [selectedMarathonWeek, setSelectedMarathonWeek] = useState(1);
  const [runsPerWeek, setRunsPerWeek] = useState(4);
  const [selectedMarathonWorkout, setSelectedMarathonWorkout] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

  // Manual Log Run Form
  const [logDate, setLogDate] = useState(new Date().toISOString().substring(0, 10));
  const [logType, setLogType] = useState('easy');
  const [logCustomName, setLogCustomName] = useState('');
  const [logDistance, setLogDistance] = useState('');
  const [logDuration, setLogDuration] = useState('');
  const [logElevation, setLogElevation] = useState('');
  const [logEffort, setLogEffort] = useState(5);
  const [logNotes, setLogNotes] = useState('');

  // GPS Activity Tracker
  const [gpsTracking, setGpsTracking] = useState(false);
  const [gpsPath, setGpsPath] = useState([]);
  const [gpsDuration, setGpsDuration] = useState(0); // in seconds
  const [gpsDistance, setGpsDistance] = useState(0); // in km
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize Auth
  useEffect(() => {
    const saved = localStorage.getItem('runtrack_user');
    const token = localStorage.getItem('runtrack_token');
    if (saved && token) {
      const parsed = JSON.parse(saved);
      setCurrentUser(parsed);
      if (parsed.onboarded) {
        setAuthMode('app');
        fetchAppData();
      } else {
        setAuthMode('onboarding');
      }
    }
  }, []);

  // Populate profile edit states whenever currentUser changes
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileGoal(currentUser.fitnessGoal || 'General Health / Cardio');
      setProfileLevel(currentUser.experienceLevel || 'Beginner');
      setProfileWeeklyGoal(currentUser.weeklyDistanceGoal ? currentUser.weeklyDistanceGoal.toString() : '20');
      setProfileWeight(currentUser.weight ? currentUser.weight.toString() : '');
      setProfileHeight(currentUser.height ? currentUser.height.toString() : '');
      setProfileAge(currentUser.age ? currentUser.age.toString() : '');
    }
  }, [currentUser]);

  // Fetch App Data
  const fetchAppData = async () => {
    setLoading(true);
    try {
      const act = await api.getActivities();
      setActivities(act);
      const st = await api.getStats();
      setStats(st);
      loadMarathonPlan();
      
      // Fetch full profile details
      try {
        const fullProfile = await api.getProfile();
        setCurrentUser(prev => prev ? { ...prev, ...fullProfile } : fullProfile);
      } catch (profileErr) {
        console.error('Failed to load full profile details', profileErr);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to sync data from cloud server');
    } finally {
      setLoading(false);
    }
  };

  const loadMarathonPlan = async () => {
    try {
      const planRes = await api.getMarathonPlan();
      if (planRes && planRes.hasPlan) {
        setMarathonPlan(planRes);
        
        // Parse completedRuns from backend database (e.g. "w1_dMonday,w2_dTuesday")
        const checkedMap = {};
        if (planRes.completedRuns) {
          planRes.completedRuns.split(',').forEach(key => {
            if (key) checkedMap[key] = true;
          });
        }
        setCheckedMarathonDays(checkedMap);
      } else {
        setMarathonPlan(null);
      }
    } catch (e) {
      console.error('Failed to load marathon plan', e);
    }
  };

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const user = await api.login(loginUsername, loginPassword);
      setCurrentUser(user);
      if (user.onboarded) {
        setAuthMode('app');
        await fetchAppData();
      } else {
        setAuthMode('onboarding');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await api.register(regUsername, regPassword, regName);
      setSuccessMsg('Account created successfully! Please login.');
      setAuthMode('login');
      // Autofill username
      setLoginUsername(regUsername);
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        name: onboardName || currentUser.name,
        fitnessGoal: onboardGoal,
        weeklyDistanceGoal: parseFloat(onboardWeeklyGoal),
        experienceLevel: onboardLevel,
        weight: onboardWeight ? parseFloat(onboardWeight) : null,
        height: onboardHeight ? parseFloat(onboardHeight) : null,
        age: onboardAge ? parseInt(onboardAge) : null
      });
      
      const newUserData = {
        ...currentUser,
        name: updated.name,
        onboarded: true
      };
      localStorage.setItem('runtrack_user', JSON.stringify(newUserData));
      setCurrentUser(newUserData);
      setAuthMode('app');
      fetchAppData();
    } catch (err) {
      setErrorMsg('Failed to update your onboarding profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdateSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setErrorMsg('');
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        name: profileName,
        fitnessGoal: profileGoal,
        weeklyDistanceGoal: parseFloat(profileWeeklyGoal),
        experienceLevel: profileLevel,
        weight: profileWeight ? parseFloat(profileWeight) : null,
        height: profileHeight ? parseFloat(profileHeight) : null,
        age: profileAge ? parseInt(profileAge) : null
      });
      
      setCurrentUser(prev => ({
        ...prev,
        ...updated
      }));
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Failed to update profile details');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setAuthMode('login');
    // Clear lists
    setActivities([]);
    setChatMessages([{ role: 'coach', text: 'Hello! I am your AI Running Coach. How is your training going today?' }]);
    setWorkoutSuggestion(null);
    setMarathonPlan(null);
  };

  // Activity Log Form Submission
  const handleStartEditActivity = (activity) => {
    setEditingActivity(activity);
    setLogDate(activity.date);
    setLogType(activity.type);
    setLogCustomName(activity.customName || '');
    setLogDistance(activity.distance.toString());
    setLogDuration(activity.duration);
    setLogElevation(activity.elevation ? activity.elevation.toString() : '');
    setLogEffort(activity.effort || 5);
    setLogNotes(activity.notes || '');
    setActiveTab('log');
  };

  const handleLogActivity = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!logDistance || !logDuration) {
      setErrorMsg('Distance and Duration are required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        date: logDate,
        type: logType,
        customName: logType === 'custom' ? logCustomName : '',
        distance: parseFloat(logDistance),
        duration: logDuration,
        elevation: logElevation ? parseInt(logElevation) : 0,
        effort: parseInt(logEffort),
        notes: logNotes,
        gpsRoute: null
      };

      if (editingActivity) {
        await api.updateActivity(editingActivity.id, payload);
        setSuccessMsg('Workout updated successfully!');
        setEditingActivity(null);
      } else {
        await api.logActivity(payload);
        setSuccessMsg('Workout saved successfully!');
      }

      // Reset form
      setLogDistance('');
      setLogDuration('');
      setLogElevation('');
      setLogNotes('');
      setLogCustomName('');
      
      // Refresh Stats & History
      await fetchAppData();
      setActiveTab('history');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save activity');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;
    try {
      await api.deleteActivity(id);
      await fetchAppData();
    } catch (err) {
      setErrorMsg('Failed to delete activity');
    }
  };

  // AI Chat Handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    const updatedMessages = [...chatMessages, { role: 'user', text: userText }];
    setChatMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      // Send backend API message history
      // backend expects List of {role, text} map
      const res = await api.chatCoach(updatedMessages);
      setChatMessages([...updatedMessages, { role: 'coach', text: res.reply }]);
    } catch (err) {
      setChatMessages([...updatedMessages, { role: 'coach', text: `⚠️ Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // AI Workout Suggestion
  const handleGetWorkoutSuggestion = async () => {
    setWorkoutLoading(true);
    setWorkoutSuggestion(null);
    try {
      const res = await api.getWorkoutSuggestion();
      setWorkoutSuggestion(res);
    } catch (err) {
      console.error(err);
    } finally {
      setWorkoutLoading(false);
    }
  };

  const logAIWorkoutDirectly = async () => {
    if (!workoutSuggestion) return;
    setLoading(true);
    try {
      let notes = `AI Suggested: ${workoutSuggestion.description}\nTips: ${workoutSuggestion.coachingTips}`;
      if (workoutSuggestion.warmup) notes += `\nWarmup: ${workoutSuggestion.warmup}`;
      if (workoutSuggestion.cooldown) notes += `\nCooldown: ${workoutSuggestion.cooldown}`;

      await api.logActivity({
        date: new Date().toISOString().substring(0, 10),
        type: workoutSuggestion.title.toLowerCase().includes('interval') ? 'interval' : 'easy',
        customName: workoutSuggestion.title,
        distance: workoutSuggestion.targetDistance,
        duration: workoutSuggestion.targetDuration,
        effort: workoutSuggestion.difficulty === 'Easy' ? 3 : workoutSuggestion.difficulty === 'Medium' ? 6 : 9,
        notes: notes
      });
      setWorkoutSuggestion(null);
      setSuccessMsg('Suggested workout logged!');
      await fetchAppData();
      setActiveTab('dashboard');
    } catch (err) {
      setErrorMsg('Failed to log AI workout');
    } finally {
      setLoading(false);
    }
  };

  // AI Marathon Planner
  const handleGenerateMarathonPlan = async (e) => {
    e.preventDefault();
    if (!marathonStart || !marathonTarget) {
      alert('Please provide start date and race target date');
      return;
    }
    setMarathonLoading(true);
    try {
      const res = await api.generateMarathonPlan(marathonStart, marathonTarget, marathonGoalDist, runsPerWeek);
      setMarathonPlan(res);
      setSelectedMarathonWeek(1);
      setCheckedMarathonDays({});
      localStorage.removeItem(`runtrack_marathon_checked_${currentUser?.username}`);
    } catch (err) {
      alert(err.message || 'Failed to generate marathon training program');
    } finally {
      setMarathonLoading(false);
    }
  };

  const handleResetMarathonPlan = async () => {
    if (!window.confirm('Are you sure you want to delete your current marathon training program?')) return;
    setMarathonLoading(true);
    try {
      await api.resetMarathonPlan();
      setMarathonPlan(null);
      setCheckedMarathonDays({});
      localStorage.removeItem(`runtrack_marathon_checked_${currentUser?.username}`);
    } catch (err) {
      alert('Failed to reset plan');
    } finally {
      setMarathonLoading(false);
    }
  };

  const toggleMarathonDay = async (weekNum, dayName, workout) => {
    const key = `w${weekNum}_d${dayName}`;
    const isChecking = !checkedMarathonDays[key];
    
    const updated = {
      ...checkedMarathonDays,
      [key]: isChecking
    };
    setCheckedMarathonDays(updated);
    try {
      await api.toggleMarathonDayInDb(key);
    } catch (err) {
      console.error('Failed to sync completed run state to server', err);
    }

    if (isChecking) {
      // Auto-log to backend history if checking a running day
      if (workout && workout.distance > 0) {
        try {
          let runType = 'easy';
          const typeLwr = (workout.type || '').toLowerCase();
          if (typeLwr.includes('interval')) runType = 'intervals';
          else if (typeLwr.includes('tempo')) runType = 'tempo';
          else if (typeLwr.includes('long')) runType = 'long';
          else if (typeLwr.includes('threshold')) runType = 'intervals';

          await api.logActivity({
            date: new Date().toISOString().substring(0, 10),
            type: runType,
            customName: '',
            distance: parseFloat(workout.distance),
            duration: workout.targetDuration && workout.targetDuration !== '—' ? workout.targetDuration : '30:00',
            elevation: 0,
            effort: 5,
            notes: `Completed Training Plan Week ${weekNum} - ${dayName} (${workout.type} run)`,
            gpsRoute: null
          });
          fetchAppData();
        } catch (err) {
          console.error('Failed to auto-log run', err);
        }
      }
    } else {
      // Auto-delete from backend history if unchecking a running day
      try {
        const targetNotesPrefix = `Completed Training Plan Week ${weekNum} - ${dayName}`;
        const toDelete = activities.filter(a => a.notes && a.notes.includes(targetNotesPrefix));
        for (const act of toDelete) {
          await api.deleteActivity(act.id);
        }
        if (toDelete.length > 0) {
          fetchAppData();
        }
      } catch (err) {
        console.error('Failed to auto-delete run from history', err);
      }
    }
  };

  // GPS Live Tracking Code
  const getDistanceBetweenCoords = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const startGpsRun = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setGpsTracking(true);
    setGpsPath([]);
    setGpsDistance(0);
    setGpsDuration(0);

    timerRef.current = setInterval(() => {
      setGpsDuration((d) => d + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPoint = { lat: latitude, lng: longitude, time: Date.now() };

        setGpsPath((prevPath) => {
          const updated = [...prevPath, newPoint];
          if (prevPath.length > 0) {
            const lastPoint = prevPath[prevPath.length - 1];
            const incrementalDist = getDistanceBetweenCoords(
              lastPoint.lat, lastPoint.lng,
              latitude, longitude
            );
            // Ignore small jump fluctuations under 2 meters
            if (incrementalDist > 0.002) {
              setGpsDistance((d) => d + incrementalDist);
            }
          }
          return updated;
        });
      },
      (err) => {
        console.error('GPS WatchPosition Error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopGpsRun = () => {
    setGpsTracking(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }

    // Prefill manually logged run form
    const mins = Math.floor(gpsDuration / 60);
    const secs = gpsDuration % 60;
    const formattedDuration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    setLogDistance(gpsDistance.toFixed(2));
    setLogDuration(formattedDuration);
    setLogNotes(`GPS Tracked Run. Points logged: ${gpsPath.length}`);
    setLogType('easy');

    // Canvas drawing cleanup
    alert(`Run finished! Tracked ${gpsDistance.toFixed(2)} km in ${formattedDuration}. Prefilled in Log form!`);
    setActiveTab('log');
  };

  // Draw Path on HUD canvas
  useEffect(() => {
    if (!canvasRef.current || gpsPath.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background HUD grids
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Coordinates bounding box
    const lats = gpsPath.map(p => p.lat);
    const lngs = gpsPath.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;

    // Scale calculations with padding
    const padding = 30;
    const scaleX = (canvas.width - padding * 2) / lngRange;
    const scaleY = (canvas.height - padding * 2) / latRange;
    const scale = Math.min(scaleX, scaleY);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;

    ctx.beginPath();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';

    gpsPath.forEach((pt, idx) => {
      // Scale lat/lng around midpoint and center on canvas
      const x = canvas.width / 2 + (pt.lng - midLng) * scale;
      // Invert Y axis for screen coordinates (north is up)
      const y = canvas.height / 2 - (pt.lat - midLat) * scale;

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw start node
    if (gpsPath.length > 0) {
      const startX = canvas.width / 2 + (gpsPath[0].lng - midLng) * scale;
      const startY = canvas.height / 2 - (gpsPath[0].lat - midLat) * scale;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(startX, startY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw end/current node pulsing
    if (gpsPath.length > 1) {
      const current = gpsPath[gpsPath.length - 1];
      const endX = canvas.width / 2 + (current.lng - midLng) * scale;
      const endY = canvas.height / 2 - (current.lat - midLat) * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [gpsPath]);

  // Clean GPS timers on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  // Formatted pace helper: minutes/km to MM:SS
  const formatPace = (decimalPace) => {
    if (!decimalPace || isNaN(decimalPace) || decimalPace === 0) return '0:00';
    const mins = Math.floor(decimalPace);
    const secs = Math.round((decimalPace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatGpsTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Chart Rendering data
  const chartActivities = [...activities].slice(0, 10).reverse();
  const chartData = {
    labels: chartActivities.map(a => a.date),
    datasets: [
      {
        fill: true,
        label: 'Run distance (km)',
        data: chartActivities.map(a => a.distance),
        borderColor: '#00f2fe',
        backgroundColor: 'rgba(0, 242, 254, 0.07)',
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: '#00f2fe',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b' } }
    }
  };

  // Auth/Onboarding Render Check
  if (authMode === 'login') {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in">
          <div className="auth-header">
            <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div className="brand-icon" style={{ width: '50px', height: '50px', fontSize: '1.5rem' }}>🏃</div>
            </div>
            <h2>Welcome to RunTrack</h2>
            <p>Your AI-Powered Personal Running Coach</p>
          </div>
          {errorMsg && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{errorMsg}</div>}
          {successMsg && <div style={{ color: 'var(--success)', marginBottom: '1rem', fontSize: '0.9rem' }}>{successMsg}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="yourname"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Sign In'}
            </button>
          </form>
          <div className="auth-toggle">
            Don't have an account? 
            <span className="auth-toggle-link" onClick={() => { setAuthMode('register'); setErrorMsg(''); }}>Register here</span>
          </div>
        </div>
      </div>
    );
  }

  if (authMode === 'register') {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in">
          <div className="auth-header">
            <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div className="brand-icon" style={{ width: '50px', height: '50px', fontSize: '1.5rem' }}>🏃</div>
            </div>
            <h2>Create Account</h2>
            <p>Start tracking and training today</p>
          </div>
          {errorMsg && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{errorMsg}</div>}
          
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="janedoe"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Register Account'}
            </button>
          </form>
          <div className="auth-toggle">
            Already have an account? 
            <span className="auth-toggle-link" onClick={() => { setAuthMode('login'); setErrorMsg(''); }}>Sign In</span>
          </div>
        </div>
      </div>
    );
  }

  if (authMode === 'onboarding') {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in" style={{ maxWidth: '520px' }}>
          <div className="auth-header">
            <h2>Personalize Your Goals</h2>
            <p>Tell us about your fitness levels to configure your AI coach</p>
          </div>
          <form onSubmit={handleOnboardingSubmit}>
            <div className="form-group">
              <label>Preferred Coach Display Name</label>
              <input
                type="text"
                className="form-input"
                placeholder={currentUser?.name || "Runner"}
                value={onboardName}
                onChange={e => setOnboardName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Current Fitness Goal</label>
              <select className="form-input" value={onboardGoal} onChange={e => setOnboardGoal(e.target.value)}>
                <option value="General Health / Cardio">General Health / Cardio</option>
                <option value="5k Training">Complete a 5K</option>
                <option value="10k Training">Complete a 10K</option>
                <option value="Half Marathon Plan">Run a Half Marathon</option>
                <option value="Full Marathon Prep">Run a Full Marathon</option>
              </select>
            </div>
            <div className="form-group">
              <label>Experience Level</label>
              <select className="form-input" value={onboardLevel} onChange={e => setOnboardLevel(e.target.value)}>
                <option value="Beginner">Beginner (Just starting or returning)</option>
                <option value="Intermediate">Intermediate (Running consistently weekly)</option>
                <option value="Advanced">Advanced (Competing or running high miles)</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Age</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Yrs"
                  value={onboardAge}
                  onChange={e => setOnboardAge(e.target.value)}
                  min="1"
                  max="120"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Weight (kg)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="kg"
                  value={onboardWeight}
                  onChange={e => setOnboardWeight(e.target.value)}
                  min="1"
                  step="0.1"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Height (cm)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="cm"
                  value={onboardHeight}
                  onChange={e => setOnboardHeight(e.target.value)}
                  min="10"
                  step="0.1"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Weekly Distance Goal (km)</label>
              <input
                type="number"
                className="form-input"
                value={onboardWeeklyGoal}
                onChange={e => setOnboardWeeklyGoal(e.target.value)}
                min="0"
                step="0.5"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Complete Setup
            </button>
          </form>
        </div>
      </div>
    );
  }

  // App Dashboard Render
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-icon">⚡</div>
          <span className="brand-name">RunTrack</span>
        </div>
        <ul className="nav-menu">
          <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <TrendingUp /> Dashboard
          </li>
          <li className={`nav-item ${activeTab === 'coach' ? 'active' : ''}`} onClick={() => setActiveTab('coach')}>
            <Brain /> AI Coach
          </li>
          <li className={`nav-item ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
            <Plus /> Log Run
          </li>
          <li className={`nav-item ${activeTab === 'gps' ? 'active' : ''}`} onClick={() => setActiveTab('gps')}>
            <MapPin /> GPS Tracker
          </li>
          <li className={`nav-item ${activeTab === 'marathon' ? 'active' : ''}`} onClick={() => setActiveTab('marathon')}>
            <Calendar /> Marathon Planner
          </li>
          <li className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History /> History
          </li>
          <li className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <User /> Profile
          </li>
        </ul>
        <div className="user-profile-section">
          <div className="user-info">
            <span className="user-name">{currentUser?.name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{currentUser?.username}</span>
          </div>
          <button className="user-logout" onClick={handleLogout} title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Main Panel */}
      <main className="main-content">
        
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="header-row">
              <h2 className="page-title">Runner Dashboard</h2>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Welcome back, {currentUser?.name}!</span>
            </div>

            {/* Metrics Grid */}
            <div className="dash-metrics-grid">
              <div className="card metric-card">
                <div className="metric-icon-box"><Compass /></div>
                <div className="metric-info">
                  <span className="metric-title">Total Distance</span>
                  <span className="metric-value">{stats.totalDistance?.toFixed(1) || 0} km</span>
                </div>
              </div>

              <div className="card metric-card">
                <div className="metric-icon-box" style={{ background: 'rgba(157, 78, 221, 0.1)', borderColor: 'rgba(157, 78, 221, 0.2)', color: 'var(--secondary)' }}><Goal /></div>
                <div className="metric-info">
                  <span className="metric-title">Weekly Mileage</span>
                  <span className="metric-value">{stats.weeklyDistance?.toFixed(1) || 0} km</span>
                </div>
              </div>

              <div className="card metric-card">
                <div className="metric-icon-box" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}><Clock /></div>
                <div className="metric-info">
                  <span className="metric-title">Avg Pace</span>
                  <span className="metric-value">{formatPace(stats.averagePace)} /km</span>
                </div>
              </div>

              <div className="card metric-card">
                <div className="metric-icon-box" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' }}><Award /></div>
                <div className="metric-info">
                  <span className="metric-title">Activities</span>
                  <span className="metric-value">{stats.totalActivities || 0} runs</span>
                </div>
              </div>
            </div>

            {/* Main Dash Grid */}
            <div className="dash-main-grid">
              
              {/* Graphic Chart */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
                <h3 style={{ marginBottom: '1.25rem' }}>Recent Performance Volume</h3>
                <div style={{ flexGrow: 1, position: 'relative' }}>
                  {activities.length > 0 ? (
                    <Line data={chartData} options={chartOptions} />
                  ) : (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      Log some activities to populate chart!
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Bests */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '1.25rem' }}>Personal Bests</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-around', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>5K PB Pace</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                      {stats.pb5k > 0 ? `${formatPace(stats.pb5k)} /km` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>10K PB Pace</span>
                    <span style={{ fontWeight: 700, color: 'var(--secondary)', fontFamily: 'var(--font-display)' }}>
                      {stats.pb10k > 0 ? `${formatPace(stats.pb10k)} /km` : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Half Marathon</span>
                    <span style={{ fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-display)' }}>
                      {stats.pbHalfMarathon > 0 ? `${formatPace(stats.pbHalfMarathon)} /km` : '—'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Recent list row */}
            <div className="card">
              <h3 style={{ marginBottom: '1.25rem' }}>Recent Workouts</h3>
              <div className="activity-list">
                {activities.slice(0, 4).map((a) => (
                  <div className="activity-item" key={a.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className={`activity-badge badge-${a.type}`}>
                        {a.type === 'custom' ? a.customName : a.type}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.distance.toFixed(2)} km Run</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.date}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration</div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)' }}>{a.duration}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pace</div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>{formatPace(a.pace)} /km</div>
                      </div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No recorded activities yet. Use the "+" or "GPS Tracker" tabs to start logging.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI COACH */}
        {activeTab === 'coach' && (
          <div className="animate-fade-in" style={{ height: '100%' }}>
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>AI Coaching Hub</h2>
            <div className="coach-container">
              
              {/* Left Column - Workout recommendations */}
              <div className="coach-column">
                <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h3>Daily AI Recommendation</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      Get a custom-generated training workout matching your fitness capacity
                    </p>
                  </div>

                  <button className="btn btn-primary" onClick={handleGetWorkoutSuggestion} disabled={workoutLoading} style={{ alignSelf: 'flex-start' }}>
                    {workoutLoading ? <div className="spinner"></div> : 'Generate Workout Suggestion'}
                  </button>

                  {workoutSuggestion && (
                    <div className="animate-fade-in" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--secondary)' }}>
                          {workoutSuggestion.difficulty} Difficulty
                        </span>
                        <h4 style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>{workoutSuggestion.title}</h4>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
                        {workoutSuggestion.description}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Distance</div>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
                            {workoutSuggestion.targetDistance} km
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Duration</div>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
                            {workoutSuggestion.targetDuration}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Coach's Tip: </span>
                        {workoutSuggestion.coachingTips}
                      </div>
                      {workoutSuggestion.warmup && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🔥 Warmup Suggestion: </span>
                          {workoutSuggestion.warmup}
                        </div>
                      )}
                      {workoutSuggestion.cooldown && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                          <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>❄️ Cooldown Suggestion: </span>
                          {workoutSuggestion.cooldown}
                        </div>
                      )}
                      <button className="btn btn-secondary" onClick={logAIWorkoutDirectly} style={{ marginTop: 'auto' }}>
                        Log Workout Completed
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Chatbot */}
              <div className="coach-column">
                <div className="card chat-card">
                  <div className="chat-header">
                    <div>
                      <h3 style={{ fontSize: '1.15rem' }}>Chat with Coach</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Powered by Gemini Flash AI</span>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setChatMessages([{ role: 'coach', text: 'Hello! I am your AI Running Coach. How is your training going today?' }])}>
                      Reset Chat
                    </button>
                  </div>
                  
                  <div className="chat-messages">
                    {chatMessages.map((msg, idx) => (
                      <div className={`chat-msg-row ${msg.role}`} key={idx}>
                        <div className={`chat-bubble ${msg.role}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-msg-row coach">
                        <div className="chat-bubble coach" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          Coach is thinking <div className="spinner" style={{ width: '14px', height: '14px' }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="chat-input-row">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ask about hydration, interval training, or pacing..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={chatLoading}
                    />
                    <button type="submit" className="btn btn-primary" disabled={chatLoading}>
                      Send
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: LOG RUN */}
        {activeTab === 'log' && (
          <div className="animate-fade-in" style={{ maxWidth: '680px', margin: '0 auto' }}>
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>{editingActivity ? 'Edit Logged Run' : 'Log an Activity'}</h2>
            <div className="card">
              <form onSubmit={handleLogActivity} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" className="form-input" value={logDate} onChange={e => setLogDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Run Type</label>
                    <select className="form-input" value={logType} onChange={e => setLogType(e.target.value)}>
                      <option value="easy">Easy / Recovery</option>
                      <option value="tempo">Tempo Run</option>
                      <option value="interval">Interval Session</option>
                      <option value="long">Long Run</option>
                      <option value="optional">Cross Training</option>
                      <option value="custom">Custom Session</option>
                    </select>
                  </div>
                </div>

                {logType === 'custom' && (
                  <div className="form-group animate-fade-in">
                    <label>Custom Session Name</label>
                    <input type="text" className="form-input" placeholder="e.g. Fartlek, Hill Repeats" value={logCustomName} onChange={e => setLogCustomName(e.target.value)} required />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label>Distance (km)</label>
                    <input type="number" className="form-input" placeholder="e.g. 5.25" step="0.01" min="0" value={logDistance} onChange={e => setLogDistance(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Duration (MM:SS)</label>
                    <input type="text" className="form-input" placeholder="e.g. 26:45" value={logDuration} onChange={e => setLogDuration(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Elevation Gain (m)</label>
                    <input type="number" className="form-input" placeholder="e.g. 85" min="0" value={logElevation} onChange={e => setLogElevation(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>RPE Effort Level: {logEffort} / 10</label>
                  <input type="range" min="1" max="10" step="1" className="form-input" style={{ padding: 0 }} value={logEffort} onChange={e => setLogEffort(e.target.value)} />
                </div>

                <div className="form-group">
                  <label>Coach Notes</label>
                  <textarea rows="3" className="form-input" placeholder="Weather, route description, or how you felt physically..." value={logNotes} onChange={e => setLogNotes(e.target.value)}></textarea>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }}>
                    {editingActivity ? 'Save Changes' : 'Save Run Activity'}
                  </button>
                  {editingActivity && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setEditingActivity(null);
                        setLogDistance('');
                        setLogDuration('');
                        setLogElevation('');
                        setLogEffort(5);
                        setLogNotes('');
                        setLogCustomName('');
                        setActiveTab('history');
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: GPS TRACKER */}
        {activeTab === 'gps' && (
          <div className="animate-fade-in" style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>GPS Activity Recorder</h2>
            <div className="card gps-card">
              
              {/* HUD / Radar Canvas View */}
              <div className="gps-map-view">
                <canvas ref={canvasRef} width={500} height={250} style={{ position: 'absolute', top: 0, left: 0 }} />
                {!gpsTracking && gpsPath.length === 0 && (
                  <div style={{ zIndex: 1, textAlign: 'center' }}>
                    <Compass size={40} className="gps-radar" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Stand outside to acquire GPS satellites</p>
                  </div>
                )}
                {gpsTracking && gpsPath.length === 0 && (
                  <div style={{ zIndex: 1, textAlign: 'center' }}>
                    <div className="gps-radar" />
                    <p style={{ color: 'var(--primary)', fontSize: '0.9rem', marginTop: '1rem', fontWeight: 600 }}>Locating satellites...</p>
                  </div>
                )}
              </div>

              {/* Real-time stats */}
              <div className="gps-stats-grid">
                <div className="gps-metric">
                  <div className="gps-metric-label">Duration</div>
                  <div className="gps-metric-val">{formatGpsTime(gpsDuration)}</div>
                </div>
                <div className="gps-metric">
                  <div className="gps-metric-label">Distance</div>
                  <div className="gps-metric-val">{gpsDistance.toFixed(2)} km</div>
                </div>
                <div className="gps-metric">
                  <div className="gps-metric-label">Live Pace</div>
                  <div className="gps-metric-val">
                    {gpsDistance > 0 ? formatPace((gpsDuration / 60) / gpsDistance) : '0:00'} /km
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                {!gpsTracking ? (
                  <button className="btn btn-primary" onClick={startGpsRun} style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
                    <Play size={18} /> Start Recording
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={stopGpsRun} style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}>
                    <Square size={18} /> Stop &amp; Save Run
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MARATHON PLANNER */}
        {activeTab === 'marathon' && (
          <div className="animate-fade-in">
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>Marathon Training Planner</h2>
            
            {/* If no plan exists, show generator form */}
            {!marathonPlan ? (
              <div className="card" style={{ maxWidth: '600px' }}>
                <h3 style={{ marginBottom: '1rem' }}>Generate Training Program</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Generate an AI-driven, multi-week customized schedule targeting a specific race event.
                </p>
                <form onSubmit={handleGenerateMarathonPlan} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label>Training Start Date</label>
                      <input type="date" className="form-input" value={marathonStart} onChange={e => setMarathonStart(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <label>Race / Target Date</label>
                      <input type="date" className="form-input" value={marathonTarget} onChange={e => setMarathonTarget(e.target.value)} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label>Target Race Distance</label>
                      <select className="form-input" value={marathonGoalDist} onChange={e => setMarathonGoalDist(e.target.value)}>
                        <option value="10K Plan">10K Race</option>
                        <option value="Half Marathon">Half Marathon (21.1 km)</option>
                        <option value="Full Marathon">Full Marathon (42.2 km)</option>
                        <option value="Ultra Marathon">50K Ultra Marathon</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Runs Per Week</label>
                      <select className="form-input" value={runsPerWeek} onChange={e => setRunsPerWeek(parseInt(e.target.value))}>
                        <option value={3}>3 Days / week</option>
                        <option value={4}>4 Days / week</option>
                        <option value={5}>5 Days / week</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={marathonLoading}>
                    {marathonLoading ? <div className="spinner"></div> : 'Build AI Marathon Program'}
                  </button>
                </form>
              </div>
            ) : (
              // Plan Display View
              <div className="animate-fade-in">
                <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Custom Plan: {marathonPlan.targetDistance}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Training timeline: {marathonPlan.startDate} to {marathonPlan.targetDate}
                    </p>
                  </div>
                  <button className="btn btn-danger" onClick={handleResetMarathonPlan}>
                    Reset Program
                  </button>
                </div>

                {/* Week Selector Tabs */}
                <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select Week</h4>
                <div className="week-tabs-container">
                  {marathonPlan.plan?.map((wk) => (
                    <button 
                      key={wk.week} 
                      className={`week-tab-btn ${selectedMarathonWeek === wk.week ? 'active' : ''}`}
                      onClick={() => setSelectedMarathonWeek(wk.week)}
                    >
                      W{wk.week}
                    </button>
                  ))}
                </div>

                {/* Selected Week Data */}
                {(() => {
                  const activeWeekData = marathonPlan.plan?.find(w => w.week === selectedMarathonWeek) || marathonPlan.plan?.[0];
                  if (!activeWeekData) return null;

                  const activeWeekRuns = activeWeekData.schedule?.filter(d => d.distance > 0) || [];
                  const completedActiveWeekRuns = activeWeekRuns.filter(d => !!checkedMarathonDays[`w${selectedMarathonWeek}_d${d.day}`]);
                  const progressPercent = activeWeekRuns.length > 0 ? Math.round((completedActiveWeekRuns.length / activeWeekRuns.length) * 100) : 0;

                  return (
                    <div className="animate-fade-in">
                      {/* Week Progress Summary */}
                      <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Week {selectedMarathonWeek} Summary</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                              {completedActiveWeekRuns.length} of {activeWeekRuns.length} workouts completed
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                              {activeWeekData.weeklyDistance} km
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Planned Volume</span>
                          </div>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease-in-out' }}></div>
                        </div>
                      </div>

                      {/* Day by Day Calendar List */}
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Training Schedule</h4>
                      <div>
                        {activeWeekData.schedule?.map((day, dayIdx) => {
                          const dayKey = `w${selectedMarathonWeek}_d${day.day}`;
                          const isChecked = !!checkedMarathonDays[dayKey];
                          const isRest = day.type === 'Rest' || day.distance === 0;

                          return (
                            <div className={`calendar-day-card ${isChecked ? 'completed' : ''} ${isRest ? 'rest-day-card' : ''}`} key={dayIdx}>
                              <div className="calendar-day-left">
                                <div 
                                  className={`calendar-circle-checkbox ${isChecked ? 'checked' : ''}`}
                                  onClick={() => toggleMarathonDay(selectedMarathonWeek, day.day, day)}
                                >
                                  {isChecked && <Check size={16} />}
                                </div>
                                
                                <div className="calendar-day-info">
                                  <div className="calendar-day-name">{day.day}</div>
                                  <div className="calendar-workout-title">
                                    {isRest ? (
                                      <span>Rest & Recovery</span>
                                    ) : (
                                      <>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{day.distance} km Run</span>
                                        <span className={`activity-badge badge-${day.type?.toLowerCase().includes('interval') ? 'interval' : day.type?.toLowerCase().includes('tempo') ? 'tempo' : day.type?.toLowerCase().includes('long') ? 'long' : 'easy'}`}>
                                          {day.type}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <p className="calendar-workout-desc" style={{ fontSize: '0.85rem' }}>{day.description}</p>
                                  
                                  {!isRest && (
                                    <div className="calendar-workout-meta" style={{ marginTop: '0.25rem' }}>
                                      {day.targetDuration && day.targetDuration !== '—' && (
                                        <span className="calendar-meta-item">⏱️ {day.targetDuration}</span>
                                      )}
                                      {day.targetPace && day.targetPace !== '—' && (
                                        <span className="calendar-meta-item">⚡ {day.targetPace}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="calendar-day-right">
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                  onClick={() => setSelectedMarathonWorkout({ weekNum: selectedMarathonWeek, day: day.day, workout: day })}
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Details Popup Modal */}
                {selectedMarathonWorkout && (
                  <div className="modal-overlay" onClick={() => setSelectedMarathonWorkout(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                          <span className="calendar-day-name" style={{ fontSize: '0.8rem' }}>Week {selectedMarathonWorkout.weekNum} — {selectedMarathonWorkout.day}</span>
                          <h3 style={{ marginTop: '0.25rem', fontSize: '1.5rem', fontWeight: 700 }}>
                            {selectedMarathonWorkout.workout.distance > 0 ? `${selectedMarathonWorkout.workout.distance} km Run` : 'Rest & Recovery'}
                          </h3>
                        </div>
                        <button className="btn" style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setSelectedMarathonWorkout(null)}>×</button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <span className={`activity-badge badge-${(selectedMarathonWorkout.workout.type || 'Rest').toLowerCase().includes('interval') ? 'interval' : (selectedMarathonWorkout.workout.type || 'Rest').toLowerCase().includes('tempo') ? 'tempo' : (selectedMarathonWorkout.workout.type || 'Rest').toLowerCase().includes('long') ? 'long' : (selectedMarathonWorkout.workout.type || 'Rest').toLowerCase().includes('easy') ? 'easy' : 'optional'}`}>
                          {selectedMarathonWorkout.workout.type || 'Rest'}
                        </span>
                        
                        {selectedMarathonWorkout.workout.targetPace && selectedMarathonWorkout.workout.targetPace !== '—' && (
                          <span className="activity-badge badge-custom">
                            Pace: {selectedMarathonWorkout.workout.targetPace}
                          </span>
                        )}
                        
                        {selectedMarathonWorkout.workout.targetDuration && selectedMarathonWorkout.workout.targetDuration !== '—' && (
                          <span className="activity-badge badge-easy" style={{ background: 'rgba(0, 242, 254, 0.15)', color: 'var(--primary)' }}>
                            Duration: {selectedMarathonWorkout.workout.targetDuration}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ marginBottom: '1.75rem' }}>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>Description</h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                          {selectedMarathonWorkout.workout.description}
                        </p>
                      </div>
                      
                      {selectedMarathonWorkout.workout.coachingTips && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2rem' }}>
                          <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            💡 Coaching Tips
                          </h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                            {selectedMarathonWorkout.workout.coachingTips}
                          </p>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button 
                          className={`btn ${checkedMarathonDays[`w${selectedMarathonWorkout.weekNum}_d${selectedMarathonWorkout.day}`] ? 'btn-danger' : 'btn-primary'}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                          onClick={() => {
                            toggleMarathonDay(selectedMarathonWorkout.weekNum, selectedMarathonWorkout.day, selectedMarathonWorkout.workout);
                            setSelectedMarathonWorkout(null);
                          }}
                        >
                          {checkedMarathonDays[`w${selectedMarathonWorkout.weekNum}_d${selectedMarathonWorkout.day}`] ? 'Mark as Incomplete' : 'Mark as Completed'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setSelectedMarathonWorkout(null)}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: HISTORY */}
        {activeTab === 'history' && (
          <div className="animate-fade-in">
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>Workout History</h2>
            <div className="card">
              <div className="activity-list" style={{ maxHeight: 'none' }}>
                {activities.map((a) => (
                  <div className="activity-item animate-fade-in" key={a.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <span className={`activity-badge badge-${a.type}`}>
                        {a.type === 'custom' ? a.customName : a.type}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{a.distance.toFixed(2)} km Run</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{a.date}</div>
                        {a.notes && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic', maxWidth: '300px' }}>
                            "{a.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Duration</div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{a.duration}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Pace</div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--primary)' }}>{formatPace(a.pace)} /km</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Elevation</div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{a.elevation || 0} m</div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: '0.5rem', marginRight: '0.5rem' }} onClick={() => handleStartEditActivity(a)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.5rem' }} onClick={() => handleDeleteActivity(a.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem' }}>
                    You have not logged any activities yet. Click on "Log Run" or "GPS Tracker" to add your first workout!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PROFILE */}
        {activeTab === 'profile' && (
          <div className="animate-fade-in">
            <h2 className="page-title" style={{ marginBottom: '1.5rem' }}>Your Profile</h2>
            
            {profileSuccessMsg && (
              <div className="alert alert-success animate-fade-in" style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', marginBottom: '1.5rem', fontWeight: 500 }}>
                ✓ {profileSuccessMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem' }}>
              
              {/* Profile Overview Card */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
                <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1rem', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.3)' }}>
                    🏃‍♂️
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{currentUser?.name}</h3>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>@{currentUser?.username}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Age:</span>
                    <span style={{ fontWeight: 600 }}>{currentUser?.age ? `${currentUser.age} years` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Weight:</span>
                    <span style={{ fontWeight: 600 }}>{currentUser?.weight ? `${currentUser.weight} kg` : '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Height:</span>
                    <span style={{ fontWeight: 600 }}>{currentUser?.height ? `${currentUser.height} cm` : '—'}</span>
                  </div>
                  
                  {currentUser?.weight && currentUser?.height && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>BMI:</span>
                      <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>
                        {(currentUser.weight / Math.pow(currentUser.height / 100, 2)).toFixed(1)}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Level:</span>
                    <span className="badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {currentUser?.experienceLevel || 'Beginner'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Weekly Goal:</span>
                    <span style={{ fontWeight: 600 }}>{currentUser?.weeklyDistanceGoal || 0} km</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fitness Goal:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{currentUser?.fitnessGoal || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Edit Profile Form */}
              <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                  Edit Profile Details
                </h3>
                
                <form onSubmit={handleProfileUpdateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Coach Display Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Age (years)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={profileAge}
                        onChange={e => setProfileAge(e.target.value)}
                        min="1"
                        max="120"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Weight (kg)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={profileWeight}
                        onChange={e => setProfileWeight(e.target.value)}
                        min="1"
                        step="0.1"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Height (cm)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={profileHeight}
                        onChange={e => setProfileHeight(e.target.value)}
                        min="10"
                        step="0.1"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fitness Goal</label>
                    <select className="form-input" value={profileGoal} onChange={e => setProfileGoal(e.target.value)}>
                      <option value="General Health / Cardio">General Health / Cardio</option>
                      <option value="5k Training">Complete a 5K</option>
                      <option value="10k Training">Complete a 10K</option>
                      <option value="Half Marathon Plan">Run a Half Marathon</option>
                      <option value="Full Marathon Prep">Run a Full Marathon</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Experience Level</label>
                      <select className="form-input" value={profileLevel} onChange={e => setProfileLevel(e.target.value)}>
                        <option value="Beginner">Beginner (Just starting)</option>
                        <option value="Intermediate">Intermediate (Running weekly)</option>
                        <option value="Advanced">Advanced (Competing/high mileage)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Weekly Goal (km)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={profileWeeklyGoal}
                        onChange={e => setProfileWeeklyGoal(e.target.value)}
                        min="0"
                        step="0.5"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} disabled={loading}>
                    {loading ? <div className="spinner"></div> : 'Save Changes'}
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
