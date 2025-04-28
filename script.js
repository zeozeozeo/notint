const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const originalPreview = document.getElementById("original-preview");
const processedPreview = document.getElementById("processed-preview");
const imageCanvas = document.getElementById("image-canvas");
const resultsArea = document.getElementById("results-area");
const downloadBtn = document.getElementById("download-btn");
const errorMessage = document.getElementById("error-message");
const processingIndicator = document.getElementById("processing-indicator");
const brightnessSlider = document.getElementById("brightness-slider");
const brightnessValueSpan = document.getElementById("brightness-value");
const medianFilterToggle = document.getElementById("median-filter-toggle");
const ctx = imageCanvas.getContext("2d");

let currentOriginalImage = null;

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropArea.addEventListener(eventName, highlight, false);
});

["dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

document.addEventListener("paste", handlePaste, false);

// dropped files
dropArea.addEventListener("drop", handleDrop, false);

// file selection via click
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect, false);
dropArea.addEventListener("click", () => fileInput.click());

// control listeners
brightnessSlider.addEventListener("change", handleBrightnessChange);
brightnessSlider.addEventListener("input", handleBrightnessInput);
medianFilterToggle.addEventListener("change", handleMedianFilterChange);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropArea.classList.add("highlight");
}

function unhighlight() {
  dropArea.classList.remove("highlight");
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

function handleFileSelect(e) {
  handleFiles(e.target.files);
  e.target.value = null;
}

function handlePaste(e) {
  if (e.clipboardData && e.clipboardData.items) {
    const items = e.clipboardData.items;
    let imageFile = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
        imageFile = items[i].getAsFile();
        break;
      }
    }
    if (imageFile) {
      preventDefaults(e);
      handleFiles([imageFile]);
    }
  }
}

function handleFiles(files) {
  hideError();
  if (files.length > 1) {
    showError("please upload only one image at a time.");
    return;
  }
  const file = files[0];
  if (!file || !file.type.startsWith("image/")) {
    showError("invalid file type. please upload an image.");
    return;
  }

  // processing indicator
  resultsArea.classList.add("hidden");
  processingIndicator.classList.remove("hidden");

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      currentOriginalImage = img;
      try {
        processImage(currentOriginalImage);
        processingIndicator.classList.add("hidden");
        resultsArea.classList.remove("hidden");
      } catch (error) {
        console.error("error processing image:", error);
        showError("an error occurred during image processing.");
        processingIndicator.classList.add("hidden");
      }
    };
    img.onerror = function () {
      showError("could not load the image file.");
      processingIndicator.classList.add("hidden");
    };
    img.src = e.target.result;
    originalPreview.src = e.target.result;
  };
  reader.onerror = function () {
    showError("could not read the file.");
    processingIndicator.classList.add("hidden");
  };
  reader.readAsDataURL(file);
}

function processImage(img) {
  imageCanvas.width = img.naturalWidth || img.width;
  imageCanvas.height = img.naturalHeight || img.height;

  ctx.drawImage(img, 0, 0);

  let imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
  let data = imageData.data;
  const width = imageCanvas.width;
  const height = imageCanvas.height;

  const brightness = parseFloat(brightnessSlider.value);
  const scaleR = 0.9 + brightness;
  const scaleG = 1.05 + brightness;
  const scaleB = 1.5 + brightness;

  let originalPixelData;
  if (!img.originalData) {
    const currentImageData = ctx.getImageData(0, 0, width, height);
    img.originalData = new Uint8ClampedArray(currentImageData.data);
    originalPixelData = img.originalData;
  } else {
    originalPixelData = img.originalData;
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = originalPixelData[i] * scaleR;
    data[i + 1] = originalPixelData[i + 1] * scaleG;
    data[i + 2] = originalPixelData[i + 2] * scaleB;
    data[i + 3] = originalPixelData[i + 3];
  }

  if (medianFilterToggle.checked) {
    const dataCopy = new Uint8ClampedArray(data);
    const radius = 1;
    const kernelSize = (2 * radius + 1) * (2 * radius + 1);

    const getIndex = (x, y) => (y * width + x) * 4;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rValues = [];
        const gValues = [];
        const bValues = [];

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = Math.max(0, Math.min(width - 1, x + kx));
            const ny = Math.max(0, Math.min(height - 1, y + ky));
            const neighborIndex = getIndex(nx, ny);

            rValues.push(dataCopy[neighborIndex]);
            gValues.push(dataCopy[neighborIndex + 1]);
            bValues.push(dataCopy[neighborIndex + 2]);
          }
        }

        // find median
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);

        const medianIndex = Math.floor(kernelSize / 2);
        const centerIndex = getIndex(x, y);

        // update with median
        data[centerIndex] = rValues[medianIndex];
        data[centerIndex + 1] = gValues[medianIndex];
        data[centerIndex + 2] = bValues[medianIndex];
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // export
  const processedDataUrl = imageCanvas.toDataURL("image/png");
  processedPreview.src = processedDataUrl;
  downloadBtn.href = processedDataUrl;
  downloadBtn.download = "notint.png";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  errorMessage.classList.add("hidden");
  errorMessage.textContent = "";
}

// control handlers

function handleBrightnessChange(e) {
  const brightness = parseFloat(e.target.value);
  brightnessValueSpan.textContent = brightness.toFixed(2);
  reprocessImage();
}

function handleBrightnessInput(e) {
  const brightness = parseFloat(e.target.value);
  brightnessValueSpan.textContent = brightness.toFixed(2);
}

function handleMedianFilterChange() {
  reprocessImage();
}

function reprocessImage() {
  if (currentOriginalImage) {
    processingIndicator.classList.remove("hidden");
    setTimeout(() => {
      try {
        processImage(currentOriginalImage);
      } catch (error) {
        console.error("Error reprocessing image:", error);
        showError("an error occurred during reprocessing.");
      } finally {
        processingIndicator.classList.add("hidden");
      }
    }, 10);
  }
}
