/* Konfigurasi: isi URL dan anon/publishable key dari Supabase Project Settings > API */
const SUPABASE_URL = "https://akebktlyhfrfwopxrnbt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cGvCIZszseAnEC4qOiHikw_DrAqliM3";
const DB_NAME = "sarpras-darussalam-local-v2";
const STORE = "records";
const QUEUE = "outbox";
let sb = null, currentUser = null, currentRole = "petugas", items = [], rooms = [], profiles = [], mutations = [];
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
function activateView(name){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+name));if(name==="admins")loadProfiles();if(name==="mutations")renderMutations();}
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
renderDashboardDetails();
renderReport();renderMutations();updateQueueStatus();
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
async function fetchRemote() {
  if (!sb || !navigator.onLine || !currentUser) return;

  for (const t of ["rooms", "inventory", "mutations"]) {
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
$("roomForm").addEventListener("submit",async e=>{e.preventDefault();const row={id:uuid(),name:$("roomName").value.trim(),type:$("roomType").value,pic:$("roomPIC").value.trim(),notes:$("roomNotes").value.trim(),created_by:currentUser.id};await saveLocal("rooms",row);$("roomForm").reset();alert("Ruangan disimpan. Sinkronisasi otomatis akan dilakukan saat online.")});
$("roomsTable").addEventListener("click",async e=>{const rid=e.target.closest("[data-roomdel]")?.dataset.roomdel;if(!rid)return;if(items.some(i=>i.room_id===rid)){alert("Ruangan masih dipakai oleh barang. Ubah lokasi barang terlebih dahulu.");return}if(confirm("Hapus ruangan dari database bersama?"))await deleteLocal("rooms",rid)});
$("itemSearch").addEventListener("input",render);
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
  summary.querySelectorAll(".report-print-header").forEach(el=>el.remove());
  summary.insertAdjacentHTML("afterbegin", `
    <section class="report-print-header">
      <div class="report-school-mark">SD</div>
      <div class="report-school-name">SD DARUSSALAM PALANGKARAYA</div>
      <div class="report-school-subtitle">LAPORAN SARANA DAN PRASARANA SEKOLAH</div>
      <div class="report-header-rule"></div>
      <h2>LAPORAN INVENTARIS BARANG</h2>
      <p class="report-header-date">Tanggal laporan: <b>${esc(today)}</b></p>
      <div class="report-filter-summary"><span>Kategori: <b>${esc(cat)}</b></span><span>Kondisi: <b>${esc(condLabel)}</b></span><span>Ruangan: <b>${esc(room)}</b></span></div>
    </section>`);
  document.querySelectorAll("#reportSignatureBlock").forEach(el=>el.remove());
  reportTableEl.insertAdjacentHTML("afterend", `
    <section id="reportSignatureBlock" class="report-signatures">
      <div class="report-sign-date">Palangkaraya, ${esc(today)}</div>
      <div class="report-sign-grid">
        <div><p>Mengetahui,</p><p>Kepala Sekolah</p><div class="report-sign-space"></div><p class="report-sign-name">(........................................)</p><p>NIP. ....................................</p></div>
        <div><p>Petugas Inventaris</p><p>Pengelola Sarana dan Prasarana</p><div class="report-sign-space"></div><p class="report-sign-name">(........................................)</p><p>NIP. ....................................</p></div>
      </div>
    </section>`);
  if(!$("reportPrintStyles")){
    const style=document.createElement("style");style.id="reportPrintStyles";style.textContent=`
      .report-print-header{display:flex;flex-direction:column;align-items:center;text-align:center;margin:0 0 18px;color:#172b24}
      .report-school-mark{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border:2px solid #173f32;border-radius:50%;font-weight:800;margin-bottom:6px}
      .report-school-name{font-size:18px;font-weight:800;letter-spacing:.5px}.report-school-subtitle{font-size:12px;margin-top:3px}.report-header-rule{height:3px;background:#173f32;width:100%;margin:10px 0 12px}
      .report-print-header h2{font-size:16px;margin:0 0 7px}.report-header-date{margin:0 0 8px}.report-filter-summary{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;font-size:11px}
      .report-signatures{margin:14px 0 0;break-inside:avoid!important;page-break-inside:avoid!important;color:#111;display:block}.report-sign-date{text-align:right;margin-bottom:5px}.report-sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:35px;text-align:center;break-inside:avoid-page!important;page-break-inside:avoid!important}.report-sign-grid>div{break-inside:avoid-page!important;page-break-inside:avoid!important}.report-sign-grid p{margin:2px 0}.report-sign-space{height:32px}.report-sign-name{font-weight:700}
      @page{size:A4 portrait;margin:14mm}
      @media print{
        body *{visibility:hidden!important}
        #view-reports,#view-reports *{visibility:visible!important}
        #view-reports{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important;background:#fff!important;color:#111!important}
        #view-reports .no-print,#view-reports button,#view-reports input,#view-reports select{display:none!important}
        #view-reports .card{border:0!important;box-shadow:none!important;padding:0!important;margin:0!important}
        #view-reports h2{margin-top:0!important}
        #view-reports .condition-summary{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;margin:8px 0 12px!important}
        #view-reports .condition-card{padding:6px!important;border:1px solid #999!important;background:#fff!important;break-inside:avoid}
        #view-reports .condition-card strong{font-size:15px!important}
        #view-reports table{width:100%!important;border-collapse:collapse!important;font-size:8px!important;table-layout:auto!important}
        #view-reports th,#view-reports td{border:1px solid #666!important;padding:4px!important;color:#111!important;background:#fff!important;overflow-wrap:anywhere!important}
        #view-reports thead{display:table-header-group}
        #view-reports tr{break-inside:avoid;page-break-inside:avoid}
        #view-reports .tablewrap{overflow:visible!important;max-width:none!important}
        #view-reports .report-signatures{display:block!important;margin-top:10px!important;break-inside:avoid!important;page-break-inside:avoid!important}
        #view-reports .report-sign-grid,#view-reports .report-sign-grid>div{break-inside:avoid-page!important;page-break-inside:avoid!important}
        #view-reports .report-sign-space{height:30px!important}
        #view-reports .report-sign-grid p{margin:2px 0!important}
        #view-reports .report-sign-date{margin-bottom:4px!important}
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
$("printReport").addEventListener("click",()=>{activateView("reports");renderReport();setTimeout(()=>window.print(),50)});
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
initMutationUI();

window.addEventListener("online",async()=>{onlineStatus();if(sb&&currentUser){await syncQueue();await fetchRemote()}});
window.addEventListener("offline",onlineStatus);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(console.warn);
onlineStatus();initAuth().catch(e=>{console.error(e);$("loginMsg").textContent="Gagal memulai aplikasi: "+e.message});
