/* Konfigurasi: isi URL dan anon/publishable key dari Supabase Project Settings > API */
const SUPABASE_URL = "https://akebktlyhfrfwopxrnbt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cGvCIZszseAnEC4qOiHikw_DrAqliM3";
const DB_NAME = "sarpras-darussalam-local-v2";
const STORE = "records";
const QUEUE = "outbox";
let sb = null, currentUser = null, currentRole = "petugas", items = [], rooms = [], profiles = [], mutations = [], inspections = [], editingRoomId = null, dashboardSelectedRoomId = "";
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)});
const isConfigured = () => SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("ISI_") && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes("ISI_");
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:"key"});if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:"id"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbAll(store){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(store,"readonly"),r=t.objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function dbPut(store,obj){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(store,"readwrite");t.objectStore(store).put(obj);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function dbDelete(store,key){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(store,"readwrite");t.objectStore(store).delete(key);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function dbClear(store){const d=await openDB();return new Promise((res,rej)=>{const t=d.transaction(store,"readwrite");t.objectStore(store).clear();t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
function setMsg(id,msg,good=false){const el=$(id);if(el){el.textContent=msg;el.className="msg "+(good?"good":"")}}
function onlineStatus(){$("netStatus").textContent=navigator.onLine?"Online":"Offline";$("netDot").style.color=navigator.onLine?"#8ef0a5":"#ff9b9b";$("syncStatus").textContent="";$("syncExplanation").textContent=navigator.onLine?"Koneksi tersedia. Perubahan lokal akan dikirim ke database bersama.":"Offline. Perubahan disimpan di perangkat ini dan menunggu koneksi."}
function showApp(){ $("loginPanel").classList.add("hidden");$("appPanel").classList.remove("hidden");$("userLabel").textContent=currentUser?.email||"Pengguna";$("roleLabel").textContent=currentRole==="admin_utama"?"Admin utama":(currentRole==="admin"?"Admin":"Petugas");document.querySelectorAll(".admin-only").forEach(e=>e.classList.toggle("hidden",currentRole!=="admin_utama")); }
function showLogin(){ $("appPanel").classList.add("hidden");$("loginPanel").classList.remove("hidden"); }
function activateView(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));if(name==="admins")loadProfiles();if(name==="mutations")renderMutations();if(name==="qr")renderQRHome();}
function table(head,rows){return `<table><thead><tr>${head.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${v??""}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${head.length}" class="muted">Belum ada data.</td></tr>`}</tbody></table>`}
function roomLabel(id){return rooms.find(r=>r.id===id)?.name||""}
function cond(i){return `<span class="pill">${i.good||0} baik</span> <span class="pill">${i.minor||0} ringan</span> <span class="pill">${i.major||0} berat</span>`}
function render(){
$("countKinds").textContent=items.length;$("countUnits").textContent=items.reduce((s,x)=>s+(+x.qty||0),0);$("countRooms").textContent=rooms.length;$("countDamaged").textContent=items.reduce((s,x)=>s+(+x.minor||0)+(+x.major||0),0);
$("itemRoom").innerHTML='<option value="">Belum ditentukan</option>'+rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
const q=($("itemSearch").value||"").toLowerCase(), visible=items.filter(i=>[i.code,i.name,i.category,roomLabel(i.room_id)].join(" ").toLowerCase().includes(q));
$("itemsTable").innerHTML=table(["Kode","Nama / kategori","Ruangan","Jumlah","Kondisi","Foto","Tindakan"],visible.map(i=>[esc(i.code||"-"),`<b>${esc(i.name)}</b><br>${esc(i.category)}<br><small>${esc(i.year||"")}</small>`,esc(roomLabel(i.room_id)||"-"),i.qty,cond(i),`${i.photo?`<img class="thumb" src="${i.photo}" alt="Foto barang">`:""}${i.damage_photo?`<img class="thumb" src="${i.damage_photo}" alt="Foto kerusakan">`:""}`,`<button class="btn light" data-edit="${i.id}">Edit</button> <button class="btn danger" data-del="${i.id}">Hapus</button><br><small>${esc(i.sync_state||"tersimpan")}</small>`]));
const roomQuery=($("roomSearch")?.value||"").trim().toLocaleLowerCase("id-ID");
const visibleRooms=rooms.filter(r=>[r.name,r.type,r.pic].some(v=>String(v||"").toLocaleLowerCase("id-ID").includes(roomQuery)));
$("roomsTable").innerHTML=table(["Ruangan","Jenis","Penanggung jawab","Keterangan","Jumlah jenis barang","Jumlah unit","Tindakan"],visibleRooms.map(r=>{const roomItems=items.filter(i=>i.room_id===r.id);const kindCount=roomItems.length;const unitCount=roomItems.reduce((sum,i)=>sum+(Number(i.qty)||0),0);return [esc(r.name),esc(r.type),esc(r.pic||"-"),esc(r.notes||"-"),kindCount,unitCount,`<button class="btn light" data-roomedit="${r.id}">Edit</button> <button class="btn danger" data-roomdel="${r.id}">Hapus</button>`]}));
$("recentTable").innerHTML=table(["Kode","Barang","Ruangan","Jumlah","Kondisi"],[...items].sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||"")).slice(0,5).map(i=>[esc(i.code||"-"),esc(i.name),esc(roomLabel(i.room_id)||"-"),i.qty,cond(i)]));
renderDashboardDetails();
renderReport();renderMutations();renderInspectionHistory();updateQueueStatus();
}
function renderDashboardDetails(){
  const recent=$("recentTable");
  if(!recent)return;
  let panel=$("dashboardDetails");
  if(!panel){panel=document.createElement("section");panel.id="dashboardDetails";panel.className="dashboard-details";recent.parentElement.insertAdjacentElement("afterend",panel);}
  const sum=key=>items.reduce((n,i)=>n+(Number(i[key])||0),0);
  const total=sum("qty"),good=sum("good"),minor=sum("minor"),major=sum("major"),damaged=minor+major;
  const pct=(n,base)=>base?Math.round(n/base*100):0;
  const cats={};items.forEach(i=>{const k=i.category||"Lainnya";cats[k]=(cats[k]||0)+(Number(i.qty)||0)});
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const damagedRows=items.filter(i=>(Number(i.minor)||0)+(Number(i.major)||0)>0).sort((a,b)=>(((Number(b.major)||0)*2+(Number(b.minor)||0))-((Number(a.major)||0)*2+(Number(a.minor)||0)))).slice(0,5);
  const roomGroups=[...rooms.map(r=>({id:r.id,name:r.name,items:items.filter(i=>i.room_id===r.id)}))];
  const unassigned=items.filter(i=>!i.room_id);
  if(unassigned.length)roomGroups.push({id:"__unassigned__",name:"Belum ditentukan ruangannya",items:unassigned});
  if(!roomGroups.some(r=>r.id===dashboardSelectedRoomId)) dashboardSelectedRoomId=roomGroups[0]?.id||"";
  const selectedRoom=roomGroups.find(r=>r.id===dashboardSelectedRoomId);
  const roomChart=selectedRoom?(()=>{const room=selectedRoom;
    const sumRoom=key=>room.items.reduce((n,i)=>n+(Number(i[key])||0),0);
    const rt=sumRoom("qty"),rg=sumRoom("good"),rm=sumRoom("minor"),rj=sumRoom("major");
    return `<div class="dash-room"><h4>${esc(room.name)}</h4><p class="dash-room-total">${room.items.length} jenis barang · ${rt} unit</p>${[["Baik",rg,"dash-good"],["Rusak ringan",rm,"dash-minor"],["Rusak berat",rj,"dash-major"]].map(([label,n,cls])=>`<div class="dash-line"><span>${label}</span><div class="dash-track"><div class="dash-fill ${cls}" style="width:${pct(n,rt)}%"></div></div><b>${n} (${pct(n,rt)}%)</b></div>`).join("")}<p class="dash-note">Persentase dihitung dari ${rt} unit di ruangan ini.</p></div>`;
  })():'<p class="dash-note">Belum ada ruangan terdata. Tambahkan ruangan dan tentukan lokasi barang pada menu Inventaris.</p>';
  panel.innerHTML=`
    <style>
      #dashboardDetails{margin-top:16px;color:var(--text,#1f2937)}
      #dashboardDetails .dash-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #dashboardDetails .dash-card{background:var(--card,#fff);border:1px solid var(--border,#dbe2e8);border-radius:12px;padding:16px;min-width:0}
      #dashboardDetails h3{font-size:16px;margin:0 0 13px}
      #dashboardDetails .dash-room-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
      #dashboardDetails .dash-room-filter{display:block;width:100%;max-width:360px;margin:0 0 12px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1f2937;font:inherit}
      #dashboardDetails .dash-room{background:#f5f9ff;border:1px solid #cbdcf5;border-radius:10px;padding:12px;min-width:0}
      #dashboardDetails .dash-room:nth-child(3n+2){background:#f1fbf5;border-color:#c4e8d1}
      #dashboardDetails .dash-room:nth-child(3n){background:#fff8ed;border-color:#f3d8ad}
      #dashboardDetails .dash-room h4{margin:0 0 4px;font-size:14px;color:#183b63}
      #dashboardDetails .dash-room-total{margin:0;color:var(--muted,#667085);font-size:12px}
      #dashboardDetails .dash-line{display:grid;grid-template-columns:90px minmax(30px,1fr) minmax(76px,auto);align-items:center;gap:8px;margin:12px 0;font-size:13px}
      #dashboardDetails .dash-line b{white-space:nowrap;text-align:right;font-size:12px}
      #dashboardDetails .dash-track{height:10px;border-radius:20px;background:#edf0f3;overflow:hidden}
      #dashboardDetails .dash-fill{height:100%;border-radius:20px;min-width:0}
      #dashboardDetails .dash-good{background:#248653}#dashboardDetails .dash-minor{background:#e3a326}#dashboardDetails .dash-major{background:#c94242}
      #dashboardDetails .dash-note{font-size:12px;color:var(--muted,#667085);margin:8px 0 0}
      #dashboardDetails .dash-category{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px}
      #dashboardDetails .dash-category:last-child{border-bottom:0}
      @media(max-width:700px){#dashboardDetails .dash-grid{grid-template-columns:1fr}#dashboardDetails .dash-room-grid{grid-template-columns:1fr}#dashboardDetails .dash-line{grid-template-columns:82px minmax(20px,1fr) minmax(76px,auto);gap:6px}}
      @media print{#dashboardDetails .dash-grid{grid-template-columns:1fr 1fr}#dashboardDetails .dash-card{break-inside:avoid}}
    </style>
    <div class="dash-grid">
      <div class="dash-card"><h3>Grafik Kondisi Barang per Ruangan</h3>
        <label for="dashboardRoomFilter" class="dash-note" style="display:block;margin:0 0 6px">Pilih ruangan</label>
        <select id="dashboardRoomFilter" class="dash-room-filter">${roomGroups.map(r=>`<option value="${esc(r.id)}" ${r.id===dashboardSelectedRoomId?"selected":""}>${esc(r.name)}</option>`).join("")}</select>
        <div class="dash-room-grid">${roomChart}</div>
        <p class="dash-note">Grafik menampilkan satu ruangan pilihan. Pilih ruangan lain pada daftar di atas untuk melihat kondisinya.</p>
      </div>
      <div class="dash-card"><h3>Jenis Barang per Kategori</h3>
        ${catRows.length?catRows.map(([name,n])=>`<div class="dash-category"><span>${esc(name)}</span><b>${n} unit</b></div>`).join(""):'<p class="dash-note">Belum ada data inventaris.</p>'}
        ${Object.keys(cats).length>5?`<p class="dash-note">Menampilkan 5 kategori dengan jumlah unit terbanyak.</p>`:""}
      </div>
      <div class="dash-card"><h3>Barang Perlu Perhatian</h3>
        ${damagedRows.length?table(["Barang","Ruangan","Rusak ringan","Rusak berat"],damagedRows.map(i=>[esc(i.name),esc(roomLabel(i.room_id)||"Belum ditentukan"),Number(i.minor)||0,Number(i.major)||0])):'<p class="dash-note">Tidak ada barang rusak yang tercatat.</p>'}
        <p class="dash-note">Total unit rusak: <b>${damaged}</b> dari ${total} unit.</p>
      </div>
      <div class="dash-card"><h3>Kelengkapan Pendataan</h3>
        <div class="dash-category"><span>Barang sudah ditempatkan</span><b>${items.filter(i=>i.room_id).length} jenis</b></div>
        <div class="dash-category"><span>Barang belum ditentukan ruangannya</span><b>${items.filter(i=>!i.room_id).length} jenis</b></div>
        <div class="dash-category"><span>Ruangan terdata</span><b>${rooms.length} ruangan</b></div>
        <p class="dash-note">Gunakan angka ini untuk membantu memeriksa data yang masih perlu dilengkapi.</p>
      </div>
    </div>`;
  const roomFilter=$("dashboardRoomFilter");
  if(roomFilter) roomFilter.addEventListener("change",()=>{dashboardSelectedRoomId=roomFilter.value;renderDashboardDetails()});
}
async function localLoad(){const all=await dbAll(STORE);items=all.filter(x=>x.table==="inventory").map(x=>x.data);rooms=all.filter(x=>x.table==="rooms").map(x=>x.data);mutations=all.filter(x=>x.table==="mutations").map(x=>x.data).sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));render()}
async function cacheRecord(tableName,data){await dbPut(STORE,{key:tableName+":"+data.id,table:tableName,data});}
async function removeCached(tableName,id){await dbDelete(STORE,tableName+":"+id)}
async function queueOp(tableName,op,data,id=data.id){await dbPut(QUEUE,{id:uuid(),table:tableName,op,data,row_id:id,queued_at:new Date().toISOString()});}
async function saveLocal(tableName,data){data.updated_at=new Date().toISOString();data.updated_by=currentUser?.id||null;data.sync_state="menunggu sinkronisasi";await cacheRecord(tableName,data);await queueOp(tableName,"upsert",data);if(navigator.onLine)syncQueue();await localLoad()}
async function deleteLocal(tableName,id){const existing=(tableName==="inventory"?items:rooms).find(x=>x.id===id);await removeCached(tableName,id);await queueOp(tableName,"delete",{id,updated_at:new Date().toISOString(),updated_by:currentUser?.id||null},id);if(navigator.onLine)syncQueue();await localLoad()}
async function updateQueueStatus(){const q=await dbAll(QUEUE);$("syncStatus").textContent=q.length?`· ${q.length} perubahan menunggu sinkronisasi`:"· tersinkron";$("syncExplanation").textContent=q.length?`${q.length} perubahan masih menunggu dikirim ke database bersama.`:"Tidak ada perubahan dalam antrean lokal."}
async function syncQueue(){
 if(!sb||!navigator.onLine||!currentUser)return;
 const queue=(await dbAll(QUEUE)).sort((a,b)=>a.queued_at.localeCompare(b.queued_at));
 for(const op of queue){
   try{
     if(op.op==="upsert"){
       const payload={...op.data};delete payload.sync_state;
       const {error}=await sb.from(op.table).upsert(payload,{onConflict:"id"});if(error)throw error;
     }else{
       const {error}=await sb.from(op.table).delete().eq("id",op.row_id);if(error)throw error;
     }
     await dbDelete(QUEUE,op.id);
   }catch(err){console.warn("Sync tertunda:",err.message);$("syncStatus").textContent="· sinkronisasi tertunda";break}
 }
 if(queue.length){await fetchRemote();await localLoad()}
 await updateQueueStatus();
}
async function fetchRemote(){
 if(!sb||!navigator.onLine||!currentUser)return;
 for(const t of ["rooms","inventory","mutations"]){
   const {data,error}=await sb.from(t).select("*");if(error){console.warn(error.message);continue}
   const pending=await dbAll(QUEUE);const pendingIds=new Set(pending.filter(op=>op.table===t).map(op=>op.row_id));for(const row of (data||[])){if(pendingIds.has(row.id))continue;row.sync_state="tersinkron";await cacheRecord(t,row)}
 }
 await localLoad();
}
async function initAuth(){
 if(!isConfigured()){ $("setupNotice").classList.remove("hidden");$("loginMsg").textContent="Konfigurasi Supabase belum diisi.";return}
 if(!window.supabase){$("loginMsg").textContent="Library login belum termuat. Hubungkan internet lalu muat ulang.";return}
 sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const {data:{session}}=await sb.auth.getSession();
 if(session?.user){currentUser=session.user;await establishSession()}else showLogin();
 sb.auth.onAuthStateChange(async(event,session)=>{if(session?.user){currentUser=session.user;await establishSession()}else{currentUser=null;showLogin()}});
}
async function establishSession(){
 showApp();await localLoad();
 if(navigator.onLine){
   const {data:profile,error}=await sb.from("profiles").select("role,display_name").eq("id",currentUser.id).single();
   if(!error&&profile){currentRole=profile.role||"petugas";localStorage.setItem("sarpras-role-"+currentUser.id,currentRole);$("userLabel").textContent=profile.display_name||currentUser.email;$("roleLabel").textContent=currentRole==="admin_utama"?"Admin utama":(currentRole==="admin"?"Admin":"Petugas")}
   else currentRole="petugas";
   showApp();await fetchRemote();await syncQueue();
 }else{
   const saved=localStorage.getItem("sarpras-role-"+currentUser.id);if(saved)currentRole=saved;
   showApp();
 }
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb){setMsg("loginMsg","Konfigurasi aplikasi belum siap.");return}setMsg("loginMsg","Memeriksa akun…");const {data,error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){setMsg("loginMsg","Gagal masuk: "+error.message);return}currentUser=data.user;await establishSession();setMsg("loginMsg","Berhasil masuk.",true)});
$("logout").addEventListener("click",async()=>{if(sb&&navigator.onLine)await sb.auth.signOut();currentUser=null;currentRole="petugas";showLogin()});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>activateView(b.dataset.view)));
$("syncNow").addEventListener("click",async()=>{if(!navigator.onLine){alert("Perangkat masih offline. Data akan disinkronkan otomatis saat internet kembali.");return}await syncQueue();await fetchRemote();alert("Proses sinkronisasi selesai. Periksa indikator antrean.")});
function fileToData(file){return new Promise(resolve=>{if(!file){resolve("");return}const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,900/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.68))};im.onerror=()=>resolve(String(r.result||""));im.src=r.result};r.onerror=()=>resolve("");r.readAsDataURL(file)})}
function resetItemForm(){$("itemForm").reset();$("itemId").value="";$("itemQty").value=1;$("itemGood").value=1;$("itemMinor").value=0;$("itemMajor").value=0;$("itemFormTitle").textContent="Tambah Inventaris"}
$("itemForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser){alert("Masuk terlebih dahulu.");return}
const qty=+$("itemQty").value||0,good=+$("itemGood").value||0,minor=+$("itemMinor").value||0,major=+$("itemMajor").value||0;
if(qty!==good+minor+major&&!confirm("Jumlah kondisi tidak sama dengan jumlah unit. Simpan tetap?"))return;
const edit=$("itemId").value,old=items.find(x=>x.id===edit);const photo=await fileToData($("itemPhoto").files[0]),damage=await fileToData($("damagePhoto").files[0]);
const row={id:edit||uuid(),code:$("itemCode").value.trim(),name:$("itemName").value.trim(),category:$("itemCategory").value,room_id:$("itemRoom").value||null,qty,year:$("itemYear").value?+$("itemYear").value:null,good,minor,major,recorder:$("itemRecorder").value.trim(),notes:$("itemNotes").value.trim(),photo:photo||old?.photo||"",damage_photo:damage||old?.damage_photo||"",created_by:old?.created_by||currentUser.id};
await saveLocal("inventory",row);resetItemForm();alert("Data disimpan pada perangkat. Sinkronisasi akan berjalan jika internet tersedia.")});
$("itemReset").addEventListener("click",resetItemForm);
$("itemsTable").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]")?.dataset.edit,del=e.target.closest("[data-del]")?.dataset.del;if(edit){const i=items.find(x=>x.id===edit);if(!i)return;$("itemId").value=i.id;$("itemCode").value=i.code||"";$("itemName").value=i.name;$("itemCategory").value=i.category;$("itemRoom").value=i.room_id||"";$("itemQty").value=i.qty;$("itemYear").value=i.year||"";$("itemGood").value=i.good;$("itemMinor").value=i.minor;$("itemMajor").value=i.major;$("itemRecorder").value=i.recorder||"";$("itemNotes").value=i.notes||"";$("itemFormTitle").textContent="Edit Inventaris";window.scrollTo({top:0,behavior:"smooth"})}if(del&&confirm("Hapus inventaris ini dari database bersama?"))await deleteLocal("inventory",del)});
$("roomForm").addEventListener("submit",async e=>{e.preventDefault();const row={id:uuid(),name:$("roomName").value.trim(),type:$("roomType").value,pic:$("roomPIC").value.trim(),notes:$("roomNotes").value.trim(),created_by:currentUser.id};await saveLocal("rooms",row);$("roomForm").reset();alert("Ruangan disimpan. Sinkronisasi otomatis akan dilakukan saat online.")});
$("roomsTable").addEventListener("click",async e=>{const rid=e.target.closest("[data-roomdel]")?.dataset.roomdel;if(!rid)return;if(items.some(i=>i.room_id===rid)){alert("Ruangan masih dipakai oleh barang. Ubah lokasi barang terlebih dahulu.");return}if(confirm("Hapus ruangan dari database bersama?"))await deleteLocal("rooms",rid)});
$("itemSearch").addEventListener("input",render);
function reportItems(){
  const roomFilter=$("reportRoomFilter")?.value||"";
  return items.filter(i=>
    (!$("reportCategory").value||i.category===$("reportCategory").value)&&
    (!$("reportCondition").value||($("reportCondition").value==="good"?i.good>0:$("reportCondition").value==="minor"?i.minor>0:i.major>0))&&
    (!roomFilter||(i.room_id||"")===roomFilter)
  );
}
function reportFilterLabels(){
  const cat=$("reportCategory")?.selectedOptions?.[0]?.textContent||"Semua kategori";
  const condLabel=$("reportCondition")?.selectedOptions?.[0]?.textContent||"Semua kondisi";
  const roomSelect=$("reportRoomFilter");
  const room=roomSelect?.selectedOptions?.[0]?.textContent||"Semua ruangan";
  return {cat,condLabel,room};
}
function decorateReportOutput(){
  const summary=$("reportSummary"), reportTableEl=$("reportTable");
  if(!summary||!reportTableEl)return;
  const {cat,condLabel,room}=reportFilterLabels();
  const today=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  // Gunakan logo yang sama dengan header aplikasi agar logo laporan selalu konsisten.
  const schoolLogo = document.querySelector("header .brand .app-school-logo img, header .brand .logo img");
  const schoolLogoSrc = schoolLogo?.currentSrc || schoolLogo?.src || "";
  summary.querySelectorAll(".report-print-header").forEach(el=>el.remove());
  document.querySelectorAll("#reportSignatureBlock").forEach(el=>el.remove());
  summary.insertAdjacentHTML("afterbegin", `
    <section class="report-print-header">
      ${schoolLogoSrc ? `<img class="report-school-logo" src="${schoolLogoSrc}" alt="Logo SD Islam Darussalam">` : ""}
      <div class="report-school-name">SD ISLAM DARUSSALAM PALANGKARAYA</div>
      <div class="report-school-subtitle">LAPORAN SARANA DAN PRASARANA SEKOLAH</div>
      <div class="report-header-rule"></div>
      <h2>LAPORAN INVENTARIS BARANG</h2>
      <p class="report-header-date">Tanggal laporan: <b>${esc(today)}</b></p>
      <div class="report-filter-summary"><span>Kategori: <b>${esc(cat)}</b></span><span>Kondisi: <b>${esc(condLabel)}</b></span><span>Ruangan: <b>${esc(room)}</b></span></div>
    </section>`);
  reportTableEl.insertAdjacentHTML("afterend", `
    <section id="reportSignatureBlock" class="report-signatures">
      <div class="report-sign-date">Palangkaraya, ${esc(today)}</div>
      <div class="report-sign-columns">
        <div class="report-sign-column"><p>Mengetahui,</p><p><b>Kepala Sekolah</b></p><div class="report-sign-space"></div><p class="report-sign-name">(........................................)</p><p>NIP. ....................................</p></div>
        <div class="report-sign-column"><p>Petugas Inventaris</p><p><b>Pengelola Sarana dan Prasarana</b></p><div class="report-sign-space"></div><p class="report-sign-name">(........................................)</p><p>NIP. ....................................</p></div>
      </div>
    </section>`);
  if(!$("reportPrintStyles")){
    const style=document.createElement("style");style.id="reportPrintStyles";style.textContent=`
      .report-print-header{display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 0 12px;color:#172b24}
      .report-school-logo{display:block;width:72px;height:72px;object-fit:contain;margin:0 auto 7px;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      .report-school-name{font-size:18px;font-weight:800;letter-spacing:.5px}.report-school-subtitle{font-size:12px;margin-top:3px}.report-header-rule{height:3px;background:#173f32;width:100%;margin:8px 0 10px}
      .report-print-header h2{font-size:16px;margin:0 0 6px}.report-header-date{margin:0 0 7px}.report-filter-summary{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;font-size:11px}
      .report-signatures{margin:8px 0 0;color:#111;display:block;break-inside:avoid!important;page-break-inside:avoid!important}.report-sign-date{text-align:right;margin-bottom:4px}
      .report-sign-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;break-inside:avoid!important;page-break-inside:avoid!important}.report-sign-column{text-align:center;min-width:0;break-inside:avoid!important;page-break-inside:avoid!important}
      .report-sign-column p{margin:2px 0}.report-sign-space{height:24px}.report-sign-name{font-weight:700}
      @page{size:A4 portrait;margin:12mm}
      @media print{html,body{margin:0!important;padding:0!important;background:#fff!important}body *{visibility:hidden!important}#view-reports,#view-reports *{visibility:visible!important}#view-reports{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important;background:#fff!important;color:#111!important}#view-reports .no-print,#view-reports button,#view-reports input,#view-reports select{display:none!important}#view-reports .card{border:0!important;box-shadow:none!important;padding:0!important;margin:0!important}#view-reports h2{margin-top:0!important}}
    `;document.head.appendChild(style);
  }
}

function renderReport(){
  if($("reportRoomFilter")?.value==="__unassigned__"){renderReportUnassigned();return;}
  const arr=reportItems();
  const total=arr.reduce((s,i)=>s+(+i.qty||0),0);
  const good=arr.reduce((s,i)=>s+(+i.good||0),0);
  const minor=arr.reduce((s,i)=>s+(+i.minor||0),0);
  const major=arr.reduce((s,i)=>s+(+i.major||0),0);
  const damaged=arr.filter(i=>(+i.minor||0)>0||(+i.major||0)>0);
  const oldRoomFilter=$("reportRoomFilter")?.value||"";
  $("reportSummary").innerHTML=`
    <style>
      .condition-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}
      .condition-card{border:1px solid #d7ded9;border-radius:10px;padding:12px;background:#f8faf9;color:#173b2f}
      .condition-card span{display:block;font-size:12px;color:#53645c;margin-bottom:5px}
      .condition-card strong{font-size:24px}
      .condition-card small{display:block;font-size:11px;margin-top:3px}
      .condition-heading{margin:20px 0 8px}
      .report-filter-room{max-width:360px;margin:12px 0}
      @media(max-width:650px){.condition-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media print{.condition-summary{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.condition-card{padding:7px;background:#fff!important}.condition-card strong{font-size:16px}}
    </style>
    <p><b>Tanggal laporan:</b> ${new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</p>
    <label class="no-print report-filter-room">Filter ruangan
      <select id="reportRoomFilter">
        <option value="">Semua ruangan</option>
        ${rooms.map(r=>`<option value="${esc(r.id)}" ${r.id===oldRoomFilter?"selected":""}>${esc(r.name)}</option>`).join("")}
        <option value="__unassigned__" ${oldRoomFilter==="__unassigned__"?"selected":""}>Belum ditentukan</option>
      </select>
    </label>
    <div class="condition-summary">
      <div class="condition-card"><span>Jenis barang</span><strong>${arr.length}</strong><small>jenis</small></div>
      <div class="condition-card"><span>Total unit</span><strong>${total}</strong><small>seluruh kondisi</small></div>
      <div class="condition-card"><span>Kondisi baik</span><strong>${good}</strong><small>unit</small></div>
      <div class="condition-card"><span>Rusak ringan</span><strong>${minor}</strong><small>unit</small></div>
      <div class="condition-card"><span>Rusak berat</span><strong>${major}</strong><small>unit</small></div>
      <div class="condition-card"><span>Total unit rusak</span><strong>${minor+major}</strong><small>ringan + berat</small></div>
    </div>
    <h3 class="condition-heading">Daftar Barang Perlu Perbaikan</h3>
    <p>Barang dengan kondisi rusak ringan atau rusak berat: <b>${damaged.length} jenis</b>.</p>
    <div id="reportDamagedTable" class="tablewrap"></div>
  `;
  $("reportDamagedTable").innerHTML=table(["Kode","Nama","Ruangan","Jumlah","Baik","Rusak ringan","Rusak berat","Keterangan"],damaged.map(i=>[esc(i.code||"-"),esc(i.name),esc(roomLabel(i.room_id)||"-"),i.qty,i.good,i.minor,i.major,esc(i.notes||"-")]));
  $("reportTable").innerHTML=table(
    ["No","Kode","Nama","Kategori","Ruangan","Tahun","Jumlah","Baik","Rusak ringan","Rusak berat","Keterangan"],
    arr.map((i,n)=>[n+1,esc(i.code||"-"),esc(i.name),esc(i.category),esc(roomLabel(i.room_id)||"-"),i.year||"-",i.qty,i.good,i.minor,i.major,esc(i.notes||"-")])
  );
  decorateReportOutput();
  const roomSelect=$("reportRoomFilter");
  if(roomSelect) roomSelect.addEventListener("change",()=>{
    const value=roomSelect.value;
    if(value==="__unassigned__"){
      roomSelect.dataset.unassigned="1";
      renderReportUnassigned();
    } else {
      roomSelect.dataset.unassigned="";
      renderReport();
      const updated=$("reportRoomFilter");
      if(updated) updated.value=value;
    }
  });
}
function renderReportUnassigned(){
  const select=$("reportRoomFilter");
  const category=$("reportCategory").value;
  const condition=$("reportCondition").value;
  const arr=items.filter(i=>(!category||i.category===category)&&(!condition||(condition==="good"?i.good>0:condition==="minor"?i.minor>0:i.major>0))&&!i.room_id);
  const total=arr.reduce((s,i)=>s+(+i.qty||0),0),good=arr.reduce((s,i)=>s+(+i.good||0),0),minor=arr.reduce((s,i)=>s+(+i.minor||0),0),major=arr.reduce((s,i)=>s+(+i.major||0),0);
  const damaged=arr.filter(i=>(+i.minor||0)>0||(+i.major||0)>0);
  $("reportSummary").innerHTML=`
    <style>.condition-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.condition-card{border:1px solid #d7ded9;border-radius:10px;padding:12px;background:#f8faf9;color:#173b2f}.condition-card span{display:block;font-size:12px;color:#53645c;margin-bottom:5px}.condition-card strong{font-size:24px}.condition-card small{display:block;font-size:11px;margin-top:3px}.condition-heading{margin:20px 0 8px}@media(max-width:650px){.condition-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media print{.condition-summary{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.condition-card{padding:7px;background:#fff!important}.condition-card strong{font-size:16px}}</style>
    <p><b>Tanggal laporan:</b> ${new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</p>
    <label class="no-print report-filter-room">Filter ruangan
      <select id="reportRoomFilter"><option value="">Semua ruangan</option>${rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}<option value="__unassigned__" selected>Belum ditentukan</option></select>
    </label>
    <div class="condition-summary">
      <div class="condition-card"><span>Jenis barang</span><strong>${arr.length}</strong><small>jenis</small></div>
      <div class="condition-card"><span>Total unit</span><strong>${total}</strong><small>seluruh kondisi</small></div>
      <div class="condition-card"><span>Kondisi baik</span><strong>${good}</strong><small>unit</small></div>
      <div class="condition-card"><span>Rusak ringan</span><strong>${minor}</strong><small>unit</small></div>
      <div class="condition-card"><span>Rusak berat</span><strong>${major}</strong><small>unit</small></div>
      <div class="condition-card"><span>Total unit rusak</span><strong>${minor+major}</strong><small>ringan + berat</small></div>
    </div>
    <h3 class="condition-heading">Daftar Barang Perlu Perbaikan</h3><p>Barang dengan kondisi rusak ringan atau rusak berat: <b>${damaged.length} jenis</b>.</p><div id="reportDamagedTable" class="tablewrap"></div>`;
  $("reportDamagedTable").innerHTML=table(["Kode","Nama","Ruangan","Jumlah","Baik","Rusak ringan","Rusak berat","Keterangan"],damaged.map(i=>[esc(i.code||"-"),esc(i.name),esc(roomLabel(i.room_id)||"-"),i.qty,i.good,i.minor,i.major,esc(i.notes||"-")]));
  $("reportTable").innerHTML=table(["No","Kode","Nama","Kategori","Ruangan","Tahun","Jumlah","Baik","Rusak ringan","Rusak berat","Keterangan"],arr.map((i,n)=>[n+1,esc(i.code||"-"),esc(i.name),esc(i.category),esc(roomLabel(i.room_id)||"-"),i.year||"-",i.qty,i.good,i.minor,i.major,esc(i.notes||"-")]));
  decorateReportOutput();
  const newSelect=$("reportRoomFilter");
  if(newSelect)newSelect.addEventListener("change",()=>{if(newSelect.value==="__unassigned__")renderReportUnassigned();else renderReport()});
}
$("reportCategory").addEventListener("change",renderReport);
$("reportCondition").addEventListener("change",renderReport);
function csvCell(v){let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function csvDownload(name,headers,rows){const blob=new Blob(["\ufeff"+[headers,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
const itemCSV=arr=>arr.map(i=>[i.code,i.name,i.category,roomLabel(i.room_id),i.qty,i.good,i.minor,i.major,i.year,i.recorder,i.notes]);
$("exportItems").addEventListener("click",()=>csvDownload("inventaris_sd_darussalam.csv",["Kode","Nama","Kategori","Ruangan","Jumlah","Baik","Rusak ringan","Rusak berat","Tahun","Petugas","Keterangan"],itemCSV(items)));
$("exportRooms").addEventListener("click",()=>csvDownload("ruangan_sd_darussalam.csv",["Nama","Jenis","Penanggung jawab","Keterangan"],rooms.map(r=>[r.name,r.type,r.pic,r.notes])));
$("exportReport").addEventListener("click",()=>{
  const arr=reportItems();
  const total=arr.reduce((n,i)=>n+(Number(i.qty)||0),0),good=arr.reduce((n,i)=>n+(Number(i.good)||0),0),minor=arr.reduce((n,i)=>n+(Number(i.minor)||0),0),major=arr.reduce((n,i)=>n+(Number(i.major)||0),0);
  const {cat,condLabel,room}=reportFilterLabels();
  const rows=[
    ["Tanggal laporan",new Date().toLocaleDateString("id-ID")],
    ["Filter kategori",cat],
    ["Filter kondisi",condLabel],
    ["Filter ruangan",room],
    [],
    ["REKAPITULASI","Nilai"],
    ["Jenis barang",arr.length],
    ["Total unit",total],
    ["Kondisi baik",good],
    ["Rusak ringan",minor],
    ["Rusak berat",major],
    [],
    ["No","Kode","Nama","Kategori","Ruangan","Tahun","Jumlah","Baik","Rusak ringan","Rusak berat","Petugas","Keterangan"],
    ...arr.map((i,n)=>[n+1,i.code,i.name,i.category,roomLabel(i.room_id)||"Belum ditentukan",i.year||"",i.qty,i.good,i.minor,i.major,i.recorder,i.notes])
  ];
  const csv=["LAPORAN INVENTARIS SARANA DAN PRASARANA SD DARUSSALAM",...rows.map(r=>r.map(csvCell).join(";"))].join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="laporan_inventaris_sarpras_sd_darussalam.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
});
$("printReport").addEventListener("click",()=>{
   activateView("reports");
   renderReport();
   setTimeout(()=>{
     const signatures=[...document.querySelectorAll("#reportSignatureBlock")];
     signatures.slice(0,-1).forEach(el=>el.remove());
     window.print();
   },100);
 });
$("backupDownload").addEventListener("click",async()=>{const payload={app:"SARPRAS SD Darussalam",version:2,exported_at:new Date().toISOString(),records:await dbAll(STORE),outbox:await dbAll(QUEUE)};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="cadangan_sarpras_darussalam.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$("restoreBackup").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const p=JSON.parse(await f.text());if(!Array.isArray(p.records))throw Error("Format tidak sesuai");if(!confirm("Pulihkan data lokal dari file ini?"))return;await dbClear(STORE);await dbClear(QUEUE);for(const r of p.records)await dbPut(STORE,r);for(const q of (p.outbox||[]))await dbPut(QUEUE,q);await localLoad();if(navigator.onLine)await syncQueue();alert("Cadangan dipulihkan ke perangkat ini.")}catch(err){alert("File cadangan tidak valid.")}e.target.value=""});
async function callAdminFunction(body){const {data:{session}}=await sb.auth.getSession();const {data,error}=await sb.functions.invoke("admin-users",{body,headers:{Authorization:"Bearer "+session.access_token}});if(error)throw error;return data}
async function loadProfiles(){if(currentRole!=="admin_utama")return;try{const {data,error}=await sb.from("profiles").select("id,email,display_name,role,created_at").order("created_at");if(error)throw error;profiles=data||[];$("adminsTable").innerHTML=table(["Email","Nama petugas","Peran","Ubah peran","Simpan nama"],profiles.map(p=>[esc(p.email||"(email tidak tersedia)"),`<input type="text" maxlength="120" value="${esc(p.display_name||"")}" placeholder="Nama petugas" data-name-input="${p.id}" style="min-width:150px;width:100%">`,esc(p.role),p.id===currentUser.id?"Admin utama":`<select data-role-id="${p.id}"><option value="petugas" ${p.role==="petugas"?"selected":""}>Petugas</option><option value="admin" ${p.role==="admin"?"selected":""}>Admin</option></select>`,`<button type="button" class="btn" data-save-name="${p.id}">Simpan</button>`]));}catch(e){$("adminsTable").textContent="Gagal memuat akun: "+e.message}}
$("adminsTable").addEventListener("change",async e=>{const id=e.target.dataset.roleId;if(!id)return;try{await callAdminFunction({action:"set_role",user_id:id,role:e.target.value});await loadProfiles();alert("Peran akun diperbarui.")}catch(err){alert("Tidak dapat mengubah peran: "+err.message);await loadProfiles()}});
$("adminsTable").addEventListener("click",async e=>{const btn=e.target.closest("[data-save-name]");if(!btn)return;const id=btn.dataset.saveName;const input=$("adminsTable").querySelector(`[data-name-input="${id}"]`);const name=(input?.value||"").trim();if(!name){alert("Nama petugas wajib diisi.");input?.focus();return}btn.disabled=true;try{await callAdminFunction({action:"set_name",user_id:id,name});alert("Nama petugas berhasil disimpan.");await loadProfiles()}catch(err){alert("Tidak dapat menyimpan nama: "+(err.message||err));}finally{btn.disabled=false}});
$("createUserForm").addEventListener("submit",async e=>{e.preventDefault();try{setMsg("adminMsg","Membuat akun…");await callAdminFunction({action:"create_user",name:$("newUserName").value.trim(),email:$("newUserEmail").value.trim(),password:$("newUserPassword").value,role:$("newUserRole").value});setMsg("adminMsg","Akun berhasil dibuat.",true);$("createUserForm").reset();await loadProfiles()}catch(err){setMsg("adminMsg","Gagal membuat akun: "+err.message)}});

// Modul mutasi barang: UI ditambahkan tanpa mengubah struktur halaman yang sudah ada.
function initMutationUI(){
  if($("view-mutations"))return;
  const firstTab=document.querySelector(".tab"),firstView=document.querySelector(".view");
  if(!firstTab||!firstView)return;
  const navParent=firstTab.parentElement;
  const tab=document.createElement("button");tab.type="button";tab.className=firstTab.className;tab.dataset.view="mutations";tab.textContent="Mutasi Barang";navParent.appendChild(tab);tab.addEventListener("click",()=>activateView("mutations"));
  const viewParent=firstView.parentElement;
  const view=document.createElement("section");view.id="view-mutations";view.className=firstView.className;view.innerHTML=`
    <div class="card">
      <h2>Catat Mutasi Barang</h2>
      <p class="muted">Mutasi akan langsung memperbarui inventaris utama dan menyimpan riwayat. Pastikan jenis dan jumlah mutasi benar sebelum menyimpan.</p>
      <form id="mutationForm">
        <div class="grid">
          <div class="field"><label for="mutationType">Jenis mutasi</label><select id="mutationType" required><option value="incoming">Barang masuk</option><option value="transfer">Pemindahan ruangan</option><option value="outgoing">Barang keluar</option></select></div>
          <div class="field"><label for="mutationItem">Barang inventaris</label><select id="mutationItem" required></select></div>
          <div class="field"><label for="mutationQty">Jumlah unit</label><input id="mutationQty" type="number" min="1" step="1" value="1" required></div>
          <div class="field" id="mutationConditionWrap"><label for="mutationCondition">Kondisi unit keluar</label><select id="mutationCondition"><option value="good">Baik</option><option value="minor">Rusak ringan</option><option value="major">Rusak berat</option></select></div>
          <div class="field" id="mutationToRoomWrap"><label for="mutationToRoom">Ruangan tujuan</label><select id="mutationToRoom"></select></div>
          <div class="field"><label for="mutationReason">Alasan / sumber / tujuan</label><input id="mutationReason" maxlength="200" placeholder="Contoh: pembelian, hibah, dipindahkan" required></div>
          <div class="field"><label for="mutationNotes">Keterangan tambahan</label><input id="mutationNotes" maxlength="500" placeholder="Nomor dokumen atau keterangan (opsional)"></div>
        </div>
        <div class="actions"><button class="btn" type="submit">Simpan Mutasi</button><button class="btn secondary" id="mutationReset" type="button">Bersihkan</button></div>
        <p id="mutationMsg" class="msg" role="status"></p>
      </form>
    </div>
    <div class="card"><h2>Riwayat Mutasi Barang</h2><div class="field no-print"><label for="mutationSearch">Cari riwayat</label><input id="mutationSearch" placeholder="Cari nama barang, jenis mutasi, alasan…"></div><div id="mutationsTable" class="tablewrap"></div><div class="actions no-print"><button class="btn secondary" id="exportMutations" type="button">Ekspor Riwayat Mutasi (CSV Excel)</button><button class="btn secondary" id="printMutations" type="button">Cetak Riwayat</button></div></div>`;
  viewParent.appendChild(view);
  $("mutationType").addEventListener("change",updateMutationForm);
  $("mutationItem").addEventListener("change",updateMutationForm);
  $("mutationSearch").addEventListener("input",renderMutations);
  $("mutationReset").addEventListener("click",()=>{$("mutationForm").reset();$("mutationQty").value=1;updateMutationForm();setMsg("mutationMsg","Form dibersihkan.",true)});
  $("mutationForm").addEventListener("submit",saveMutation);
  $("exportMutations").addEventListener("click",()=>csvDownload("riwayat_mutasi_sarpras_sd_darussalam.csv",["Tanggal","Jenis Mutasi","Kode","Nama Barang","Jumlah","Kondisi","Dari Ruangan","Ke Ruangan","Alasan","Keterangan","Petugas"],filteredMutations().map(m=>[m.created_at?new Date(m.created_at).toLocaleString("id-ID"):"",mutationTypeLabel(m.type),m.item_code,m.item_name,m.quantity,conditionLabel(m.condition),roomLabel(m.from_room_id)||"-",roomLabel(m.to_room_id)||"-",m.reason,m.notes,m.performed_by_email||""])));
  $("printMutations").addEventListener("click",()=>window.print());
  updateMutationForm();
}
function mutationTypeLabel(v){return v==="incoming"?"Barang masuk":v==="outgoing"?"Barang keluar":"Pemindahan ruangan"}
function conditionLabel(v){return v==="minor"?"Rusak ringan":v==="major"?"Rusak berat":v==="good"?"Baik":"-"}
function updateMutationForm(){
  const type=$("mutationType")?.value||"incoming",chosen=$("mutationItem")?.value||"";
  if($("mutationItem"))$("mutationItem").innerHTML='<option value="">Pilih barang inventaris</option>'+items.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(i=>`<option value="${esc(i.id)}" ${i.id===chosen?"selected":""}>${esc(i.code||"Tanpa kode")} — ${esc(i.name)} (stok ${Number(i.qty)||0})</option>`).join("");
  if($("mutationToRoom"))$("mutationToRoom").innerHTML='<option value="">Pilih ruangan</option>'+rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
  if($("mutationConditionWrap"))$("mutationConditionWrap").style.display=type==="outgoing"?"block":"none";
  if($("mutationToRoomWrap"))$("mutationToRoomWrap").style.display=type==="transfer"?"block":"none";
  const selected=items.find(i=>i.id===($("mutationItem")?.value||""));
  const condSelect=$("mutationCondition");if(condSelect&&selected){for(const opt of condSelect.options){const key=opt.value;opt.disabled=Number(selected[key]||0)<1;opt.textContent=conditionLabel(key)+(opt.disabled?" (0 unit)":" (tersedia "+(Number(selected[key])||0)+" unit)")}}
}
function filteredMutations(){const q=($("mutationSearch")?.value||"").toLowerCase();return mutations.filter(m=>[m.type,m.item_code,m.item_name,m.reason,m.notes,m.performed_by_email,roomLabel(m.from_room_id),roomLabel(m.to_room_id)].join(" ").toLowerCase().includes(q))}
function renderMutations(){if(!$("mutationsTable"))return;updateMutationForm();const arr=filteredMutations();$("mutationsTable").innerHTML=table(["Tanggal","Jenis","Barang","Jumlah","Dari","Ke","Alasan","Petugas"],arr.map(m=>[m.created_at?esc(new Date(m.created_at).toLocaleString("id-ID")):"-",esc(mutationTypeLabel(m.type)),`${esc(m.item_code||"-")}<br><b>${esc(m.item_name||"-")}</b>`,m.quantity,esc(roomLabel(m.from_room_id)||"-"),esc(roomLabel(m.to_room_id)||"-"),esc(m.reason||"-")+(m.notes?`<br><small>${esc(m.notes)}</small>`:""),esc(m.performed_by_email||"-")]));}
async function saveMutation(e) {
  e.preventDefault();

  if (!currentUser) {
    setMsg("mutationMsg", "Masuk terlebih dahulu.");
    return;
  }

  if (!sb || !navigator.onLine) {
    setMsg("mutationMsg", "Mutasi memerlukan koneksi internet. Tidak ada perubahan stok yang dikirim.");
    return;
  }

  const type = $("mutationType").value;
  const id = $("mutationItem").value;
  const qty = Number($("mutationQty").value);
  const condition = type === "outgoing" ? $("mutationCondition").value : null;
  const toRoom = type === "transfer" ? ($("mutationToRoom").value || null) : null;
  const reason = $("mutationReason").value.trim();
  const notes = $("mutationNotes").value.trim();
  const item = items.find(i => i.id === id);

  if (!item) {
    setMsg("mutationMsg", "Pilih barang inventaris yang valid.");
    return;
  }
  if (!Number.isInteger(qty) || qty < 1) {
    setMsg("mutationMsg", "Jumlah harus berupa bilangan bulat minimal 1.");
    return;
  }
  if (!reason) {
    setMsg("mutationMsg", "Isi alasan, sumber, atau tujuan mutasi.");
    return;
  }
  if (type === "outgoing" && !["good", "minor", "major"].includes(condition)) {
    setMsg("mutationMsg", "Pilih kondisi barang keluar yang valid.");
    return;
  }
  if (type === "transfer") {
    if (!toRoom) {
      setMsg("mutationMsg", "Pilih ruangan tujuan.");
      return;
    }
    if (toRoom === (item.room_id || null)) {
      setMsg("mutationMsg", "Ruangan tujuan sama dengan ruangan saat ini.");
      return;
    }
    if (!rooms.some(r => r.id === toRoom)) {
      setMsg("mutationMsg", "Ruangan tujuan tidak ditemukan.");
      return;
    }
    if (qty !== (Number(item.qty) || 0)) {
      setMsg("mutationMsg", "Pemindahan berlaku untuk seluruh unit dalam satu data barang. Masukkan jumlah total barang.");
      return;
    }
  }
  if (type === "outgoing" && qty > (Number(item[condition]) || 0)) {
    setMsg("mutationMsg", `Jumlah melebihi stok kondisi ${conditionLabel(condition).toLowerCase()} yang tersedia (${Number(item[condition]) || 0} unit).`);
    return;
  }

  const submitButton = $("mutationForm").querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const { data, error } = await sb.rpc("record_inventory_mutation", {
      p_inventory_id: id,
      p_type: type,
      p_quantity: qty,
      p_condition: condition,
      p_to_room_id: toRoom,
      p_reason: reason,
      p_notes: notes
    });

    if (error) throw error;

    // Muat ulang data dari Supabase. Jangan membuat antrean perubahan kedua.
    await fetchRemote();
    await localLoad();

    $("mutationForm").reset();
    $("mutationQty").value = 1;
    updateMutationForm();
    setMsg("mutationMsg", data?.message || "Mutasi dan riwayat berhasil disimpan oleh Supabase.", true);
  } catch (err) {
    console.error("Kesalahan mutasi:", err);
    setMsg("mutationMsg", "Mutasi tidak dapat dikonfirmasi oleh Supabase. Jangan ulangi dulu; periksa inventaris dan riwayat mutasi. Detail: " + (err?.message || "Kesalahan tidak diketahui."));
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

// Modul QR dan pemeriksaan ditambahkan secara terpisah agar tidak mengubah fitur lama.
let qrLibraryPromise = null;
function loadQRCodeLibrary(){
  if(window.QRCode) return Promise.resolve(true);
  if(qrLibraryPromise) return qrLibraryPromise;
  qrLibraryPromise = new Promise(resolve=>{
    const script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload=()=>resolve(!!window.QRCode);script.onerror=()=>resolve(false);
    document.head.appendChild(script);
  });
  return qrLibraryPromise;
}
function qrPayload(type,id){return `SARPRAS|${type}|${id}`}
function itemById(id){return items.find(x=>x.id===id)}
function inspectionTargetLabel(row){return row.target_type==="room"?(row.room_name||roomLabel(row.room_id)||"Ruangan"):(row.item_name||itemById(row.item_id)?.name||"Barang")}
function initQRUI(){
  if($("view-qr")) return;
  const firstTab=document.querySelector(".tab"),firstView=document.querySelector(".view");
  if(!firstTab||!firstView){console.warn("QR: area navigasi aplikasi tidak ditemukan");return}
  const tab=document.createElement("button");tab.type="button";tab.className=firstTab.className;tab.dataset.view="qr";tab.textContent="QR & Pemeriksaan";firstTab.parentElement.appendChild(tab);tab.addEventListener("click",()=>activateView("qr"));
  const view=document.createElement("section");view.id="view-qr";view.className=firstView.className;view.innerHTML=`
    <div class="card"><h2>QR Inventaris per Ruangan</h2><p class="muted">Pilih ruangan untuk melihat barang di dalamnya. Setiap barang memiliki QR sendiri yang dapat dicetak sebagai label dan ditempel pada barang.</p>
      <div class="grid"><div class="field"><label for="qrRoomFilter">Filter per ruangan</label><select id="qrRoomFilter"><option value="">Semua ruangan</option></select></div><div class="field"><label for="qrTarget">Pilih barang (opsional)</label><select id="qrTarget"><option value="">Pilih barang</option></select></div></div>
      <div class="actions"><button class="btn" type="button" id="makeQR">Buat QR barang terpilih</button><button class="btn secondary" type="button" id="printQR">Cetak QR terpilih</button><button class="btn secondary" type="button" id="printAllQR">Cetak semua QR di ruangan</button></div><p id="qrMsg" class="msg" role="status"></p><div id="qrRoomSummary" class="muted" style="margin:10px 0"></div><div id="qrRoomItems" class="tablewrap"></div><div id="qrOutput" style="margin-top:16px"></div>
    </div>
    <div class="card"><h2>Catat Pemeriksaan</h2><p class="muted">Pemeriksaan disimpan di perangkat dan dikirim ke Supabase saat koneksi tersedia.</p>
      <form id="inspectionForm"><div class="grid"><div class="field"><label for="inspectTargetType">Periksa</label><select id="inspectTargetType"><option value="item">Barang</option><option value="room">Ruangan</option></select></div><div class="field"><label for="inspectTarget">Barang / ruangan</label><select id="inspectTarget" required></select></div>
      <div class="field"><label for="inspectResult">Hasil pemeriksaan</label><select id="inspectResult"><option value="sesuai">Sesuai</option><option value="rusak_ringan">Rusak ringan</option><option value="rusak_berat">Rusak berat</option><option value="tidak_ditemukan">Tidak ditemukan</option><option value="jumlah_tidak_sesuai">Jumlah tidak sesuai</option><option value="perlu_perbaikan">Perlu perbaikan</option></select></div>
      <div class="field"><label for="inspectCondition">Kondisi</label><select id="inspectCondition"><option value="baik">Baik</option><option value="rusak_ringan">Rusak ringan</option><option value="rusak_berat">Rusak berat</option><option value="tidak_dapat_dinilai">Tidak dapat dinilai</option></select></div>
      <div class="field"><label for="inspectQty">Jumlah ditemukan</label><input id="inspectQty" type="number" min="0" step="1" value="1" required></div><div class="field"><label for="inspectNotes">Catatan</label><input id="inspectNotes" maxlength="1000" placeholder="Catatan pemeriksaan"></div></div>
      <div class="actions"><button class="btn" type="submit">Simpan Pemeriksaan</button><button class="btn secondary" id="scanQR" type="button">Pindai QR dengan Kamera</button></div><div id="scanArea" class="hidden"><video id="qrVideo" playsinline style="max-width:100%;width:360px"></video><p class="muted">Arahkan kamera ke QR. Kamera memerlukan izin dan HTTPS.</p><button class="btn secondary" type="button" id="stopScan">Hentikan kamera</button></div><p id="inspectionMsg" class="msg" role="status"></p></form>
    </div>
    <div class="card"><h2>Riwayat Pemeriksaan</h2><div class="field no-print"><label for="inspectionSearch">Cari riwayat</label><input id="inspectionSearch" placeholder="Cari barang, ruangan, catatan, petugas"></div><div id="inspectionTable" class="tablewrap"></div><div class="actions no-print"><button class="btn secondary" type="button" id="exportInspections">Ekspor CSV untuk Excel</button><button class="btn secondary" type="button" id="printInspections">Cetak riwayat</button></div></div>`;
  firstView.parentElement.appendChild(view);
  $("qrRoomFilter").addEventListener("change",()=>{populateQRTargets();renderQRRoomItems();$("qrOutput").innerHTML="";setMsg("qrMsg","")});$("inspectTargetType").addEventListener("change",populateInspectionTargets);
  $("makeQR").addEventListener("click",()=>makeSelectedQR());$("printQR").addEventListener("click",()=>printSelectedQR());$("printAllQR").addEventListener("click",()=>printAllItemQR());
  $("inspectionForm").addEventListener("submit",saveInspection);$("inspectionSearch").addEventListener("input",renderInspectionHistory);
  $("exportInspections").addEventListener("click",()=>csvDownload("riwayat_pemeriksaan_sarpras.csv",["Tanggal","Jenis","Barang/Ruangan","Hasil","Kondisi","Jumlah ditemukan","Catatan","Petugas"],filteredInspections().map(r=>[r.inspected_at?new Date(r.inspected_at).toLocaleString("id-ID"):"",r.target_type==="room"?"Ruangan":"Barang",inspectionTargetLabel(r),inspectionResultLabel(r.result),conditionLabel(r.condition),r.found_qty,r.notes,r.performed_by_email])));
  $("printInspections").addEventListener("click",()=>window.print());$("scanQR").addEventListener("click",startQRScan);$("stopScan").addEventListener("click",stopQRScan);
  populateQRRoomFilter();populateQRTargets();renderQRRoomItems();populateInspectionTargets();renderInspectionHistory();
}
function populateQRRoomFilter(){const el=$("qrRoomFilter");if(!el)return;const selected=el.value;el.innerHTML='<option value="">Semua ruangan</option>'+rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");if(rooms.some(r=>r.id===selected))el.value=selected}
function qrFilteredItems(){const roomId=$("qrRoomFilter")?.value||"";return items.filter(x=>!roomId||String(x.room_id||"")===String(roomId))}
function populateQRTargets(){const el=$("qrTarget");if(!el)return;const selected=el.value;const arr=qrFilteredItems();el.innerHTML='<option value="">Pilih barang</option>'+arr.map(x=>`<option value="${esc(x.id)}">${esc((x.code||"Tanpa kode")+" — "+(x.name||"Barang tanpa nama"))}</option>`).join("");if(arr.some(x=>x.id===selected))el.value=selected}
function renderQRRoomItems(){const target=$("qrRoomItems"),summary=$("qrRoomSummary");if(!target||!summary)return;const rows=qrFilteredItems();const roomId=$("qrRoomFilter")?.value||"";const room=rooms.find(r=>String(r.id)===String(roomId));summary.textContent=(room?`Ruangan: ${room.name} · `:"Semua ruangan · ")+`${rows.length} data barang (setiap baris memiliki QR sendiri)`;target.innerHTML=table(["Kode","Nama Barang","Ruangan","Jumlah"],rows.map(x=>[esc(x.code||"-"),esc(x.name||"-"),esc(roomLabel(x.room_id)||"Belum ditentukan"),Number(x.qty)||0]))}
function populateInspectionTargets(){const type=$("inspectTargetType")?.value||"item",el=$("inspectTarget");if(!el)return;const arr=type==="room"?rooms:items;el.innerHTML='<option value="">Pilih data</option>'+arr.map(x=>`<option value="${esc(x.id)}">${esc(type==="room"?x.name:((x.code||"Tanpa kode")+" — "+x.name))}</option>`).join("");if(type==="item"){$("inspectQty").value=1}}
async function makeSelectedQR(){const id=$("qrTarget")?.value||"",out=$("qrOutput");if(out)out.innerHTML="";if(!id){setMsg("qrMsg","Pilih barang pada daftar terlebih dahulu.");return}const ok=await loadQRCodeLibrary();if(!ok){setMsg("qrMsg","Generator QR tidak termuat. Periksa koneksi internet lalu coba lagi.");return}const row=items.find(x=>String(x.id)===String(id));if(!row){setMsg("qrMsg","Barang tidak ditemukan. Pilih ulang ruangan dan barang.");populateQRRoomFilter();populateQRTargets();renderQRRoomItems();return}const payload=qrPayload("item",id);const box=document.createElement("div");box.style.cssText="display:inline-block;padding:16px;border:1px solid #ddd;border-radius:10px;text-align:center;background:white;color:#111";const canvas=document.createElement("div");box.appendChild(canvas);const title=document.createElement("b");title.textContent=(row.code?row.code+" — ":"")+row.name;box.appendChild(title);out.appendChild(box);try{new QRCode(canvas,{text:payload,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});window._sarprasCurrentQR={type:"item",id,payload,label:title.textContent};setMsg("qrMsg","QR barang berhasil dibuat. QR siap dicetak.",true)}catch(err){console.error(err);setMsg("qrMsg","QR gagal dibuat: "+(err.message||err))}}
function printSelectedQR(){const out=$("qrOutput");if(!out?.querySelector("canvas, img")){setMsg("qrMsg","Buat QR terlebih dahulu.");return}printQRMarkup(out.innerHTML,"Label QR SARPRAS")}
async function printAllItemQR(){
  const selectedItems = qrFilteredItems();
  if (!selectedItems.length) {
    setMsg("qrMsg", "Tidak ada barang pada ruangan yang dipilih. Periksa data ruangan pada menu Inventaris.");
    return;
  }
  const ok = await loadQRCodeLibrary();
  if (!ok) {
    setMsg("qrMsg", "Generator QR tidak termuat. Periksa koneksi internet lalu coba lagi.");
    return;
  }
  const html = [];
  // Cetak satu label untuk setiap unit sesuai kolom jumlah.
  // Jika jumlah komputer 2, tampilkan 2 label QR untuk data inventaris tersebut.
  for (const row of selectedItems) {
    if (!row || !row.id) continue;
    const qty = Math.max(1, Math.floor(Number(row.qty) || 1));
    const holder = document.createElement("div");
    try {
      new QRCode(holder, {
        text: qrPayload("item", String(row.id)),
        width: 120,
        height: 120,
        correctLevel: QRCode.CorrectLevel.M
      });
      let image = "";
      const canvas = holder.querySelector("canvas");
      if (canvas) {
        image = canvas.toDataURL("image/png");
      } else {
        const img = holder.querySelector("img");
        if (img) {
          if (!img.complete) {
            await new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }
          image = img.src || "";
        }
      }
      if (!image) {
        console.warn("QR tidak menghasilkan gambar untuk baris inventaris", row.id);
        continue;
      }
      for (let unit = 0; unit < qty; unit++) {
        const displayCode = qty > 1
          ? `${row.code || "Tanpa kode"}-${String(unit + 1).padStart(2, "0")}`
          : (row.code || "Tanpa kode");
        html.push(`<div class="label"><img src="${image}" alt="QR"><b>${esc(displayCode)}</b><span>${esc(row.name || "")}</span><small>${esc(roomLabel(row.room_id) || "Belum ditentukan")}</small></div>`);
      }
    } catch (err) {
      console.error("Gagal membuat QR untuk baris inventaris", row.id, err);
    }
  }
  if (!html.length) {
    setMsg("qrMsg", "QR tidak berhasil dibuat. Periksa koneksi generator QR lalu coba lagi.");
    return;
  }
  const roomId = $("qrRoomFilter")?.value || "";
  const room = rooms.find(r => String(r.id) === String(roomId));
  printQRMarkup(
    html.join(""),
    "Label QR SARPRAS" + (room ? " — " + room.name : " — Semua Ruangan"),
    true
  );
  setMsg("qrMsg", `${html.length} label QR disiapkan untuk dicetak (mengikuti jumlah unit pada inventaris).`, true);
}
function printQRMarkup(html,title,grid=false){const w=window.open("","_blank");if(!w){alert("Izinkan pop-up untuk mencetak QR.");return}w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:12px}.labels{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.label{border:1px solid #aaa;border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:5px;break-inside:avoid;text-align:center;font-size:12px}.label img{width:120px;height:120px;object-fit:contain} @media print{body{padding:0}}</style></head><body><h2>${esc(title)}</h2><div class="${grid?"labels":""}">${html}</div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
async function saveInspection(e){e.preventDefault();if(!currentUser){setMsg("inspectionMsg","Masuk terlebih dahulu.");return}const type=$("inspectTargetType").value,id=$("inspectTarget").value,qty=Number($("inspectQty").value);if(!id){setMsg("inspectionMsg","Pilih barang atau ruangan.");return}if(!Number.isInteger(qty)||qty<0){setMsg("inspectionMsg","Jumlah ditemukan harus bilangan bulat minimal 0.");return}const isRoom=type==="room",target=(isRoom?rooms:items).find(x=>x.id===id);if(!target){setMsg("inspectionMsg","Data target tidak ditemukan.");return}const now=new Date().toISOString();const row={id:uuid(),target_type:type,target_id:id,item_id:isRoom?null:id,room_id:isRoom?id:(target.room_id||null),item_name:isRoom?"":target.name||"",item_code:isRoom?"":target.code||"",room_name:isRoom?target.name||"":roomLabel(target.room_id)||"",result:$("inspectResult").value,condition:$("inspectCondition").value,found_qty:qty,notes:$("inspectNotes").value.trim(),performed_by:currentUser.id,performed_by_email:currentUser.email||"",inspected_at:now,created_at:now};try{await cacheRecord("inventory_inspections",row);await queueOp("inventory_inspections","upsert",row);if(navigator.onLine)await syncQueue();await localLoad();$("inspectNotes").value="";setMsg("inspectionMsg",navigator.onLine?"Pemeriksaan disimpan. Periksa indikator sinkronisasi untuk memastikan pengiriman ke server.":"Pemeriksaan disimpan di perangkat dan menunggu koneksi.",true)}catch(err){console.error(err);setMsg("inspectionMsg","Gagal menyimpan pemeriksaan: "+(err.message||err))}}
function inspectionResultLabel(v){return ({sesuai:"Sesuai",rusak_ringan:"Rusak ringan",rusak_berat:"Rusak berat",tidak_ditemukan:"Tidak ditemukan",jumlah_tidak_sesuai:"Jumlah tidak sesuai",perlu_perbaikan:"Perlu perbaikan"})[v]||v||"-"}
function filteredInspections(){const q=($("inspectionSearch")?.value||"").toLocaleLowerCase("id-ID");return inspections.filter(r=>[inspectionTargetLabel(r),r.result,r.condition,r.notes,r.performed_by_email,r.room_name,r.item_code].join(" ").toLocaleLowerCase("id-ID").includes(q))}
function renderInspectionHistory(){if(!$("inspectionTable"))return;const arr=filteredInspections();$("inspectionTable").innerHTML=table(["Tanggal","Jenis","Barang/Ruangan","Hasil","Kondisi","Jumlah","Catatan","Petugas"],arr.map(r=>[esc(r.inspected_at?new Date(r.inspected_at).toLocaleString("id-ID"):"-"),r.target_type==="room"?"Ruangan":"Barang",esc(inspectionTargetLabel(r)),esc(inspectionResultLabel(r.result)),esc(conditionLabel(r.condition)),Number(r.found_qty)||0,esc(r.notes||"-"),esc(r.performed_by_email||"-")]))}
function renderQRHome(){populateQRRoomFilter();populateQRTargets();renderQRRoomItems();populateInspectionTargets();renderInspectionHistory()}
let qrScanStream=null,qrScanActive=false;
async function startQRScan(){if(!("BarcodeDetector" in window)){setMsg("inspectionMsg","Pemindaian kamera otomatis tidak didukung browser ini. Masukkan kode QR secara manual belum tersedia; gunakan aplikasi pemindai QR pada HP untuk membaca teks SARPRAS|ITEM|ID atau SARPRAS|ROOM|ID.");return}try{const detector=new BarcodeDetector({formats:["qr_code"]});qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});const video=$("qrVideo");video.srcObject=qrScanStream;await video.play();$("scanArea").classList.remove("hidden");qrScanActive=true;const tick=async()=>{if(!qrScanActive)return;try{const codes=await detector.detect(video);if(codes.length){const m=/^SARPRAS\|(ITEM|ROOM)\|(.+)$/.exec(codes[0].rawValue||"");if(m){$("inspectTargetType").value=m[1]==="ROOM"?"room":"item";populateInspectionTargets();$("inspectTarget").value=m[2];setMsg("inspectionMsg","QR berhasil dipindai. Lengkapi hasil pemeriksaan lalu simpan.",true);stopQRScan();return}}}catch(e){}requestAnimationFrame(tick)};requestAnimationFrame(tick)}catch(err){setMsg("inspectionMsg","Kamera tidak dapat dibuka: "+(err.message||err)+". Pastikan izin kamera diberikan dan aplikasi dibuka melalui HTTPS.")}}
function stopQRScan(){qrScanActive=false;if(qrScanStream){qrScanStream.getTracks().forEach(t=>t.stop());qrScanStream=null}const v=$("qrVideo");if(v)v.srcObject=null;$("scanArea")?.classList.add("hidden")}

initMutationUI();
initQRUI();

window.addEventListener("online",async()=>{onlineStatus();if(sb&&currentUser){await syncQueue();await fetchRemote()}});
window.addEventListener("offline",onlineStatus);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(console.warn);
onlineStatus();initAuth().catch(e=>{console.error(e);$("loginMsg").textContent="Gagal memulai aplikasi: "+e.message});
