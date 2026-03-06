import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { videoAPI } from '../services/api';

function VideoCard({ video, onClick, onDelete, showDelete }) {
  const hasThumbnail = !!video.thumbnailName;
  const [thumbError, setThumbError] = useState(false);
  const fallbackVideoRef = useRef(null);

  useEffect(() => {
    if ((!hasThumbnail || thumbError) && fallbackVideoRef.current) {
      const vid = fallbackVideoRef.current;
      vid.currentTime = 2;
    }
  }, [hasThumbnail, thumbError]);

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="video-card" onClick={() => onClick(video)}>
      <div className="video-thumbnail">
        {hasThumbnail && !thumbError ? (
          <img
            src={videoAPI.thumbnailUrl(video.thumbnailName)}
            alt={video.title}
            className="thumbnail-img"
            onError={() => setThumbError(true)}
          />
        ) : (
          <video
            ref={fallbackVideoRef}
            src={videoAPI.streamUrl(video.fileName)}
            className="thumbnail-video"
            muted
            preload="metadata"
            onLoadedData={(e) => { e.target.currentTime = 2; }}
          />
        )}
        <div className="thumb-overlay">
          <span className="play-circle">&#9654;</span>
        </div>
        <div className="thumb-duration">{formatSize(video.fileSize)}</div>
      </div>
      <div className="video-card-info">
        <h4>{video.title}</h4>
        <p className="video-meta">
          <span className="video-author">{video.userName}</span>
          <span className="video-date">{new Date(video.uploadedAt).toLocaleDateString()}</span>
        </p>
      </div>
      {showDelete && (
        <div className="video-card-actions">
          <button
            className="btn btn-danger btn-sm"
            onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Dashboard({ user }) {
  const location = useLocation();
  const [myVideos, setMyVideos] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showUpload, setShowUpload] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [volume, setVolume] = useState(1);
  const videoRef = useRef(null);

  const loadVideos = useCallback(async () => {
    try {
      const [myRes, sugRes] = await Promise.all([
        videoAPI.getMyVideos(),
        videoAPI.getSuggestions(),
      ]);
      setMyVideos(myRes.data);
      setSuggestions(sugRes.data);
    } catch (err) {
      console.error('Failed to load videos', err);
    }
  }, []);

  useEffect(() => {
    if (location.state?.playVideo) {
      setCurrentVideo(location.state.playVideo);
    }
  }, [location.state]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume, currentVideo]);

  const allVideos = [...myVideos, ...suggestions.filter(s => !myVideos.find(m => m.id === s.id))];

  const playVideo = (video) => {
    setCurrentVideo(video);
    const idx = allVideos.findIndex(v => v.id === video.id);
    setCurrentIndex(idx);
  };

  const playNext = () => {
    if (allVideos.length === 0) return;
    const next = (currentIndex + 1) % allVideos.length;
    setCurrentIndex(next);
    setCurrentVideo(allVideos[next]);
  };

  const playPrev = () => {
    if (allVideos.length === 0) return;
    const prev = (currentIndex - 1 + allVideos.length) % allVideos.length;
    setCurrentIndex(prev);
    setCurrentVideo(allVideos[prev]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = form.file.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', form.title.value || file.name);
    formData.append('description', form.description.value || '');

    setStatus({ msg: 'Uploading...', type: 'loading' });
    try {
      await videoAPI.upload(formData, (e) => {
        setUploadProgress(Math.round((e.loaded * 100) / e.total));
      });
      setStatus({ msg: 'Upload successful!', type: 'success' });
      setUploadProgress(0);
      setShowUpload(false);
      form.reset();
      loadVideos();
    } catch (err) {
      setStatus({ msg: 'Upload failed: ' + (err.response?.data?.error || err.message), type: 'error' });
    }
  };

  const handleYoutubeDownload = async (e) => {
    e.preventDefault();
    const url = e.target.url.value;
    if (!url) return;

    setStatus({ msg: 'Downloading from YouTube... This may take a while.', type: 'loading' });
    try {
      await videoAPI.downloadYoutube(url);
      setStatus({ msg: 'Download successful!', type: 'success' });
      setShowYoutube(false);
      e.target.reset();
      loadVideos();
    } catch (err) {
      setStatus({ msg: 'Download failed: ' + (err.response?.data?.error || err.message), type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this video?')) return;
    try {
      await videoAPI.deleteVideo(id);
      if (currentVideo?.id === id) setCurrentVideo(null);
      loadVideos();
    } catch (err) {
      setStatus({ msg: 'Delete failed', type: 'error' });
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>My Videos</h2>
        <div className="dashboard-actions">
          <button className="btn btn-primary" onClick={() => { setShowUpload(!showUpload); setShowYoutube(false); }}>
            Upload Video
          </button>
          <button className="btn btn-secondary" onClick={() => { setShowYoutube(!showYoutube); setShowUpload(false); }}>
            YouTube Download
          </button>
        </div>
      </div>

      {status.msg && (
        <div className={`status-msg status-${status.type}`}>
          {status.msg}
          {status.type !== 'loading' && (
            <span style={{ cursor: 'pointer', marginLeft: 12 }} onClick={() => setStatus({ msg: '', type: '' })}>
              x
            </span>
          )}
        </div>
      )}

      {showUpload && (
        <div className="upload-section">
          <h3>Upload Video</h3>
          <form className="upload-form" onSubmit={handleUpload}>
            <input type="file" name="file" accept="video/*" required />
            <input type="text" name="title" placeholder="Video title (optional)" />
            <input type="text" name="description" placeholder="Description (optional)" />
            {uploadProgress > 0 && (
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <button className="btn btn-primary" type="submit">Upload</button>
          </form>
        </div>
      )}

      {showYoutube && (
        <div className="upload-section">
          <h3>Download from YouTube</h3>
          <form className="upload-form" onSubmit={handleYoutubeDownload}>
            <input type="url" name="url" placeholder="Paste YouTube URL here" required />
            <button className="btn btn-primary" type="submit">Download</button>
          </form>
        </div>
      )}

      {currentVideo && (
        <div className="video-player-section">
          <video
            ref={videoRef}
            key={currentVideo.id}
            controls
            autoPlay
            onEnded={playNext}
          >
            <source src={videoAPI.streamUrl(currentVideo.fileName)} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="player-controls">
            <div className="player-info">
              <h3>{currentVideo.title}</h3>
              <p>{currentVideo.userName} - {formatSize(currentVideo.fileSize)}</p>
            </div>
            <div className="volume-control">
              <label>Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <div className="player-nav">
              <button className="btn btn-secondary" onClick={playPrev}>Previous</button>
              <button className="btn btn-secondary" onClick={playNext}>Next</button>
            </div>
          </div>
        </div>
      )}

      {myVideos.length > 0 && (
        <div className="video-section">
          <h3>Your Videos</h3>
          <div className="video-grid">
            {myVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={playVideo}
                onDelete={handleDelete}
                showDelete
              />
            ))}
          </div>
        </div>
      )}

      {myVideos.length === 0 && (
        <div className="no-videos">
          <p>No videos yet. Upload a video or download from YouTube to get started!</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="video-section">
          <h3>Suggestions</h3>
          <HorizontalScroller>
            {suggestions.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={playVideo}
                onDelete={handleDelete}
                showDelete={false}
              />
            ))}
          </HorizontalScroller>
        </div>
      )}
    </div>
  );
}

function HorizontalScroller({ children }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
    return () => {
      if (el) el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, children]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="h-scroller-wrap">
      {canScrollLeft && (
        <button className="h-scroller-btn h-scroller-left" onClick={() => scroll('left')}>
          &#8249;
        </button>
      )}
      <div className="h-scroller" ref={scrollRef}>
        {children}
      </div>
      {canScrollRight && (
        <button className="h-scroller-btn h-scroller-right" onClick={() => scroll('right')}>
          &#8250;
        </button>
      )}
    </div>
  );
}

export default Dashboard;
