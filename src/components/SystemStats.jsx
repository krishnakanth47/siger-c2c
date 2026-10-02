import React from 'react';
import { Activity, Gauge, Box, Truck, RefreshCw, Archive, CheckCircle } from 'lucide-react';

export default function SystemStats({ stats }) {
  if (!stats) return null;

  return (
    <div className="system-stats-grid corner-brackets">
      <div className="stat-box">
        <span className="stat-label">Production Machines</span>
        <div className="stat-value">
          <span>{stats.machinesCount}</span>
          <span className="stat-sub">Spindles Active</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">OHC Loaders</span>
        <div className="stat-value">
          <span>{stats.loadersCount}</span>
          <span className="stat-sub">Auto Bays</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">FIFO Queue</span>
        <div className="stat-value" style={{ color: stats.queueRatio.startsWith('4') ? 'var(--accent-amber)' : 'var(--accent-cyan)' }}>
          <span>{stats.queueRatio}</span>
          <span className="stat-sub">Max 4Q</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Empty Baskets</span>
        <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
          <span>{stats.emptyBaskets}</span>
          <span className="stat-sub">Ready Pool</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">In Transit (OHC)</span>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
          <span>{stats.inTransit}</span>
          <span className="stat-sub">On Rail</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Dynamic Unloaders</span>
        <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
          <span>{stats.unloading} / {stats.dynamicUnloadersCount}</span>
          <span className="stat-sub">Active Bays</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Loaded Baskets</span>
        <div className="stat-value">
          <span>{stats.loadedBaskets}</span>
          <span className="stat-sub">Stored / Circ</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Pallet Stations</span>
        <div className="stat-value">
          <span>{stats.palletStationsCount}</span>
          <span className="stat-sub">Pallet Bays</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Active Variants</span>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
          <span>{stats.activeVariantsRatio}</span>
          <span className="stat-sub">Allowed</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Total Cones Handled</span>
        <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>
          <span>{stats.totalConesHandled || 0}</span>
          <span className="stat-sub">Cones</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Completed Cycles</span>
        <div className="stat-value">
          <span>{stats.totalCycles || 0}</span>
          <span className="stat-sub">Loops</span>
        </div>
      </div>

      <div className="stat-box">
        <span className="stat-label">Total Baskets Fleet</span>
        <div className="stat-value">
          <span>{stats.basketsTotal}</span>
          <span className="stat-sub">Tracked Twin</span>
        </div>
      </div>
    </div>
  );
}
