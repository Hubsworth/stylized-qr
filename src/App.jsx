import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import qrcode from 'qrcode-generator';
import { Download, QrCode, Globe, Check, Image as ImageIcon, X, Circle, Square, MoveHorizontal, MoveVertical, Search } from 'lucide-react';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [fgColor, setFgColor] = useState('#1e293b');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [qrStyle, setQrStyle] = useState('dots'); // 'squares', 'dots', 'classic-dots'
  const [isCircular, setIsCircular] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoScale, setLogoScale] = useState(0.22);
  const [logoZoom, setLogoZoom] = useState(1.0);
  const [logoX, setLogoX] = useState(0);
  const [logoY, setLogoY] = useState(0);
  const [isCircularLogo, setIsCircularLogo] = useState(true);
  const qrRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        setLogo(re.target.result);
        setLogoScale(0.22);
        setLogoZoom(1.0);
        setLogoX(0);
        setLogoY(0);
      };
      reader.readAsDataURL(file);
    }
  };

  const qrMatrix = useMemo(() => {
    if (!url) return null;
    try {
      const qr = qrcode(0, 'H');
      qr.addData(url);
      qr.make();
      const count = qr.getModuleCount();
      const matrix = [];
      for (let r = 0; r < count; r++) {
        const row = [];
        for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
        matrix.push(row);
      }
      return matrix;
    } catch (e) { return null; }
  }, [url]);

  const finalMatrix = useMemo(() => {
    if (!qrMatrix) return null;
    const qrSize = qrMatrix.length;
    const qrCenter = (qrSize - 1) / 2;
    const radius = Math.sqrt(Math.pow(qrCenter, 2) + Math.pow(qrCenter, 2)) + 0.5;
    const padding = isCircular ? Math.ceil(radius - qrCenter) + 1 : 0;
    const size = qrSize + padding * 2;
    const center = (size - 1) / 2;

    // Window area (the hole)
    const logoCells = Math.floor(qrSize * logoScale);
    const logoStart = Math.floor(center - logoCells / 2);
    const logoEnd = logoStart + logoCells;

    const matrix = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const qrR = r - padding;
        const qrC = c - padding;
        const isInsideQR = qrR >= 0 && qrR < qrSize && qrC >= 0 && qrC < qrSize;

        let isInsideLogo = false;
        if (logo) {
          if (isCircularLogo) {
            const distLogo = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
            isInsideLogo = distLogo < (logoCells / 2) + 0.2;
          } else {
            isInsideLogo = r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd;
          }
        }

        // Quiet Zone around eyes (crucial for scannability)
        const q = size;
        const p = padding;
        const isQuietTL = r >= p - 1 && r < p + 8 && c >= p - 1 && c < p + 8;
        const isQuietTR = r >= p - 1 && r < p + 8 && c >= q - p - 8 && c < q - p + 1;
        const isQuietBL = r >= q - p - 8 && r < q - p + 1 && c >= p - 1 && c < p + 8;
        const isQuietZone = isQuietTL || isQuietTR || isQuietBL;

        if (isInsideLogo) {
          row.push({ isDark: false, type: 'logo-hole' });
        } else if (isQuietZone) {
          row.push({ isDark: false, type: 'quiet-zone' });
        } else if (isInsideQR) {
          row.push({ isDark: qrMatrix[qrR][qrC], type: 'qr' });
        } else if (isCircular) {
          const dist = Math.sqrt(Math.pow(r + 0.5 - (center + 0.5), 2) + Math.pow(c + 0.5 - (center + 0.5), 2));
          if (dist <= radius) {
            let charSum = 0;
            for (let i = 0; i < url.length; i++) charSum = (charSum * 31 + url.charCodeAt(i)) & 0xFFFFFFFF;
            let h = (r * 12345 + c * 67891 + charSum) >>> 0;
            h ^= h >>> 16;
            h = Math.imul(h, 0x85ebca6b);
            h ^= h >>> 13;
            h = Math.imul(h, 0xc2b2ae35);
            h ^= h >>> 16;
            const isDark = (h % 100) < 30;
            row.push({ isDark, type: 'junk' });
          } else {
            row.push(null);
          }
        } else {
          row.push(null);
        }
      }
      matrix.push(row);
    }
    return { matrix, padding, radius, logoCells, logoStart, center };
  }, [qrMatrix, isCircular, url, logo, logoScale, isCircularLogo]);

  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const outputSize = 2000;
    canvas.width = outputSize;
    canvas.height = outputSize;

    img.onload = () => {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.drawImage(img, 0, 0, outputSize, outputSize);
      const downloadLink = document.createElement("a");
      downloadLink.href = canvas.toDataURL("image/png");
      downloadLink.download = `qr_${Date.now()}.png`;
      downloadLink.click();
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 2000);
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [bgColor]);

  const renderEye = (r, c, qrStyle, fgColor) => {
    const rxOuter = qrStyle === 'squares' ? 0 : (qrStyle === 'dots' ? 2.5 : 1.2);
    const rxInner = qrStyle === 'squares' ? 0 : (qrStyle === 'dots' ? 1.5 : 0.8);
    return [
      <rect key={`eye-out-${r}-${c}`} x={c + 0.5} y={r + 0.5} width={6} height={6} rx={rxOuter} fill="none" stroke={fgColor} strokeWidth={1} />,
      <rect key={`eye-in-${r}-${c}`} x={c + 2} y={r + 2} width={3} height={3} rx={rxInner} fill={fgColor} />
    ];
  };

  return (
    <div className="app-container">
      <div className="glass-panel generator-card">
        <div className="main-layout">
          <div>
            <h1 className="title">Stylized QR Code Generator</h1>
          </div>
          <div className="input-group">
            <label className="glass-label">Enter URL or Text</label>
            <input type="text" className="glass-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            <div className="input-group">
              <label className="glass-label">QR Style</label>
              <select className="glass-input" value={qrStyle} onChange={(e) => setQrStyle(e.target.value)}>
                <option value="squares">Sharp Squares</option>
                <option value="dots">Bolder Dots</option>
                <option value="classic-dots">Classic Dots</option>
              </select>
            </div>
            <div className="input-group">
              <label className="glass-label">Logo Overlay</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="glass-button" style={{ flex: 1, justifyContent: 'center' }} onClick={() => fileInputRef.current.click()}>
                  <ImageIcon size={18} /> {logo ? 'Change' : 'Upload'}
                </button>
                {logo && (
                  <button className="glass-button" style={{ padding: '0.75rem' }} onClick={() => setLogo(null)}>
                    <X size={18} />
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleLogoUpload} />
            </div>
          </div>

          {logo && (
            <div className="glass-sub-panel" style={{ marginTop: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div className="input-group">
                  <label className="glass-label">Window Size</label>
                  <input type="range" min="0.1" max="0.35" step="0.01" className="glass-input" value={logoScale} onChange={(e) => setLogoScale(parseFloat(e.target.value))} style={{ height: '0.5rem', padding: '0' }} />
                </div>
                <div className="input-group">
                  <label className="glass-label">Shape</label>
                  <button className="glass-button" onClick={() => setIsCircularLogo(!isCircularLogo)} style={{ padding: '0.65rem' }}>{isCircularLogo ? <Circle size={18} /> : <Square size={18} />}</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div className="input-group">
                  <label className="glass-label"><Search size={12} /> Zoom</label>
                  <input type="range" min="0.5" max="2.0" step="0.05" className="glass-input" value={logoZoom} onChange={(e) => setLogoZoom(parseFloat(e.target.value))} style={{ height: '0.5rem', padding: '0' }} />
                </div>
                <div className="input-group">
                  <label className="glass-label"><MoveHorizontal size={12} /> Offset X</label>
                  <input type="range" min="-5" max="5" step="0.1" className="glass-input" value={logoX} onChange={(e) => setLogoX(parseFloat(e.target.value))} style={{ height: '0.5rem', padding: '0' }} />
                </div>
                <div className="input-group">
                  <label className="glass-label"><MoveVertical size={12} /> Offset Y</label>
                  <input type="range" min="-5" max="5" step="0.1" className="glass-input" value={logoY} onChange={(e) => setLogoY(parseFloat(e.target.value))} style={{ height: '0.5rem', padding: '0' }} />
                </div>
              </div>
            </div>
          )}

          <div className="input-group" style={{ marginTop: '0.75rem' }}>
            <label className="glass-label">Circular Frame</label>
            <button className={`glass-button ${isCircular ? 'active-mode' : ''}`} style={{ width: '100%', justifyContent: 'center', backgroundColor: isCircular ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.2)' }} onClick={() => setIsCircular(!isCircular)}>
              <Globe size={18} /> {isCircular ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="color-pickers">
            <div className="color-picker-group"><label className="glass-label">Foreground Color</label><div className="color-input-wrapper"><input type="color" className="color-input" value={fgColor} onChange={(e) => setFgColor(e.target.value)} /><div className="color-display" style={{ backgroundColor: fgColor, color: bgColor }}>{fgColor}</div></div></div>
            <div className="color-picker-group"><label className="glass-label">Background Color</label><div className="color-input-wrapper"><input type="color" className="color-input" value={bgColor} onChange={(e) => setBgColor(e.target.value)} /><div className="color-display" style={{ backgroundColor: bgColor, color: fgColor }}>{bgColor}</div></div></div>
          </div>
        </div>

        <div className="qr-section">
          <div className="qr-wrapper" style={{ backgroundColor: bgColor, minWidth: '320px', minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
            <div ref={qrRef} style={{ display: url ? 'block' : 'none', width: '320px', height: '320px' }}>
              {finalMatrix && (
                <svg viewBox={`-0.5 -0.5 ${finalMatrix.matrix.length + 1} ${finalMatrix.matrix.length + 1}`} style={{ width: '100%', height: '100%', shapeRendering: 'geometricPrecision' }}>
                  <defs>
                    <clipPath id="logo-clip">
                      {isCircularLogo ? (
                        finalMatrix.matrix.map((row, r) => row.map((cell, c) => (cell?.type === 'logo-hole') ? <rect key={`clip-${r}-${c}`} x={c} y={r} width={1.05} height={1.05} /> : null))
                      ) : (
                        <rect x={finalMatrix.logoStart} y={finalMatrix.logoStart} width={finalMatrix.logoCells} height={finalMatrix.logoCells} />
                      )}
                    </clipPath>
                  </defs>
                  {finalMatrix.matrix.map((row, r) => row.map((cell, c) => {
                    if (cell === null) return null;
                    const q = finalMatrix.matrix.length;
                    const p = finalMatrix.padding;
                    const isEyeTL = r >= p && r < p + 7 && c >= p && c < p + 7;
                    const isEyeTR = r >= p && r < p + 7 && c >= q - p - 7 && c < q - p;
                    const isEyeBL = r >= q - p - 7 && r < q - p && c >= p && c < p + 7;
                    if (isEyeTL || isEyeTR || isEyeBL) return null;
                    if (qrStyle === 'squares') {
                      return cell.isDark ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fgColor} /> : null;
                    } else {
                      const radius = qrStyle === 'dots' ? 0.48 : 0.4;
                      return cell.isDark ? <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={radius} fill={fgColor} /> : null;
                    }
                  }))}
                  {(() => {
                    const q = finalMatrix.matrix.length;
                    const p = finalMatrix.padding;
                    return [renderEye(p, p, qrStyle, fgColor), renderEye(p, q - p - 7, qrStyle, fgColor), renderEye(q - p - 7, p, qrStyle, fgColor)];
                  })()}
                  {logo && (
                    <image
                      href={logo}
                      x={finalMatrix.logoStart + logoX - (finalMatrix.logoCells * (logoZoom - 1)) / 2}
                      y={finalMatrix.logoStart + logoY - (finalMatrix.logoCells * (logoZoom - 1)) / 2}
                      width={finalMatrix.logoCells * logoZoom}
                      height={finalMatrix.logoCells * logoZoom}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath="url(#logo-clip)"
                    />
                  )}
                </svg>
              )}
            </div>
            {!url && <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}><QrCode size={64} color={fgColor} /><p className="placeholder-text" style={{ color: fgColor }}>Enter data to preview</p></div>}
          </div>
          <button className="glass-button download-btn" onClick={handleDownload} disabled={!url} style={{ opacity: url ? 1 : 0.5, cursor: url ? 'pointer' : 'not-allowed', marginTop: '1.5rem', minWidth: '220px', justifyContent: 'center' }}>
            {isDownloaded ? <Check size={20} /> : <Download size={20} />} {isDownloaded ? 'Downloaded!' : 'Download High-Res PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
