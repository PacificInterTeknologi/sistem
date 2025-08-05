// =====================
// LAPORAN KEUANGAN MANAGEMENT
// =====================

/**
 * Mendapatkan data laporan keuangan dari localStorage
 * @returns {Array} Array of laporan keuangan objects
 */
function getLaporanKeuangan() {
  try {
    return JSON.parse(localStorage.getItem("laporanKeuangan")) || [];
  } catch (error) {
    console.error("Error getting laporan keuangan data:", error);
    return [];
  }
}

/**
 * Menyimpan data laporan keuangan ke localStorage
 * @param {Array} data - Array of laporan keuangan objects
 */
function simpanLaporanKeuangan(data) {
  try {
    // Validasi data
    if (!Array.isArray(data)) {
      throw new Error("Data harus berupa array");
    }
    
    localStorage.setItem("laporanKeuangan", JSON.stringify(data));
  } catch (error) {
    console.error("Error saving laporan keuangan data:", error);
    showNotification("Gagal menyimpan data laporan keuangan", "error");
  }
}

/**
 * Simpan data penjualan ke jurnal dan laporan keuangan
 * @param {Object} penjualan - Data penjualan
 */
function simpanKeJurnal(penjualan) {
  try {
    // Ambil data jurnal yang ada
    const jurnalData = JSON.parse(localStorage.getItem("dataJurnal")) || [];
    
    // Tambahkan entri untuk pendapatan penjualan (kredit)
    jurnalData.push({
      tanggal: penjualan.tanggal,
      akun: "Pendapatan Jasa",
      keterangan: `Penjualan - ${penjualan.customer}`,
      debit: 0,
      kredit: penjualan.total,
      fromPenjualan: true,
      noInvoice: penjualan.noInvoice,
      jenisTransaksi: "penjualan"
    });
    
    // Tambahkan entri untuk kas/piutang (debit)
    jurnalData.push({
      tanggal: penjualan.tanggal,
      akun: penjualan.metodePembayaran === "Tunai" ? "Kas" : "Piutang Usaha",
      keterangan: `Penjualan - ${penjualan.customer}`,
      debit: penjualan.total,
      kredit: 0,
      fromPenjualan: true,
      noInvoice: penjualan.noInvoice,
      jenisTransaksi: "penjualan"
    });
    
    // Simpan kembali data jurnal
    localStorage.setItem("dataJurnal", JSON.stringify(jurnalData));
    
    // Simpan ke laporanKeuangan (SATU BARIS untuk penjualan)
    const laporanKeuangan = getLaporanKeuangan();
    
    // Hapus dulu data laporan keuangan untuk invoice ini jika ada (untuk menghindari duplikat)
    const filteredLaporan = laporanKeuangan.filter(item => 
      !(item.noInvoice === penjualan.noInvoice && item.jenisTransaksi === "penjualan")
    );
    
    // Tambahkan SATU BARIS untuk penjualan
    filteredLaporan.push({
      tanggal: penjualan.tanggal,
      akun: "Penjualan",
      nilai: penjualan.total,
      keterangan: `Penjualan - ${penjualan.customer}`,
      tipe: "kredit",
      noInvoice: penjualan.noInvoice,
      jenisTransaksi: "penjualan",
      metodePembayaran: penjualan.metodePembayaran,
      jenisInvoice: penjualan.jenisInvoice || "jasa"
    });
    
    simpanLaporanKeuangan(filteredLaporan);
    
    showNotification("Data penjualan berhasil dicatat di jurnal dan laporan keuangan!");
    
    // Log aktivitas
    logActivity(`Menambah jurnal untuk invoice: ${penjualan.noInvoice}`);
  } catch (error) {
    console.error("Error saving to journal:", error);
    showNotification("Terjadi kesalahan saat menyimpan ke jurnal", "error");
  }
}

/**
 * Update laporan keuangan setelah hapus data
 * @param {Object} deletedItem - Item yang dihapus
 */
function updateLaporanKeuanganAfterDelete(deletedItem) {
  let laporanKeuangan = getLaporanKeuangan();
  
  // Hapus item yang sesuai dari laporan keuangan
  laporanKeuangan = laporanKeuangan.filter(item => 
    !(item.akun === deletedItem.akun && 
      item.nilai === (deletedItem.debit || deletedItem.kredit) && 
      item.tanggal === deletedItem.tanggal)
  );
  
  simpanLaporanKeuangan(laporanKeuangan);
}

/**
 * Update laporan keuangan saat status pembayaran berubah
 * @param {Object} penjualan - Data penjualan yang statusnya berubah
 */
function updateLaporanKeuanganOnPayment(penjualan) {
  try {
    const laporanKeuangan = getLaporanKeuangan();
    
    if (penjualan.status === "Lunas" && penjualan.tanggalPelunasan) {
      // Tambahkan entri untuk pelunasan
      laporanKeuangan.push({
        tanggal: penjualan.tanggalPelunasan,
        akun: "Pelunasan",
        nilai: penjualan.total,
        keterangan: `Pelunasan Invoice ${penjualan.noInvoice} - ${penjualan.customer}`,
        tipe: "debit",
        noInvoice: penjualan.noInvoice,
        jenisTransaksi: "pelunasan"
      });
      
      showNotification("Status pembayaran diperbarui dan dicatat di laporan keuangan!");
    }
    
    simpanLaporanKeuangan(laporanKeuangan);
    
    // Log aktivitas
    logActivity(`Update laporan keuangan untuk pelunasan invoice: ${penjualan.noInvoice}`);
  } catch (error) {
    console.error("Error updating laporan keuangan on payment:", error);
    showNotification("Terjadi kesalahan saat memperbarui laporan keuangan", "error");
  }
}

/**
 * Bersihkan data laporan keuangan dari invoice yang sudah dihapus
 */
function cleanLaporanKeuanganFromDeletedInvoices() {
  try {
    const laporanKeuangan = getLaporanKeuangan();
    const dataPenjualan = JSON.parse(localStorage.getItem("dataPenjualan")) || [];
    
    // Filter data laporan keuangan, hapus yang tidak memiliki invoice di data penjualan
    const filteredLaporan = laporanKeuangan.filter(item => {
      // Jika tidak ada noInvoice, biarkan (ini adalah transaksi manual)
      if (!item.noInvoice) return true;
      
      // Cek apakah invoice masih ada di data penjualan
      return dataPenjualan.some(p => p.noInvoice === item.noInvoice);
    });
    
    // Simpan kembali data yang sudah dibersihkan
    if (filteredLaporan.length !== laporanKeuangan.length) {
      simpanLaporanKeuangan(filteredLaporan);
      showNotification("Data laporan keuangan telah dibersihkan dari invoice yang sudah dihapus");
    }
  } catch (error) {
    console.error("Error cleaning laporan keuangan:", error);
  }
}

// =====================
// INVOICE MANAGEMENT
// =====================

/**
 * Mendapatkan data invoice dari localStorage
 * @returns {Array} Array of invoice objects
 */
function getInvoices() {
  try {
    return JSON.parse(localStorage.getItem("dataPenjualan")) || [];
  } catch (error) {
    console.error("Error getting invoices data:", error);
    return [];
  }
}

/**
 * Menyimpan data invoice ke localStorage
 * @param {Array} data - Array of invoice objects
 */
function simpanInvoices(data) {
  try {
    // Validasi data
    if (!Array.isArray(data)) {
      throw new Error("Data harus berupa array");
    }
    
    localStorage.setItem("dataPenjualan", JSON.stringify(data));
  } catch (error) {
    console.error("Error saving invoices data:", error);
    showNotification("Gagal menyimpan data invoice", "error");
  }
}

/**
 * Mengubah status pembayaran invoice
 * @param {number} index - Index invoice yang akan diubah
 * @param {string} status - Status baru (Lunas/Belum Lunas)
 */
function ubahStatusPembayaran(index, status) {
  try {
    const data = getInvoices();
    const invoice = data[index];
    
    if (!invoice) {
      showNotification("Data invoice tidak ditemukan", "error");
      return;
    }
    
    const oldStatus = invoice.status;
    invoice.status = status;
    
    if (status === "Lunas") {
      // Jika tanggal pelunasan belum diisi, isi dengan tanggal hari ini
      if (!invoice.tanggalPelunasan) {
        const today = new Date().toISOString().split('T')[0];
        invoice.tanggalPelunasan = today;
      }
      
      // Jika status berubah dari Belum Lunas menjadi Lunas, tambahkan entri jurnal untuk penerimaan kas
      if (oldStatus === "Belum Lunas") {
        const jurnalData = JSON.parse(localStorage.getItem("dataJurnal")) || [];
        
        // Tambahkan entri untuk pengurangan piutang
        jurnalData.push({
          tanggal: invoice.tanggalPelunasan || new Date().toISOString().split('T')[0],
          akun: "Piutang Usaha",
          keterangan: `Pelunasan Invoice ${invoice.noInvoice} - ${invoice.customer}`,
          debit: 0,
          kredit: invoice.total,
          fromPenjualan: true,
          noInvoice: invoice.noInvoice,
          jenisTransaksi: "pelunasan"
        });
        
        // Tambahkan entri untuk penambahan kas
        jurnalData.push({
          tanggal: invoice.tanggalPelunasan || new Date().toISOString().split('T')[0],
          akun: "Kas",
          keterangan: `Pelunasan Invoice ${invoice.noInvoice} - ${invoice.customer}`,
          debit: invoice.total,
          kredit: 0,
          fromPenjualan: true,
          noInvoice: invoice.noInvoice,
          jenisTransaksi: "pelunasan"
        });
        
        localStorage.setItem("dataJurnal", JSON.stringify(jurnalData));
        
        // Update laporan keuangan untuk pelunasan
        updateLaporanKeuanganOnPayment(invoice);
      }
    } else {
      invoice.tanggalPelunasan = "";
    }
    
    simpanInvoices(data);
    
    // Log aktivitas
    logActivity(`Mengubah status pembayaran invoice ${invoice.noInvoice} dari ${oldStatus} menjadi ${status}`);
    
    showNotification("Status pembayaran berhasil diperbarui");
  } catch (error) {
    console.error("Error changing payment status:", error);
    showNotification("Terjadi kesalahan saat mengubah status pembayaran", "error");
  }
}

/**
 * Hapus invoice dan data terkait
 * @param {number} index - Index invoice yang akan dihapus
 */
function hapusInvoice(index) {
  try {
    const data = getInvoices();
    const invoice = data[index];
    
    if (!invoice) {
      showNotification("Data invoice tidak ditemukan", "error");
      return;
    }
    
    // Tampilkan konfirmasi dengan nomor invoice
    if (confirm(`Apakah Anda yakin ingin menghapus invoice ${invoice.noInvoice}?`)) {
      // Hapus dari array
      data.splice(index, 1);
      simpanInvoices(data);
      
      // Hapus dari jurnal
      const jurnalData = JSON.parse(localStorage.getItem("dataJurnal")) || [];
      const updatedJurnalData = jurnalData.filter(item => 
        !(item.noInvoice === invoice.noInvoice)
      );
      localStorage.setItem("dataJurnal", JSON.stringify(updatedJurnalData));
      
      // Hapus dari laporan keuangan
      updateLaporanKeuanganAfterDelete(invoice);
      
      // Log aktivitas
      logActivity(`Menghapus invoice: ${invoice.noInvoice}`);
      
      showNotification(`Invoice ${invoice.noInvoice} berhasil dihapus`);
    }
  } catch (error) {
    console.error("Error deleting invoice:", error);
    showNotification("Terjadi kesalahan saat menghapus invoice", "error");
  }
}

// =====================
// UPDATE INISIALISASI APLIKASI
// =====================

/**
 * Inisialisasi aplikasi
 */
function initializeApp() {
  // Inisialisasi data pengguna
  initializeUsersData();
  
  const user = getCurrentUser();
  if (!user) {
    showNotification("Silakan login terlebih dahulu", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
    return;
  }
  
  // Update info user di header
  const userInfoElement = document.getElementById("userWelcome");
  if (userInfoElement) {
    userInfoElement.textContent = `${user.fullName} (${user.role})`;
  }
  
  // Tampilkan menu manajemen pengguna hanya untuk admin
  const adminMenu = document.getElementById("linkPengguna");
  if (adminMenu && user.role === "admin") {
    adminMenu.style.display = "block";
  }
  
  // Bersihkan data laporan keuangan dari invoice yang sudah dihapus
  cleanLaporanKeuanganFromDeletedInvoices();
  
  // Halaman-specific initialization
  const currentPath = window.location.pathname;
  const pageName = currentPath.split('/').pop() || 'dashboard.html';
  
  switch(pageName) {
    case 'pelanggan.html':
      // Setup form pelanggan
      if (typeof setupFormPelanggan === 'function') setupFormPelanggan();
      
      // Tampilkan data pelanggan
      if (typeof tampilkanPelanggan === 'function') tampilkanPelanggan();
      
      // Setup pencarian jika ada input pencarian
      if (typeof setupSearch === 'function') setupSearch();
      break;
      
    case 'pengguna.html':
      // Setup form pengguna
      if (typeof setupUserForm === 'function') setupUserForm();
      
      // Tampilkan data pengguna
      if (typeof tampilkanUsers === 'function') tampilkanUsers();
      
      // Setup pencarian jika ada input pencarian
      if (typeof setupUserSearch === 'function') setupUserSearch();
      break;
      
    case 'activity-logs.html':
      // Tampilkan activity logs
      if (typeof tampilkanActivityLogs === 'function') tampilkanActivityLogs();
      break;
      
    case 'invoice.html':
      // Tampilkan data invoice
      if (typeof tampilkanInvoices === 'function') tampilkanInvoices();
      break;
  }
  
  // Log aktivitas login
  logActivity(`User ${user.username} (${user.role}) mengakses halaman ${pageName}`);
  
  // Setup auto-refresh token jika diperlukan
  setupAutoRefresh();
}