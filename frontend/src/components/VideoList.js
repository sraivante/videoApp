import React, { useState, useEffect, useRef, useCallback } from 'react';
import { videoAPI } from '../services/api';

function VideoList({ user, onPlayVideo }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await videoAPI.getMyVideos();
      setVideos(res.data);
    } catch (err) {
      console.error('Failed to load videos', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await videoAPI.deleteVideo(id);
      setVideos(videos.filter(v => v.id !== id));
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="video-list-page"><p className="no-videos">Loading videos...</p></div>;
  }

  return (
    <div className="video-list-page">
      <div className="vl-header">
        <h2>All My Videos</h2>
        <span className="vl-count">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
      </div>

      {videos.length === 0 ? (
        <div className="no-videos">
          <p>You have no videos yet. Go to Dashboard to upload or download videos.</p>
        </div>
      ) : (
        <div className="vl-table-wrap">
          <table className="vl-table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Title</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td>
                    <div className="vl-preview" onClick={() => onPlayVideo(video)}>
                      {video.thumbnailName ? (
                        <img
                          src={videoAPI.thumbnailUrl(video.thumbnailName)}
                          alt={video.title}
                        />
                      ) : (
                        <VideoPreview fileName={video.fileName} />
                      )}
                      <div className="vl-play-icon">&#9654;</div>
                    </div>
                  </td>
                  <td>
                    <span className="vl-title" onClick={() => onPlayVideo(video)}>
                      {video.title}
                    </span>
                    {video.description && <p className="vl-desc">{video.description}</p>}
                  </td>
                  <td className="vl-size">{formatSize(video.fileSize)}</td>
                  <td className="vl-date">{new Date(video.uploadedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="vl-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => onPlayVideo(video)}>
                        Play
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(video.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VideoPreview({ fileName }) {
  const ref = useRef(null);
  return (
    <video
      ref={ref}
      src={videoAPI.streamUrl(fileName)}
      muted
      preload="metadata"
      onLoadedData={(e) => { e.target.currentTime = 2; }}
    />
  );
}

export default VideoList;
