const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  saveFile: (payload) => ipcRenderer.invoke('desktop:save-file', payload),
  printHtml: (payload) => ipcRenderer.invoke('desktop:print-html', payload),
  exportPdf: (payload) => ipcRenderer.invoke('desktop:export-pdf', payload),
});
