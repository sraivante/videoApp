import React, { useState } from 'react';
import ChangePassword from './ChangePassword';
import { getSettings, saveSettings } from '../services/settings';

const TABS = [
  { id: 'account', label: 'Account', icon: '\u{1F464}' },
  { id: 'playback', label: 'Playback', icon: '\u{25B6}' },
  { id: 'security', label: 'Security', icon: '\u{1F512}' },
  { id: 'about', label: 'About', icon: '\u{2139}' },
];

function AccountTab({ user, onLogout }) {
  return (
    <div className="settings-panel">
      <h3>Account</h3>
      <div className="settings-field">
        <label>Name</label>
        <div className="settings-value">{user.name || '—'}</div>
      </div>
      <div className="settings-field">
        <label>Email</label>
        <div className="settings-value">{user.email}</div>
      </div>
      <button className="btn btn-danger" onClick={onLogout} style={{ marginTop: 12 }}>
        Logout
      </button>
    </div>
  );
}

function PlaybackTab() {
  const [settings, setSettings] = useState(getSettings());

  const update = (partial) => {
    setSettings(saveSettings(partial));
  };

  return (
    <div className="settings-panel">
      <h3>Playback</h3>
      <div className="settings-field">
        <label>Default Volume</label>
        <div className="volume-control" style={{ marginTop: 4 }}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={settings.defaultVolume}
            onChange={(e) => update({ defaultVolume: parseFloat(e.target.value) })}
          />
          <span>{Math.round(settings.defaultVolume * 100)}%</span>
        </div>
      </div>
      <div className="settings-field settings-toggle">
        <div>
          <label>Autoplay Next Video</label>
          <p className="settings-hint">Automatically play the next video when one ends.</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.autoPlayNext}
            onChange={(e) => update({ autoPlayNext: e.target.checked })}
          />
          <span className="switch-slider" />
        </label>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="settings-panel">
      <h3>Security</h3>
      <ChangePassword embedded />
    </div>
  );
}

function AboutTab() {
  return (
    <div className="settings-panel">
      <h3>About</h3>
      <div className="settings-field">
        <label>Application</label>
        <div className="settings-value">VideoApp</div>
      </div>
      <div className="settings-field">
        <label>Version</label>
        <div className="settings-value">1.0.0</div>
      </div>
      <p className="settings-hint" style={{ marginTop: 12 }}>
        A personal video library with upload and YouTube download support.
      </p>
    </div>
  );
}

function Settings({ user, onLogout, onClose }) {
  const [activeTab, setActiveTab] = useState('account');

  const renderTab = () => {
    switch (activeTab) {
      case 'account': return <AccountTab user={user} onLogout={onLogout} />;
      case 'playback': return <PlaybackTab />;
      case 'security': return <SecurityTab />;
      case 'about': return <AboutTab />;
      default: return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="settings-body">
          <div className="settings-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="settings-tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="settings-content">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
