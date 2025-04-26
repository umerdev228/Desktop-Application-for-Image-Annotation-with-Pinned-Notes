// app.js

const uploadButton = document.getElementById('uploadButton');
const imageCanvas = document.getElementById('imageCanvas');
const ctx = imageCanvas.getContext('2d');
const noteTitleInput = document.getElementById('noteTitle');
const noteDescriptionInput = document.getElementById('noteDescription');
const saveNoteButton = document.getElementById('saveNote');
const hoverTooltip = document.getElementById('hoverTooltip');
const saveButton = document.getElementById('saveSession');
const loadButton = document.getElementById('loadSession');
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
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'bmp'];
    const fileExtension = filePath.split('.').pop().toLowerCase();

    if (allowedExtensions.includes(fileExtension)) {
      img.src = filePath;
    } else {
      await window.electronAPI.showErrorDialog('Invalid file type! Please select a JPG, PNG, JPEG, or BMP image.');
    }
  }
});


img.onload = () => {
  scale = 1;
  originX = 0;
  originY = 0;
  pins = [];
  drawImage();
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
  isDragging = true;
  dragged = false;
  startX = e.offsetX - originX;
  startY = e.offsetY - originY;

  // Record mouse down position
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
});

imageCanvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return; // Only left-click

  const distance = Math.sqrt((e.clientX - mouseDownX) ** 2 + (e.clientY - mouseDownY) ** 2);

  if (distance < 5) { // 🔥 Treat as real click
    const mouse = getCanvasCoordinates(e);
    const clickedPin = getPinAtPosition(mouse.x, mouse.y);

    if (clickedPin) {
      activePin = clickedPin;
    } else {
      activePin = { x: mouse.x, y: mouse.y, title: '', description: '', tag: 'default' };
    }
    openNoteModal();
  }

  isDragging = false;
});

imageCanvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const moveX = Math.abs(e.offsetX - (startX + originX));
    const moveY = Math.abs(e.offsetY - (startY + originY));

    if (moveX > 5 || moveY > 5) {
      dragged = true; // if moved more than 5px, consider dragging
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

imageCanvas.addEventListener('click', (e) => {
  if (isDragging) return;

  const mouse = getCanvasCoordinates(e);
  const clickedPin = getPinAtPosition(mouse.x, mouse.y);

  if (clickedPin) {
    activePin = clickedPin;
  } else {
    activePin = { x: mouse.x, y: mouse.y, title: '', description: '' };
  }
  openNoteModal();
});

imageCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

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

cancelNoteButton.addEventListener('click', () => {
  activePin = null;
  closeNoteModal();
});

saveButton.addEventListener('click', async () => {
  if (!currentImagePath) {
    alert('Please upload an image first.');
    return;
  }

  const sessionData = {
    imagePath: currentImagePath,
    pins: pins
  };

  const result = await window.electronAPI.saveSession(sessionData);

  if (result.success) {
    alert('Session saved successfully!');
  } else {
    alert('Session save cancelled.');
  }
});

loadButton.addEventListener('click', async () => {
  const session = await window.electronAPI.loadSession();

  if (session) {
    img.src = session.imagePath;
    currentImagePath = session.imagePath;
    pins = session.pins || [];

    img.onload = () => {
      scale = 1;
      originX = 0;
      originY = 0;
      drawImage();
    };
  } else {
    alert('No session loaded.');
  }
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

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = img.width;
  exportCanvas.height = img.height;
  const exportCtx = exportCanvas.getContext('2d');

  exportCtx.drawImage(img, 0, 0);

  pins.forEach(pin => {
    exportCtx.beginPath();
    exportCtx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);

    // ✨ Use dynamic color based on tag
    exportCtx.fillStyle = getColorByTag(pin.tag);
    exportCtx.fill();
    exportCtx.stroke();

    // Draw title
    if (pin.title) {
      exportCtx.font = "24px Arial";
      exportCtx.fillStyle = "black";
      exportCtx.fillText(pin.title, pin.x + 12, pin.y - 12);
    }
  });

  const dataURL = exportCanvas.toDataURL('image/png');

  const result = await window.electronAPI.saveImage(dataURL);

  if (result.success) {
    console.log('Image exported successfully!');
  } else {
    console.log('Image export cancelled.');
  }
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

function getColorByTag(tag) {
  switch (tag) {
    case 'important': return '#f97316'; // orange
    case 'warning': return '#eab308';   // yellow
    case 'info': return '#3b82f6';       // blue
    default: return '#ef4444';           // red (default)
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
