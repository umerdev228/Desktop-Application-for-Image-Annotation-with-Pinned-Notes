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


ipcMain.handle('dialog:exportPdf', async (event, data) => {
  const { imageDataUrl, width, height } = data;

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export as PDF',
    defaultPath: 'annotated_image.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (canceled) return { success: false };

  try {
    // Create PDF with safe dimensions
    // Use A4 as the base format for better compatibility
    const isLandscape = width > height;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });

    // Get page dimensions in points
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate the maximum size for the image with margins
    const margin = 20; // 20pt margin
    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    // Calculate scale to fit image on page
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    // Center image on page
    const x = (pageWidth - scaledWidth) / 2;
    const y = (pageHeight - scaledHeight) / 2;

    // Add the image to PDF
    pdf.addImage(
      imageDataUrl,
      imageDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG',
      x, y, scaledWidth, scaledHeight,
      undefined, 'MEDIUM' // Use medium compression for balance
    );

    // Save the PDF
    const pdfBuffer = pdf.output('arraybuffer');
    fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

    return { success: true };
  } catch (error) {
    console.error('PDF export error:', error);

    await dialog.showMessageBox({
      type: 'error',
      title: 'PDF Export Failed',
      message: 'Failed to export image as PDF. Try using PNG export instead.',
      detail: error.message,
      buttons: ['OK']
    });

    return { success: false };
  }
});