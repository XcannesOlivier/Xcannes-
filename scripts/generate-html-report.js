#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportFile = path.join(__dirname, 'translation-report.json');
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de traductions XCANNES</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      margin-bottom: 10px;
      font-size: 32px;
    }
    .meta {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .card h3 {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .card .value {
      font-size: 36px;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    thead {
      background: #f8f9fa;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e9ecef;
    }
    th {
      font-weight: 600;
      color: #495057;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      font-size: 14px;
    }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s ease;
    }
    .progress-fill.low { background: #dc3545; }
    .progress-fill.medium { background: #ffc107; }
    .progress-fill.high { background: #28a745; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .details {
      margin-top: 40px;
    }
    .lang-detail {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .lang-detail h3 {
      color: #495057;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .missing-keys {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
      margin-top: 15px;
    }
    .key-item {
      background: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #495057;
    }
    .section-title {
      font-size: 24px;
      color: #1a1a1a;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Rapport de traductions XCANNES</h1>
    <div class="meta">
      Généré le ${new Date(report.generated).toLocaleString('fr-FR')}<br>
      Référence: <code>${report.reference.file}</code> (${report.reference.totalKeys} clés)
    </div>

    <div class="summary">
      ${generateSummaryCards(report)}
    </div>

    <h2 class="section-title">Vue d'ensemble</h2>
    <table>
      <thead>
        <tr>
          <th>Langue</th>
          <th>Total</th>
          <th>Manquantes</th>
          <th>Obsolètes</th>
          <th>Complétude</th>
          <th>Progression</th>
        </tr>
      </thead>
      <tbody>
        ${generateTableRows(report)}
      </tbody>
    </table>

    <h2 class="section-title">Détails des traductions incomplètes</h2>
    <div class="details">
      ${generateDetails(report)}
    </div>
  </div>
</body>
</html>`;

function generateSummaryCards(report) {
  const languages = Object.values(report.languages);
  const total = languages.length;
  const complete = languages.filter(l => l.exists && !l.error && l.missing === 0 && l.extra === 0).length;
  const incomplete = languages.filter(l => l.exists && !l.error && (l.missing > 0 || l.extra > 0)).length;
  const errors = languages.filter(l => !l.exists || l.error).length;

  return `
    <div class="card">
      <h3>Total de langues</h3>
      <div class="value">${total}</div>
    </div>
    <div class="card" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
      <h3>Complètes</h3>
      <div class="value">${complete}</div>
    </div>
    <div class="card" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">
      <h3>Incomplètes</h3>
      <div class="value">${incomplete}</div>
    </div>
    <div class="card" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);">
      <h3>Erreurs</h3>
      <div class="value">${errors}</div>
    </div>
  `;
}

function generateTableRows(report) {
  return Object.entries(report.languages)
    .sort((a, b) => {
      const aComp = a[1].exists && !a[1].error ? ((917 - a[1].missing) / 917) : 0;
      const bComp = b[1].exists && !b[1].error ? ((917 - b[1].missing) / 917) : 0;
      return bComp - aComp;
    })
    .map(([lang, data]) => {
      if (!data.exists) {
        return `<tr>
          <td><strong>${lang}</strong></td>
          <td colspan="5"><span class="badge badge-danger">Fichier non trouvé</span></td>
        </tr>`;
      }
      if (data.error) {
        return `<tr>
          <td><strong>${lang}</strong></td>
          <td colspan="5"><span class="badge badge-danger">Erreur: ${data.errorMessage}</span></td>
        </tr>`;
      }

      const completeness = ((917 - data.missing) / 917 * 100).toFixed(1);
      const progressClass = completeness >= 95 ? 'high' : completeness >= 70 ? 'medium' : 'low';
      const badge = completeness === '100.0' && data.extra === 0 ? 'badge-success' : completeness >= 90 ? 'badge-warning' : 'badge-danger';

      return `<tr>
        <td><strong>${lang}</strong></td>
        <td>${data.total}</td>
        <td>${data.missing > 0 ? `<span style="color: #dc3545;">${data.missing}</span>` : '0'}</td>
        <td>${data.extra > 0 ? `<span style="color: #ffc107;">${data.extra}</span>` : '0'}</td>
        <td><span class="badge ${badge}">${completeness}%</span></td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${completeness}%"></div>
          </div>
        </td>
      </tr>`;
    }).join('');
}

function generateDetails(report) {
  const incomplete = Object.entries(report.languages)
    .filter(([_, data]) => data.exists && !data.error && (data.missing > 0 || data.extra > 0))
    .sort((a, b) => b[1].missing - a[1].missing);

  if (incomplete.length === 0) {
    return '<p>Toutes les traductions sont complètes ! 🎉</p>';
  }

  return incomplete.map(([lang, data]) => {
    const completeness = ((917 - data.missing) / 917 * 100).toFixed(1);
    return `
      <div class="lang-detail">
        <h3>
          <span>${lang.toUpperCase()}</span>
          <span style="color: #666; font-size: 14px;">${completeness}% complet</span>
        </h3>
        ${data.missing > 0 ? `
          <div>
            <strong style="color: #dc3545;">⚠️ ${data.missing} clés manquantes:</strong>
            <div class="missing-keys">
              ${data.missingKeys.slice(0, 30).map(key => `<div class="key-item">${key}</div>`).join('')}
            </div>
            ${data.missingKeys.length > 30 ? `<p style="margin-top: 10px; color: #666; font-style: italic;">... et ${data.missingKeys.length - 30} autres clés</p>` : ''}
          </div>
        ` : ''}
        ${data.extra > 0 ? `
          <div style="margin-top: 15px;">
            <strong style="color: #ffc107;">⚠️ ${data.extra} clés obsolètes (à supprimer):</strong>
            <div class="missing-keys">
              ${data.extraKeys.slice(0, 20).map(key => `<div class="key-item">${key}</div>`).join('')}
            </div>
            ${data.extraKeys.length > 20 ? `<p style="margin-top: 10px; color: #666; font-style: italic;">... et ${data.extraKeys.length - 20} autres clés</p>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

const outputPath = path.join(__dirname, 'translation-report.html');
fs.writeFileSync(outputPath, html);

console.log(`✅ Rapport HTML généré: ${outputPath}`);
console.log('   Ouvrez ce fichier dans votre navigateur pour voir le rapport détaillé.');
