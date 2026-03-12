    // DOM Elements
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const resultDiv = document.getElementById('result');
    const rawText = document.getElementById('rawText');
    const qrType = document.getElementById('qrType');
    const ssidText = document.getElementById('ssidText');
    const passwordText = document.getElementById('passwordText');
    const wifiSection = document.getElementById('wifiSection');
    const assetSection = document.getElementById('assetSection');
    const uidField = document.getElementById('uidField');
    const uidText = document.getElementById('uidText');
    const macText = document.getElementById('macText');
    const macField = document.getElementById('macField');
    const macLabel = document.getElementById('macLabel');
    const copyRawBtn = document.getElementById('copyRawBtn');
    const copySsidBtn = document.getElementById('copySsidBtn');
    const copyPassBtn = document.getElementById('copyPassBtn');
    const copyUidBtn = document.getElementById('copyUidBtn');
    const copyMacBtn = document.getElementById('copyMacBtn');
    const infoMsg = document.getElementById('infoMsg');
    const manualInput = document.getElementById('manualInput');
    const parseBtn = document.getElementById('parseBtn');
    const statusDiv = document.getElementById('status');
    const instructionsDiv = document.querySelector('.instructions'); 

    // Show status message
    function showStatus(message, type = 'loading') {
      statusDiv.textContent = message;
      statusDiv.className = 'status ' + type;
    }

    function hideStatus() {
      statusDiv.className = 'status';
    }

    // Apply binary threshold to image
    function applyThreshold(canvas, threshold = 128) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const value = gray < threshold ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = value;
      }
      
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    }

    // Resize image if too large
    function resizeImage(img, maxWidth = 1000) {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      return canvas;
    }

    // Crop a region of the canvas
    function cropCanvas(canvas, x, y, width, height) {
      const cropped = document.createElement('canvas');
      cropped.width = width;
      cropped.height = height;
      const ctx = cropped.getContext('2d');
      ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      return cropped;
    }

    // Handle image upload
    function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      showStatus('Loading image...', 'loading');

      const reader = new FileReader();
      reader.onload = e => {
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
        resultDiv.style.display = 'none';

        detectQRInImage(e.target.result);
      };
      reader.onerror = () => {
        showStatus('Error reading file', 'error');
      };
      reader.readAsDataURL(file);
    }

    // Detect QR in uploaded image with improved detection
    function detectQRInImage(src) {
      const img = new Image();
      img.onload = () => {
        showStatus('Scanning image...', 'loading');
        
        let result = null;
        const attempts = [];

        // Create base canvas
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = img.width;
        baseCanvas.height = img.height;
        const baseCtx = baseCanvas.getContext('2d');
        baseCtx.drawImage(img, 0, 0);

        // Strategy 1: Try full image at different scales
        const scales = [1.0, 0.75, 0.5, 0.25, 1.5, 2.0];
        for (const scale of scales) {
          if (result) break;
          const scaled = document.createElement('canvas');
          scaled.width = Math.round(img.width * scale);
          scaled.height = Math.round(img.height * scale);
          const ctx = scaled.getContext('2d');
          ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
          result = scanCanvas(scaled);
          if (result) attempts.push(`Full image at ${scale}x scale`);
        }

        // Strategy 2: Try with binary threshold
        if (!result) {
          const thresholds = [100, 128, 150, 180];
          for (const thresh of thresholds) {
            if (result) break;
            const thresholded = document.createElement('canvas');
            thresholded.width = img.width;
            thresholded.height = img.height;
            thresholded.getContext('2d').drawImage(img, 0, 0);
            applyThreshold(thresholded, thresh);
            result = scanCanvas(thresholded);
            if (result) attempts.push(`Threshold ${thresh}`);
          }
        }

        // Strategy 3: Try aggressive cropping - focus on bottom 2/3 of image (where QR code likely is)
        if (!result) {
          const cropRegions = [
            // Focus on bottom portion where QR code usually is
            { x: 0, y: 0.2, w: 1, h: 0.8 },
            { x: 0, y: 0.25, w: 1, h: 0.75 },
            { x: 0, y: 0.3, w: 1, h: 0.7 },
            { x: 0.05, y: 0.25, w: 0.9, h: 0.7 },
            { x: 0.1, y: 0.3, w: 0.8, h: 0.6 },
            // Center regions
            { x: 0.1, y: 0.2, w: 0.8, h: 0.7 },
            { x: 0.15, y: 0.25, w: 0.7, h: 0.65 },
            { x: 0.2, y: 0.3, w: 0.6, h: 0.6 },
            // Try smaller center regions
            { x: 0.25, y: 0.35, w: 0.5, h: 0.5 },
            { x: 0.2, y: 0.3, w: 0.6, h: 0.55 },
          ];

          for (const region of cropRegions) {
            if (result) break;
            const cropX = Math.round(img.width * region.x);
            const cropY = Math.round(img.height * region.y);
            const cropW = Math.round(img.width * region.w);
            const cropH = Math.round(img.height * region.h);
            
            if (cropW > 100 && cropH > 100) {
              const cropped = cropCanvas(baseCanvas, cropX, cropY, cropW, cropH);
              result = scanCanvas(cropped);
              if (result) attempts.push(`Crop (${Math.round(region.x*100)}%, ${Math.round(region.y*100)}%)`);
            }
          }
        }

        // Strategy 4: Try threshold + crop combinations
        if (!result) {
          const keyRegions = [
            { x: 0, y: 0.25, w: 1, h: 0.75 },
            { x: 0, y: 0.3, w: 1, h: 0.7 },
            { x: 0.1, y: 0.3, w: 0.8, h: 0.6 },
          ];

          for (const region of keyRegions) {
            if (result) break;
            const cropX = Math.round(img.width * region.x);
            const cropY = Math.round(img.height * region.y);
            const cropW = Math.round(img.width * region.w);
            const cropH = Math.round(img.height * region.h);
            
            const cropped = cropCanvas(baseCanvas, cropX, cropY, cropW, cropH);
            
            // Try different thresholds on the cropped region
            const thresholds = [100, 128, 150];
            for (const thresh of thresholds) {
              if (result) break;
              const thresholded = document.createElement('canvas');
              thresholded.width = cropped.width;
              thresholded.height = cropped.height;
              thresholded.getContext('2d').drawImage(cropped, 0, 0);
              applyThreshold(thresholded, thresh);
              result = scanCanvas(thresholded);
              if (result) attempts.push(`Threshold ${thresh} + crop`);
            }
          }
        }

        // Strategy 5: Try scaled + threshold combinations
        if (!result) {
          const testScales = [0.5, 0.75, 1.0];
          const testThresholds = [100, 128, 150];
          
          for (const scale of testScales) {
            if (result) break;
            for (const thresh of testThresholds) {
              if (result) break;
              const scaled = document.createElement('canvas');
              scaled.width = Math.round(img.width * scale);
              scaled.height = Math.round(img.height * scale);
              scaled.getContext('2d').drawImage(img, 0, 0, scaled.width, scaled.height);
              applyThreshold(scaled, thresh);
              result = scanCanvas(scaled);
              if (result) attempts.push(`Scale ${scale}x + threshold ${thresh}`);
            }
          }
        }

        if (result) {
          hideStatus();
          console.log('QR detected using:', attempts);
          showStatus('✅ QR code detected successfully!', 'success');
          processQRContent(result.data);
                  
            // Hide instructions after image is loaded ← ADD THIS LINE
          if (instructionsDiv) {
            instructionsDiv.style.display = 'none';
          }

        } else {
          showStatus('❌ No QR code found. Try cropping the image to show only the QR code.', 'error');
        }
      };
      img.onerror = () => {
        showStatus('Error loading image', 'error');
      };
      img.src = src;
    }

    // Scan canvas for QR code
    function scanCanvas(canvas) {
      try {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(imageData.data, canvas.width, canvas.height);
      } catch (err) {
        console.error('Scan error:', err);
        return null;
      }
    }

    // Process scanned QR content
    function processQRContent(text) {
      rawText.textContent = text;
      resultDiv.style.display = 'block';
      
      // Hide all sections first
      wifiSection.style.display = 'none';
      assetSection.style.display = 'none';
      copySsidBtn.style.display = 'none';
      copyPassBtn.style.display = 'none';
      copyUidBtn.style.display = 'none';
      copyMacBtn.style.display = 'none';
      infoMsg.textContent = '';

      // Try to parse as Wi-Fi QR
      if (parseWiFiQR(text)) {
        qrType.textContent = 'Wi-Fi Network';
        return;
      }

      // Try to parse as Asset Tag (Recorder or Standalone Camera)
      if (parseAssetTag(text)) {
        // qrType is already set inside parseAssetTag
        return;
      }

      // Default: plain text or URL
      qrType.textContent = 'Plain Text';
      if (text.startsWith('http://') || text.startsWith('https://')) {
        infoMsg.textContent = 'This is a URL. Click the link below to visit.';
        rawText.innerHTML = `<a href="${text}" target="_blank" style="color: #114581;">${text}</a>`;
      } else {
        infoMsg.textContent = 'Plain text content';
      }
    }

    // Parse Wi-Fi QR code
    function parseWiFiQR(text) {
      // Check if it's a WiFi QR code
      if (!text.startsWith('WIFI:')) {
        return false;
      }

      let ssid = '';
      let password = '';
      let security = 'WPA';
      let hidden = 'false';

      // Remove the initial "WIFI:" prefix first
      const content = text.substring(5);
      
      // Split by semicolon and process each field
      const fields = content.split(';');
      
      for (const field of fields) {
        if (field.startsWith('S:')) {
          ssid = field.substring(2);
        } else if (field.startsWith('P:')) {
          password = field.substring(2);
        } else if (field.startsWith('T:')) {
          security = field.substring(2);
        } else if (field.startsWith('H:')) {
          hidden = field.substring(2);
        }
      }

      // Only proceed if we found at least SSID or password
      if (!ssid && !password) {
        return false;
      }

      ssidText.textContent = ssid || '(not specified)';
      passwordText.textContent = password || '(no password)';
      
      wifiSection.style.display = 'block';
      copySsidBtn.style.display = 'inline-block';
      if (password) {
        copyPassBtn.style.display = 'inline-block';
      }

      const securityTypes = {
        'WPA': 'WPA/WPA2',
        'WEP': 'WEP',
        'nopass': 'None',
        '': 'Unknown'
      };
      
      infoMsg.textContent = `Wi-Fi Network: ${ssid} | Security: ${securityTypes[security] || security} | Hidden: ${hidden === 'true' ? 'Yes' : 'No'}`;
      return true;
    }

    // Parse Asset Tag QR code
    function parseAssetTag(text) {
      // Format: NF2FHC8ES4TZU6TL111A,2c6f513b4b28,84
      // UID (20 chars), MAC/Recovery (12 chars), extra data
      const assetRegex = /^([A-Z0-9]{20}),([a-f0-9]{12}),(\d+)$/i;
      const match = text.match(assetRegex);

      if (match) {
        const uid = match[1];
        const macOrRecovery = match[2];
        const extraData = match[3];

        uidText.textContent = uid;
        macText.textContent = `${macOrRecovery} (Recovery Code)`;
        macLabel.textContent = 'MAC Address / Recovery Code';
        
        qrType.textContent = 'Recorder';
        assetSection.style.display = 'block';
        uidField.style.display = 'block';
        macField.style.display = 'block';
        copyUidBtn.style.display = 'inline-block';
        copyMacBtn.style.display = 'inline-block';
        
        infoMsg.textContent = `Recorder with UID, Recovery Code, and identifier: ${extraData}`;
        return true;
      }

      // Format: 2J6RPW31AST18A4F111A (UID only - 20 chars)
      const uidOnlyRegex = /^([A-Z0-9]{20})$/i;
      const uidMatch = text.match(uidOnlyRegex);
      
      if (uidMatch) {
        uidText.textContent = uidMatch[1];
        
        qrType.textContent = 'Recorder';
        assetSection.style.display = 'block';
        uidField.style.display = 'block';
        macField.style.display = 'none';
        copyUidBtn.style.display = 'inline-block';
        copyMacBtn.style.display = 'none';
        
        infoMsg.textContent = 'Recorder UID only (no MAC/Recovery Code)';
        return true;
      }

      // Format: d42c3d518b2b,312 (MAC Address only - 12 chars + comma + numbers)
      const macOnlyRegex = /^([a-f0-9]{12}),(\d+)$/i;
      const macMatch = text.match(macOnlyRegex);
      
      if (macMatch) {
        const macAddress = macMatch[1];
        const extraData = macMatch[2];
        
        macText.textContent = `${macAddress} (Device ID)`;
        macLabel.textContent = 'Device ID / MAC Address';
        
        qrType.textContent = 'Standalone Camera';
        assetSection.style.display = 'block';
        uidField.style.display = 'none';
        macField.style.display = 'block';
        copyUidBtn.style.display = 'none';
        copyMacBtn.style.display = 'inline-block';
        
        infoMsg.textContent = `Standalone Camera Device ID. Extra: ${extraData}`;
        return true;
      }

      return false;
    }

    // Copy to clipboard
    function copyToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          showStatus('✅ Copied to clipboard!', 'success');
          setTimeout(hideStatus, 2000);
        }).catch(err => {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    }

    // Fallback for older browsers
    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showStatus('✅ Copied to clipboard!', 'success');
        setTimeout(hideStatus, 2000);
      } catch (err) {
        showStatus('Failed to copy. Please copy manually.', 'error');
      }
      document.body.removeChild(textarea);
    }

    // Event Listeners
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    copyRawBtn.addEventListener('click', () => copyToClipboard(rawText.textContent));
    copySsidBtn.addEventListener('click', () => copyToClipboard(ssidText.textContent));
    copyPassBtn.addEventListener('click', () => copyToClipboard(passwordText.textContent));
    copyUidBtn.addEventListener('click', () => copyToClipboard(uidText.textContent));
    copyMacBtn.addEventListener('click', () => copyToClipboard(macText.textContent.split(' ')[0]));
    parseBtn.addEventListener('click', () => {
      const text = manualInput.value.trim();
      if (text) {
        processQRContent(text);
      } else {
        showStatus('Please paste QR content first.', 'error');
      }
    });
