import Alpine from 'alpinejs';
import axios from 'axios';
import * as echarts from 'echarts/core';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import QRCode from 'qrcode';

echarts.use([GridComponent, TooltipComponent, LegendComponent, LineChart, CanvasRenderer]);

window.Alpine = Alpine;
window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['X-CSRF-TOKEN'] = document.querySelector('meta[name="csrf-token"]')?.content || '';

Alpine.data('clipboard', () => ({
  copied: false,
  async copy(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    this.copied = true;
    setTimeout(() => this.copied = false, 1600);
  },
}));

Alpine.data('qrCode', (value, options = {}) => ({
  value,
  options: {
    width: Number(options.width || 232),
    margin: Number(options.margin ?? 2),
    dark: options.dark || '#0f172a',
    light: options.light || '#ffffff',
    level: ['L', 'M', 'Q', 'H'].includes(options.level) ? options.level : 'M',
  },
  async init() {
    await this.render();
  },
  async render() {
    await QRCode.toCanvas(this.$refs.canvas, this.value, {
      width: this.options.width,
      margin: this.options.margin,
      color: { dark: this.options.dark, light: this.options.light },
      errorCorrectionLevel: this.options.level,
    });
  },
  async downloadPng(filename = 'gojet-qr.png') {
    await this.render();
    const link = document.createElement('a');
    link.download = filename;
    link.href = this.$refs.canvas.toDataURL('image/png');
    link.click();
  },
  async downloadSvg(filename = 'gojet-qr.svg') {
    const svg = await QRCode.toString(this.value, {
      type: 'svg',
      width: this.options.width,
      margin: this.options.margin,
      color: { dark: this.options.dark, light: this.options.light },
      errorCorrectionLevel: this.options.level,
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },
  download(filename = 'gojet-qr.png') {
    return this.downloadPng(filename);
  },
}));

Alpine.data('resumableUpload', (config) => ({
  file: null,
  busy: false,
  progress: 0,
  error: '',
  result: null,
  select(event) {
    this.file = event.target.files?.[0] || null;
    this.progress = 0;
    this.error = '';
    this.result = null;
  },
  async upload(metadata = {}) {
    if (!this.file || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const { data: session } = await axios.post(config.createUrl, {
        name: this.file.name,
        size_bytes: this.file.size,
        mime_type: this.file.type || null,
        visibility: metadata.visibility || 'unlisted',
        expires_at: metadata.expires_at || null,
        max_downloads: metadata.max_downloads || null,
      });
      const chunkSize = Number(session.chunk_size || 5 * 1024 * 1024);
      const count = Math.ceil(this.file.size / chunkSize);
      for (let index = 0; index < count; index += 1) {
        const start = index * chunkSize;
        const end = Math.min(this.file.size, start + chunkSize);
        const body = new FormData();
        body.append('chunk', this.file.slice(start, end), `${index}.part`);
        const url = config.chunkUrl.replace('__SESSION__', session.id).replace('__INDEX__', String(index));
        await axios.post(url, body, { headers: { 'Content-Type': 'multipart/form-data' } });
        this.progress = Math.round(((index + 1) / count) * 100);
      }
      const completeUrl = config.completeUrl.replace('__SESSION__', session.id);
      const { data } = await axios.post(completeUrl);
      this.result = data;
      if (data.manage_url) window.location.assign(data.manage_url);
    } catch (error) {
      this.error = error.response?.data?.message || error.message || 'Upload failed.';
    } finally {
      this.busy = false;
    }
  },
}));

Alpine.data('blockOrder', (initial = []) => ({
  ids: initial,
  move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this.ids.length) return;
    [this.ids[index], this.ids[target]] = [this.ids[target], this.ids[index]];
    this.ids = [...this.ids];
  },
}));

Alpine.data('trendChart', (rows, labels = {}) => ({
  chart: null,
  observer: null,
  init() {
    this.chart = echarts.init(this.$refs.chart);
    this.chart.setOption({
      animationDuration: 500,
      tooltip: { trigger: 'axis', backgroundColor: '#0f172a', borderWidth: 0, textStyle: { color: '#fff' } },
      legend: { top: 0, right: 0, textStyle: { color: '#64748b' } },
      grid: { left: 44, right: 18, top: 46, bottom: 34 },
      xAxis: { type: 'category', boundaryGap: false, data: rows.map((row) => row.date.slice(5)), axisLabel: { color: '#64748b' }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#64748b' }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#eef2f7' } } },
      series: [
        { name: labels.clicks || 'Clicks', type: 'line', smooth: true, showSymbol: false, data: rows.map((row) => row.clicks), lineStyle: { width: 3, color: '#0891b2' }, areaStyle: { color: 'rgba(6,182,212,.10)' } },
        { name: labels.unique || 'Unique visitors', type: 'line', smooth: true, showSymbol: false, data: rows.map((row) => row.unique_clicks), lineStyle: { width: 2.5, color: '#6366f1' } },
      ],
    });
    this.observer = new ResizeObserver(() => this.chart?.resize());
    this.observer.observe(this.$refs.chart);
  },
}));

Alpine.start();
