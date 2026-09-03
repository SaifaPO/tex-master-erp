// Kreslenie 2D textúry dresu na canvas — portované z 3d_konfigurator_dresov.html.
// Čisté funkcie parametrizované `configState` (pozri dresPresets.js DEFAULT_CONFIG_STATE) —
// žiadny globálny stav, žiadna závislosť na DOM mimo dodaného 2D kontextu.

export function updateJerseyTexture(ctx, canvas, configState) {
  const W = canvas.width;
  const H = canvas.height;
  const halfW = W / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = configState.farby.zakladna;
  ctx.fillRect(0, 0, W, H);

  renderPattern(ctx, 0, 0, halfW, H, false, configState);
  renderPattern(ctx, halfW, 0, halfW, H, true, configState);
  renderSleeves(ctx, W, H, configState);
  renderFrontDetails(ctx, 0, 0, halfW, H, configState);
  renderBackDetails(ctx, halfW, 0, halfW, H, configState);
  renderCollarDecorations(ctx, W, H, configState);
}

function renderPattern(c, x, y, w, h, isBack, configState) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();

  const pType = configState.vzor;
  const pColor = configState.farby.vzor;
  const aColor = configState.farby.akcent;

  if (pType === 'stripes') {
    const num = 7;
    const sW = w / num;
    for (let i = 0; i < num; i++) {
      if (i % 2 === 1) {
        c.fillStyle = pColor;
        c.fillRect(x + i * sW, y, sW, h);
        c.fillStyle = aColor;
        c.fillRect(x + i * sW + sW * 0.85, y, sW * 0.15, h);
      }
    }
  } else if (pType === 'hoops') {
    const num = 8;
    const hH = h / num;
    for (let j = 0; j < num; j++) {
      if (j % 2 === 1) {
        c.fillStyle = pColor;
        c.fillRect(x, y + j * hH, w, hH);
        c.fillStyle = aColor;
        c.fillRect(x, y + j * hH + hH - 12, w, 12);
      }
    }
  } else if (pType === 'sash') {
    c.fillStyle = pColor;
    c.beginPath();
    if (!isBack) {
      c.moveTo(x + w * 0.15, y);
      c.lineTo(x + w * 0.55, y);
      c.lineTo(x + w * 0.95, y + h);
      c.lineTo(x + w * 0.55, y + h);
    } else {
      c.moveTo(x + w * 0.85, y);
      c.lineTo(x + w * 0.45, y);
      c.lineTo(x + w * 0.05, y + h);
      c.lineTo(x + w * 0.45, y + h);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = aColor;
    c.lineWidth = 14;
    c.stroke();
  } else if (pType === 'honeycomb') {
    c.fillStyle = pColor;
    c.strokeStyle = aColor;
    c.lineWidth = 3;
    const hexR = 48;
    const hexH = hexR * Math.sqrt(3);
    for (let hx = x - hexR; hx < x + w + hexR; hx += hexR * 3) {
      for (let hy = y - hexH; hy < y + h + hexH; hy += hexH) {
        drawHex(c, hx, hy, hexR);
        drawHex(c, hx + hexR * 1.5, hy + hexH / 2, hexR);
      }
    }
  } else if (pType === 'chevron') {
    for (let k = 0; k < 6; k++) {
      c.fillStyle = (k % 2 === 0) ? pColor : aColor;
      c.beginPath();
      const cy = y + k * (h / 6) * 0.9;
      c.moveTo(x, cy);
      c.lineTo(x + w / 2, cy + 140);
      c.lineTo(x + w, cy);
      c.lineTo(x + w, cy + 100);
      c.lineTo(x + w / 2, cy + 240);
      c.lineTo(x, cy + 100);
      c.closePath();
      c.fill();
    }
  } else if (pType === 'gradient') {
    const grad = c.createLinearGradient(x, y + h * 0.1, x, y + h * 0.95);
    grad.addColorStop(0, configState.farby.zakladna);
    grad.addColorStop(0.5, pColor);
    grad.addColorStop(1, aColor);
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
  } else if (pType === 'modern') {
    c.fillStyle = pColor;
    for (let b = 0; b < 45; b++) {
      c.fillRect(x + ((b * 137) % (w - 120)), y + ((b * 251) % (h - 80)), 60 + (b % 4) * 40, 15 + (b % 3) * 12);
    }
  } else if (pType === 'camo') {
    c.fillStyle = pColor;
    for (let p = 0; p < 20; p++) {
      c.beginPath();
      c.moveTo(x + ((p * 223) % w), y + ((p * 367) % h));
      c.lineTo(x + ((p * 223) % w) + 120, y + ((p * 367) % h) + 40);
      c.lineTo(x + ((p * 223) % w) + 80, y + ((p * 367) % h) + 160);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

function drawHex(c, cx, cy, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = cx + r * Math.cos(angle);
    const hy = cy + r * Math.sin(angle);
    if (i === 0) c.moveTo(hx, hy);
    else c.lineTo(hx, hy);
  }
  c.closePath();
  c.fill();
  c.stroke();
}

function renderSleeves(c, W, H, configState) {
  c.fillStyle = configState.farby.rukava;
  c.fillRect(0, 0, W * 0.12, H * 0.35);
  c.fillRect(W * 0.88, 0, W * 0.12, H * 0.35);

  c.fillStyle = configState.farby.golier;
  c.fillRect(0, H * 0.32, W * 0.12, H * 0.03);
  c.fillRect(W * 0.88, H * 0.32, W * 0.12, H * 0.03);

  if (configState.loga.zobrazitOdznakRukav) {
    c.save();
    const bX = W * 0.94;
    const bY = H * 0.18;
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(bX, bY, 40, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#020617';
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = '#1e3a8a';
    c.font = 'bold 22px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('PRO', bX, bY - 5);
    c.restore();
  }
}

function renderFrontDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;

  if (configState.loga.zobrazitErb) {
    renderClubCrest(c, x + w * 0.32, y + h * 0.32, 80, configState);
  }

  if (configState.loga.zobrazitBrandLogo) {
    renderBrandLogo(c, x + w * 0.68, y + h * 0.32, configState);
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVpredu && configState.text.cisloHraca) {
    c.save();
    c.font = `bold 110px "${configState.text.fontRodina}", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 14;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.33);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.cisloHraca, centerX, y + h * 0.33);
    c.restore();
  }

  if (configState.text.zobrazitTimText && configState.text.timText) {
    c.save();
    c.font = `800 85px "${configState.text.fontRodina}", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 16;
    c.strokeText(configState.text.timText, centerX, y + h * 0.54);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.timText, centerX, y + h * 0.54);
    c.restore();
  }
}

function renderBackDetails(c, x, y, w, h, configState) {
  const centerX = x + w / 2;

  if (configState.text.zobrazitMeno && configState.text.menoHraca) {
    c.save();
    c.font = `bold 95px "${configState.text.fontRodina}", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 16;
    c.strokeText(configState.text.menoHraca.toUpperCase(), centerX, y + h * 0.28);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.menoHraca.toUpperCase(), centerX, y + h * 0.28);
    c.restore();
  }

  if (configState.text.zobrazitCislo && configState.text.cisloVzadu && configState.text.cisloHraca) {
    c.save();
    c.font = `bold 360px "${configState.text.fontRodina}", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = configState.text.farbaObrysu;
    c.lineWidth = 32;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.fillStyle = configState.text.farbaTextu;
    c.fillText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.strokeStyle = configState.farby.akcent;
    c.lineWidth = 6;
    c.strokeText(configState.text.cisloHraca, centerX, y + h * 0.54);
    c.restore();
  }

  c.save();
  c.font = 'bold 36px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.fillText('CUSTOM MATCH EDITION', centerX, y + h * 0.88);
  c.restore();
}

function renderClubCrest(c, cx, cy, size, configState) {
  c.save();
  if (configState.loga.typErbu === 'custom' && configState.loga.vlastnyErbImg) {
    try {
      c.drawImage(configState.loga.vlastnyErbImg, cx - size / 2, cy - size / 2, size, size);
      c.restore();
      return;
    } catch (e) { /* obrázok sa ešte nenačítal — vykresli sa pri ďalšej aktualizácii */ }
  }

  c.translate(cx, cy);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, -size * 0.5);
  c.lineTo(size * 0.45, -size * 0.35);
  c.lineTo(size * 0.45, size * 0.1);
  c.bezierCurveTo(size * 0.45, size * 0.45, 0, size * 0.65, 0, size * 0.65);
  c.bezierCurveTo(0, size * 0.65, -size * 0.45, size * 0.45, -size * 0.45, size * 0.1);
  c.lineTo(-size * 0.45, -size * 0.35);
  c.closePath();
  c.fill();
  c.strokeStyle = configState.farby.akcent;
  c.lineWidth = 6;
  c.stroke();

  c.fillStyle = configState.farby.vzor;
  c.beginPath();
  c.arc(0, 0, size * 0.28, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#ffffff';
  c.font = `bold ${Math.floor(size * 0.35)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const symbol = configState.loga.typErbu === 'star' ? '⭐' : (configState.loga.typErbu === 'eagle' ? '🦅' : (configState.loga.typErbu === 'crown' ? '👑' : '🛡️'));
  c.fillText(symbol, 0, 0);
  c.restore();
}

function renderBrandLogo(c, cx, cy, configState) {
  c.save();
  c.translate(cx, cy);
  c.fillStyle = configState.text.farbaTextu;
  c.strokeStyle = configState.text.farbaObrysu;
  c.lineWidth = 4;

  if (configState.loga.brandIcon === 'swoosh') {
    c.beginPath();
    c.moveTo(-35, 10);
    c.quadraticCurveTo(5, 25, 40, -20);
    c.quadraticCurveTo(0, 5, -35, 10);
    c.fill();
    c.stroke();
  } else if (configState.loga.brandIcon === 'geometric') {
    c.beginPath();
    c.moveTo(0, -25);
    c.lineTo(25, 0);
    c.lineTo(0, 25);
    c.lineTo(-25, 0);
    c.closePath();
    c.fill();
    c.stroke();
  } else {
    c.font = '900 30px "Chakra Petch", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SPZ', 0, 0);
  }
  c.restore();
}

function renderCollarDecorations(c, W, H, configState) {
  c.fillStyle = configState.farby.golier;
  c.fillRect(W * 0.35, 0, W * 0.3, H * 0.05);
}
