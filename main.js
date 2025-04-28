const fs = require('fs');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { jsPDF } = require('jspdf');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('dialog:openImage', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] }
      ]
    });

    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('session:save', async (event, sessionData) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Session',
    defaultPath: 'saved_session.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    return { success: true };
  }

  return { success: false };
});

ipcMain.handle('session:load', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (!canceled && filePaths.length > 0) {
    const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
    return JSON.parse(fileContent);
  }

  return null;
});

ipcMain.handle('dialog:showError', async (event, message) => {
  await dialog.showMessageBox({
    type: 'error',
    title: 'Invalid File',
    message: message,
    buttons: ['OK']
  });
});

ipcMain.handle('dialog:saveImage', async (event, dataUrl) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export as PNG',
    defaultPath: 'annotated_image.png',
    filters: [{ name: 'PNG Files', extensions: ['png'] }]
  });

  if (!canceled && filePath) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('dialog:savePdf', async (event, pdfBuffer) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export as PDF',
    defaultPath: 'annotated_image.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (!canceled && filePath) {
    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true };
  }
  return { success: false };
});


ipcMain.handle('dialog:exportPdf', async (event, imageDataUrl) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export as PDF',
    defaultPath: 'annotated_image.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (!canceled && filePath) {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: 'a4' // or can use [width, height] if you want original size
    });

    // Insert image into PDF
    pdf.addImage(imageDataUrl, 'PNG', 0, 0, 595, 842); // A4 size

    // Save PDF
    pdf.save(filePath);

    return { success: true };
  }

  return { success: false };
});
