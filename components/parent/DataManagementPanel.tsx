import React, { useState } from 'react';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle, X } from '../icons';

interface DataManagementPanelProps {
  onDeleteAllData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (file: File) => Promise<boolean>;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmButtonClass?: string;
  isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmButtonClass = "bg-red-600 hover:bg-red-700",
  isDangerous = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center mb-4">
          {isDangerous && <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />}
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
          >
            İptal
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition font-medium ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

interface NotificationProps {
  isVisible: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

const Notification: React.FC<NotificationProps> = ({
  isVisible,
  onClose,
  type,
  title,
  message
}) => {
  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <X className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success': return 'text-green-800';
      case 'error': return 'text-red-800';
      case 'warning': return 'text-yellow-800';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`p-4 rounded-lg border ${getBgColor()} shadow-lg max-w-sm`}>
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1">
            <h4 className={`font-semibold ${getTextColor()}`}>{title}</h4>
            <p className={`text-sm mt-1 ${getTextColor()}`}>{message}</p>
          </div>
          <button
            onClick={onClose}
            className={`ml-2 ${getTextColor()} hover:opacity-70 transition`}
            title="Bildirimi kapat"
            aria-label="Bildirimi kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const DataManagementPanel: React.FC<DataManagementPanelProps> = ({
  onDeleteAllData,
  onExportData,
  onImportData
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    isVisible: boolean;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
  }>({
    isVisible: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showNotification = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setNotification({ isVisible: true, type, title, message });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, isVisible: false }));
    }, 5000);
  };

  const handleDeleteAllData = async () => {
    setIsLoading('delete');
    try {
      await onDeleteAllData();
      setShowDeleteConfirm(false);
      showNotification('success', 'Başarılı', 'Tüm veriler başarıyla silindi.');
    } catch (error) {
      showNotification('error', 'Hata', 'Veri silme işlemi sırasında bir hata oluştu.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleExportData = async () => {
    setIsLoading('export');
    try {
      await onExportData();
      showNotification('success', 'Başarılı', 'Veriler başarıyla dışa aktarıldı.');
    } catch (error) {
      showNotification('error', 'Hata', 'Veri dışa aktarım işlemi sırasında bir hata oluştu.');
    } finally {
      setIsLoading(null);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Dosya formatını kontrol et
      if (file.name.endsWith('.json')) {
        setSelectedFile(file);
        setShowImportConfirm(true);
      } else {
        showNotification('error', 'Geçersiz Dosya', 'Lütfen .json formatında bir yedek dosyası seçin.');
      }
    }
    // Input'u sıfırla
    event.target.value = '';
  };

  const handleImportData = async () => {
    if (!selectedFile) return;
    
    setIsLoading('import');
    try {
      const success = await onImportData(selectedFile);
      setShowImportConfirm(false);
      setSelectedFile(null);
      
      if (success) {
        showNotification('success', 'Başarılı', 'Veriler başarıyla içe aktarıldı ve geri yüklendi.');
      } else {
        showNotification('error', 'Hata', 'Seçilen dosya geçerli bir yedek dosyası değil.');
      }
    } catch (error) {
      showNotification('error', 'Hata', 'Veri içe aktarım işlemi sırasında bir hata oluştu.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-2xl font-bold mb-4 flex items-center">
          <AlertTriangle className="w-6 h-6 mr-3 text-amber-500" />
          Veri Yönetimi
        </h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>Önemli:</strong> Bu bölümdeki işlemler uygulamanın tüm verilerini etkiler. 
            Lütfen işlemleri gerçekleştirmeden önce verilerinizi yedeklemeyi unutmayın.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Export Data */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Download className="w-5 h-5 text-blue-600 mr-2" />
              <h4 className="font-semibold text-slate-800">Veri Dışa Aktar</h4>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Tüm uygulama verilerinizi JSON formatında bilgisayarınıza kaydedin.
            </p>
            <button
              onClick={handleExportData}
              disabled={isLoading === 'export'}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading === 'export' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Dışa Aktarılıyor...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Yedekle
                </>
              )}
            </button>
          </div>

          {/* Import Data */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Upload className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-semibold text-slate-800">Veri İçe Aktar</h4>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Daha önce yedeklediğiniz dosyadan verilerinizi geri yükleyin.
            </p>
            <label className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition cursor-pointer flex items-center justify-center">
              <Upload className="w-4 h-4 mr-2" />
              Dosya Seç
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Delete All Data */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-center mb-3">
              <Trash2 className="w-5 h-5 text-red-600 mr-2" />
              <h4 className="font-semibold text-red-800">Tüm Verileri Sil</h4>
            </div>
            <p className="text-sm text-red-700 mb-4">
              <strong>DİKKAT:</strong> Bu işlem geri alınamaz! Tüm verileriniz kalıcı olarak silinecektir.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading === 'delete'}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading === 'delete' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Siliniyor...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tüm Verileri Sil
                </>
              )}
            </button>
          </div>
        </div>

        {/* Güvenlik Uyarısı */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-800 font-medium mb-1">Güvenlik Bilgilendirmesi</p>
              <p className="text-yellow-700">
                Dışa aktarılan yedek dosyalar şifrelenmez ve herkes tarafından okunabilir. 
                Kişisel verilerin güvenliği için bu dosyaları güvenli yerlerde saklayın.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAllData}
        title="Tüm Verileri Sil"
        message="UYARI: Tüm uygulama verilerini kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz. Devam etmek istediğinizden emin misiniz?"
        confirmText="Evet, Sil"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isDangerous={true}
      />

      {/* Import Confirmation Modal */}
      <ConfirmationModal
        isOpen={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setSelectedFile(null);
        }}
        onConfirm={handleImportData}
        title="Veriyi Geri Yükle"
        message="DİKKAT: Bu işlem mevcut tüm verilerinizi seçilen yedek dosyasındaki verilerle değiştirecektir. Devam etmek istediğinizden emin misiniz?"
        confirmText="Devam Et"
        confirmButtonClass="bg-green-600 hover:bg-green-700"
        isDangerous={false}
      />

      {/* Notification */}
      <Notification
        isVisible={notification.isVisible}
        onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </>
  );
};

export default DataManagementPanel;