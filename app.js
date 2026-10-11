/* Konfigurasi: isi URL dan anon/publishable key dari Supabase Project Settings > API */
const SUPABASE_URL = "https://akebktlyhfrfwopxrnbt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cGvCIZszseAnEC4qOiHikw_DrAqliM3";
const DB_NAME = "sarpras-darussalam-local-v2";
const STORE = "records";
const QUEUE = "outbox";
let sb = null, currentUser = null, currentRole = "petugas", items = [], rooms = [], profiles = [], mutations = [], inspections = [], editingRoomId = null;
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
  const pct=n=>total?Math.round(n/total*100):0;
  const cats={};items.forEach(i=>{const k=i.category||"Lainnya";cats[k]=(cats[k]||0)+(Number(i.qty)||0)});
  const catRows=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const damagedRows=items.filter(i=>(Number(i.minor)||0)+(Number(i.major)||0)>0).sort((a,b)=>(((Number(b.major)||0)*2+(Number(b.minor)||0))-((Number(a.major)||0)*2+(Number(a.minor)||0)))).slice(0,5);
  panel.innerHTML=`
    <style>
      #dashboardDetails{margin-top:16px;color:var(--text,#1f2937)}
      #dashboardDetails .dash-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #dashboardDetails .dash-card{background:var(--card,#fff);border:1px solid var(--border,#dbe2e8);border-radius:12px;padding:16px;min-width:0}
      #dashboardDetails h3{font-size:16px;margin:0 0 13px}
      #dashboardDetails .dash-line{display:grid;grid-template-columns:105px minmax(30px,1fr) 46px;align-items:center;gap:8px;margin:12px 0;font-size:13px}
      #dashboardDetails .dash-track{height:10px;border-radius:20px;background:#edf0f3;overflow:hidden}
      #dashboardDetails .dash-fill{height:100%;border-radius:20px;min-width:0}
      #dashboardDetails .dash-good{background:#248653}#dashboardDetails .dash-minor{background:#e3a326}#dashboardDetails .dash-major{background:#c94242}
      #dashboardDetails .dash-note{font-size:12px;color:var(--muted,#667085);margin:8px 0 0}
      #dashboardDetails .dash-category{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#e5e7eb);font-size:13px}
      #dashboardDetails .dash-category:last-child{border-bottom:0}
      @media(max-width:700px){#dashboardDetails .dash-grid{grid-template-columns:1fr}#dashboardDetails .dash-line{grid-template-columns:90px minmax(30px,1fr) 42px;gap:6px}}
      @media print{#dashboardDetails .dash-grid{grid-template-columns:1fr 1fr}#dashboardDetails .dash-card{break-inside:avoid}}
    </style>
    <div class="dash-grid">
      <div class="dash-card"><h3>Grafik Kondisi Barang</h3>
        ${[["Baik",good,"dash-good"],["Rusak ringan",minor,"dash-minor"],["Rusak berat",major,"dash-major"]].map(([label,n,cls])=>`<div class="dash-line"><span>${label}</span><div class="dash-track"><div class="dash-fill ${cls}" style="width:${pct(n)}%"></div></div><b>${n} (${pct(n)}%)</b></div>`).join("")}
        <p class="dash-note">Persentase dihitung dari total ${total} unit barang.</p>
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
}
async function localLoad(){const all=await dbAll(STORE);items=all.filter(x=>x.table==="inventory").map(x=>x.data);rooms=all.filter(x=>x.table==="rooms").map(x=>x.data);mutations=all.filter(x=>x.table==="mutations").map(x=>x.data).sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));inspections=all.filter(x=>x.table==="inventory_inspections").map(x=>x.data).sort((a,b)=>(b.inspected_at||b.created_at||"").localeCompare(a.inspected_at||a.created_at||""));render()}
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
async function fetchRemote() {
  if (!sb || !navigator.onLine || !currentUser) return;

  for (const t of ["rooms", "inventory", "mutations", "inventory_inspections"]) {
    const { data, error } = await sb.from(t).select("*");

    // Jika server gagal dibaca, jangan mengubah cache tabel ini.
    if (error) {
      console.warn("Gagal membaca " + t + ":", error.message);
      continue;
    }

    const queue = await dbAll(QUEUE);
    const pendingIds = new Set(
      queue.filter(op => op.table === t).map(op => op.row_id)
    );
    const remoteRows = data || [];
    const remoteIds = new Set(remoteRows.map(row => row.id));

    // Simpan/perbarui data yang benar-benar ditemukan di server.
    for (const row of remoteRows) {
      if (pendingIds.has(row.id)) continue;
      await cacheRecord(t, { ...row, sync_state: "tersinkron" });
    }

    // Bersihkan cache lokal yang tidak ada di server untuk semua tabel.
    // Baris dengan operasi tertunda tetap dipertahankan agar perubahan lokal tidak hilang.
    const localRows = (await dbAll(STORE)).filter(record => record.table === t);
    for (const record of localRows) {
      const rowId = record.data && record.data.id;
      if (rowId && !remoteIds.has(rowId) && !pendingIds.has(rowId)) {
        await removeCached(t, rowId);
      }
    }
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
// Tombol batal edit ditambahkan tanpa perlu mengubah index.html.
const roomSubmitButton=$("roomForm").querySelector('button[type="submit"]');
if(roomSubmitButton){roomSubmitButton.textContent="Simpan Ruangan";const cancelRoomButton=document.createElement("button");cancelRoomButton.type="button";cancelRoomButton.id="roomEditCancel";cancelRoomButton.className="btn light";cancelRoomButton.textContent="Batal Edit";cancelRoomButton.hidden=true;roomSubmitButton.insertAdjacentElement("afterend",cancelRoomButton);cancelRoomButton.addEventListener("click",resetRoomForm)}
function resetRoomForm(){editingRoomId=null;$("roomForm").reset();if(roomSubmitButton)roomSubmitButton.textContent="Simpan Ruangan";const cancel=$("roomEditCancel");if(cancel)cancel.hidden=true}
$("roomForm").addEventListener("submit",async e=>{e.preventDefault();if(!currentUser){alert("Silakan masuk terlebih dahulu.");return}const old=rooms.find(r=>r.id===editingRoomId);const row={id:editingRoomId||uuid(),name:$("roomName").value.trim(),type:$("roomType").value,pic:$("roomPIC").value.trim(),notes:$("roomNotes").value.trim(),created_by:old?.created_by||currentUser.id};if(!row.name){alert("Nama ruangan wajib diisi.");return}if(rooms.some(r=>r.id!==row.id&&r.name.trim().toLowerCase()===row.name.toLowerCase())){alert("Nama ruangan tersebut sudah ada. Gunakan nama yang berbeda.");return}const wasEditing=Boolean(editingRoomId);await saveLocal("rooms",row);resetRoomForm();alert(wasEditing?"Perubahan ruangan disimpan. Sinkronisasi berjalan jika internet tersedia.":"Ruangan ditambahkan. Sinkronisasi berjalan jika internet tersedia.")});
$("roomsTable").addEventListener("click",async e=>{const editId=e.target.closest("[data-roomedit]")?.dataset.roomedit;const rid=e.target.closest("[data-roomdel]")?.dataset.roomdel;if(editId){const r=rooms.find(x=>x.id===editId);if(!r)return;editingRoomId=r.id;$("roomName").value=r.name||"";$("roomType").value=r.type||"Kelas";$("roomPIC").value=r.pic||"";$("roomNotes").value=r.notes||"";if(roomSubmitButton)roomSubmitButton.textContent="Simpan Perubahan";const cancel=$("roomEditCancel");if(cancel)cancel.hidden=false;window.scrollTo({top:0,behavior:"smooth"});$("roomName").focus();return}if(!rid)return;if(items.some(i=>i.room_id===rid)){alert("Ruangan masih dipakai oleh barang. Ubah lokasi barang terlebih dahulu.");return}if(confirm("Hapus ruangan dari database bersama?"))await deleteLocal("rooms",rid)});
$("itemSearch").addEventListener("input",render);
$("roomSearch")?.addEventListener("input",render);
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

  // Bersihkan elemen cetak lama sebelum membangun ulang agar tidak berlipat.
  summary.querySelectorAll(".report-print-header").forEach(el=>el.remove());
  document.querySelectorAll("#reportSignatureBlock").forEach(el=>el.remove());

  summary.insertAdjacentHTML("afterbegin", `
    <section class="report-print-header">
      <div class="report-school-mark"><img src="data:image/jpeg;base64,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" alt="Logo SD Islam Darussalam Palangka Raya"></div>
      <div class="report-school-name">SD DARUSSALAM PALANGKARAYA</div>
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
        <div class="report-sign-column">
          <p>Mengetahui,</p><p><b>Kepala Sekolah</b></p>
          <div class="report-sign-space"></div>
          <p class="report-sign-name">(........................................)</p>
          <p>NIP. ....................................</p>
        </div>
        <div class="report-sign-column">
          <p>Petugas Inventaris</p><p><b>Pengelola Sarana dan Prasarana</b></p>
          <div class="report-sign-space"></div>
          <p class="report-sign-name">(........................................)</p>
          <p>NIP. ....................................</p>
        </div>
      </div>
    </section>`);

  if(!$("reportPrintStyles")){
    const style=document.createElement("style");style.id="reportPrintStyles";style.textContent=`
      .report-print-header{display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 0 12px;color:#172b24}
      .report-school-mark{display:flex;align-items:center;justify-content:center;width:58px;height:58px;margin:0 auto 5px;overflow:hidden}.report-school-mark img{display:block;width:100%;height:100%;object-fit:contain}
      .report-school-name{font-size:18px;font-weight:800;letter-spacing:.5px}.report-school-subtitle{font-size:12px;margin-top:3px}.report-header-rule{height:3px;background:#173f32;width:100%;margin:8px 0 10px}
      .report-print-header h2{font-size:16px;margin:0 0 6px}.report-header-date{margin:0 0 7px}.report-filter-summary{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;font-size:11px}
      .report-signatures{margin:8px 0 0;color:#111;display:block;break-inside:avoid!important;page-break-inside:avoid!important}
      .report-sign-date{text-align:right;margin-bottom:4px}
      .report-sign-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;break-inside:avoid!important;page-break-inside:avoid!important}
      .report-sign-column{text-align:center;min-width:0;break-inside:avoid!important;page-break-inside:avoid!important}
      .report-sign-column p{margin:2px 0}.report-sign-space{height:24px}.report-sign-name{font-weight:700}
      @page{size:A4 portrait;margin:12mm}
      @media print{
        html,body{margin:0!important;padding:0!important;background:#fff!important}
        body *{visibility:hidden!important}
        #view-reports,#view-reports *{visibility:visible!important}
        #view-reports{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important;background:#fff!important;color:#111!important}
        #view-reports .no-print,#view-reports button,#view-reports input,#view-reports select{display:none!important}
        #view-reports .card{border:0!important;box-shadow:none!important;padding:0!important;margin:0!important}
        #view-reports h2{margin-top:0!important}
        #view-reports .condition-summary{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;margin:6px 0 9px!important}
        #view-reports .condition-card{padding:5px!important;border:1px solid #999!important;background:#fff!important;break-inside:avoid}
        #view-reports .condition-card strong{font-size:14px!important}
        #view-reports table{width:100%!important;border-collapse:collapse!important;font-size:8px!important;table-layout:auto!important}
        #view-reports th,#view-reports td{border:1px solid #666!important;padding:3px!important;color:#111!important;background:#fff!important;overflow-wrap:anywhere!important}
        #view-reports thead{display:table-header-group}
        #view-reports tr{break-inside:avoid!important;page-break-inside:avoid!important}
        #view-reports .tablewrap{overflow:visible!important;max-width:none!important}
        #view-reports #reportSignatureBlock{display:block!important;visibility:visible!important;margin-top:7px!important;break-inside:avoid!important;page-break-inside:avoid!important}
        #view-reports .report-sign-columns{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important;break-inside:avoid!important;page-break-inside:avoid!important}
        #view-reports .report-sign-column{display:block!important;width:auto!important;break-inside:avoid!important;page-break-inside:avoid!important}
        #view-reports .report-sign-space{height:24px!important}
        #view-reports .report-sign-column p{margin:2px 0!important}
        #view-reports .report-sign-date{margin-bottom:3px!important}
      }
    `;document.head.appendChild(style);
  }
}
function reportItems(){
  const roomFilter=$("reportRoomFilter")?.value||"";
  return items.filter(i=>
    (!$("reportCategory").value||i.category===$("reportCategory").value)&&
    (!$("reportCondition").value||($("reportCondition").value==="good"?i.good>0:$("reportCondition").value==="minor"?i.minor>0:i.major>0))&&
    (!roomFilter||(i.room_id||"")===roomFilter)
  );
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
async function loadProfiles(){if(currentRole!=="admin_utama")return;try{const {data,error}=await sb.from("profiles").select("id,email,display_name,role,created_at").order("created_at");if(error)throw error;profiles=data||[];$("adminsTable").innerHTML=table(["Email","Nama","Peran","Ubah peran"],profiles.map(p=>[esc(p.email||"(email tidak tersedia)"),esc(p.display_name||"-"),esc(p.role),p.id===currentUser.id?"Admin utama":`<select data-role-id="${p.id}"><option value="petugas" ${p.role==="petugas"?"selected":""}>Petugas</option><option value="admin" ${p.role==="admin"?"selected":""}>Admin</option></select>`]));}catch(e){$("adminsTable").textContent="Gagal memuat akun: "+e.message}}
$("adminsTable").addEventListener("change",async e=>{const id=e.target.dataset.roleId;if(!id)return;try{await callAdminFunction({action:"set_role",user_id:id,role:e.target.value});await loadProfiles();alert("Peran akun diperbarui.")}catch(err){alert("Tidak dapat mengubah peran: "+err.message);await loadProfiles()}});
$("createUserForm").addEventListener("submit",async e=>{e.preventDefault();try{setMsg("adminMsg","Membuat akun…");await callAdminFunction({action:"create_user",email:$("newUserEmail").value.trim(),password:$("newUserPassword").value,role:$("newUserRole").value});setMsg("adminMsg","Akun berhasil dibuat.",true);$("createUserForm").reset();await loadProfiles()}catch(err){setMsg("adminMsg","Gagal membuat akun: "+err.message)}});

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
function conditionLabel(v){return (v==="minor"||v==="rusak_ringan")?"Rusak ringan":(v==="major"||v==="rusak_berat")?"Rusak berat":(v==="good"||v==="baik")?"Baik":v==="tidak_dapat_dinilai"?"Tidak dapat dinilai":"-"}
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
    <div class="card"><h2>QR Code Inventaris dan Ruangan</h2><p class="muted">Pilih satu barang atau ruangan untuk membuat QR. QR menyimpan identitas data di aplikasi SARPRAS.</p>
      <div class="grid"><div class="field"><label for="qrTargetType">Jenis QR</label><select id="qrTargetType"><option value="item">Barang inventaris</option><option value="room">Ruangan</option></select></div><div class="field"><label for="qrTarget">Pilih data</label><select id="qrTarget"></select></div></div>
      <div class="actions"><button class="btn" type="button" id="makeQR">Buat QR</button><button class="btn secondary" type="button" id="printQR">Cetak QR terpilih</button><button class="btn secondary" type="button" id="printAllQR">Cetak semua QR barang</button></div><div id="qrOutput" style="margin-top:16px"></div><p id="qrMsg" class="msg" role="status"></p>
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
  $("qrTargetType").addEventListener("change",populateQRTargets);$("inspectTargetType").addEventListener("change",populateInspectionTargets);
  $("makeQR").addEventListener("click",()=>makeSelectedQR());$("printQR").addEventListener("click",()=>printSelectedQR());$("printAllQR").addEventListener("click",()=>printAllItemQR());
  $("inspectionForm").addEventListener("submit",saveInspection);$("inspectionSearch").addEventListener("input",renderInspectionHistory);
  $("exportInspections").addEventListener("click",()=>csvDownload("riwayat_pemeriksaan_sarpras.csv",["Tanggal","Jenis","Barang/Ruangan","Hasil","Kondisi","Jumlah ditemukan","Catatan","Petugas"],filteredInspections().map(r=>[r.inspected_at?new Date(r.inspected_at).toLocaleString("id-ID"):"",r.target_type==="room"?"Ruangan":"Barang",inspectionTargetLabel(r),inspectionResultLabel(r.result),conditionLabel(r.condition),r.found_qty,r.notes,r.performed_by_email])));
  $("printInspections").addEventListener("click",()=>window.print());$("scanQR").addEventListener("click",startQRScan);$("stopScan").addEventListener("click",stopQRScan);
  populateQRTargets();populateInspectionTargets();renderInspectionHistory();
}
function populateQRTargets(){const type=$("qrTargetType")?.value||"item",el=$("qrTarget");if(!el)return;const arr=type==="room"?rooms:items;el.innerHTML='<option value="">Pilih data</option>'+arr.map(x=>`<option value="${esc(x.id)}">${esc(type==="room"?x.name:((x.code||"Tanpa kode")+" — "+x.name))}</option>`).join("")}
function populateInspectionTargets(){const type=$("inspectTargetType")?.value||"item",el=$("inspectTarget");if(!el)return;const arr=type==="room"?rooms:items;el.innerHTML='<option value="">Pilih data</option>'+arr.map(x=>`<option value="${esc(x.id)}">${esc(type==="room"?x.name:((x.code||"Tanpa kode")+" — "+x.name))}</option>`).join("");if(type==="item"){$("inspectQty").value=1}}
async function makeSelectedQR(){const type=$("qrTargetType").value,id=$("qrTarget").value,out=$("qrOutput");out.innerHTML="";if(!id){setMsg("qrMsg","Pilih barang atau ruangan terlebih dahulu.");return}const ok=await loadQRCodeLibrary();if(!ok){setMsg("qrMsg","Generator QR tidak termuat. Periksa koneksi internet lalu coba lagi.");return}const row=(type==="room"?rooms:items).find(x=>x.id===id);if(!row)return;const payload=qrPayload(type,id);const box=document.createElement("div");box.style.cssText="display:inline-block;padding:16px;border:1px solid #ddd;border-radius:10px;text-align:center;background:white;color:#111";const canvas=document.createElement("div");box.appendChild(canvas);const title=document.createElement("b");title.textContent=type==="room"?row.name:(row.code?row.code+" — "+row.name:row.name);box.appendChild(title);const small=document.createElement("p");small.textContent=payload;small.style.cssText="font-size:10px;word-break:break-all;max-width:220px";box.appendChild(small);out.appendChild(box);new QRCode(canvas,{text:payload,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});window._sarprasCurrentQR={type,id,payload,label:title.textContent};setMsg("qrMsg","QR berhasil dibuat. Cetak setelah gambar QR tampil.",true)}
function printSelectedQR(){const out=$("qrOutput");if(!out?.querySelector("canvas, img")){setMsg("qrMsg","Buat QR terlebih dahulu.");return}printQRMarkup(out.innerHTML,"Label QR SARPRAS")}
async function printAllItemQR(){if(!items.length){setMsg("qrMsg","Belum ada data barang.");return}const ok=await loadQRCodeLibrary();if(!ok){setMsg("qrMsg","Generator QR tidak termuat. Periksa koneksi internet lalu coba lagi.");return}const html=[];for(const row of items){const holder=document.createElement("div");new QRCode(holder,{text:qrPayload("item",row.id),width:120,height:120});await new Promise(r=>setTimeout(r,30));const image=holder.querySelector("img")?.src||holder.querySelector("canvas")?.toDataURL("image/png")||"";html.push(`<div class="label"><img src="${image}" alt="QR"><b>${esc(row.code||"")}</b><span>${esc(row.name)}</span></div>`)}printQRMarkup(html.join(""),"Label QR Barang SARPRAS",true)}
function printQRMarkup(html,title,grid=false){const w=window.open("","_blank");if(!w){alert("Izinkan pop-up untuk mencetak QR.");return}w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;padding:12px}.labels{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.label{border:1px solid #aaa;border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:5px;break-inside:avoid;text-align:center;font-size:12px}.label img{width:120px;height:120px;object-fit:contain} @media print{body{padding:0}}</style></head><body><h2>${esc(title)}</h2><div class="${grid?"labels":""}">${html}</div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
async function saveInspection(e){e.preventDefault();if(!currentUser){setMsg("inspectionMsg","Masuk terlebih dahulu.");return}const type=$("inspectTargetType").value,id=$("inspectTarget").value,qty=Number($("inspectQty").value);if(!id){setMsg("inspectionMsg","Pilih barang atau ruangan.");return}if(!Number.isInteger(qty)||qty<0){setMsg("inspectionMsg","Jumlah ditemukan harus bilangan bulat minimal 0.");return}const isRoom=type==="room",target=(isRoom?rooms:items).find(x=>x.id===id);if(!target){setMsg("inspectionMsg","Data target tidak ditemukan.");return}const now=new Date().toISOString();const row={id:uuid(),target_type:type,target_id:id,item_id:isRoom?null:id,room_id:isRoom?id:(target.room_id||null),item_name:isRoom?"":target.name||"",item_code:isRoom?"":target.code||"",room_name:isRoom?target.name||"":roomLabel(target.room_id)||"",result:$("inspectResult").value,condition:$("inspectCondition").value,found_qty:qty,notes:$("inspectNotes").value.trim(),performed_by:currentUser.id,performed_by_email:currentUser.email||"",inspected_at:now,created_at:now};try{await cacheRecord("inventory_inspections",row);await queueOp("inventory_inspections","upsert",row);if(navigator.onLine)await syncQueue();await localLoad();$("inspectNotes").value="";setMsg("inspectionMsg",navigator.onLine?"Pemeriksaan disimpan. Periksa indikator sinkronisasi untuk memastikan pengiriman ke server.":"Pemeriksaan disimpan di perangkat dan menunggu koneksi.",true)}catch(err){console.error(err);setMsg("inspectionMsg","Gagal menyimpan pemeriksaan: "+(err.message||err))}}
function inspectionResultLabel(v){return ({sesuai:"Sesuai",rusak_ringan:"Rusak ringan",rusak_berat:"Rusak berat",tidak_ditemukan:"Tidak ditemukan",jumlah_tidak_sesuai:"Jumlah tidak sesuai",perlu_perbaikan:"Perlu perbaikan"})[v]||v||"-"}
function filteredInspections(){const q=($("inspectionSearch")?.value||"").toLocaleLowerCase("id-ID");return inspections.filter(r=>[inspectionTargetLabel(r),r.result,r.condition,r.notes,r.performed_by_email,r.room_name,r.item_code].join(" ").toLocaleLowerCase("id-ID").includes(q))}
function renderInspectionHistory(){if(!$("inspectionTable"))return;const arr=filteredInspections();$("inspectionTable").innerHTML=table(["Tanggal","Jenis","Barang/Ruangan","Hasil","Kondisi","Jumlah","Catatan","Petugas"],arr.map(r=>[esc(r.inspected_at?new Date(r.inspected_at).toLocaleString("id-ID"):"-"),r.target_type==="room"?"Ruangan":"Barang",esc(inspectionTargetLabel(r)),esc(inspectionResultLabel(r.result)),esc(conditionLabel(r.condition)),Number(r.found_qty)||0,esc(r.notes||"-"),esc(r.performed_by_email||"-")]))}
function renderQRHome(){populateQRTargets();populateInspectionTargets();renderInspectionHistory()}
let qrScanStream=null,qrScanActive=false;
async function startQRScan(){if(!("BarcodeDetector" in window)){setMsg("inspectionMsg","Pemindaian kamera otomatis tidak didukung browser ini. Masukkan kode QR secara manual belum tersedia; gunakan aplikasi pemindai QR pada HP untuk membaca teks SARPRAS|ITEM|ID atau SARPRAS|ROOM|ID.");return}try{const detector=new BarcodeDetector({formats:["qr_code"]});qrScanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});const video=$("qrVideo");video.srcObject=qrScanStream;await video.play();$("scanArea").classList.remove("hidden");qrScanActive=true;const tick=async()=>{if(!qrScanActive)return;try{const codes=await detector.detect(video);if(codes.length){const m=/^SARPRAS\|(ITEM|ROOM)\|(.+)$/.exec(codes[0].rawValue||"");if(m){$("inspectTargetType").value=m[1]==="ROOM"?"room":"item";populateInspectionTargets();$("inspectTarget").value=m[2];setMsg("inspectionMsg","QR berhasil dipindai. Lengkapi hasil pemeriksaan lalu simpan.",true);stopQRScan();return}}}catch(e){}requestAnimationFrame(tick)};requestAnimationFrame(tick)}catch(err){setMsg("inspectionMsg","Kamera tidak dapat dibuka: "+(err.message||err)+". Pastikan izin kamera diberikan dan aplikasi dibuka melalui HTTPS.")}}
function stopQRScan(){qrScanActive=false;if(qrScanStream){qrScanStream.getTracks().forEach(t=>t.stop());qrScanStream=null}const v=$("qrVideo");if(v)v.srcObject=null;$("scanArea")?.classList.add("hidden")}

initMutationUI();
initQRUI();

window.addEventListener("online",async()=>{onlineStatus();if(sb&&currentUser){await syncQueue();await fetchRemote()}});
window.addEventListener("offline",onlineStatus);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(console.warn);
onlineStatus();initAuth().catch(e=>{console.error(e);$("loginMsg").textContent="Gagal memulai aplikasi: "+e.message});
