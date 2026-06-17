/**
 * AC Energy Card  v1.0
 * 空调时段耗电量图表 — Lovelace Custom Card
 *
 * 安装方法：
 *   1. 将此文件放入 HA 的 /config/www/ 目录
 *   2. 设置 → 仪表板 → 资源 → 添加：
 *        URL:  /local/ac-energy-card.js
 *        类型: JavaScript 模块
 *   3. 仪表板 → 添加卡片 → 手动卡片：
 *        type: custom:ac-energy-card
 *        entity: sensor.你的累计耗电量sensor
 */

class AcEnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._mode = "hourly";
    this._hass = null;
    this._config = {};
  }

  // ── HA 生命周期：配置 ──
  setConfig(config) {
    if (!config.entity) throw new Error("请设置 entity（累计耗电量 sensor）");
    this._config = config;
    this._render();
  }

  // ── HA 生命周期：状态更新 ──
  set hass(hass) {
    this._hass = hass;
    // 首次或每次状态更新时刷新
    if (!this._initialized) {
      this._initialized = true;
      this._loadData();
    }
  }

  // ── 渲染骨架 ──
  _render() {
    const title = this._config.title || "空调耗电";
    const icon  = this._config.icon  || "❄️";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        .card {
          background: linear-gradient(145deg, #12121f 0%, #1a1a2e 100%);
          border-radius: 16px;
          padding: 20px 20px 16px;
          color: #e0e0f0;
          font-family: var(--primary-font-family, 'Segoe UI', system-ui, sans-serif);
          position: relative;
          overflow: hidden;
        }

        .card::before {
          content: '';
          position: absolute;
          top: -40px; right: -40px;
          width: 140px; height: 140px;
          background: radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon { font-size: 18px; line-height: 1; }

        .title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .toggle {
          display: flex;
          background: rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 2px;
          gap: 2px;
        }

        .toggle-btn {
          padding: 3px 10px;
          border-radius: 16px;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.03em;
          -webkit-tap-highlight-color: transparent;
        }

        .toggle-btn.active {
          background: rgba(56,189,248,0.2);
          color: #38bdf8;
        }

        .summary {
          display: flex;
          align-items: baseline;
          gap: 6px;
          margin: 12px 0 16px;
        }

        .total-val {
          font-size: 32px;
          font-weight: 700;
          color: #f0f9ff;
          letter-spacing: -0.02em;
          line-height: 1;
        }

        .total-unit { font-size: 14px; color: #94a3b8; font-weight: 400; }

        .total-label {
          font-size: 11px;
          color: #64748b;
          margin-left: auto;
          align-self: center;
        }

        /* Chart */
        .chart-wrap {
          position: relative;
          height: 120px;
          display: flex;
          align-items: flex-end;
          gap: 3px;
          padding-bottom: 20px;
        }

        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          height: 100%;
          position: relative;
        }

        .bar {
          width: 100%;
          border-radius: 4px 4px 2px 2px;
          transition: height 0.5s cubic-bezier(0.34,1.3,0.64,1);
          cursor: default;
          min-height: 2px;
          position: relative;
        }

        .bar-label {
          font-size: 9px;
          color: #475569;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          text-align: center;
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
        }

        /* Touch-friendly tooltip (tap on mobile) */
        .tooltip {
          position: absolute;
          background: rgba(15,15,30,0.95);
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          color: #e2e8f0;
          pointer-events: none;
          white-space: nowrap;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.15s;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip.visible { opacity: 1; }
        .tooltip strong { color: #38bdf8; font-size: 13px; }

        /* Status */
        .status {
          text-align: center;
          color: #475569;
          font-size: 12px;
          padding: 24px 0;
          width: 100%;
        }

        .dots span {
          display: inline-block;
          animation: blink 1.2s infinite;
          font-size: 18px;
          color: #38bdf8;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      </style>

      <ha-card>
        <div class="card">
          <div class="header">
            <div class="title-group">
              <span class="icon">${icon}</span>
              <span class="title">${title}</span>
            </div>
            <div class="toggle">
              <button class="toggle-btn ${this._mode === 'hourly' ? 'active' : ''}" data-mode="hourly">小时</button>
              <button class="toggle-btn ${this._mode === 'daily'  ? 'active' : ''}" data-mode="daily">日</button>
            </div>
          </div>

          <div class="summary">
            <span class="total-val" id="totalVal">—</span>
            <span class="total-unit">kWh</span>
            <span class="total-label" id="totalLabel"></span>
          </div>

          <div class="chart-wrap" id="chartWrap">
            <div class="status">
              <div class="dots"><span>•</span><span>•</span><span>•</span></div>
              <div style="margin-top:6px">正在读取数据…</div>
            </div>
          </div>
        </div>
      </ha-card>
    `;

    // Toggle 事件
    this.shadowRoot.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._mode = btn.dataset.mode;
        this._render();
        this._loadData();
      });
    });
  }

  // ── 读取 HA History API ──
  async _loadData() {
    if (!this._hass) return;

    try {
      const isHourly = this._mode === 'hourly';
      const entity   = this._config.entity;
      const now      = new Date();
      const start    = new Date(now);

      if (isHourly) {
        start.setHours(now.getHours() - 23, 0, 0, 0);
      } else {
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
      }

      // HA 提供的 callApi 方法，自动带 Token
      const res = await this._hass.callApi(
        "GET",
        `history/period/${start.toISOString()}` +
        `?filter_entity_id=${entity}&minimal_response=true&no_attributes=true`
      );

      if (!res || !res[0] || res[0].length === 0) {
        throw new Error("该时段内无数据");
      }

      const states = res[0].filter(s =>
        s.state !== 'unavailable' && s.state !== 'unknown'
      );

      const data = isHourly
        ? this._bucketHourly(states, now, start)
        : this._bucketDaily(states, now, start);

      this._drawChart(data);

    } catch (e) {
      const wrap = this.shadowRoot.getElementById('chartWrap');
      if (wrap) {
        wrap.innerHTML = `<div class="status" style="color:#ef4444">
          读取失败：${e.message || e}
        </div>`;
      }
    }
  }

  // ── 按小时分桶 ──
  _bucketHourly(states, now, start) {
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const t = new Date(start);
      t.setHours(start.getHours() + i);
      return { time: t, label: `${String(t.getHours()).padStart(2,'0')}h` };
    });

    const getVal = (endTime) => {
      const et = endTime.getTime();
      let best = null;
      for (const s of states) {
        const st = new Date(s.last_changed || s.last_updated).getTime();
        if (st <= et) best = parseFloat(s.state);
        else break;
      }
      return best;
    };

    return buckets.map((b, i) => {
      const endT = i + 1 < buckets.length ? buckets[i + 1].time : now;
      const cur  = getVal(endT);
      const prev = i === 0 ? null : getVal(b.time);
      return {
        label: b.label,
        kwh: (cur !== null && prev !== null) ? Math.max(0, cur - prev) : null
      };
    });
  }

  // ── 按天分桶 ──
  _bucketDaily(states, now, start) {
    const buckets = Array.from({ length: 30 }, (_, i) => {
      const t = new Date(start);
      t.setDate(start.getDate() + i);
      return { time: t, label: `${t.getMonth()+1}/${t.getDate()}` };
    });

    const getVal = (endTime) => {
      const et = endTime.getTime();
      let best = null;
      for (const s of states) {
        const st = new Date(s.last_changed || s.last_updated).getTime();
        if (st <= et) best = parseFloat(s.state);
        else break;
      }
      return best;
    };

    return buckets.map((b, i) => {
      const endT = i + 1 < buckets.length ? buckets[i + 1].time : now;
      const cur  = getVal(endT);
      const prev = i === 0 ? null : getVal(b.time);
      return {
        label: b.label,
        kwh: (cur !== null && prev !== null) ? Math.max(0, cur - prev) : null
      };
    });
  }

  // ── 绘制柱状图 ──
  _drawChart(data) {
    const valid = data.filter(d => d.kwh !== null);
    const total = valid.reduce((s, d) => s + d.kwh, 0);
    const max   = Math.max(...valid.map(d => d.kwh), 0.001);

    const valEl   = this.shadowRoot.getElementById('totalVal');
    const labelEl = this.shadowRoot.getElementById('totalLabel');
    if (valEl)   valEl.textContent   = total.toFixed(2);
    if (labelEl) labelEl.textContent = this._mode === 'hourly' ? '过去 24 小时' : '过去 30 天';

    const showLabel = (i) =>
      this._mode === 'hourly' ? i % 4 === 0 : (i % 5 === 0 || i === data.length - 1);

    // 低耗=冷蓝 #38bdf8，高耗=暖橙 #fb923c
    const barColor = (ratio) => {
      const r = Math.round(56  + (251 - 56)  * ratio);
      const g = Math.round(189 + (146 - 189) * ratio);
      const b = Math.round(248 + (60  - 248) * ratio);
      return `rgb(${r},${g},${b})`;
    };

    const wrap = this.shadowRoot.getElementById('chartWrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    data.forEach((d, i) => {
      const col   = document.createElement('div');
      col.className = 'bar-col';

      const ratio = d.kwh !== null ? d.kwh / max : 0;
      const pct   = Math.max(ratio * 95, d.kwh ? 2 : 0);
      const color = barColor(ratio);

      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.cssText = `
        height: 0%;
        background: linear-gradient(to top, ${color}cc, ${color});
        box-shadow: 0 0 6px ${color}44;
      `;

      // Tooltip（鼠标 + 触摸均可）
      const tip = document.createElement('div');
      tip.className = 'tooltip';
      tip.innerHTML = d.kwh !== null
        ? `${d.label}<br><strong>${d.kwh.toFixed(3)} kWh</strong>`
        : `${d.label}<br><span style="color:#64748b">无数据</span>`;

      bar.appendChild(tip);

      const showTip = () => tip.classList.add('visible');
      const hideTip = () => tip.classList.remove('visible');

      bar.addEventListener('mouseenter', showTip);
      bar.addEventListener('mouseleave', hideTip);
      bar.addEventListener('touchstart', (e) => {
        e.preventDefault();
        // 隐藏其他已显示的 tooltip
        wrap.querySelectorAll('.tooltip.visible').forEach(t => t.classList.remove('visible'));
        showTip();
      }, { passive: false });
      document.addEventListener('touchstart', (e) => {
        if (!bar.contains(e.target)) hideTip();
      }, { passive: true });

      // 入场动画
      setTimeout(() => { bar.style.height = `${pct}%`; }, 30 + i * 12);

      const lbl = document.createElement('div');
      lbl.className = 'bar-label';
      lbl.textContent = showLabel(i) ? d.label : '';

      col.appendChild(bar);
      col.appendChild(lbl);
      wrap.appendChild(col);
    });
  }

  // HA 需要知道卡片高度（可选）
  getCardSize() { return 3; }
}

customElements.define('ac-energy-card', AcEnergyCard);
