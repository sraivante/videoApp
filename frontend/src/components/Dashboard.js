import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { videoAPI } from '../services/api';

function VideoCard({ video, onClick }) {
  const hasThumbnail = !!video.thumbnailName;
  const [thumbError, setThumbError] = useState(false);
  const fallbackVideoRef = useRef(null);

  useEffect(() => {
    if ((!hasThumbnail || thumbError) && fallbackVideoRef.current) {
      fallbackVideoRef.current.currentTime = 2;
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
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Dashboard({ user }) {
  const location = useLocation();
  const [allVideos, setAllVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState({ msg: '', type: '' });
  const [volume, setVolume] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(0);
  const countdownRef = useRef(null);
  const videoRef = useRef(null);

  const loadVideos = useCallback(async () => {
    try {
      const [myRes, sugRes] = await Promise.all([
        videoAPI.getMyVideos(),
        videoAPI.getSuggestions(),
      ]);
      const myVids = myRes.data;
      const sugVids = sugRes.data;
      // merge, deduplicate, shuffle
      const merged = [...myVids];
      sugVids.forEach(s => {
        if (!merged.find(m => m.id === s.id)) merged.push(s);
      });
      const shuffled = shuffle(merged);
      setAllVideos(shuffled);
      // auto-play first video if nothing is playing
      if (shuffled.length > 0 && !currentVideo) {
        setCurrentVideo(shuffled[0]);
        setCurrentIndex(0);
      }
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load videos', err);
      setLoaded(true);
    }
  }, []); // intentionally no currentVideo dep to avoid re-shuffle

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    if (location.state?.playVideo) {
      setCurrentVideo(location.state.playVideo);
      const idx = allVideos.findIndex(v => v.id === location.state.playVideo.id);
      if (idx >= 0) setCurrentIndex(idx);
    }
  }, [location.state, allVideos]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume, currentVideo]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const playVideo = useCallback((video) => {
    clearCountdown();
    setShowEndScreen(false);
    setCurrentVideo(video);
    const idx = allVideos.findIndex(v => v.id === video.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
  }, [allVideos, clearCountdown]);

  const playNext = useCallback(() => {
    if (allVideos.length === 0) return;
    clearCountdown();
    setShowEndScreen(false);
    const next = (currentIndex + 1) % allVideos.length;
    setCurrentIndex(next);
    setCurrentVideo(allVideos[next]);
  }, [allVideos, currentIndex, clearCountdown]);

  const playPrev = useCallback(() => {
    if (allVideos.length === 0) return;
    clearCountdown();
    setShowEndScreen(false);
    const prev = (currentIndex - 1 + allVideos.length) % allVideos.length;
    setCurrentIndex(prev);
    setCurrentVideo(allVideos[prev]);
  }, [allVideos, currentIndex, clearCountdown]);

  const handleVideoEnded = useCallback(() => {
    if (allVideos.length <= 1) return;
    setShowEndScreen(true);
    setAutoPlayCountdown(10);
    clearCountdown();
    countdownRef.current = setInterval(() => {
      setAutoPlayCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          playNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [allVideos, playNext, clearCountdown]);

  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);

  const getNextSuggestions = (count) => {
    const others = allVideos.filter(v => v.id !== currentVideo?.id);
    const start = currentIndex % Math.max(others.length, 1);
    const result = [];
    for (let i = 0; i < Math.min(count, others.length); i++) {
      result.push(others[(start + i) % others.length]);
    }
    return result;
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

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
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
          <div className="video-frame-wrap">
            <video
              ref={videoRef}
              key={currentVideo.id}
              controls
              autoPlay
              onEnded={handleVideoEnded}
              onPlay={() => { setShowEndScreen(false); clearCountdown(); }}
            >
              <source src={videoAPI.streamUrl(currentVideo.fileName)} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {showEndScreen && (
              <div className="end-screen-overlay">
                <div className="end-screen-header">
                  <span>Up Next in {autoPlayCountdown}s</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowEndScreen(false); clearCountdown(); }}>
                    Cancel
                  </button>
                </div>
                <EndScreenScroller
                  videos={getNextSuggestions(4)}
                  onSelect={playVideo}
                />
              </div>
            )}
          </div>
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

      {!currentVideo && loaded && allVideos.length === 0 && (
        <div className="no-videos">
          <p>No videos yet. Upload a video or download from YouTube to get started!</p>
        </div>
      )}

      {allVideos.length > 0 && (
        <div className="video-section">
          <h3>Suggestions</h3>
          <HorizontalScroller>
            {allVideos
              .filter(v => !currentVideo || v.id !== currentVideo.id)
              .map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onClick={playVideo}
                />
              ))}
          </HorizontalScroller>
        </div>
      )}
    </div>
  );
}

function EndScreenScroller({ videos, onSelect }) {
  const scrollRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);

  const handleMouseDown = (e) => {
    setDragStart({ x: e.clientX, scrollLeft: scrollRef.current.scrollLeft });
  };
  const handleMouseMove = (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    scrollRef.current.scrollLeft = dragStart.scrollLeft - dx;
  };
  const handleMouseUp = () => setDragStart(null);

  const handleTouchStart = (e) => {
    setDragStart({ x: e.touches[0].clientX, scrollLeft: scrollRef.current.scrollLeft });
  };
  const handleTouchMove = (e) => {
    if (!dragStart) return;
    const dx = e.touches[0].clientX - dragStart.x;
    scrollRef.current.scrollLeft = dragStart.scrollLeft - dx;
  };

  return (
    <div
      className="end-screen-cards"
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setDragStart(null)}
    >
      {videos.map((video) => (
        <div key={video.id} className="end-screen-card" onClick={() => onSelect(video)}>
          <div className="end-card-thumb">
            {video.thumbnailName ? (
              <img src={videoAPI.thumbnailUrl(video.thumbnailName)} alt={video.title} />
            ) : (
              <video
                src={videoAPI.streamUrl(video.fileName)}
                muted
                preload="metadata"
                onLoadedData={(e) => { e.target.currentTime = 2; }}
              />
            )}
            <div className="end-card-play">&#9654;</div>
          </div>
          <p className="end-card-title">{video.title}</p>
        </div>
      ))}
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
