const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openImageDialog: () => ipcRenderer.invoke('dialog:openImage'),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  loadSession: () => ipcRenderer.invoke('session:load'),
  showErrorDialog: (message) => ipcRenderer.invoke('dialog:showError', message),
  saveImage: (dataUrl) => ipcRenderer.invoke('dialog:saveImage', dataUrl),
  savePdf: (pdfBuffer) => ipcRenderer.invoke('dialog:savePdf', pdfBuffer),
  exportPdf: (imageDataUrl) => ipcRenderer.invoke('dialog:exportPdf', imageDataUrl)

});