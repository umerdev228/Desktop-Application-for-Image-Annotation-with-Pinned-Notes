// app.js

const uploadButton = document.getElementById('uploadButton');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
const noteTitleInput = document.getElementById('noteTitle');
const noteDescriptionInput = document.getElementById('noteDescription');
const saveNoteButton = document.getElementById('saveNote');
const hoverTooltip = document.getElementById('hoverTooltip');
// const saveButton = document.getElementById('saveSession');
// const loadButton = document.getElementById('loadSession');
const modalOverlay = document.getElementById('modalOverlay');
const cancelNoteButton = document.getElementById('cancelNote');
const searchBar = document.getElementById('searchBar');
const exportButton = document.getElementById('exportImage');
const pinTagInput = document.getElementById('pinTag');
const notesPanel = document.getElementById('notesPanel');
const toggleSidebarButton = document.getElementById('toggleSidebar');
const deleteModalOverlay = document.getElementById('deleteModalOverlay');
const cancelDeleteButton = document.getElementById('cancelDelete');
const confirmDeleteButton = document.getElementById('confirmDelete');
const contextMenu = document.getElementById('contextMenu');
const deletePinButton = document.getElementById('deletePin');
const exportPdfButton = document.getElementById('exportPdf');
const loaderOverlay = document.getElementById('loaderOverlay');

modalOverlay.hidden = true;

let img = new Image();
let scale = 1;
let originX = 0;
let originY = 0;
let startX, startY;
let currentImagePath = null;

let pins = [];
let activePin = null;
let hoveredPin = null;

let isDragging = false;
let dragged = false;
let mouseDownX = 0;
let mouseDownY = 0;

let searchQuery = '';

function resizeCanvas() {
  imageCanvas.width = window.innerWidth * 0.75;
  imageCanvas.height = window.innerHeight - 50;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

uploadButton.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openImageDialog();
  if (filePath) {
    showLoader(); // 🔥 Show loader immediately when user selects file
    img.src = filePath;
  }
});

img.onload = () => {
  scale = 1;
  originX = 0;
  originY = 0;
  pins = [];
  drawImage();
  renderNotesSidebar();
  hideLoader(); // 🔥 Hide loader when image is completely loaded
};

imageCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomIntensity = 0.1;
  const zoom = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;

  const mouseX = e.offsetX;
  const mouseY = e.offsetY;

  originX -= mouseX / scale;
  originY -= mouseY / scale;
  scale *= zoom;
  originX += mouseX / scale;
  originY += mouseY / scale;

  drawImage();
});

imageCanvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Only set dragging state on left-click (button 0)
    isDragging = true;
    dragged = false;
    startX = e.offsetX - originX;
    startY = e.offsetY - originY;

    // Record mouse down position
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
  }
});

imageCanvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return; // Only left-click

  // Calculate distance mouse moved
  const distance = Math.sqrt((e.clientX - mouseDownX) ** 2 + (e.clientY - mouseDownY) ** 2);

  // Only open modal if: no dragging + tiny movement
  if (!dragged && distance < 5) {
    const mouse = getCanvasCoordinates(e);
    const clickedPin = getPinAtPosition(mouse.x, mouse.y);

    if (clickedPin) {
      activePin = clickedPin;
      openNoteModal();
    } else if (img.src) { // Only create new pin if an image is loaded
      activePin = { x: mouse.x, y: mouse.y, title: '', description: '', tag: 'default' };
      openNoteModal();
    }
  }

  isDragging = false;
});

imageCanvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const moveX = Math.abs(e.clientX - mouseDownX);
    const moveY = Math.abs(e.clientY - mouseDownY);

    if (moveX > 5 || moveY > 5) {
      dragged = true;
    }

    originX = e.offsetX - startX;
    originY = e.offsetY - startY;
    drawImage();
  } else {
    const mouse = getCanvasCoordinates(e);
    hoveredPin = getPinAtPosition(mouse.x, mouse.y);

    if (hoveredPin) {
      showHoverTooltip(e.clientX, e.clientY, hoveredPin.title);
    } else {
      hideHoverTooltip();
    }
  }
});

imageCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  // Reset drag state to prevent unwanted dragging when right-clicking
  isDragging = false;
  dragged = false;

  const mouse = getCanvasCoordinates(e);
  const clickedPin = getPinAtPosition(mouse.x, mouse.y);

  if (clickedPin) {
    activePin = clickedPin;

    // Position context menu near mouse
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.display = 'flex';
  } else {
    contextMenu.style.display = 'none';
  }
});

saveNoteButton.addEventListener('click', () => {
  activePin.title = noteTitleInput.value.trim();
  activePin.description = noteDescriptionInput.value.trim();
  activePin.tag = pinTagInput.value;

  if (activePin.title !== '' || activePin.description !== '') {
    if (!pins.includes(activePin)) {
      pins.push(activePin);
    }
  }

  activePin = null;
  closeNoteModal();
  drawImage();
  renderNotesSidebar();
});

searchBar.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  drawImage(); // Redraw to update highlighting
});

exportButton.addEventListener('click', async () => {
  if (!img.width || !img.height) {
    await window.electronAPI.showErrorDialog('No image loaded to export.');
    return;
  }

  showLoader(); // 🔥 Show loader immediately

  // 🔥 Wait for loader to show, then start heavy export
  setTimeout(async () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = img.width;
    exportCanvas.height = img.height;
    const exportCtx = exportCanvas.getContext('2d');

    exportCtx.drawImage(img, 0, 0);

    pins.forEach(pin => {
      exportCtx.beginPath();
      exportCtx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
      exportCtx.fillStyle = getColorByTag(pin.tag);
      exportCtx.fill();
      exportCtx.stroke();

      if (pin.title) {
        exportCtx.font = "24px Arial";
        exportCtx.fillStyle = "black";
        exportCtx.fillText(pin.title, pin.x + 12, pin.y - 12);
      }
    });

    const dataURL = exportCanvas.toDataURL('image/png');
    const result = await window.electronAPI.saveImage(dataURL);

    hideLoader(); // 🔥 Hide loader after export

    if (result.success) {
      console.log('Image exported successfully!');
    } else {
      console.log('Image export cancelled.');
    }
  }, 0); // 🔥 Tiny delay to repaint loader
});

toggleSidebarButton.addEventListener('click', () => {
  notesPanel.classList.toggle('hidden');
});

cancelDeleteButton.addEventListener('click', () => {
  activePin = null;
  closeDeleteModal();
});

confirmDeleteButton.addEventListener('click', () => {
  if (activePin) {
    pins = pins.filter(p => p !== activePin);
    activePin = null;
    drawImage();
    renderNotesSidebar(); // 🔥 Update sidebar too
  }
  closeDeleteModal();
});

deletePinButton.addEventListener('click', () => {
  contextMenu.style.display = 'none';
  openDeleteModal();
});

document.addEventListener('click', () => {
  contextMenu.style.display = 'none';
});

exportPdfButton.addEventListener('click', async () => {
  if (!img.width || !img.height) {
    await window.electronAPI.showErrorDialog('No image loaded to export.');
    return;
  }

  showLoader();

  setTimeout(async () => {
    try {
      // Step 1: Create a canvas for the exported image with pins
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = img.width;
      exportCanvas.height = img.height;
      const exportCtx = exportCanvas.getContext('2d');

      // Draw base image
      exportCtx.drawImage(img, 0, 0);

      // Draw pins with larger text to ensure visibility
      pins.forEach(pin => {
        // Draw pin circle
        exportCtx.beginPath();
        exportCtx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
        exportCtx.fillStyle = getColorByTag(pin.tag);
        exportCtx.fill();
        exportCtx.stroke();

        // Draw pin text with increased size
        if (pin.title) {
          exportCtx.font = "36px Arial";
          exportCtx.fillStyle = "black";
          exportCtx.fillText(pin.title, pin.x + 12, pin.y - 12);
        }
      });

      // Step 2: Check if image needs to be scaled to fit PDF limitations
      const PDF_MAX_DIMENSION = 14000; // Slightly below jsPDF limit of 14400
      let finalWidth = img.width;
      let finalHeight = img.height;
      let needsScaling = false;

      if (finalWidth > PDF_MAX_DIMENSION || finalHeight > PDF_MAX_DIMENSION) {
        needsScaling = true;
        const ratio = Math.min(PDF_MAX_DIMENSION / finalWidth, PDF_MAX_DIMENSION / finalHeight);
        finalWidth = Math.floor(finalWidth * ratio);
        finalHeight = Math.floor(finalHeight * ratio);
      }

      // Step 3: If scaling needed, create a resized version
      let finalImageData;

      if (needsScaling) {
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = finalWidth;
        resizeCanvas.height = finalHeight;
        const resizeCtx = resizeCanvas.getContext('2d');

        // Use high-quality image smoothing
        resizeCtx.imageSmoothingEnabled = true;
        resizeCtx.imageSmoothingQuality = 'high';
        resizeCtx.drawImage(exportCanvas, 0, 0, finalWidth, finalHeight);

        finalImageData = resizeCanvas.toDataURL('image/jpeg', 0.95);
      } else {
        finalImageData = exportCanvas.toDataURL('image/png');
      }

      // Step 4: Send to main process
      const result = await window.electronAPI.exportPdf({
        imageDataUrl: finalImageData,
        width: finalWidth,
        height: finalHeight,
        originalWidth: img.width,
        originalHeight: img.height
      });

      hideLoader();

      if (result.success) {
        console.log('PDF exported successfully!');
      } else {
        console.log('PDF export cancelled or failed.');
      }
    } catch (error) {
      hideLoader();
      console.error('PDF export error:', error);
      await window.electronAPI.showErrorDialog('Error creating PDF: ' + error.message);
    }
  }, 0);
});

cancelNoteButton.addEventListener('click', () => {
  closeNoteModal();
  activePin = null;
});

function getCanvasCoordinates(e) {
  const rect = imageCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - originX) / scale,
    y: (e.clientY - rect.top - originY) / scale
  };
}

function getPinAtPosition(x, y) {
  return pins.find(pin => {
    const dx = pin.x - x;
    const dy = pin.y - y;
    return Math.sqrt(dx * dx + dy * dy) < 10;
  });
}

function showHoverTooltip(x, y, text) {
  hoverTooltip.hidden = false;
  hoverTooltip.style.left = `${x + 10}px`;
  hoverTooltip.style.top = `${y + 10}px`;
  hoverTooltip.textContent = text;
}

function hideHoverTooltip() {
  hoverTooltip.hidden = true;
}

function openNoteModal() {
  noteTitleInput.value = activePin.title;
  noteDescriptionInput.value = activePin.description;
  pinTagInput.value = activePin.tag || 'default';
  modalOverlay.classList.add('active');
}

function closeNoteModal() {
  modalOverlay.classList.remove('active');
}

function drawImage(showLabels = false) {
  ctx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  ctx.save();
  ctx.translate(originX, originY);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  // Draw pins
  pins.forEach(pin => {
    const matchesSearch = pin.title.toLowerCase().includes(searchQuery) ||
      pin.description.toLowerCase().includes(searchQuery);

    if (searchQuery === '' || matchesSearch) {
      drawPin(pin.x, pin.y, true, showLabels ? pin.title : null, pin.tag);
    } else {
      drawPin(pin.x, pin.y, false, showLabels ? pin.title : null, pin.tag);
    }
  });


  ctx.restore();
}

function drawPin(x, y, highlight = true, label = null, tag = 'default') {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);

  if (highlight) {
    ctx.fillStyle = getColorByTag(tag);
  } else {
    ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
  }

  ctx.fill();
  ctx.stroke();

  if (label) {
    ctx.font = "14px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(label, x + 10, y - 10);
  }
}

function renderNotesSidebar() {
  // Clear everything except the header
  const header = document.getElementById('notesHeader');
  notesPanel.innerHTML = '';
  notesPanel.appendChild(header);

  // Group pins by tag
  const groups = {};
  pins.forEach(pin => {
    if (!groups[pin.tag]) {
      groups[pin.tag] = [];
    }
    groups[pin.tag].push(pin);
  });

  // For each group
  for (const tag in groups) {
    const title = document.createElement('div');
    title.className = 'note-group-title';
    title.textContent = capitalizeTag(tag);
    notesPanel.appendChild(title);

    groups[tag].forEach(pin => {
      const item = document.createElement('div');
      item.className = 'note-item';
      item.textContent = pin.title || 'Untitled Note';
      notesPanel.appendChild(item);
    });
  }
}

// Helper to capitalize first letter
function capitalizeTag(tag) {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function openDeleteModal() {
  deleteModalOverlay.classList.add('active');
}

function closeDeleteModal() {
  deleteModalOverlay.classList.remove('active');
}

function showLoader() {
  loaderOverlay.hidden = false;
  loaderOverlay.style.display = 'flex';
}

function hideLoader() {
  loaderOverlay.hidden = true;
  loaderOverlay.style.display = 'none';
}

// Add this helper function to app.js to convert CSS colors to RGB for PDF
function getColorRgbByTag(tag) {
  const hexColor = getColorByTag(tag);
  // Convert hex to RGB values for PDF
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return { r, g, b };
}

// Make sure your getColorByTag function returns hex colors
function getColorByTag(tag) {
  switch (tag) {
    case 'important': return '#f97316'; // orange
    case 'warning': return '#eab308';   // yellow
    case 'info': return '#3b82f6';      // blue
    default: return '#ef4444';          // red (default)
  }
}