import { TestResult } from "./tauri";
import { getScoreColor } from "./ai-scoring";

export function generatePDFReport(
  result: TestResult,
  systemInfo: { cpu: string; gpu: string; ram: string }
): void {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString("vi-VN");
  const timeStr = new Date().toLocaleTimeString("vi-VN");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Laptop Tester Pro - Test Report</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 3px solid #3b82f6;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24pt;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .header .subtitle {
      font-size: 10pt;
      color: #666;
    }
    .score-section {
      text-align: center;
      padding: 30px;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .score-value {
      font-size: 48pt;
      font-weight: bold;
      color: ${getScoreColor(result.score)};
      margin-bottom: 10px;
    }
    .verdict {
      font-size: 18pt;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 5px;
    }
    .recommendation {
      display: inline-block;
      padding: 8px 20px;
      background: ${getScoreColor(result.score)};
      color: white;
      border-radius: 20px;
      font-weight: 600;
      font-size: 12pt;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14pt;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 15px;
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      background: #f9fafb;
      border-radius: 5px;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      font-weight: 600;
      color: #1a1a1a;
      text-align: right;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 15px;
    }
    .metric-card {
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
      text-align: center;
    }
    .metric-label {
      font-size: 9pt;
      color: #666;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-value {
      font-size: 18pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    .metric-unit {
      font-size: 10pt;
      color: #666;
    }
    .explanations {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
    }
    .explanation-item {
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 10pt;
    }
    .explanation-item:last-child {
      border-bottom: none;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    .timestamp {
      margin-top: 10px;
      font-size: 9pt;
      color: #999;
    }
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI Laptop Tester Pro</h1>
    <div class="subtitle">Comprehensive Hardware Test Report</div>
    <div class="timestamp">${dateStr} ${timeStr}</div>
  </div>

  <div class="score-section">
    <div class="score-value">${result.score.toFixed(1)}</div>
    <div class="verdict">${result.verdict}</div>
    <div class="recommendation">${result.recommendation}</div>
  </div>

  <div class="section">
    <div class="section-title">System Information</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">CPU</span>
        <span class="info-value">${systemInfo.cpu}</span>
      </div>
      <div class="info-item">
        <span class="info-label">GPU</span>
        <span class="info-value">${systemInfo.gpu}</span>
      </div>
      <div class="info-item">
        <span class="info-label">RAM</span>
        <span class="info-value">${systemInfo.ram}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Test Duration</span>
        <span class="info-value">${Math.floor(result.duration_sec / 60)}m ${result.duration_sec % 60}s</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Test Metrics</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">CPU Temp</div>
        <div class="metric-value">${result.metrics.cpu_temp.toFixed(1)}<span class="metric-unit">°C</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">GPU Temp</div>
        <div class="metric-value">${result.metrics.gpu_temp.toFixed(1)}<span class="metric-unit">°C</span></div>
      </div>
      <div class="metric-card">
        <div class="metric-label">CPU Usage</div>
        <div class="metric-value">${result.metrics.cpu_usage.toFixed(1)}<span class="metric-unit">%</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detailed Analysis</div>
    <div class="explanations">
      ${result.explanations.map((exp) => `<div class="explanation-item">${exp}</div>`).join("")}
    </div>
  </div>

  <div class="footer">
    <div>Generated by AI Laptop Tester Pro v0.1.0</div>
    <div class="timestamp">Report ID: ${timestamp}</div>
  </div>
</body>
</html>
  `;

  // Open print dialog with the generated HTML
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}
