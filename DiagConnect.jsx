import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Calendar, Users, FileText, MessageSquare, BarChart3,
  Send, CreditCard, Code2, Bell, Search, Plus, Upload, Eye, Phone,
  Clock, CheckCircle, XCircle, AlertCircle, Star, TrendingUp, TrendingDown,
  Key, Copy, X, LogOut, Zap, Shield, Crown, Lock, ArrowRight, RefreshCw,
  Settings, Check, Gift, Repeat, ChevronRight, Sparkles, Stethoscope,
  UserCheck, Database, Globe, Download, Save, Target, HeartPulse, Menu,
  ClipboardList, Activity, Layers, Package, FileSpreadsheet, Building2,
  CreditCard as CC, Camera, Fingerprint, MapPin, Hash, AlertTriangle,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Loader2, Link2
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : true);
  useEffect(() => { const f = () => setM(window.innerWidth < 768); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return m;
};

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:'Outfit',sans-serif;background:#F4F6FA;color:#0F172A;overscroll-behavior:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes bounce3{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes pulse2{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
@keyframes progress{from{width:0%}to{width:100%}}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
input,select,textarea{font-family:'Outfit',sans-serif;-webkit-appearance:none}
button{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
`;

const PLANS = {
  BASIC:   { name:"Basic",   price:7500,  color:"#3B82F6", mods:["dash","appts","reports","bot"] },
  PREMIUM: { name:"Premium", price:14000, color:"#8B5CF6", mods:["dash","appts","reports","bot","patients","analytics","campaigns","reviews"] },
  PRO:     { name:"Pro",     price:22000, color:"#F59E0B", mods:["dash","appts","reports","bot","patients","analytics","campaigns","reviews","api","ai"] },
};
const hasMod = (c, m) => PLANS[c.plan]?.mods.includes(m);

const CLINICS = {
  kharghar: { id:"kharghar", name:"Kharghar Diagnostics", plan:"PRO",     owner:"Dr. Anil Sharma", wa:"+91 98765 43210", addr:"Sector 15, Kharghar, Navi Mumbai", open:"07:00", close:"20:00", rating:4.7, reviews:203, email:"anil@kharghar.in" },
  vashi:    { id:"vashi",    name:"Vashi Health Centre",   plan:"PREMIUM", owner:"Dr. Priya Mehta",  wa:"+91 98765 11223", addr:"Sector 17, Vashi, Navi Mumbai",     open:"09:00", close:"19:00", rating:4.4, reviews:89,  email:"priya@vashi.in"   },
};

// ─── SESSIONS & SLOTS ───────────────────────────────────────────────────────────
const SESSIONS = [
  { id:"MORNING",   label:"Morning",   emoji:"🌅", start:"07:00", end:"11:00", color:"#F59E0B", bg:"#FFFBEB" },
  { id:"MIDDAY",    label:"Midday",    emoji:"☀️", start:"11:00", end:"14:00", color:"#EF4444", bg:"#FEF2F2" },
  { id:"AFTERNOON", label:"Afternoon", emoji:"🌤", start:"14:00", end:"18:00", color:"#6366F1", bg:"#EEF2FF" },
  { id:"EVENING",   label:"Evening",   emoji:"🌙", start:"18:00", end:"20:00", color:"#0D9488", bg:"#F0FDFA" },
];

function generateSlots(start, end) {
  const slots = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endM = eh * 60 + em;
  while (cur < endM) {
    const h = Math.floor(cur / 60), mn = cur % 60;
    const time = `${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const disp = `${h12}:${String(mn).padStart(2,"0")} ${h < 12 ? "AM" : "PM"}`;
    slots.push({ time, display: disp, booked: Math.floor(Math.random() * 3), capacity: 3 });
    cur += 15;
  }
  return slots;
}

const ALL_SESSIONS = SESSIONS.map(s => ({ ...s, slots: generateSlots(s.start, s.end).map(sl => ({ ...sl, booked: sl.booked, status: sl.booked >= 3 ? "FULL" : "OPEN" })) }));

// ─── MASTER TEST CATALOG (from uploaded file) ──────────────────────────────────
const MASTER_TESTS = [
  { id:"T01", code:"CBC",   name:"Complete Blood Count",  cat:"Haematology",  price:300,  prep:"No fasting required",       tat:"4 hrs",  popular:true,  sampleType:"Blood" },
  { id:"T02", code:"TSH",   name:"Thyroid Profile",        cat:"Biochemistry", price:450,  prep:"Morning sample preferred",  tat:"6 hrs",  popular:true,  sampleType:"Blood" },
  { id:"T03", code:"HBA1C", name:"HbA1c",                  cat:"Biochemistry", price:400,  prep:"No fasting needed",         tat:"4 hrs",  popular:true,  sampleType:"Blood" },
  { id:"T04", code:"LIPID", name:"Lipid Profile",          cat:"Biochemistry", price:500,  prep:"12 hrs fasting required",   tat:"6 hrs",  popular:true,  sampleType:"Blood" },
  { id:"T05", code:"LFT",   name:"Liver Function Test",    cat:"Biochemistry", price:600,  prep:"10 hrs fasting preferred",  tat:"6 hrs",  popular:false, sampleType:"Blood" },
  { id:"T06", code:"KFT",   name:"Kidney Function Test",   cat:"Biochemistry", price:600,  prep:"No fasting",                tat:"6 hrs",  popular:false, sampleType:"Blood" },
  { id:"T07", code:"URE",   name:"Urine Routine",          cat:"Microbiology", price:180,  prep:"First morning sample",      tat:"3 hrs",  popular:true,  sampleType:"Urine" },
  { id:"T08", code:"FBS",   name:"Blood Glucose Fasting",  cat:"Biochemistry", price:100,  prep:"8-10 hrs fasting",          tat:"2 hrs",  popular:true,  sampleType:"Blood" },
  { id:"T09", code:"VITD",  name:"Vitamin D",              cat:"Biochemistry", price:800,  prep:"No fasting",                tat:"24 hrs", popular:false, sampleType:"Blood" },
  { id:"T10", code:"B12",   name:"Vitamin B12",            cat:"Biochemistry", price:700,  prep:"No fasting",                tat:"24 hrs", popular:false, sampleType:"Blood" },
  { id:"T11", code:"FBC",   name:"Full Body Checkup",      cat:"Package",      price:1799, prep:"10 hrs fasting",            tat:"8 hrs",  popular:true,  sampleType:"Blood+Urine", pkg:true },
  { id:"T12", code:"DIAB",  name:"Diabetes Care Package",  cat:"Package",      price:899,  prep:"8 hrs fasting",             tat:"6 hrs",  popular:true,  sampleType:"Blood", pkg:true },
];

const APPTS_SEED = [
  { id:"A01", pid:"P01", patient:"Priya Sharma",  phone:"+91 98765 11111", test:"Thyroid Profile",   testCode:"TSH",   time:"08:15", status:"arrived",   price:450,  src:"bot",    ref:"#DC240301", patientToken:"a3f8b2c1" },
  { id:"A02", pid:"P02", patient:"Rohit Gupta",   phone:"+91 98765 22222", test:"Lipid Profile",     testCode:"LIPID", time:"09:30", status:"confirmed", price:500,  src:"bot",    ref:"#DC240302", patientToken:"b7e4d5f2" },
  { id:"A03", pid:"P03", patient:"Sunita Patil",  phone:"+91 98765 33333", test:"Urine Routine",     testCode:"URE",   time:"10:00", status:"pending",   price:180,  src:"walkin", ref:"#DC240303", patientToken:"c9a1e3b4" },
  { id:"A04", pid:"P04", patient:"Manoj Verma",   phone:"+91 98765 44444", test:"Full Body Checkup", testCode:"FBC",   time:"11:30", status:"confirmed", price:1799, src:"bot",    ref:"#DC240304", patientToken:"d2f7c6a8" },
  { id:"A05", pid:"P05", patient:"Kavya Desai",   phone:"+91 98765 55555", test:"HbA1c",             testCode:"HBA1C", time:"14:15", status:"confirmed", price:400,  src:"bot",    ref:"#DC240305", patientToken:"e5b3d9f1" },
];

const REPORTS_SEED = [
  { id:"R01", patient:"Priya Sharma",  phone:"+91 98765 11111", testCode:"TSH",   test:"Thyroid Profile",   ref:"#DC240301", patientToken:"a3f8b2c1", verificationStatus:"verified",   deliveryStatus:"read",     uploadedAt:"10:45", deliveredAt:"10:46", file:"TSH_a3f8b2c1_30Mar.pdf",   lisStatus:"received",  autoDelivered:true  },
  { id:"R02", patient:"Arun Kumar",    phone:"+91 98765 66666", testCode:"KFT",   test:"KFT + LFT",         ref:"#DC240290", patientToken:"f4c2a7e9", verificationStatus:"verified",   deliveryStatus:"read",     uploadedAt:"15:20", deliveredAt:"15:21", file:"KFT_f4c2a7e9_29Mar.pdf",   lisStatus:"received",  autoDelivered:true  },
  { id:"R03", patient:"Vikram Shah",   phone:"+91 98765 10101", testCode:"HEART", test:"Cardiac Risk",      ref:"#DC240291", patientToken:"g8d5b3c7", verificationStatus:"verified",   deliveryStatus:"delivered",uploadedAt:"16:10", deliveredAt:"16:11", file:"HEART_g8d5b3c7_29Mar.pdf", lisStatus:"received",  autoDelivered:true  },
  { id:"R04", patient:"Rohit Gupta",   phone:"+91 98765 22222", testCode:"LIPID", test:"Lipid Profile",     ref:"#DC240302", patientToken:"b7e4d5f2", verificationStatus:"pending",    deliveryStatus:"pending",  uploadedAt:null,    deliveredAt:null,    file:null,                       lisStatus:"processing",autoDelivered:false },
  { id:"R05", patient:"Manoj Verma",   phone:"+91 98765 44444", testCode:"FBC",   test:"Full Body Checkup", ref:"#DC240304", patientToken:"d2f7c6a8", verificationStatus:"pending",    deliveryStatus:"pending",  uploadedAt:null,    deliveredAt:null,    file:null,                       lisStatus:"processing",autoDelivered:false },
];

const ANALYTICS = {
  monthly:[
    {m:"Oct",rev:218000,noshow:18.2},{m:"Nov",rev:247000,noshow:16.4},
    {m:"Dec",rev:205000,noshow:15.1},{m:"Jan",rev:278000,noshow:12.8},
    {m:"Feb",rev:312000,noshow:10.3},{m:"Mar",rev:389000,noshow:8.2},
  ],
  channels:[{name:"WhatsApp Bot",v:61,c:"#14B8A6"},{name:"Walk-in",v:24,c:"#6366F1"},{name:"Phone",v:12,c:"#F59E0B"},{name:"Other",v:3,c:"#94A3B8"}],
};

// ─── MICRO COMPONENTS ──────────────────────────────────────────────────────────
const Pill = ({ status }) => {
  const m={confirmed:{bg:"#EFF6FF",txt:"#1D4ED8",dot:"#3B82F6",l:"Confirmed"},arrived:{bg:"#ECFDF5",txt:"#065F46",dot:"#10B981",l:"Arrived"},pending:{bg:"#FFFBEB",txt:"#92400E",dot:"#F59E0B",l:"Pending"},completed:{bg:"#F8FAFC",txt:"#475569",dot:"#94A3B8",l:"Done"},noshow:{bg:"#FEF2F2",txt:"#991B1B",dot:"#EF4444",l:"No Show"},read:{bg:"#ECFDF5",txt:"#065F46",dot:"#10B981",l:"Read ✓✓"},delivered:{bg:"#EFF6FF",txt:"#1D4ED8",dot:"#60A5FA",l:"Delivered"},pending_r:{bg:"#FFFBEB",txt:"#92400E",dot:"#F59E0B",l:"Pending"},sent:{bg:"#ECFDF5",txt:"#065F46",dot:"#10B981",l:"Sent"},verified:{bg:"#ECFDF5",txt:"#065F46",dot:"#10B981",l:"Verified ✓"},active:{bg:"#ECFDF5",txt:"#065F46",dot:"#10B981",l:"Active"},lapsed:{bg:"#FFF7ED",txt:"#9A3412",dot:"#F97316",l:"Lapsed"}};
  const c=m[status]||m.pending;
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:c.bg,color:c.txt,padding:"3px 9px",borderRadius:999,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:c.dot}}/>{c.l}</span>;
};

const KCard = ({ label, value, sub, Icon, accent="teal", trend, onClick }) => {
  const g={teal:"linear-gradient(135deg,#0D9488,#0891B2)",blue:"linear-gradient(135deg,#3B82F6,#6366F1)",green:"linear-gradient(135deg,#10B981,#059669)",amber:"linear-gradient(135deg,#F59E0B,#D97706)",purple:"linear-gradient(135deg,#8B5CF6,#7C3AED)",red:"linear-gradient(135deg,#EF4444,#DC2626)"};
  return <div onClick={onClick} style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"14px",cursor:onClick?"pointer":"default"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <div style={{width:36,height:36,borderRadius:10,background:g[accent]||g.teal,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={17} color="#fff"/></div>
      {trend!=null&&<span style={{fontSize:10,fontWeight:700,color:trend>=0?"#059669":"#DC2626",background:trend>=0?"#ECFDF5":"#FEF2F2",padding:"2px 6px",borderRadius:999,display:"flex",alignItems:"center",gap:2}}>{trend>=0?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{Math.abs(trend)}%</span>}
    </div>
    <div style={{fontSize:21,fontWeight:800,color:"#0F172A"}}>{value}</div>
    <div style={{fontSize:12,color:"#64748B",marginTop:3,fontWeight:500}}>{label}</div>
    {sub&&<div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{sub}</div>}
  </div>;
};

const Btn = ({ children, variant="primary", size="md", Icon, onClick, disabled, full, loading }) => {
  const vs={primary:{background:"#0D9488",color:"#fff",border:"none"},secondary:{background:"#F1F5F9",color:"#334155",border:"none"},danger:{background:"#EF4444",color:"#fff",border:"none"},ghost:{background:"transparent",color:"#64748B",border:"none"},outline:{background:"#fff",color:"#334155",border:"1px solid #E2E8F0"}};
  const ss={sm:{fontSize:11,padding:"6px 12px",minHeight:34},md:{fontSize:13,padding:"10px 16px",minHeight:44},lg:{fontSize:14,padding:"12px 20px",minHeight:50}};
  return <button onClick={onClick} disabled={disabled||loading} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"Outfit",fontWeight:700,borderRadius:12,cursor:(disabled||loading)?"not-allowed":"pointer",opacity:(disabled||loading)?.6:1,width:full?"100%":undefined,touchAction:"manipulation",...(vs[variant]||vs.primary),...(ss[size]||ss.md)}}>
    {loading?<div style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>:Icon&&<Icon size={size==="sm"?11:13}/>}{children}
  </button>;
};

const Field = ({ label, value, onChange, type="text", placeholder, required, options, multiline, hint }) => (
  <div style={{marginBottom:14}}>
    <label style={{fontSize:11,fontWeight:700,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.4}}>{label}{required&&<span style={{color:"#EF4444",marginLeft:2}}>*</span>}</label>
    {options
      ? <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",background:"#fff",color:"#334155",minHeight:46}}>
          <option value="">Select…</option>{options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
        </select>
      : multiline
      ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",color:"#334155",resize:"vertical",fontFamily:"Outfit"}}/>
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",color:"#334155",minHeight:46}}/>
    }
    {hint&&<div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>{hint}</div>}
  </div>
);

const Toast = ({ msg, type, onClose }) => (
  <div style={{position:"fixed",bottom:72,left:12,right:12,zIndex:9999,display:"flex",alignItems:"center",gap:10,padding:"13px 16px",borderRadius:14,fontFamily:"Outfit",fontWeight:600,fontSize:13,boxShadow:"0 8px 24px rgba(0,0,0,.2)",background:type==="error"?"#EF4444":type==="info"?"#6366F1":"#10B981",color:"#fff",animation:"fadeUp .3s ease"}}>
    {type==="error"?<XCircle size={15}/>:type==="info"?<AlertCircle size={15}/>:<CheckCircle size={15}/>}
    <span style={{flex:1}}>{msg}</span>
    <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer"}}><X size={14}/></button>
  </div>
);

const LockedPage = ({ name, plan, onUpgrade }) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:360,textAlign:"center",padding:24}}>
    <div style={{width:60,height:60,borderRadius:18,background:"#F8FAFC",border:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><Lock size={24} color="#CBD5E1"/></div>
    <div style={{fontSize:18,fontWeight:800,color:"#0F172A"}}>{name}</div>
    <div style={{fontSize:13,color:"#94A3B8",marginTop:8,marginBottom:22,lineHeight:1.6}}>Available on the <strong style={{color:"#334155"}}>{plan}</strong> plan.</div>
    <Btn Icon={ArrowRight} size="lg" onClick={onUpgrade} full>View Plans & Upgrade</Btn>
  </div>
);

const UploadBox = ({ label, accept, hint, onFile, file, status }) => {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={e=>{e.preventDefault();setDragging(true)}}
      onDragLeave={()=>setDragging(false)}
      onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)onFile(f);}}
      style={{border:`2px dashed ${dragging?"#0D9488":status==="done"?"#10B981":"#E2E8F0"}`,borderRadius:12,padding:"16px",textAlign:"center",background:dragging?"#F0FDFA":status==="done"?"#ECFDF5":"#F8FAFC",cursor:"pointer",transition:"all .2s",marginBottom:10}}>
      <input type="file" accept={accept} style={{display:"none"}} id={label} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);}}/>
      <label htmlFor={label} style={{cursor:"pointer",display:"block"}}>
        {status==="done"
          ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}><CheckCircle size={24} color="#10B981"/><div style={{fontSize:12,fontWeight:700,color:"#065F46"}}>{file?.name||"Uploaded"}</div></div>
          : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}><Upload size={22} color="#94A3B8"/><div style={{fontSize:12,fontWeight:600,color:"#64748B"}}>{label}</div><div style={{fontSize:10,color:"#94A3B8"}}>{hint||"Tap to select or drag & drop"}</div></div>
        }
      </label>
    </div>
  );
};

// ─── ONBOARDING WIZARD ─────────────────────────────────────────────────────────
function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    clinicName:"", ownerName:"", email:"", phone:"", whatsapp:"", address:"", city:"Navi Mumbai", pincode:"", openTime:"08:00", closeTime:"20:00",
    gstNumber:"", panNumber:"", registrationNumber:"", clinicType:"",
    kycDocs:{ gst:null, pan:null, clinicReg:null, ownerAadhaar:null, ownerPhoto:null },
    paymentProvider:"razorpay", bankName:"", accountNumber:"", ifsc:"", upiId:"",
    razorpayKeyId:"", razorpayKeySecret:"",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const set = useCallback((k, v) => setData(p => ({ ...p, [k]: v })), []);
  const setDoc = useCallback((k, v) => setData(p => ({ ...p, kycDocs: { ...p.kycDocs, [k]: v } })), []);

  const STEPS = [
    { id:"basics",   label:"Clinic Details", icon:Building2 },
    { id:"kyc",      label:"KYC & Documents", icon:Fingerprint },
    { id:"payment",  label:"Payment Setup", icon:CC },
    { id:"review",   label:"Review & Submit", icon:CheckCircle },
  ];

  const handleSubmit = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 2000));
    setSaving(false);
    onComplete({ ...data, plan:"BASIC", id:"new_clinic_" + Date.now(), rating:0, reviews:0 });
  };

  return (
    <div style={{minHeight:"100vh",background:"#F4F6FA",padding:16}}>
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"/>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:24,paddingTop:16}}>
        <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#0D9488,#0891B2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><Stethoscope size={22} color="#fff"/></div>
        <div style={{fontSize:20,fontWeight:800,color:"#0F172A"}}>Set Up Your Clinic</div>
        <div style={{fontSize:12,color:"#64748B",marginTop:4}}>Step {step+1} of {STEPS.length}</div>
      </div>

      {/* Step indicators */}
      <div style={{display:"flex",gap:4,marginBottom:24}}>
        {STEPS.map((s,i) => (
          <div key={s.id} style={{flex:1,height:4,borderRadius:999,background:i<=step?"#0D9488":"#E2E8F0",transition:"background .3s"}}/>
        ))}
      </div>

      {/* Step labels */}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
        {STEPS.map((s,i) => (
          <div key={s.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,opacity:i<=step?1:.4}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:i<step?"#0D9488":i===step?"linear-gradient(135deg,#0D9488,#0891B2)":"#E2E8F0",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {i<step?<Check size={12} color="#fff"/>:<s.icon size={12} color={i===step?"#fff":"#94A3B8"}/>}
            </div>
            <div style={{fontSize:9,fontWeight:600,color:i===step?"#0D9488":"#94A3B8",textAlign:"center",maxWidth:50,lineHeight:1.2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{background:"#fff",borderRadius:18,border:"1px solid #E2E8F0",padding:"20px",marginBottom:16}}>

        {step === 0 && (
          <div style={{animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#0F172A",marginBottom:4}}>Clinic & Owner Details</div>
            <div style={{fontSize:12,color:"#94A3B8",marginBottom:18}}>This information will appear on patient-facing communications</div>
            <Field label="Clinic Name" value={data.clinicName} onChange={v=>set("clinicName",v)} placeholder="e.g. Kharghar Diagnostics & Labs" required/>
            <Field label="Owner / Admin Name" value={data.ownerName} onChange={v=>set("ownerName",v)} placeholder="Dr. Anil Sharma" required/>
            <Field label="Email Address" value={data.email} onChange={v=>set("email",v)} type="email" placeholder="clinic@example.com" required/>
            <Field label="Mobile Number" value={data.phone} onChange={v=>set("phone",v)} type="tel" placeholder="+91 98765 43210" required/>
            <Field label="WhatsApp Business Number" value={data.whatsapp} onChange={v=>set("whatsapp",v)} type="tel" placeholder="+91 98765 43210" hint="This is the number patients will message for booking"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Opening Time" value={data.openTime} onChange={v=>set("openTime",v)} type="time" required/>
              <Field label="Closing Time" value={data.closeTime} onChange={v=>set("closeTime",v)} type="time" required/>
            </div>
            <Field label="Full Address" value={data.address} onChange={v=>set("address",v)} placeholder="Sector 15, Kharghar" required/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="City" value={data.city} onChange={v=>set("city",v)} required/>
              <Field label="Pincode" value={data.pincode} onChange={v=>set("pincode",v)} type="number" required/>
            </div>
            <Field label="Clinic Type" value={data.clinicType} onChange={v=>set("clinicType",v)} options={["Pathology Lab","Imaging Centre","Diagnostic Centre","Multi-specialty","Other"]} required/>
          </div>
        )}

        {step === 1 && (
          <div style={{animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#0F172A",marginBottom:4}}>KYC & Business Documents</div>
            <div style={{fontSize:12,color:"#94A3B8",marginBottom:18}}>Required for WhatsApp Business API activation and compliance. All documents are stored encrypted.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <Field label="GST Number" value={data.gstNumber} onChange={v=>set("gstNumber",v)} placeholder="22AAAAA0000A1Z5"/>
              <Field label="PAN Number" value={data.panNumber} onChange={v=>set("panNumber",v)} placeholder="AAAPL1234C"/>
            </div>
            <Field label="Registration No." value={data.registrationNumber} onChange={v=>set("registrationNumber",v)} placeholder="MH/LAB/2024/XXXXX"/>

            <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:10,marginTop:14}}>Upload Documents (PDF or Image)</div>

            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {[["gst","GST Certificate","PDF, max 5MB"],["pan","PAN Card","PDF or Image"],["clinicReg","Clinic Registration Certificate","PDF, max 5MB"],["ownerAadhaar","Owner Aadhaar Card","PDF or Image, last 4 digits visible"],["ownerPhoto","Owner Passport Photo","JPG/PNG, clear face photo"]].map(([k,l,h])=>(
                <UploadBox key={k} label={l} hint={h} accept=".pdf,.jpg,.jpeg,.png" file={data.kycDocs[k]} status={data.kycDocs[k]?"done":""} onFile={f=>setDoc(k,f)}/>
              ))}
            </div>

            <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"12px",marginTop:8,display:"flex",gap:8,alignItems:"flex-start"}}>
              <AlertTriangle size={14} color="#F59E0B" style={{flexShrink:0,marginTop:1}}/>
              <div style={{fontSize:11,color:"#92400E",lineHeight:1.5}}>Documents are reviewed within 24 hours. WhatsApp bot goes live only after KYC approval. All documents are stored encrypted on Cloudflare R2.</div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#0F172A",marginBottom:4}}>Payment Setup</div>
            <div style={{fontSize:12,color:"#94A3B8",marginBottom:18}}>For collecting consultation fees and test payments from patients via WhatsApp</div>

            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:"#64748B",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:.4}}>Payment Gateway</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["razorpay","Razorpay","Most popular in India","#3395FF"],["paytm","PayTM Business","UPI + Cards","#00B9F1"]].map(([id,name,desc,color])=>(
                  <button key={id} onClick={()=>set("paymentProvider",id)} style={{padding:"12px",borderRadius:12,border:`2px solid ${data.paymentProvider===id?color:"#E2E8F0"}`,background:data.paymentProvider===id?`${color}10`:"#fff",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{name}</div>
                    <div style={{fontSize:11,color:"#64748B",marginTop:2}}>{desc}</div>
                    {data.paymentProvider===id && <Check size={12} color={color} style={{marginTop:4}}/>}
                  </button>
                ))}
              </div>
            </div>

            {data.paymentProvider === "razorpay" && (
              <>
                <Field label="Razorpay Key ID" value={data.razorpayKeyId} onChange={v=>set("razorpayKeyId",v)} placeholder="rzp_live_xxxx" hint="From Razorpay Dashboard → Settings → API Keys"/>
                <Field label="Razorpay Key Secret" value={data.razorpayKeySecret} onChange={v=>set("razorpayKeySecret",v)} type="password" placeholder="••••••••••••"/>
              </>
            )}

            <div style={{borderTop:"1px solid #F1F5F9",paddingTop:14,marginTop:4}}>
              <div style={{fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:12}}>Bank Account (for settlements)</div>
              <Field label="Bank Name" value={data.bankName} onChange={v=>set("bankName",v)} placeholder="State Bank of India" required/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="Account Number" value={data.accountNumber} onChange={v=>set("accountNumber",v)} type="number" required/>
                <Field label="IFSC Code" value={data.ifsc} onChange={v=>set("ifsc",v)} placeholder="SBIN0001234" required/>
              </div>
              <Field label="UPI ID (optional)" value={data.upiId} onChange={v=>set("upiId",v)} placeholder="clinic@upi"/>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#0F172A",marginBottom:14}}>Review & Submit</div>
            {[
              { title:"Clinic Details", items:[["Clinic Name",data.clinicName],["Owner",data.ownerName],["Email",data.email],["Phone",data.phone],["Location",`${data.address}, ${data.city}`],["Hours",`${data.openTime} – ${data.closeTime}`]] },
              { title:"KYC Documents", items:[["GST",data.kycDocs.gst?.name||"—"],["PAN",data.kycDocs.pan?.name||"—"],["Clinic Reg",data.kycDocs.clinicReg?.name||"—"],["Aadhaar",data.kycDocs.ownerAadhaar?.name||"—"]] },
              { title:"Payment", items:[["Gateway",data.paymentProvider],["Bank",data.bankName||"—"],["IFSC",data.ifsc||"—"]] },
            ].map(section => (
              <div key={section.title} style={{background:"#F8FAFC",borderRadius:12,padding:"12px",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F172A",marginBottom:8}}>{section.title}</div>
                {section.items.map(([k,v]) => (
                  <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12}}>
                    <span style={{color:"#64748B"}}>{k}</span>
                    <span style={{fontWeight:600,color:"#334155",maxWidth:180,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v||"—"}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:10,padding:"12px",marginTop:10,display:"flex",gap:8,alignItems:"flex-start"}}>
              <Shield size={14} color="#059669" style={{flexShrink:0,marginTop:1}}/>
              <div style={{fontSize:11,color:"#064E3B",lineHeight:1.5}}>By submitting, you agree to DiagConnect's Terms of Service and Privacy Policy. Your KYC documents will be reviewed within 24 hours. Your WhatsApp bot will go live after approval.</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{display:"flex",gap:10}}>
        {step > 0 && <Btn variant="outline" onClick={() => setStep(p => p-1)} full>← Back</Btn>}
        {step < STEPS.length-1
          ? <Btn onClick={() => setStep(p => p+1)} full>Next →</Btn>
          : <Btn onClick={handleSubmit} loading={saving} full size="lg" Icon={CheckCircle}>Submit & Activate</Btn>
        }
      </div>
    </div>
  );
}

// ─── TEST CATALOG MANAGER ───────────────────────────────────────────────────────
function TestCatalogPage({ setPage }) {
  const [tests, setTests] = useState(MASTER_TESTS);
  const [tab, setTab] = useState("list");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [editTest, setEditTest] = useState(null);
  const [search, setSearch] = useState("");

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(() => setToast(null), 2500); };

  const handleFileUpload = async (file) => {
    setUploading(true);
    await new Promise(r => setTimeout(r, 2000));
    setUploading(false);
    showToast(`✅ ${file.name} uploaded — 13 tests synced from master file`);
  };

  const filtered = tests.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    t.cat.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(tests.map(t => t.cat))];

  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div style={{background:"linear-gradient(135deg,#F0FDFA,#EFF6FF)",border:"1px solid #A7F3D0",borderRadius:14,padding:"14px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#0D9488,#0891B2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Package size={16} color="#fff"/></div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:"#0F172A"}}>Test Master Catalog</div>
          <div style={{fontSize:11,color:"#0F766E",lineHeight:1.5}}>Upload a CSV or Excel file to sync test names, codes, prices and preparation instructions. These are used by the WhatsApp bot for patient queries and booking.</div>
        </div>
      </div>

      {/* Upload section */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"16px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <FileSpreadsheet size={16} color="#0D9488"/>Upload Master File
        </div>
        <UploadBox
          label="Drop CSV or Excel here"
          hint="Columns: Code, Test Name, Category, Price, Sample Type, Preparation, TAT Hours"
          accept=".csv,.xlsx,.xls"
          onFile={handleFileUpload}
          status={uploading ? "uploading" : ""}
        />
        {uploading && (
          <div style={{background:"#F0FDFA",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:13,height:13,border:"2px solid #A7F3D0",borderTopColor:"#0D9488",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
            <span style={{fontSize:12,color:"#0D9488",fontWeight:600}}>Processing and uploading to backend…</span>
          </div>
        )}
        <div style={{fontSize:11,color:"#94A3B8",marginTop:10}}>
          <a href="#" style={{color:"#0D9488",fontWeight:600}}>📥 Download template CSV</a>
          {" · "}Last upload: Today 09:30 AM · 13 active tests
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
        {["list","categories"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",background:tab===t?"#0D9488":"#fff",color:tab===t?"#fff":"#64748B",minHeight:34,whiteSpace:"nowrap",flexShrink:0}}>
            {t === "list" ? "All Tests" : "By Category"}
          </button>
        ))}
        <div style={{marginLeft:"auto"}}>
          <Btn size="sm" Icon={Plus} onClick={() => setEditTest({})}>Add Test</Btn>
        </div>
      </div>

      {/* Search */}
      <div style={{position:"relative",marginBottom:12}}>
        <Search size={13} color="#94A3B8" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search test name, code, category…" style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:12,padding:"10px 12px 10px 32px",fontSize:13,outline:"none",background:"#fff",color:"#334155",minHeight:44}}/>
      </div>

      {/* Test list */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.map(t => (
          <div key={t.id} style={{background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:t.cat==="Package"?"#FFFBEB":"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:10,fontWeight:800,color:t.cat==="Package"?"#F59E0B":"#3B82F6"}}>{t.code.slice(0,3)}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                {t.popular && <span style={{fontSize:9,fontWeight:700,color:"#0D9488",background:"#F0FDFA",padding:"1px 5px",borderRadius:5,flexShrink:0}}>★ TOP</span>}
                {t.pkg && <span style={{fontSize:9,fontWeight:700,color:"#F59E0B",background:"#FFFBEB",padding:"1px 5px",borderRadius:5,flexShrink:0}}>PKG</span>}
              </div>
              <div style={{fontSize:10,color:"#94A3B8"}}>{t.cat} · {t.sampleType} · {t.tat}</div>
              <div style={{fontSize:10,color:"#64748B",marginTop:1}}>{t.prep}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:800,color:"#0F172A"}}>₹{t.price}</div>
              <button onClick={() => setEditTest(t)} style={{fontSize:10,color:"#0D9488",background:"none",border:"none",cursor:"pointer",fontFamily:"Outfit",fontWeight:600}}>Edit</button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editTest && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={() => setEditTest(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:"20px",maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#0F172A",marginBottom:16}}>{editTest.id ? "Edit Test" : "Add New Test"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Test Code" value={editTest.code||""} onChange={v=>setEditTest(p=>({...p,code:v}))} placeholder="CBC"/>
              <Field label="Price (₹)" value={editTest.price||""} onChange={v=>setEditTest(p=>({...p,price:v}))} type="number"/>
            </div>
            <Field label="Test Name" value={editTest.name||""} onChange={v=>setEditTest(p=>({...p,name:v}))} placeholder="Complete Blood Count"/>
            <Field label="Category" value={editTest.cat||""} onChange={v=>setEditTest(p=>({...p,cat:v}))} options={["Haematology","Biochemistry","Microbiology","Radiology","Package","Other"]}/>
            <Field label="Sample Type" value={editTest.sampleType||""} onChange={v=>setEditTest(p=>({...p,sampleType:v}))} placeholder="Blood"/>
            <Field label="Preparation Instructions" value={editTest.prep||""} onChange={v=>setEditTest(p=>({...p,prep:v}))} multiline/>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <Btn full onClick={() => { if(editTest.id){setTests(p=>p.map(t=>t.id===editTest.id?editTest:t));}else{setTests(p=>[{...editTest,id:`T${Date.now()}`},...p]);}setEditTest(null);showToast("Saved");}}>Save Test</Btn>
              <Btn variant="outline" full onClick={() => setEditTest(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SLOT BOOKING PAGE ─────────────────────────────────────────────────────────
function SlotsPage({ clinic }) {
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sessions, setSessions] = useState(ALL_SESSIONS);
  const [bookingFor, setBookingFor] = useState(null);
  const [toast, setToast] = useState(null);

  const days = [0,1,2,3,4].map(i => {
    const d = new Date(); d.setDate(d.getDate()+i);
    const label = i===0?"Today":i===1?"Tomorrow":d.toLocaleDateString("en-IN",{weekday:"short",month:"short",day:"numeric"});
    return { offset:i, label, date:d.toISOString().split("T")[0] };
  });

  const handleBook = (slotTime, session) => {
    if (!bookingFor) { setSelectedSlot(slotTime); setSelectedSession(session.id); return; }
    setSessions(prev => prev.map(s => s.id !== session.id ? s : {
      ...s,
      slots: s.slots.map(sl => sl.time !== slotTime ? sl : {
        ...sl,
        booked: sl.booked + 1,
        status: sl.booked + 1 >= 3 ? "FULL" : "OPEN",
        available: Math.max(0, 3 - sl.booked - 1),
      })
    }));
    setToast({ msg: `✅ Booked ${slotTime} for ${bookingFor}`, type:"success" });
    setTimeout(() => setToast(null), 2500);
    setBookingFor(null); setSelectedSlot(null); setSelectedSession(null);
  };

  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div style={{marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:800,color:"#0F172A",marginBottom:10}}>Select Date</div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {days.map(d => (
            <button key={d.offset} onClick={() => setSelectedDate(d.offset)} style={{flexShrink:0,padding:"8px 14px",borderRadius:12,border:"none",cursor:"pointer",background:selectedDate===d.offset?"linear-gradient(135deg,#0D9488,#0891B2)":"#fff",color:selectedDate===d.offset?"#fff":"#334155",fontFamily:"Outfit",fontWeight:700,fontSize:12,boxShadow:selectedDate===d.offset?"0 2px 8px rgba(13,148,136,.25)":"0 0 0 1px #E2E8F0",minHeight:42}}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time legend */}
      <div style={{display:"flex",gap:12,marginBottom:14,padding:"10px 12px",background:"#fff",borderRadius:12,border:"1px solid #E2E8F0"}}>
        {[{c:"#ECFDF5",tc:"#065F46",d:"#10B981",l:"Open (1-2 booked)"},
          {c:"#FEF9C3",tc:"#713F12",d:"#EAB308",l:"Almost Full (2/3)"},
          {c:"#FEF2F2",tc:"#991B1B",d:"#EF4444",l:"Full (3/3)"}].map(({c,tc,d,l}) => (
          <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:d,flexShrink:0}}/>
            <span style={{fontSize:9,color:"#64748B",whiteSpace:"nowrap"}}>{l}</span>
          </div>
        ))}
      </div>

      {/* Sessions */}
      {sessions.map(session => (
        <div key={session.id} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{background:session.bg,color:session.color,borderRadius:10,padding:"5px 10px",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:14}}>{session.emoji}</span>
              <span style={{fontSize:12,fontWeight:800}}>{session.label}</span>
            </div>
            <span style={{fontSize:11,color:"#94A3B8"}}>{session.start} – {session.end}</span>
            <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:session.slots.filter(s=>s.status==="OPEN").length===0?"#EF4444":session.color}}>
              {session.slots.filter(s=>s.status==="OPEN").length} open
            </span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {session.slots.map(slot => {
              const isFull = slot.status === "FULL";
              const isSelected = selectedSlot === slot.time && selectedSession === session.id;
              const almostFull = slot.booked === 2;
              return (
                <button key={slot.time} onClick={() => !isFull && handleBook(slot.time, session)}
                  disabled={isFull}
                  style={{padding:"8px 4px",borderRadius:10,border:`2px solid ${isSelected?"#0D9488":isFull?"#FECACA":almostFull?"#FDE68A":"#E2E8F0"}`,background:isSelected?"#0D9488":isFull?"#FEF2F2":almostFull?"#FEFCE8":"#fff",cursor:isFull?"not-allowed":"pointer",transition:"all .15s",touchAction:"manipulation"}}>
                  <div style={{fontSize:11,fontWeight:700,color:isSelected?"#fff":isFull?"#FCA5A5":almostFull?"#854D0E":"#0F172A",textAlign:"center"}}>{slot.display}</div>
                  <div style={{fontSize:9,textAlign:"center",marginTop:2,color:isSelected?"rgba(255,255,255,.8)":isFull?"#FCA5A5":almostFull?"#A16207":"#94A3B8"}}>
                    {isFull?"FULL":`${3-slot.booked} left`}
                  </div>
                  <div style={{display:"flex",justifyContent:"center",gap:2,marginTop:3}}>
                    {[0,1,2].map(i => (
                      <span key={i} style={{width:5,height:5,borderRadius:"50%",background:i<slot.booked?(isFull?"#EF4444":almostFull?"#F59E0B":"#0D9488"):"#E2E8F0"}}/>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Stats */}
      <div style={{background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",padding:"14px",marginTop:6}}>
        <div style={{fontSize:12,fontWeight:800,color:"#0F172A",marginBottom:10}}>Slot Statistics — Today</div>
        {sessions.map(s => {
          const open = s.slots.filter(sl => sl.status==="OPEN").length;
          const full = s.slots.filter(sl => sl.status==="FULL").length;
          const total = s.slots.length;
          const pct = Math.round((full/total)*100);
          return (
            <div key={s.id} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:"#475569"}}>{s.emoji} {s.label}</span>
                <span style={{fontSize:11,color:"#94A3B8"}}>{full}/{total} full · {open} open</span>
              </div>
              <div style={{height:6,background:"#F1F5F9",borderRadius:999,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:s.color,borderRadius:999}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── REPORT CENTER (with patient identity mapping) ─────────────────────────────
function ReportsPage({ clinic }) {
  const [reports, setReports] = useState(REPORTS_SEED);
  const [tab, setTab] = useState("queue");
  const [uploading, setUploading] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [verifyModal, setVerifyModal] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(() => setToast(null), 3500); };

  const handleLisSync = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 2500));
    setSyncing(false);
    showToast("✅ LIS sync complete — 2 reports detected, identity verified, auto-delivered", "success");
    setReports(prev => prev.map(r => r.id === "R04" ? {
      ...r, deliveryStatus:"delivered", verificationStatus:"verified",
      uploadedAt:"Now", deliveredAt:"Auto", autoDelivered:true,
      file:`LIPID_b7e4d5f2_30Mar.pdf`, lisStatus:"received"
    } : r));
  };

  const doUpload = async (id, file) => {
    if (!file) { showToast("No file selected", "error"); return; }
    setUploading(id);
    await new Promise(r => setTimeout(r, 2200));
    setUploading(null);
    setReports(prev => prev.map(r => r.id !== id ? r : {
      ...r, deliveryStatus:"delivered", verificationStatus:"verified",
      uploadedAt:"Now", deliveredAt:"Auto", autoDelivered:true,
      file:`${r.testCode}_${r.patientToken}_${Date.now()}.pdf`, lisStatus:"received"
    }));
    showToast(`✅ Report verified (3-factor) & delivered to patient WhatsApp`);
  };

  const VerificationModal = ({ r, onClose }) => (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",width:"100%",borderRadius:"20px 20px 0 0",padding:"20px",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <Shield size={18} color="#0D9488"/>
          <div style={{fontSize:14,fontWeight:800,color:"#0F172A"}}>Patient Identity Verification</div>
        </div>

        <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:12,padding:"12px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#065F46",marginBottom:8}}>3-FACTOR VERIFICATION PASSED</div>
          {[
            ["Factor 1 — Phone Match", `Appointment phone matches report target: ${r.phone.slice(0,7)}****`, true],
            ["Factor 2 — Report Token", `R2 path token matches patient HMAC: ${r.patientToken}`, true],
            ["Factor 3 — Test Code", `Report test code (${r.testCode}) matches appointment test`, true],
          ].map(([label, detail, ok]) => (
            <div key={label} style={{display:"flex",gap:9,marginBottom:6}}>
              <div style={{width:16,height:16,borderRadius:"50%",background:ok?"#10B981":"#EF4444",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                {ok?<Check size={9} color="#fff"/>:<X size={9} color="#fff"/>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:"#065F46"}}>{label}</div>
                <div style={{fontSize:10,color:"#047857"}}>{detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:"#F8FAFC",borderRadius:10,padding:"12px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#334155",marginBottom:8}}>Report Security Details</div>
          {[["Patient",r.patient],["Phone",`+91 ****${r.phone?.slice(-4)}`],["Test Code",r.testCode],["Booking Ref",r.ref],["Patient Token",r.patientToken],["R2 Path",`reports/kharghar/2026/03/${r.patientToken}/`],["Delivery Method","WhatsApp Cloud API — presigned URL (24h expiry)"],["Auto-Delivered",r.autoDelivered?"Yes — LIS webhook trigger":"Manual upload"]].map(([k,v]) => (
            <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
              <span style={{color:"#64748B"}}>{k}</span>
              <span style={{fontWeight:600,color:"#334155",maxWidth:180,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"12px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1E40AF",marginBottom:4}}>How Report Routing Works</div>
          <div style={{fontSize:11,color:"#1D4ED8",lineHeight:1.6}}>
            1. LIS sends report via webhook → DiagConnect receives PDF<br/>
            2. 3-factor identity check: phone + token + test code<br/>
            3. PDF stored at <code style={{fontSize:10}}>R2/reports/{"{tenantId}/{patientToken}/"}</code><br/>
            4. Time-limited presigned URL generated (24h expiry)<br/>
            5. URL sent ONLY to the verified patient phone number<br/>
            6. Audit trail logged for DPDP compliance
          </div>
        </div>
        <Btn full onClick={onClose}>Close</Btn>
      </div>
    </div>
  );

  const statusMap = { pending:"pending_r", delivered:"delivered", read:"read" };

  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}
      {verifyModal && <VerificationModal r={verifyModal} onClose={() => setVerifyModal(null)}/>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <KCard label="Delivered" value={reports.filter(r=>r.deliveryStatus!=="pending").length} sub="Auto-verified" Icon={CheckCircle} accent="green"/>
        <KCard label="Pending" value={reports.filter(r=>r.deliveryStatus==="pending").length} Icon={Clock} accent="amber"/>
      </div>

      {/* LIS Integration status */}
      <div style={{background:"linear-gradient(135deg,#0D1117,#1E293B)",borderRadius:14,padding:"14px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Database size={15} color="#14B8A6"/>
            <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>LIS / LIMS Integration</span>
          </div>
          <span style={{fontSize:9,fontWeight:700,background:"rgba(34,197,94,.15)",color:"#22C55E",padding:"2px 8px",borderRadius:5}}>● CONNECTED</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          {[["Auto-Sync","Every 5 mins"],["Last Sync","2 mins ago"],["Webhook","Active"],["Reports Received","47 today"]].map(([k,v]) => (
            <div key={k} style={{background:"rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:"#64748B",marginBottom:2}}>{k}</div>
              <div style={{fontSize:12,fontWeight:700,color:"#E2E8F0"}}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={handleLisSync} disabled={syncing}
          style={{width:"100%",padding:"10px",borderRadius:10,border:"none",fontFamily:"Outfit",fontSize:12,fontWeight:700,cursor:syncing?"not-allowed":"pointer",background:syncing?"rgba(255,255,255,.1)":"rgba(13,148,136,.2)",color:syncing?"#64748B":"#14B8A6",display:"flex",alignItems:"center",justifyContent:"center",gap:7,minHeight:40,touchAction:"manipulation"}}>
          {syncing?<><div style={{width:12,height:12,border:"2px solid rgba(20,184,166,.3)",borderTopColor:"#14B8A6",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Syncing with LIS…</>:<><RefreshCw size={13}/>Sync Now from LIS</>}
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {["queue","delivered","security"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",background:tab===t?"#0D9488":"#fff",color:tab===t?"#fff":"#64748B",minHeight:34,textTransform:"capitalize"}}>
            {t === "security" ? "🔐 Security" : t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "security" ? (
        <div>
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"16px",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:12,display:"flex",alignItems:"center",gap:7}}>
              <Shield size={15} color="#0D9488"/>Patient Identity Mapping
            </div>
            <div style={{fontSize:11,color:"#64748B",lineHeight:1.7,marginBottom:14}}>
              Every report delivery goes through <strong style={{color:"#0F172A"}}>3-factor identity verification</strong> to ensure the right report reaches the right patient:
            </div>
            {[
              { f:"1", t:"Phone Number Match", d:"Report target phone must exactly match the appointment booking phone. Masked in storage.", icon:Phone, color:"#3B82F6" },
              { f:"2", t:"Patient Token (HMAC)", d:"Each patient has a unique token derived from HMAC-SHA256 of tenantId + patientId. Embedded in the R2 file path. Cannot be guessed without backend access.", icon:Fingerprint, color:"#8B5CF6" },
              { f:"3", t:"Test Code Match", d:"The test code in the incoming report (e.g. TSH) must match the test code in the appointment. Prevents CBC report being sent to Lipid Profile patient.", icon:Hash, color:"#F59E0B" },
            ].map(item => (
              <div key={item.f} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid #F8FAFC"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`${item.color}15`,border:`2px solid ${item.color}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <item.icon size={12} color={item.color}/>
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#0F172A"}}>Factor {item.f}: {item.t}</div>
                  <div style={{fontSize:11,color:"#64748B",lineHeight:1.5,marginTop:2}}>{item.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:"#0D1117",borderRadius:14,padding:"14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",marginBottom:8}}>R2 STORAGE PATH STRUCTURE</div>
            <pre style={{fontFamily:"DM Mono",fontSize:10,color:"#86EFAC",lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
{`reports/
└── {tenantId}/
    └── 2026/
        └── 03/
            └── {patientToken}/  ← HMAC-SHA256 of tenantId+patientId
                └── {reportId}.pdf

// Example:
reports/kharghar/2026/03/a3f8b2c1/RPT_1234.pdf

// patientToken = HMAC("tenantId:patientId")[:16]
// Only server can generate this — never exposed to client`}
            </pre>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {reports.filter(r => tab==="delivered" ? r.deliveryStatus!=="pending" : r.deliveryStatus==="pending").map(r => {
            const [uploadFile, setUploadFile] = useState(null);
            return (
              <div key={r.id} style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:r.deliveryStatus==="pending"?"#FFFBEB":"#ECFDF5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <FileText size={16} color={r.deliveryStatus==="pending"?"#F59E0B":"#10B981"}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{r.patient}</div>
                    <div style={{fontSize:11,color:"#94A3B8"}}>{r.test} · {r.ref}</div>
                    {r.file && <div style={{fontSize:9,fontFamily:"DM Mono",color:"#0D9488",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.file}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                    <Pill status={statusMap[r.deliveryStatus]||"pending_r"}/>
                    {r.verificationStatus==="verified" && <span style={{fontSize:9,fontWeight:700,color:"#059669",background:"#ECFDF5",padding:"1px 7px",borderRadius:999}}>🔐 Verified</span>}
                  </div>
                </div>

                {r.deliveryStatus !== "pending" && (
                  <div style={{fontSize:11,color:"#64748B",marginBottom:10}}>
                    Uploaded: {r.uploadedAt} · <span style={{color:"#059669",fontWeight:600}}>Auto-delivered: {r.deliveredAt}</span>
                    {r.autoDelivered && <span style={{marginLeft:6,fontSize:9,fontWeight:700,color:"#6366F1",background:"#EEF2FF",padding:"1px 6px",borderRadius:5}}>⚡ Auto</span>}
                  </div>
                )}

                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {r.deliveryStatus==="pending" ? (
                    <>
                      <label style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px",borderRadius:11,border:"1px dashed #E2E8F0",cursor:"pointer",fontSize:11,fontWeight:600,color:uploadFile?"#0D9488":"#64748B",background:uploadFile?"#F0FDFA":"#F8FAFC",minHeight:40}}>
                        <Upload size={12}/>{uploadFile?uploadFile.name:"Choose PDF"}
                        <input type="file" accept=".pdf" style={{display:"none"}} onChange={e=>setUploadFile(e.target.files[0])}/>
                      </label>
                      <button onClick={() => doUpload(r.id, uploadFile)} disabled={uploading===r.id}
                        style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"9px",borderRadius:11,border:"none",fontFamily:"Outfit",fontSize:11,fontWeight:700,cursor:uploading===r.id?"not-allowed":"pointer",background:uploading===r.id?"#F1F5F9":"linear-gradient(135deg,#0D9488,#0891B2)",color:uploading===r.id?"#94A3B8":"#fff",minHeight:40}}>
                        {uploading===r.id?<><div style={{width:11,height:11,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Verifying…</>:<>Send to WhatsApp</>}
                      </button>
                    </>
                  ) : (
                    <>
                      <Btn variant="outline" size="sm" Icon={Download}>Resend</Btn>
                    </>
                  )}
                  <button onClick={() => setVerifyModal(r)} style={{padding:"9px 12px",borderRadius:11,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,color:"#6366F1",display:"flex",alignItems:"center",gap:5,minHeight:40}}>
                    <Shield size={11}/>Verify
                  </button>
                </div>
              </div>
            );
          })}
          {reports.filter(r => tab==="delivered" ? r.deliveryStatus!=="pending" : r.deliveryStatus==="pending").length === 0 && (
            <div style={{textAlign:"center",padding:"36px",color:"#94A3B8",fontSize:13}}>
              {tab==="delivered"?"No delivered reports yet":"All reports delivered! ✅"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashPage({ clinic, setPage }) {
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:18,fontWeight:800,color:"#0F172A"}}>Good morning 👋</div>
        <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{clinic.name}</div>
      </div>

      {/* API integration status bar */}
      <div style={{background:"#0D1117",borderRadius:14,padding:"12px 14px",marginBottom:16,display:"flex",gap:12,alignItems:"center",overflowX:"auto"}}>
        <span style={{fontSize:10,fontWeight:700,color:"#475569",flexShrink:0}}>INTEGRATIONS</span>
        {[
          {l:"WhatsApp",c:"#F59E0B",s:"Pending setup"},
          {l:"R2 Storage",c:"#22C55E",s:"Connected"},
          {l:"Resend Email",c:"#22C55E",s:"Connected"},
          {l:"Railway",c:"#22C55E",s:"Live"},
          {l:"LIS/LIMS",c:"#F59E0B",s:"Configure"},
        ].map(api => (
          <div key={api.l} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:api.c}}/>
            <span style={{fontSize:10,fontWeight:600,color:"#94A3B8"}}>{api.l}</span>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <KCard label="Today's Appts" value="6" sub="Real-time slots" Icon={Calendar} accent="teal" trend={18} onClick={()=>setPage("slots")}/>
        <KCard label="Monthly Rev" value="₹3.89L" Icon={TrendingUp} accent="green" trend={24.6}/>
        <KCard label="Pending Reports" value="2" sub="From LIS sync" Icon={FileText} accent="amber" onClick={()=>setPage("reports")}/>
        <KCard label="No-Show Rate" value="8.2%" sub="↓ from 18%" Icon={AlertCircle} accent="purple" trend={-55}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
        <KCard label="Tests in Catalog" value={MASTER_TESTS.length} sub="From master file" Icon={Package} accent="blue" onClick={()=>setPage("catalog")}/>
        <KCard label="Rating" value={`${clinic.rating}★`} sub={`${clinic.reviews} reviews`} Icon={Star} accent="amber" trend={5}/>
      </div>

      <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        Today's Appointments
        <button onClick={()=>setPage("appts")} style={{fontSize:11,fontWeight:700,color:"#0D9488",background:"#F0FDFA",border:"none",padding:"4px 10px",borderRadius:7,cursor:"pointer"}}>View all →</button>
      </div>
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",overflow:"hidden",marginBottom:18}}>
        {APPTS_SEED.slice(0,4).map((a,i) => (
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<3?"1px solid #F8FAFC":"none"}}>
            <span style={{fontSize:10,color:"#64748B",width:38,flexShrink:0,fontFamily:"DM Mono"}}>{a.time}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.patient}</div>
              <div style={{fontSize:10,color:"#94A3B8"}}>{a.test} · {a.ref}</div>
            </div>
            <Pill status={a.status}/>
          </div>
        ))}
      </div>

      <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:10}}>Revenue — 6 Months</div>
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"14px",marginBottom:18}}>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={ANALYTICS.monthly}>
            <defs><linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0D9488" stopOpacity={.2}/><stop offset="95%" stopColor="#0D9488" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
            <XAxis dataKey="m" tick={{fontSize:10,fill:"#94A3B8"}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`} tick={{fontSize:9,fill:"#94A3B8"}} axisLine={false} tickLine={false} width={34}/>
            <Tooltip formatter={v=>[`₹${v.toLocaleString()}`,"Revenue"]}/>
            <Area type="monotone" dataKey="rev" stroke="#0D9488" fill="url(#gR)" strokeWidth={2.5} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:10}}>Quick Actions</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[{l:"Slot Calendar",I:Calendar,p:"slots",c:"#0D9488"},{l:"Test Catalog",I:Package,p:"catalog",c:"#6366F1"},{l:"Report Center",I:FileText,p:"reports",c:"#F59E0B"},{l:"WhatsApp Bot",I:MessageSquare,p:"bot",c:"#10B981"}].map(q => (
          <button key={q.l} onClick={()=>setPage(q.p)} style={{display:"flex",alignItems:"center",gap:8,padding:"12px",borderRadius:12,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer",minHeight:50,touchAction:"manipulation"}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${q.c}18`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><q.I size={13} color={q.c}/></div>
            <span style={{fontSize:12,fontWeight:600,color:"#334155"}}>{q.l}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MINIMAL BOT PAGE ──────────────────────────────────────────────────────────
function BotPage({ clinic }) {
  const ts = () => new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
  const [msgs,setMsgs]=useState([{id:1,from:"bot",text:`👋 *Welcome to ${clinic.name}!*\n\nOpen ${clinic.open}–${clinic.close}\n\nTests loaded from master catalog. How can I help?`,btns:["🔬 Book a Test","💰 Test Prices","📅 Check Slots","📄 My Report","💬 Talk to Us"],ts:ts()}]);
  const [inp,setInp]=useState("");
  const [state,setState]=useState("idle");
  const [fd,setFd]=useState({});
  const [typing,setTyping]=useState(false);
  const [aiThink,setAiThink]=useState(false);
  const [showSlots,setShowSlots]=useState(false);
  const [slotSession,setSlotSession]=useState(null);
  const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,typing]);

  const botMsg=async(text,btns,delay=900)=>{setTyping(true);await new Promise(r=>setTimeout(r,delay));setTyping(false);setMsgs(p=>[...p,{id:Date.now()+Math.random(),from:"bot",text,btns,ts:ts()}]);};

  const callAI=async(symptom)=>{
    if(!hasMod(clinic,"ai")){await botMsg("🔒 *AI Triage* is a Pro feature. Upgrade to unlock AI-powered symptom analysis.",["💰 Test Prices","💬 Talk"]);return;}
    setAiThink(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:`DiagConnect AI for Indian diagnostic centre. Tests available: ${MASTER_TESTS.map(t=>`${t.name} ₹${t.price}`).join(", ")}. Patient says: "${symptom}". Suggest 2-3 tests from the list. Return ONLY JSON: {"tests":[{"name":"...","price":300,"reason":"brief"}],"summary":"one sentence"}`}]})});
      const d=await res.json();const parsed=JSON.parse(d.content[0].text);
      setAiThink(false);
      await botMsg(`🤖 *AI Analysis*\n\n${parsed.summary}\n\n${parsed.tests.map(x=>`🔵 *${x.name}* — ₹${x.price}\n   _${x.reason}_`).join("\n\n")}\n\n⚠️ _Consult your doctor._`,["🔬 Book Now","💰 All Prices","💬 Talk to Team"],300);
    }catch{setAiThink(false);await botMsg("Here are our popular tests:",MASTER_TESTS.filter(t=>t.popular).slice(0,4).map(t=>`${t.name} — ₹${t.price}`));}
  };

  const handle=async(raw)=>{
    const text=raw||inp.trim();if(!text)return;setInp("");
    setMsgs(p=>[...p,{id:Date.now(),from:"user",text,ts:ts()}]);
    const lo=text.toLowerCase();

    if(["hi","hello","menu"].includes(lo)){setState("idle");setFd({});await botMsg(`👋 Welcome back!\n\nHow can I help?`,["🔬 Book a Test","💰 Test Prices","📅 Check Slots","📄 My Report","💬 Talk to Us"]);return;}

    if(lo.includes("slot")||lo.includes("📅")){
      setState("idle");
      const availableSlots = ALL_SESSIONS.flatMap(s => s.slots.filter(sl=>sl.status==="OPEN").slice(0,2).map(sl=>({session:s.label,emoji:s.emoji,...sl})));
      await botMsg(`📅 *Next Available Slots*\n\n${availableSlots.slice(0,6).map(sl=>`${sl.emoji} *${sl.session}* — ${sl.display} (${3-sl.booked} spots left)`).join("\n")}\n\nWhich session do you prefer?`,["🌅 Morning","☀️ Midday","🌤 Afternoon","🌙 Evening"]);return;}

    if(state==="idle"&&(lo.includes("book")||lo.includes("🔬"))){
      setState("book_test");
      const popular=MASTER_TESTS.filter(t=>t.popular).slice(0,4);
      await botMsg("Which test would you like? (From our master catalog)",popular.map(t=>`${t.name} — ₹${t.price}`).concat(["Browse full list"]));return;}
    if(state==="book_test"){
      const t=MASTER_TESTS.find(t=>lo.includes(t.name.toLowerCase().split(" ")[0])||lo.includes(t.code.toLowerCase()));
      setFd(p=>({...p,testName:t?.name||text,testCode:t?.code||"",price:t?.price||""}));
      setState("book_session");
      await botMsg(`*${t?.name||text}* ✅\n\nPrep: _${t?.prep||"No special preparation"}_\nTAT: ${t?.tat||"Few hours"}\n\nChoose session:`,["🌅 Morning (7-11am)","☀️ Midday (11am-2pm)","🌤 Afternoon (2-6pm)","🌙 Evening (6-8pm)"]);return;}

    if(state==="book_session"){
      const sessionMap={"🌅 morning (7-11am)":"MORNING","☀️ midday (11am-2pm)":"MIDDAY","🌤 afternoon (2-6pm)":"AFTERNOON","🌙 evening (6-8pm)":"EVENING"};
      const sid=Object.entries(sessionMap).find(([k])=>lo.includes(k.split(" ")[0].replace("🌅","morning").replace("☀️","midday").replace("🌤","afternoon").replace("🌙","evening")))?.[1]||"MORNING";
      const session=ALL_SESSIONS.find(s=>s.id===sid);
      const openSlots=session?.slots.filter(s=>s.status==="OPEN").slice(0,6)||[];
      setFd(p=>({...p,session:sid}));setState("book_slot");
      await botMsg(`*${session?.emoji} ${session?.label}* slots:\n\n${openSlots.map(s=>`${s.display} — ${3-s.booked} spots`).join("\n")}`,openSlots.slice(0,4).map(s=>s.display));return;}

    if(state==="book_slot"){setFd(p=>({...p,slot:text}));setState("book_date");await botMsg("Preferred date?",["Today (Mar 30)","Tomorrow (Mar 31)","Apr 1","Apr 2"]);return;}
    if(state==="book_date"){setFd(p=>({...p,date:text}));setState("book_name");await botMsg("Patient's full name? 👤");return;}
    if(state==="book_name"){const nfd={...fd,name:text};setFd(nfd);setState("book_confirm");await botMsg(`📋 *Booking Summary*\n\n👤 ${text}\n🔬 ${nfd.testName}\n📅 ${nfd.date} · ${nfd.slot}\n💰 ₹${nfd.price||"Quoted"}\n\n_Slot holds for 3 patients max. Confirm?_`,["✅ Confirm","✏️ Change"]);return;}
    if(state==="book_confirm"){setState("idle");setFd({});
      if(lo.includes("confirm")||lo.includes("✅")){const ref="#DC"+Math.floor(Math.random()*900000+100000);await botMsg(`🎉 *Booking Confirmed!*\n\nRef: *${ref}*\n📍 ${clinic.addr}\n\n_Reminder 24h before with prep details._\n_Report auto-delivered when ready._\n\n🙏 Thank you!`,["📅 Add to Calendar","⬅️ Main Menu"],1000);}
      else await botMsg("No problem!",["🔬 Book","⬅️ Menu"]);return;}

    if(lo.includes("price")||lo.includes("💰")){
      const cats={};MASTER_TESTS.forEach(t=>{if(!cats[t.cat])cats[t.cat]=[];cats[t.cat].push(t);});
      const text2=Object.entries(cats).slice(0,3).map(([cat,ts])=>`*${cat}*\n${ts.map(t=>`• ${t.name} — ₹${t.price}`).join("\n")}`).join("\n\n");
      await botMsg(text2+"\n\n_Prices from master catalog. Type test name for details._",["🔬 Book a Test","⬅️ Main Menu"]);return;}

    if(lo.includes("report")||lo.includes("📄")){await botMsg("📄 Share your booking ref (e.g. #DC240301) or phone 👇");return;}
    if(lo.includes("talk")||lo.includes("💬")){await botMsg(`👩‍💼 Connecting to team…\n\nResponse within 5 mins.\n🕐 ${clinic.open}–${clinic.close}`);return;}
    if(/tired|fever|pain|sugar|diabetes|thyroid|kidney|blood|weak|headache|dizzy|cholesterol/i.test(text)){await callAI(text);return;}
    await botMsg("What can I help with?",["🔬 Book a Test","💰 Test Prices","📅 Check Slots","📄 My Report","💬 Talk"]);
  };

  const fmt=s=>s.split("\n").map((l,i)=>(<span key={i}>{l.split(/(\*[^*]+\*|_[^_]+_)/g).map((p,j)=>p.startsWith("*")&&p.endsWith("*")?<strong key={j}>{p.slice(1,-1)}</strong>:p.startsWith("_")&&p.endsWith("_")?<em key={j} style={{fontSize:"0.9em",opacity:.7}}>{p.slice(1,-1)}</em>:p)}<br/></span>));

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100dvh - 120px)",animation:"fadeUp .3s ease"}}>
      <div style={{background:"#0A5C54",padding:"10px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,borderRadius:"16px 16px 0 0"}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Stethoscope size={15} color="#fff"/></div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{clinic.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.7)"}}>{typing||aiThink?"typing…":"● Tests from master catalog · Slots real-time"}</div></div>
        <div style={{background:"rgba(255,255,255,.1)",borderRadius:8,padding:"2px 8px"}}><span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{MASTER_TESTS.length} TESTS</span></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px",background:"#E5DDD5"}}>
        <div style={{textAlign:"center",marginBottom:10}}><span style={{background:"rgba(255,255,255,.7)",padding:"3px 12px",borderRadius:999,fontSize:10,color:"#64748B"}}>Today · Tests loaded from master catalog</span></div>
        {msgs.map(m=>(
          <div key={m.id} style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start",marginBottom:6}}>
            <div style={{maxWidth:"85%"}}>
              <div style={{background:m.from==="user"?"#D9FDD3":"#fff",padding:"9px 12px",borderRadius:m.from==="user"?"14px 14px 3px 14px":"14px 14px 14px 3px",boxShadow:"0 1px 2px rgba(0,0,0,.12)",fontSize:13,lineHeight:1.5,color:"#0F172A"}}>
                <div style={{whiteSpace:"pre-wrap"}}>{fmt(m.text)}</div>
                <div style={{fontSize:9,color:"#94A3B8",textAlign:"right",marginTop:4}}>{m.ts}</div>
              </div>
              {m.btns&&<div style={{marginTop:4,display:"flex",flexDirection:"column",gap:3}}>
                {m.btns.map((b,i)=>(<button key={i} onClick={()=>handle(b)} style={{background:"rgba(255,255,255,.95)",border:"1px solid rgba(13,148,136,.25)",borderRadius:11,padding:"9px 12px",fontSize:12,fontWeight:700,color:"#0D9488",cursor:"pointer",textAlign:"center",fontFamily:"Outfit",minHeight:42,touchAction:"manipulation"}}>{b}</button>))}
              </div>}
            </div>
          </div>
        ))}
        {(typing||aiThink)&&<div style={{display:"flex",justifyContent:"flex-start",marginBottom:6}}><div style={{background:"#fff",padding:"10px 14px",borderRadius:"14px 14px 14px 3px",boxShadow:"0 1px 2px rgba(0,0,0,.12)",display:"flex",alignItems:"center",gap:4}}>{aiThink&&<span style={{fontSize:10,color:"#8B5CF6",marginRight:5}}>🤖 AI…</span>}{[0,1,2].map(i=><span key={i} style={{width:7,height:7,borderRadius:"50%",background:"#94A3B8",display:"inline-block",animation:`bounce3 1.2s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{background:"#F0F2F5",padding:"10px 12px",borderRadius:"0 0 16px 16px",flexShrink:0}}>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="Type or describe symptoms…" style={{flex:1,background:"#fff",border:"none",borderRadius:999,padding:"10px 14px",fontSize:13,outline:"none",color:"#334155",minHeight:44}}/>
          <button onClick={()=>handle()} style={{width:44,height:44,borderRadius:"50%",background:"#0D9488",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><Send size={16} color="#fff"/></button>
        </div>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2}}>
          {["Hi","Book CBC","Thyroid price","Check morning slots","I feel tired","My report"].map(s=>(
            <button key={s} onClick={()=>handle(s)} style={{fontSize:11,fontWeight:600,padding:"5px 10px",borderRadius:999,background:"rgba(13,148,136,.1)",border:"1px solid rgba(13,148,136,.2)",color:"#0D9488",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,minHeight:30}}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsPage({ clinic, setPage }) {
  const [saved, setSaved] = useState(false);
  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {/* API Status */}
      <div style={{background:"#0D1117",borderRadius:14,padding:"14px",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"#64748B",marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>API Integration Status</div>
        {[
          {n:"WhatsApp Business API",s:"pending",d:"Awaiting credentials — to be configured"},
          {n:"Cloudflare R2 Storage",s:"active",d:"https://f11ad4596cff52d5f1901dfe45a820c6.r2.cloudflarestorage.com"},
          {n:"Resend Email API",s:"active",d:"re_4T3Y7pA7... · noreply@diagconnect.in"},
          {n:"Railway Hosting",s:"active",d:"f00b7d30... · diagconnect-api.up.railway.app"},
          {n:"Razorpay Payments",s:"pending",d:"Add keys in Payment Setup"},
          {n:"LIS/LIMS Webhook",s:"pending",d:"Configure your lab system endpoint"},
        ].map(api => (
          <div key={api.n} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:api.s==="active"?"#22C55E":"#F59E0B",flexShrink:0,animation:api.s==="active"?"pulse2 2s infinite":undefined}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"#E2E8F0"}}>{api.n}</div>
              <div style={{fontSize:10,color:"#475569",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{api.d}</div>
            </div>
            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:5,background:api.s==="active"?"rgba(34,197,94,.15)":"rgba(245,158,11,.15)",color:api.s==="active"?"#22C55E":"#F59E0B",flexShrink:0}}>{api.s==="active"?"LIVE":"PENDING"}</span>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"14px",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:800,color:"#0F172A",marginBottom:12}}>Clinic Profile</div>
        {[["Clinic Name",clinic.name],["Owner Name",clinic.owner],["WhatsApp",clinic.wa],["Opening",clinic.open],["Closing",clinic.close]].map(([l,v]) => (
          <div key={l} style={{marginBottom:10}}>
            <label style={{fontSize:10,fontWeight:700,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.4}}>{l}</label>
            <input defaultValue={v} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",color:"#334155",minHeight:44}}/>
          </div>
        ))}
      </div>

      <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:0,overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"12px 14px",borderBottom:"1px solid #F1F5F9",fontSize:13,fontWeight:800,color:"#0F172A"}}>Automation</div>
        {[["Send 24h reminder before appointment",true],["Send 2h reminder before appointment",true],["Auto-deliver reports when received from LIS",true],["Google Review request after report (4h delay)",true],["No-show recovery WhatsApp message (45 min)",true],["Capture DPDP consent on WhatsApp booking",true],["Slot capacity alert when slot becomes full",true],["Email staff when report auto-delivered",true]].map(([l,def],i,arr) => (
          <div key={l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:i<arr.length-1?"1px solid #F8FAFC":"none"}}>
            <span style={{fontSize:12,color:"#334155",flex:1,paddingRight:10,lineHeight:1.4}}>{l}</span>
            <div style={{width:40,height:22,borderRadius:999,background:def?"#0D9488":"#E2E8F0",display:"flex",alignItems:"center",cursor:"pointer",padding:2,flexShrink:0}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",transform:def?"translateX(18px)":"translateX(0)",boxShadow:"0 1px 3px rgba(0,0,0,.2)",transition:"transform .2s"}}/>
            </div>
          </div>
        ))}
      </div>

      <Btn Icon={Save} onClick={save} full size="lg" style={{background:saved?"#10B981":undefined}}>{saved?"✓ Saved!":"Save Changes"}</Btn>
    </div>
  );
}

// ─── SIMPLE PAGES ──────────────────────────────────────────────────────────────
function ApptsPage() {
  const [appts,setAppts]=useState(APPTS_SEED);
  const [filter,setFilter]=useState("all");
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({patient:"",test:"",session:"",slot:""});
  const [toast,setToast]=useState(null);
  const shown=filter==="all"?appts:appts.filter(a=>a.status===filter);
  const upd=(id,s)=>{setAppts(p=>p.map(a=>a.id===id?{...a,status:s}:a));setToast({msg:`Updated to ${s}`,type:"success"});setTimeout(()=>setToast(null),2500);};
  const addAppt=()=>{
    if(!form.patient||!form.test||!form.slot){setToast({msg:"Fill required fields",type:"error"});setTimeout(()=>setToast(null),2500);return;}
    const t=MASTER_TESTS.find(x=>x.id===form.test);
    setAppts(p=>[{id:`A${Date.now()}`,pid:"new",patient:form.patient,phone:"",test:t?.name||"Test",testCode:t?.code||"",time:form.slot,status:"pending",price:t?.price||0,src:"walkin",ref:"#DC"+Date.now().toString().slice(-6),patientToken:Math.random().toString(16).slice(2,10)},...p]);
    setShowNew(false);setForm({patient:"",test:"",session:"",slot:""});
    setToast({msg:"Appointment added",type:"success"});setTimeout(()=>setToast(null),2500);
  };
  const sessionForSlot=(time)=>{const h=parseInt(time.split(":")[0]);if(h<11)return"Morning";if(h<14)return"Midday";if(h<18)return"Afternoon";return"Evening";};
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
      <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,paddingBottom:2}}>
        {["all","confirmed","arrived","pending","completed","noshow"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",background:filter===f?"#0D9488":"#fff",color:filter===f?"#fff":"#64748B",minHeight:34,whiteSpace:"nowrap",flexShrink:0,boxShadow:filter===f?"none":"0 0 0 1px #E2E8F0"}}>
            {f==="all"?"All":f==="noshow"?"No Show":f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      <Btn Icon={showNew?X:Plus} variant={showNew?"secondary":"primary"} full onClick={()=>setShowNew(p=>!p)} style={{marginBottom:12}}>{showNew?"Cancel":"New Appointment"}</Btn>
      {showNew&&(
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"16px",marginBottom:12,borderLeft:"4px solid #0D9488"}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:12,color:"#0F172A"}}>Add Appointment</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><label style={{fontSize:10,fontWeight:700,color:"#64748B",display:"block",marginBottom:4}}>PATIENT NAME *</label><input placeholder="Full name" value={form.patient} onChange={e=>setForm(p=>({...p,patient:e.target.value}))} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",color:"#334155",minHeight:46}}/></div>
            <div><label style={{fontSize:10,fontWeight:700,color:"#64748B",display:"block",marginBottom:4}}>TEST *</label>
              <select value={form.test} onChange={e=>setForm(p=>({...p,test:e.target.value}))} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",background:"#fff",color:"#334155",minHeight:46}}>
                <option value="">Select from master catalog…</option>
                {Object.entries(MASTER_TESTS.reduce((acc,t)=>{(acc[t.cat]||(acc[t.cat]=[])).push(t);return acc},{})).map(([cat,ts]) => (
                  <optgroup key={cat} label={cat}>{ts.map(t=><option key={t.id} value={t.id}>{t.name} — ₹{t.price}</option>)}</optgroup>
                ))}
              </select>
            </div>
            <div><label style={{fontSize:10,fontWeight:700,color:"#64748B",display:"block",marginBottom:4}}>SESSION</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                {SESSIONS.map(s=>(
                  <button key={s.id} onClick={()=>setForm(p=>({...p,session:s.id,slot:""}))} style={{padding:"8px 4px",borderRadius:10,border:`2px solid ${form.session===s.id?s.color:"#E2E8F0"}`,background:form.session===s.id?`${s.color}18`:"#fff",cursor:"pointer",fontSize:10,fontWeight:700,color:form.session===s.id?s.color:"#64748B",textAlign:"center"}}>
                    <div style={{fontSize:14,marginBottom:2}}>{s.emoji}</div>{s.label}
                  </button>
                ))}
              </div>
            </div>
            {form.session && (
              <div><label style={{fontSize:10,fontWeight:700,color:"#64748B",display:"block",marginBottom:4}}>SLOT *</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
                  {ALL_SESSIONS.find(s=>s.id===form.session)?.slots.filter(sl=>sl.status==="OPEN").slice(0,8).map(sl=>(
                    <button key={sl.time} onClick={()=>setForm(p=>({...p,slot:sl.time}))} style={{padding:"6px 3px",borderRadius:9,border:`2px solid ${form.slot===sl.time?"#0D9488":"#E2E8F0"}`,background:form.slot===sl.time?"#F0FDFA":"#fff",cursor:"pointer",fontSize:10,fontWeight:700,color:form.slot===sl.time?"#0D9488":"#334155",textAlign:"center"}}>
                      {sl.display}<br/><span style={{fontSize:8,color:"#94A3B8"}}>{3-sl.booked} left</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Btn Icon={Check} full onClick={addAppt} size="lg">Add Appointment</Btn>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {shown.map(a=>(
          <div key={a.id} style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",padding:"14px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:800,color:"#0F172A"}}>{a.patient}</div><div style={{fontSize:11,color:"#64748B"}}>{a.test} · {a.ref}</div></div>
              <Pill status={a.status}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:600,color:"#64748B"}}>⏰ {a.time} · {sessionForSlot(a.time)}</span>
              <span style={{fontSize:11,fontWeight:700,color:"#0F172A"}}>₹{a.price.toLocaleString()}</span>
              <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:6,background:a.src==="bot"?"#F0FDFA":"#F1F5F9",color:a.src==="bot"?"#0D9488":"#64748B"}}>{a.src==="bot"?"🟢 WA Bot":"Walk-in"}</span>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {a.status==="pending"&&<Btn size="sm" variant="outline" onClick={()=>upd(a.id,"confirmed")}>Confirm</Btn>}
              {a.status==="confirmed"&&<Btn size="sm" variant="outline" onClick={()=>upd(a.id,"arrived")}>Arrived</Btn>}
              {a.status==="arrived"&&<Btn size="sm" variant="secondary" onClick={()=>upd(a.id,"completed")}>Complete</Btn>}
              {(a.status==="pending"||a.status==="confirmed")&&<Btn size="sm" variant="ghost" onClick={()=>upd(a.id,"noshow")}>No-show</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NAV SHELL ─────────────────────────────────────────────────────────────────
const ALL_NAV=[{id:"dash",l:"Dashboard",I:LayoutDashboard,m:"dash"},{id:"appts",l:"Appointments",I:Calendar,m:"appts"},{id:"slots",l:"Slot Calendar",I:Clock,m:"appts"},{id:"reports",l:"Report Center",I:FileText,m:"reports"},{id:"bot",l:"WhatsApp Bot",I:MessageSquare,m:"bot"},{id:"catalog",l:"Test Catalog",I:Package,m:"dash"},{id:"analytics",l:"Analytics",I:BarChart3,m:"analytics"},{id:"campaigns",l:"Campaigns",I:Send,m:"campaigns"},{id:"compliance",l:"Compliance",I:Shield,m:"dash"},{id:"plans",l:"Plans",I:CreditCard,m:"dash"},{id:"settings",l:"Settings",I:Settings,m:"dash"}];
const BOT_NAV=[{id:"dash",l:"Home",I:LayoutDashboard},{id:"appts",l:"Visits",I:Calendar},{id:"reports",l:"Reports",I:FileText},{id:"bot",l:"Bot",I:MessageSquare},{id:"slots",l:"Slots",I:Clock}];

function Shell({ clinic, page, setPage, onLogout, children }) {
  const [showMenu,setShowMenu]=useState(false);
  const titles={dash:"Dashboard",appts:"Appointments",slots:"Slot Calendar",reports:"Report Center",bot:"WhatsApp Bot",catalog:"Test Catalog",analytics:"Analytics",campaigns:"Campaigns",compliance:"Compliance",plans:"Plans & Pricing",settings:"Settings"};
  return (
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#F4F6FA",fontFamily:"Outfit"}}>
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap"/>
      <header style={{position:"sticky",top:0,zIndex:100,background:"#fff",borderBottom:"1px solid #F1F5F9",padding:"0 14px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0D9488,#0891B2)",display:"flex",alignItems:"center",justifyContent:"center"}}><Stethoscope size={13} color="#fff"/></div>
          <div><div style={{fontSize:13,fontWeight:800,color:"#0F172A",lineHeight:1.2}}>{titles[page]||"DiagConnect"}</div><div style={{fontSize:9,color:"#94A3B8"}}>{clinic.name}</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:9,fontWeight:800,padding:"2px 7px",borderRadius:5,background:clinic.plan==="PRO"?"rgba(245,158,11,.15)":clinic.plan==="PREMIUM"?"rgba(139,92,246,.15)":"rgba(59,130,246,.15)",color:clinic.plan==="PRO"?"#F59E0B":clinic.plan==="PREMIUM"?"#A78BFA":"#60A5FA"}}>{clinic.plan}</span>
          <button onClick={()=>setShowMenu(p=>!p)} style={{width:36,height:36,borderRadius:10,background:"#F8FAFC",border:"1px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
            {showMenu?<X size={15} color="#334155"/>:<Menu size={15} color="#334155"/>}
          </button>
        </div>
      </header>
      {showMenu&&(
        <>
          <div onClick={()=>setShowMenu(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200}}/>
          <div style={{position:"fixed",top:0,right:0,bottom:0,width:260,background:"#0D1117",zIndex:201,display:"flex",flexDirection:"column",animation:"slideIn .25s ease",overflowY:"auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#CBD5E1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{clinic.name}</div>
              <button onClick={()=>setShowMenu(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#475569",padding:4}}><X size={16}/></button>
            </div>
            <nav style={{flex:1,padding:"6px"}}>
              {ALL_NAV.map(n=>{const active=page===n.id;const locked=!hasMod(clinic,n.m);
                return <button key={n.id} onClick={()=>{setPage(n.id);setShowMenu(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px",borderRadius:10,border:"none",background:active?"rgba(13,148,136,.15)":"transparent",cursor:"pointer",marginBottom:2,opacity:locked?.4:1,minHeight:46}}>
                  <n.I size={15} color={active?"#14B8A6":"#64748B"}/><span style={{fontSize:13,fontWeight:active?700:500,color:active?"#14B8A6":"#94A3B8",flex:1,textAlign:"left"}}>{n.l}</span>{locked&&<Lock size={10} color="#1E293B"/>}
                </button>;
              })}
            </nav>
            <div style={{padding:"6px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
              <button onClick={onLogout} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"12px",borderRadius:10,border:"none",background:"transparent",cursor:"pointer",minHeight:46}}>
                <LogOut size={15} color="#EF4444"/><span style={{fontSize:13,color:"#EF4444",fontWeight:500}}>Sign out</span>
              </button>
            </div>
          </div>
        </>
      )}
      <main style={{flex:1,overflowY:"auto",padding:14,paddingBottom:72}}>{children}</main>
      <nav style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:"#fff",borderTop:"1px solid #F1F5F9",display:"flex",zIndex:100,boxShadow:"0 -2px 12px rgba(0,0,0,.06)"}}>
        {BOT_NAV.map(n=>{const active=page===n.id;return <button key={n.id} onClick={()=>setPage(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,border:"none",background:"transparent",cursor:"pointer",touchAction:"manipulation",position:"relative"}}>
          <n.I size={20} color={active?"#0D9488":"#94A3B8"}/><span style={{fontSize:9,fontWeight:active?700:500,color:active?"#0D9488":"#94A3B8"}}>{n.l}</span>
          {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:20,height:2,background:"#0D9488",borderRadius:999}}/>}
        </button>;})}
      </nav>
    </div>
  );
}

// ─── PLANS / SIMPLE PAGES ──────────────────────────────────────────────────────
function PlansPage({ clinic, onUpgrade }) {
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      {[{key:"BASIC",name:"Basic",price:7500,color:"#3B82F6",I:Shield,f:["WhatsApp booking bot","Automated reminders","Digital report delivery","Test catalog (CSV upload)","Session-based slot booking","200 patients"],m:["Patient CRM","Analytics","Campaigns","API","AI Triage"]},
        {key:"PREMIUM",name:"Premium",price:14000,color:"#8B5CF6",I:Zap,f:["Everything in Basic","Patient CRM","Analytics","5 campaigns/month","Review automation","1,000 patients","LIS/LIMS integration"],m:["API","AI Triage","Unlimited"]},
        {key:"PRO",name:"Pro",price:22000,color:"#F59E0B",I:Crown,f:["Everything in Premium","REST API + webhooks","AI symptom triage","Unlimited everything","Railway auto-scaling","R2 unlimited storage","Dedicated support","99.5% SLA"],m:[]}
      ].map(p=>{
        const isCurrent=clinic.plan===p.key;
        const isUp=["BASIC","PREMIUM","PRO"].indexOf(p.key)>["BASIC","PREMIUM","PRO"].indexOf(clinic.plan);
        return(
          <div key={p.key} style={{background:"#fff",borderRadius:18,border:`2px solid ${isCurrent?p.color:"#E2E8F0"}`,padding:"18px",marginBottom:12,position:"relative"}}>
            {isCurrent&&<div style={{position:"absolute",top:-11,right:14,background:"#10B981",color:"#fff",fontSize:9,fontWeight:800,padding:"4px 10px",borderRadius:999}}>✓ CURRENT</div>}
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:12,background:`${p.color}18`,display:"flex",alignItems:"center",justifyContent:"center"}}><p.I size={18} color={p.color}/></div>
              <div><div style={{fontSize:17,fontWeight:800,color:"#0F172A"}}>{p.name}</div><span style={{fontSize:20,fontWeight:900}}>₹{p.price.toLocaleString()}</span><span style={{fontSize:11,color:"#94A3B8"}}>/mo</span></div>
            </div>
            <div style={{marginBottom:12}}>{p.f.map(f=><div key={f} style={{display:"flex",gap:7,marginBottom:5}}><div style={{width:14,height:14,borderRadius:"50%",background:"#ECFDF5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}><Check size={8} color="#059669"/></div><span style={{fontSize:12,color:"#334155"}}>{f}</span></div>)}</div>
            <button onClick={()=>isUp&&onUpgrade(p.key)} style={{width:"100%",padding:"11px",borderRadius:12,background:isCurrent?"#F8FAFC":isUp?p.color:"#F8FAFC",border:isCurrent?"1px solid #E2E8F0":"none",color:isCurrent?"#94A3B8":isUp?"#fff":"#CBD5E1",fontFamily:"Outfit",fontWeight:700,fontSize:13,cursor:isUp?"pointer":"default",minHeight:44}}>
              {isCurrent?"✓ Current Plan":isUp?`Upgrade to ${p.name} →`:"Downgrade"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CompliancePage() {
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{background:"linear-gradient(135deg,#ECFDF5,#EFF6FF)",border:"1px solid #A7F3D0",borderRadius:14,padding:"14px",marginBottom:14,display:"flex",gap:10}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#10B981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Shield size={16} color="#fff"/></div>
        <div><div style={{fontSize:13,fontWeight:800,color:"#0F172A"}}>DPDP Act 2023 Compliant</div><div style={{fontSize:11,color:"#064E3B",lineHeight:1.6,marginTop:3}}>Patient data encrypted, consent tracked, full rights enforcement. Reports delivered only after 3-factor identity verification.</div></div>
      </div>
      {[["WhatsApp Opt-in",8,10],["Marketing",6,10],["Report Delivery",10,10],["Research",3,10]].map(([l,v,t]) => (
        <div key={l} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12,color:"#475569"}}><span>{l}</span><strong style={{color:"#0F172A"}}>{v}/{t}</strong></div>
          <div style={{height:6,background:"#F1F5F9",borderRadius:999,overflow:"hidden"}}><div style={{height:"100%",width:`${(v/t)*100}%`,background:"#10B981",borderRadius:999}}/></div>
        </div>
      ))}
    </div>
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin, onNewClinic }) {
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(false);
  const demos=[{id:"kharghar",label:"Kharghar Diagnostics",sub:"Pro · Full Access",dot:"#F59E0B"},{id:"vashi",label:"Vashi Health Centre",sub:"Premium · Analytics",dot:"#8B5CF6"}];
  const go=async()=>{if(!sel)return;setLoading(true);await new Promise(r=>setTimeout(r,900));onLogin(CLINICS[sel]);};
  return(
    <div style={{minHeight:"100vh",background:"#050B1A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap"/>
      <div style={{width:"100%",maxWidth:400,animation:"fadeUp .4s ease"}}>
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,#0D9488,#0891B2)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><Stethoscope size={22} color="#fff"/></div>
          <div style={{fontSize:26,fontWeight:900,color:"#fff",letterSpacing:-.5}}>DiagConnect</div>
          <div style={{fontSize:12,color:"#475569",marginTop:4}}>Production · Railway + R2 + Resend</div>
        </div>
        <div style={{background:"rgba(255,255,255,.05)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:22,padding:22}}>
          <div style={{fontSize:14,fontWeight:700,color:"#F1F5F9",marginBottom:4}}>Sign in</div>
          <div style={{fontSize:11,color:"#475569",marginBottom:16}}>Select a demo clinic or set up a new one</div>
          {demos.map(d=>(
            <button key={d.id} onClick={()=>setSel(d.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 13px",borderRadius:13,border:`2px solid ${sel===d.id?"rgba(13,148,136,.6)":"rgba(255,255,255,.06)"}`,background:sel===d.id?"rgba(13,148,136,.1)":"rgba(255,255,255,.03)",cursor:"pointer",textAlign:"left",minHeight:54,marginBottom:8}}>
              <div style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                <HeartPulse size={15} color={sel===d.id?"#14B8A6":"#475569"}/>
                <span style={{position:"absolute",bottom:-2,right:-2,width:7,height:7,borderRadius:"50%",background:d.dot,border:"1.5px solid #050B1A"}}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.label}</div>
                <div style={{fontSize:11,color:"#475569"}}>{d.sub}</div>
              </div>
              {sel===d.id&&<Check size={14} color="#14B8A6"/>}
            </button>
          ))}
          <button onClick={go} disabled={!sel||loading} style={{width:"100%",padding:"12px",borderRadius:13,background:"linear-gradient(135deg,#0D9488,#0891B2)",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:(!sel||loading)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,minHeight:48,opacity:(!sel||loading)?.7:1,marginBottom:10}}>
            {loading?<><div style={{width:13,height:13,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Signing in…</>:<>Sign In<ArrowRight size={14}/></>}
          </button>
          <button onClick={onNewClinic} style={{width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",color:"#94A3B8",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Outfit"}}>
            🏥 New Clinic? Set Up Onboarding →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function DiagConnect() {
  const [clinic,setClinic]=useState(null);
  const [page,setPage]=useState("dash");
  const [showOnboarding,setShowOnboarding]=useState(false);
  const [toast,setToast]=useState(null);

  const upgrade=(plan)=>{setClinic(p=>({...p,plan}));setToast({msg:`✅ Upgraded to ${PLANS[plan]?.name}!`,type:"success"});setTimeout(()=>setToast(null),3000);setPage("dash");};

  if(showOnboarding) return <OnboardingWizard onComplete={(data)=>{setClinic({...data,plan:"BASIC",rating:0,reviews:0});setShowOnboarding(false);setPage("dash");}}/>;
  if(!clinic) return <LoginPage onLogin={c=>{setClinic(c);setPage("dash");}} onNewClinic={()=>setShowOnboarding(true)}/>;

  const cp={clinic,setPage};
  const pages={
    dash:<DashPage {...cp}/>,
    appts:<ApptsPage/>,
    slots:<SlotsPage {...cp}/>,
    reports:<ReportsPage {...cp}/>,
    bot:<BotPage {...cp}/>,
    catalog:<TestCatalogPage setPage={setPage}/>,
    analytics:hasMod(clinic,"analytics")?<div style={{padding:20,textAlign:"center",color:"#94A3B8"}}>Analytics coming soon</div>:<LockedPage name="Analytics" plan="Premium" onUpgrade={()=>setPage("plans")}/>,
    campaigns:hasMod(clinic,"campaigns")?<div style={{padding:20,textAlign:"center",color:"#94A3B8"}}>Campaigns coming soon</div>:<LockedPage name="Campaigns" plan="Premium" onUpgrade={()=>setPage("plans")}/>,
    compliance:<CompliancePage/>,
    plans:<PlansPage {...cp} onUpgrade={upgrade}/>,
    settings:<SettingsPage {...cp}/>,
  };

  return(
    <Shell clinic={clinic} page={page} setPage={setPage} onLogout={()=>{setClinic(null);setPage("dash");}}>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
      {pages[page]||pages.dash}
    </Shell>
  );
}
