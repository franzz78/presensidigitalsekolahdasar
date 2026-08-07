// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD9BmV4XKXuMWa4PZHpb7Bbt-rHs61m3lE",
  databaseURL: "https://absensi-polri-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-polri",
  storageBucket: "absensi-polri.firebasestorage.app",
  messagingSenderId: "19006760644",
  appId: "1:19006760644:web:b980f54aea123e92ed4b91"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let html5QrCode;
let isScannerRunning = false;

// Loading Screen Logic
window.addEventListener('load', () => {
  let progress = 0;
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  const interval = setInterval(() => {
    progress += 5;
    if (progressBar) progressBar.style.width = progress + '%';
    if (progressText) progressText.innerText = progress + '%';
    
    if (progress >= 100) {
      clearInterval(interval);
      document.getElementById('loading-screen').style.display = 'none';
      initScanner();
    }
  }, 50);

  // Set default date filter
  document.getElementById('recap-date').value = getTodayString();
  registerServiceWorker();
});

// Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Failed:', err));
  }
}

// WIB Time Utility Functions
function getWIBDate() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function getTodayString() {
  const d = getWIBDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Real-time Clock
function updateClock() {
  const d = getWIBDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateStr = d.toLocaleDateString('id-ID', options);

  document.getElementById('clock').innerText = `${hours}:${minutes}:${seconds} WIB`;
  document.getElementById('date-display').innerText = dateStr;
}
setInterval(updateClock, 1000);

// Hamburger Menu Toggle
document.getElementById('hamburger-btn').addEventListener('click', () => {
  const menu = document.getElementById('nav-menu');
  menu.classList.toggle('show');
});

// Section Navigation
function showSection(sectionId) {
  document.querySelectorAll('main > section').forEach(sec => {
    sec.classList.remove('active-section');
    sec.classList.add('hidden-section');
  });
  document.getElementById(sectionId).classList.remove('hidden-section');
  document.getElementById(sectionId).classList.add('active-section');
  document.getElementById('nav-menu').classList.remove('show');

  if (sectionId === 'home-section') {
    startScanner();
  } else {
    stopScanner();
  }

  if (sectionId.startsWith('kelas')) {
    loadClassData(sectionId);
  }
}

// Admin Protection Password
function accessAdmin() {
  Swal.fire({
    title: 'Akses Administrator',
    input: 'password',
    inputPlaceholder: 'Masukkan Password Admin',
    showCancelButton: true,
    confirmButtonText: 'Masuk',
    confirmButtonColor: '#b71c1c'
  }).then((result) => {
    if (result.isConfirmed) {
      if (result.value === "PRESENSIDIGITALSD12026##") {
        showSection('admin-section');
        loadAdminData();
      } else {
        Swal.fire('Akses Ditolak', 'Password yang Anda masukkan salah!', 'error');
      }
    }
  });
}

// QR Scanner Logic
function initScanner() {
  html5QrCode = new Html5Qrcode("reader");
  startScanner();
}

function startScanner() {
  if (isScannerRunning) return;
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
    .then(() => { isScannerRunning = true; })
    .catch(err => console.log('Camera init error:', err));
}

function stopScanner() {
  if (isScannerRunning && html5QrCode) {
    html5QrCode.stop().then(() => { isScannerRunning = false; }).catch(err => console.log(err));
  }
}

function onScanSuccess(decodedText) {
  // Expected QR Format JSON: {"id":"...", "nama":"...", "kelas":"..."}
  try {
    const student = JSON.parse(decodedText);
    processAttendance(student);
  } catch (e) {
    Swal.fire('Format QR Salah', 'QR Code tidak terdaftar dalam sistem.', 'error');
  }
}

function processAttendance(student) {
  const today = getTodayString();
  const timeStr = getWIBDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ref = database.ref(`presensi/${today}/${student.id}`);

  ref.once('value', snapshot => {
    if (snapshot.exists()) {
      Swal.fire({
        icon: 'warning',
        title: 'Kamu sudah absen!',
        text: 'Kamu sudah absen, tidak bisa absen kembali!',
        confirmButtonColor: '#b71c1c'
      });
    } else {
      ref.set({
        nama: student.nama,
        kelas: student.kelas,
        status: 'Hadir',
        waktu: timeStr
      }).then(() => {
        Swal.fire({
          icon: 'success',
          title: 'Presensi Berhasil',
          text: `Nama: ${student.nama} (${student.kelas}) sudah absen.`,
          confirmButtonColor: '#b71c1c'
        });
      });
    }
  });
}

// Student & Admin Data Operations
const studentForm = document.getElementById('student-form');
studentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('student-id').value || database.ref().child('students').push().key;
  const nama = document.getElementById('student-name').value;
  const kelas = document.getElementById('student-class').value;

  database.ref(`students/${id}`).set({ nama, kelas }).then(() => {
    Swal.fire('Tersimpan', 'Data siswa berhasil disimpan.', 'success');
    resetForm();
    loadAdminData();
  });
});

function resetForm() {
  document.getElementById('student-id').value = '';
  document.getElementById('student-name').value = '';
  document.getElementById('btn-cancel').style.display = 'none';
}

function loadAdminData() {
  // Load Master Students
  database.ref('students').on('value', snapshot => {
    const tbody = document.querySelector('#table-admin-students tbody');
    tbody.innerHTML = '';
    let count = 1;
    snapshot.forEach(child => {
      const s = child.val();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${count++}</td>
        <td>${s.nama}</td>
        <td>${s.kelas}</td>
        <td>
          <button onclick="generateQR('${child.key}', '${s.nama}', '${s.kelas}')" class="btn-primary">QR</button>
          <button onclick="editStudent('${child.key}', '${s.nama}', '${s.kelas}')" class="btn-secondary">Edit</button>
          <button onclick="deleteStudent('${child.key}')" class="btn-delete"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  filterRecap();
}

function deleteStudent(id) {
  Swal.fire({
    title: 'Hapus Data?',
    text: 'Data siswa akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d32f2f',
    confirmButtonText: 'Hapus'
  }).then(result => {
    if (result.isConfirmed) {
      database.ref(`students/${id}`).remove();
    }
  });
}

function editStudent(id, nama, kelas) {
  document.getElementById('student-id').value = id;
  document.getElementById('student-name').value = nama;
  document.getElementById('student-class').value = kelas;
  document.getElementById('btn-cancel').style.display = 'inline-block';
}

function generateQR(id, nama, kelas) {
  const qrCard = document.getElementById('qr-generator-card');
  const qrBox = document.getElementById('qrcode-box');
  const info = document.getElementById('qr-student-info');
  
  qrBox.innerHTML = '';
  info.innerText = `${nama} - ${kelas}`;
  
  const qrData = JSON.stringify({ id, nama, kelas });
  new QRCode(qrBox, {
    text: qrData,
    width: 150,
    height: 150
  });

  qrCard.style.display = 'block';
  qrCard.scrollIntoView({ behavior: 'smooth' });
}

// Classes Data View
function loadClassData(sectionId) {
  const classNameMap = {
    'kelas4-section': 'Kelas 4',
    'kelas5-section': 'Kelas 5',
    'kelas6-section': 'Kelas 6'
  };
  const targetClass = classNameMap[sectionId];
  const tableIdMap = {
    'kelas4-section': 'table-k4',
    'kelas5-section': 'table-k5',
    'kelas6-section': 'table-k6'
  };

  database.ref('students').orderByChild('kelas').equalTo(targetClass).on('value', snapshot => {
    const tbody = document.querySelector(`#${tableIdMap[sectionId]} tbody`);
    tbody.innerHTML = '';
    let count = 1;
    snapshot.forEach(child => {
      const s = child.val();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${count++}</td>
        <td>${s.nama}</td>
        <td>${s.kelas}</td>
        <td><button onclick="generateQR('${child.key}', '${s.nama}', '${s.kelas}'); showSection('admin-section');" class="btn-primary">Lihat QR</button></td>
      `;
      tbody.appendChild(tr);
    });
  });
}

// Attendance Recap Filter & Manual Override
function filterRecap() {
  const dateStr = document.getElementById('recap-date').value || getTodayString();
  
  database.ref('students').once('value', studentsSnap => {
    const students = studentsSnap.val() || {};
    
    database.ref(`presensi/${dateStr}`).on('value', presensiSnap => {
      const presensi = presensiSnap.val() || {};
      const tbody = document.querySelector('#table-recap tbody');
      tbody.innerHTML = '';

      Object.keys(students).forEach(id => {
        const student = students[id];
        const record = presensi[id];
        let status = record ? record.status : 'Tidak Hadir';
        let waktu = record ? record.waktu : '-';
        
        let statusClass = 'status-tidak-hadir';
        if (status === 'Hadir') statusClass = 'status-hadir';
        if (status === 'Izin/Lupa QR') statusClass = 'status-kuning';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${student.nama}</td>
          <td>${student.kelas}</td>
          <td><span class="${statusClass}">${status}</span></td>
          <td>${waktu}</td>
          <td>
            <button onclick="manualPresence('${dateStr}', '${id}', '${student.nama}', '${student.kelas}')" class="btn-secondary">Ubah Status</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
  });
}

function manualPresence(dateStr, studentId, nama, kelas) {
  Swal.fire({
    title: 'Ubah Status Presensi',
    input: 'select',
    inputOptions: {
      'Hadir': 'Hadir',
      'Izin/Lupa QR': 'Izin/Lupa QR (Kuning)',
      'Tidak Hadir': 'Tidak Hadir'
    },
    showCancelButton: true,
    confirmButtonColor: '#b71c1c'
  }).then(result => {
    if (result.isConfirmed) {
      const selectedStatus = result.value;
      const timeStr = getWIBDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      database.ref(`presensi/${dateStr}/${studentId}`).set({
        nama: nama,
        kelas: kelas,
        status: selectedStatus,
        waktu: selectedStatus === 'Tidak Hadir' ? '-' : timeStr
      });
    }
  });
}

// Export to Excel & PDF
function exportToExcel() {
  const table = document.getElementById("table-recap");
  const wb = XLSX.utils.table_to_book(table, {sheet: "Rekap Presensi"});
  XLSX.writeFile(wb, `Rekap_Presensi_${document.getElementById('recap-date').value}.xlsx`);
}

function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(`Rekap Presensi SDN 1 Susukan Agung (${document.getElementById('recap-date').value})`, 14, 15);
  doc.autoTable({ html: '#table-recap', startY: 20 });
  doc.save(`Rekap_Presensi_${document.getElementById('recap-date').value}.pdf`);
  }
          
