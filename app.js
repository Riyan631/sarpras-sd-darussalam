/* Konfigurasi: isi URL dan anon/publishable key dari Supabase Project Settings > API */
const SUPABASE_URL = "https://akebktlyhfrfwopxrnbt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cGvCIZszseAnEC4qOiHikw_DrAqliM3";
const DB_NAME = "sarpras-darussalam-local-v2";
const STORE = "records";
const QUEUE = "outbox";
let sb = null, currentUser = null, currentRole = "petugas", items = [], rooms = [], profiles = [];
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
function activateView(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));if(name==="admins")loadProfiles();}
function table(head,rows){return `<table><thead><tr>${head.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${v??""}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${head.length}" class="muted">Belum ada data.</td></tr>`}</tbody></table>`}
function roomLabel(id){return rooms.find(r=>r.id===id)?.name||""}
function cond(i){return `<span class="pill">${i.good||0} baik</span> <span class="pill">${i.minor||0} ringan</span> <span class="pill">${i.major||0} berat</span>`}
function render(){
$("countKinds").textContent=items.length;$("countUnits").textContent=items.reduce((s,x)=>s+(+x.qty||0),0);$("countRooms").textContent=rooms.length;$("countDamaged").textContent=items.reduce((s,x)=>s+(+x.minor||0)+(+x.major||0),0);
$("itemRoom").innerHTML='<option value="">Belum ditentukan</option>'+rooms.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
const q=($("itemSearch").value||"").toLowerCase(), visible=items.filter(i=>[i.code,i.name,i.category,roomLabel(i.room_id)].join(" ").toLowerCase().includes(q));
$("itemsTable").innerHTML=table(["Kode","Nama / kategori","Ruangan","Jumlah","Kondisi","Foto","Tindakan"],visible.map(i=>[esc(i.code||"-"),`<b>${esc(i.name)}</b><br>${esc(i.category)}<br><small>${esc(i.year||"")}</small>`,esc(roomLabel(i.room_id)||"-"),i.qty,cond(i),`${i.photo?`<img class="thumb" src="${i.photo}" alt="Foto barang">`:""}${i.damage_photo?`<img class="thumb" src="${i.damage_photo}" alt="Foto kerusakan">`:""}`,`<button class="btn light" data-edit="${i.id}">Edit</button> <button class="btn danger" data-del="${i.id}">Hapus</button><br><small>${esc(i.sync_state||"tersimpan")}</small>`]));
$("roomsTable").innerHTML=table(["Ruangan","Jenis","Penanggung jawab","Keterangan","Jumlah jenis barang","Tindakan"],rooms.map(r=>[esc(r.name),esc(r.type),esc(r.pic||"-"),esc(r.notes||"-"),items.filter(i=>i.room_id===r.id).length,`<button class="btn danger" data-roomdel="${r.id}">Hapus</button>`]));
$("recentTable").innerHTML=table(["Kode","Barang","Ruangan","Jumlah","Kondisi"],[...items].sort((a,b)=>(b.updated_at||"").localeCompare(a.updated_at||"")).slice(0,5).map(i=>[esc(i.code||"-"),esc(i.name),esc(roomLabel(i.room_id)||"-"),i.qty,cond(i)]));
renderReport();updateQueueStatus();
}
async function localLoad(){const all=await dbAll(STORE);items=all.filter(x=>x.table==="inventory").map(x=>x.data);rooms=all.filter(x=>x.table==="rooms").map(x=>x.data);render()}
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
 for(const t of ["rooms","inventory"]){
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
function reportItems(){return items.filter(i=>(!$("reportCategory").value||i.category===$("reportCategory").value)&&(!$("reportCondition").value||($("reportCondition").value==="good"?i.good>0:$("reportCondition").value==="minor"?i.minor>0:i.major>0)))}
function renderReport(){const arr=reportItems();$("reportSummary").innerHTML=`<p><b>Jenis barang:</b> ${arr.length} · <b>Total unit:</b> ${arr.reduce((s,i)=>s+(+i.qty||0),0)} · <b>Unit rusak:</b> ${arr.reduce((s,i)=>s+(+i.minor||0)+(+i.major||0),0)} · <b>Tanggal:</b> ${new Date().toLocaleDateString("id-ID")}</p>`;$("reportTable").innerHTML=table(["No","Kode","Nama","Kategori","Ruangan","Tahun","Jumlah","Baik","Rusak ringan","Rusak berat","Keterangan"],arr.map((i,n)=>[n+1,esc(i.code),esc(i.name),esc(i.category),esc(roomLabel(i.room_id)||"-"),i.year||"-",i.qty,i.good,i.minor,i.major,esc(i.notes||"-")]))}
$("reportCategory").addEventListener("change",renderReport);$("reportCondition").addEventListener("change",renderReport);
function csvCell(v){let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function csvDownload(name,headers,rows){const blob=new Blob(["\ufeff"+[headers,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
const itemCSV=arr=>arr.map(i=>[i.code,i.name,i.category,roomLabel(i.room_id),i.qty,i.good,i.minor,i.major,i.year,i.recorder,i.notes]);
$("exportItems").addEventListener("click",()=>csvDownload("inventaris_sd_darussalam.csv",["Kode","Nama","Kategori","Ruangan","Jumlah","Baik","Rusak ringan","Rusak berat","Tahun","Petugas","Keterangan"],itemCSV(items)));
$("exportRooms").addEventListener("click",()=>csvDownload("ruangan_sd_darussalam.csv",["Nama","Jenis","Penanggung jawab","Keterangan"],rooms.map(r=>[r.name,r.type,r.pic,r.notes])));
$("exportReport").addEventListener("click",()=>csvDownload("laporan_sarpras_sd_darussalam.csv",["Kode","Nama","Kategori","Ruangan","Jumlah","Baik","Rusak ringan","Rusak berat","Tahun","Petugas","Keterangan"],itemCSV(reportItems())));
$("printReport").addEventListener("click", (e) => {
  e.preventDefault();
  activateView("reports");
  window.focus();
  window.print();
});
$("backupDownload").addEventListener("click",async()=>{const payload={app:"SARPRAS SD Darussalam",version:2,exported_at:new Date().toISOString(),records:await dbAll(STORE),outbox:await dbAll(QUEUE)};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="cadangan_sarpras_darussalam.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$("restoreBackup").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const p=JSON.parse(await f.text());if(!Array.isArray(p.records))throw Error("Format tidak sesuai");if(!confirm("Pulihkan data lokal dari file ini?"))return;await dbClear(STORE);await dbClear(QUEUE);for(const r of p.records)await dbPut(STORE,r);for(const q of (p.outbox||[]))await dbPut(QUEUE,q);await localLoad();if(navigator.onLine)await syncQueue();alert("Cadangan dipulihkan ke perangkat ini.")}catch(err){alert("File cadangan tidak valid.")}e.target.value=""});
async function callAdminFunction(body){const {data:{session}}=await sb.auth.getSession();const {data,error}=await sb.functions.invoke("admin-users",{body,headers:{Authorization:"Bearer "+session.access_token}});if(error)throw error;return data}
async function loadProfiles(){if(currentRole!=="admin_utama")return;try{const {data,error}=await sb.from("profiles").select("id,email,display_name,role,created_at").order("created_at");if(error)throw error;profiles=data||[];$("adminsTable").innerHTML=table(["Email","Nama","Peran","Ubah peran"],profiles.map(p=>[esc(p.email||"(email tidak tersedia)"),esc(p.display_name||"-"),esc(p.role),p.id===currentUser.id?"Admin utama":`<select data-role-id="${p.id}"><option value="petugas" ${p.role==="petugas"?"selected":""}>Petugas</option><option value="admin" ${p.role==="admin"?"selected":""}>Admin</option></select>`]));}catch(e){$("adminsTable").textContent="Gagal memuat akun: "+e.message}}
$("adminsTable").addEventListener("change",async e=>{const id=e.target.dataset.roleId;if(!id)return;try{await callAdminFunction({action:"set_role",user_id:id,role:e.target.value});await loadProfiles();alert("Peran akun diperbarui.")}catch(err){alert("Tidak dapat mengubah peran: "+err.message);await loadProfiles()}});
$("createUserForm").addEventListener("submit",async e=>{e.preventDefault();try{setMsg("adminMsg","Membuat akun…");await callAdminFunction({action:"create_user",email:$("newUserEmail").value.trim(),password:$("newUserPassword").value,role:$("newUserRole").value});setMsg("adminMsg","Akun berhasil dibuat.",true);$("createUserForm").reset();await loadProfiles()}catch(err){setMsg("adminMsg","Gagal membuat akun: "+err.message)}});
window.addEventListener("online",async()=>{onlineStatus();if(sb&&currentUser){await syncQueue();await fetchRemote()}});
window.addEventListener("offline",onlineStatus);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(console.warn);
onlineStatus();initAuth().catch(e=>{console.error(e);$("loginMsg").textContent="Gagal memulai aplikasi: "+e.message});
