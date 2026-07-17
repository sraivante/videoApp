package com.videoapp.service;

import com.videoapp.dto.VideoDTO;
import com.videoapp.exception.AlreadyDownloadedException;
import com.videoapp.model.User;
import com.videoapp.model.Video;
import com.videoapp.repository.UserRepository;
import com.videoapp.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VideoService {

    /** All physical media lives in this single shared directory, content-addressed. */
    private static final String SHARED_DIR = "shared";

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;
    private final YouTubeDownloadService youTubeDownloadService;

    @Value("${video.storage.path}")
    private String storagePath;

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(Paths.get(storagePath));
        Files.createDirectories(Paths.get(storagePath, "thumbnails"));
        Files.createDirectories(Paths.get(storagePath, SHARED_DIR));
    }

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    public VideoDTO uploadVideo(MultipartFile file, String title, String description, Long userId) throws IOException {
        User user = getUser(userId);

        String originalName = file.getOriginalFilename();
        String extension = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf("."))
                : ".mp4";

        // Stream to a temp file while hashing, so the storage path is derived from
        // the content. Identical content produces the same path and is stored once.
        Path sharedDir = Paths.get(storagePath, SHARED_DIR);
        Files.createDirectories(sharedDir);
        Path tmp = Files.createTempFile(sharedDir, "upload-", extension);
        String hash;
        try (DigestInputStream in = new DigestInputStream(file.getInputStream(),
                MessageDigest.getInstance("SHA-256"))) {
            Files.copy(in, tmp, StandardCopyOption.REPLACE_EXISTING);
            hash = HexFormat.of().formatHex(in.getMessageDigest().digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            Files.deleteIfExists(tmp);
            throw new IOException("SHA-256 not available", e);
        }

        String fileName = SHARED_DIR + "/" + hash + extension;
        Path target = Paths.get(storagePath, fileName);

        if (Files.exists(target)) {
            // Content already on disk — drop the temp copy, reference the existing file.
            Files.deleteIfExists(tmp);
        } else {
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
        }

        // Same user already has this exact file -> duplicate.
        if (videoRepository.findFirstByUserIdAndFileName(userId, fileName).isPresent()) {
            throw new AlreadyDownloadedException("You already have this video in your library.", null);
        }

        String thumbnailName = ensureThumbnail(target, hash + extension);
        long fileSize = Files.size(target);

        Video saved = createRow(fileName, title != null ? title : originalName, description,
                thumbnailName, fileSize, file.getContentType() != null ? file.getContentType() : "video/mp4", user);
        return toDTO(saved);
    }

    // ------------------------------------------------------------------
    // YouTube
    // ------------------------------------------------------------------

    /**
     * Add a YouTube video for a user, de-duplicating against shared storage.
     * <ul>
     *   <li>If the user already has it and {@code redownload} is false -> {@link AlreadyDownloadedException}.</li>
     *   <li>If it exists globally but the user doesn't have it -> reference it (no re-download, no extra space).</li>
     *   <li>Otherwise download it fresh.</li>
     * </ul>
     */
    public VideoDTO addYoutubeVideo(String url, Long userId, boolean redownload)
            throws IOException, InterruptedException {
        User user = getUser(userId);

        YouTubeDownloadService.Metadata meta = youTubeDownloadService.probe(url);
        String fileName = youtubeFileName(meta.videoId());
        Path target = Paths.get(storagePath, fileName);

        Optional<Video> mine = videoRepository.findFirstByUserIdAndFileName(userId, fileName);
        if (mine.isPresent()) {
            if (!redownload) {
                throw new AlreadyDownloadedException(
                        "This video is already downloaded in your library.", meta.videoId());
            }
            // "Delete and re-download": remove the user's copy first (frees the file if it was the last reference).
            deleteUserVideosByFileName(userId, fileName);
        }

        if (!redownload && Files.exists(target)) {
            // Already downloaded by someone else — just add a reference for this user.
            return referenceExisting(fileName, meta.title(), user);
        }

        // Fresh download (new video, or a forced re-download).
        youTubeDownloadService.downloadTo(url, target);
        long fileSize = Files.size(target);
        String thumbnailName = generateThumbnail(target, fileName.replace("/", "_"));

        Video saved = createRow(fileName, meta.title(), null, thumbnailName, fileSize, "video/mp4", user);
        return toDTO(saved);
    }

    private String youtubeFileName(String videoId) {
        String safe = videoId.replaceAll("[^A-Za-z0-9_-]", "_");
        return SHARED_DIR + "/yt-" + safe + ".mp4";
    }

    /** Create a Video row that references an already-present physical file. */
    private VideoDTO referenceExisting(String fileName, String title, User user) throws IOException {
        Video sample = videoRepository.findFirstByFileName(fileName).orElse(null);
        Path target = Paths.get(storagePath, fileName);
        String thumbnailName = sample != null
                ? sample.getThumbnailName()
                : ensureThumbnail(target, fileName.replace("/", "_"));
        long fileSize = sample != null ? sample.getFileSize() : Files.size(target);
        String contentType = sample != null ? sample.getContentType() : "video/mp4";

        Video saved = createRow(fileName, title, null, thumbnailName, fileSize, contentType, user);
        return toDTO(saved);
    }

    // ------------------------------------------------------------------
    // Queries
    // ------------------------------------------------------------------

    public List<VideoDTO> getUserVideos(Long userId) {
        return videoRepository.findByUserIdOrderByUploadedAtDesc(userId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<VideoDTO> getSuggestions(Long userId) {
        return videoRepository.findAllByOrderByUploadedAtDesc()
                .stream()
                .filter(v -> !v.getUser().getId().equals(userId))
                .limit(10)
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<VideoDTO> getAllVideos() {
        return videoRepository.findAllByOrderByUploadedAtDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public Resource getVideoResource(String fileName) {
        Path path = Paths.get(storagePath, fileName);
        if (!Files.exists(path)) {
            throw new RuntimeException("Video file not found: " + fileName);
        }
        return new FileSystemResource(path);
    }

    public Resource getThumbnailResource(String thumbnailName) {
        Path path = Paths.get(storagePath, "thumbnails", thumbnailName);
        if (!Files.exists(path)) {
            throw new RuntimeException("Thumbnail not found: " + thumbnailName);
        }
        return new FileSystemResource(path);
    }

    // ------------------------------------------------------------------
    // Delete (reference-counted)
    // ------------------------------------------------------------------

    public void deleteVideo(Long videoId, Long userId) throws IOException {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found"));
        if (!video.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        String fileName = video.getFileName();
        String thumbnailName = video.getThumbnailName();
        videoRepository.delete(video);
        deletePhysicalIfOrphan(fileName, thumbnailName);
    }

    /** Remove all of a user's rows for a shared file (used by delete-and-redownload). */
    private void deleteUserVideosByFileName(Long userId, String fileName) throws IOException {
        List<Video> rows = videoRepository.findByUserIdAndFileName(userId, fileName);
        String thumbnailName = rows.isEmpty() ? null : rows.get(0).getThumbnailName();
        for (Video v : rows) {
            videoRepository.delete(v);
        }
        deletePhysicalIfOrphan(fileName, thumbnailName);
    }

    /** Delete the physical file + thumbnail only when no Video row references them anymore. */
    private void deletePhysicalIfOrphan(String fileName, String thumbnailName) throws IOException {
        if (videoRepository.countByFileName(fileName) == 0) {
            Files.deleteIfExists(Paths.get(storagePath, fileName));
            if (thumbnailName != null) {
                Files.deleteIfExists(Paths.get(storagePath, "thumbnails", thumbnailName));
            }
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private Video createRow(String fileName, String title, String description, String thumbnailName,
                            Long fileSize, String contentType, User user) {
        Video video = Video.builder()
                .title(title)
                .description(description)
                .fileName(fileName)
                .thumbnailName(thumbnailName)
                .fileSize(fileSize)
                .contentType(contentType)
                .user(user)
                .build();
        return videoRepository.save(video);
    }

    /** Return an existing thumbnail for the base name, generating one only if missing. */
    private String ensureThumbnail(Path videoPath, String baseName) {
        String thumbName = baseName.replaceAll("\\.[^.]+$", "") + ".jpg";
        if (Files.exists(Paths.get(storagePath, "thumbnails", thumbName))) {
            return thumbName;
        }
        return generateThumbnail(videoPath, baseName);
    }

    private String generateThumbnail(Path videoPath, String baseName) {
        try {
            String thumbName = baseName.replaceAll("\\.[^.]+$", "") + ".jpg";
            Path thumbPath = Paths.get(storagePath, "thumbnails", thumbName);

            // Get video duration via ffprobe to pick a frame at 25%
            String seekTime = "00:00:02";
            try {
                ProcessBuilder probePb = new ProcessBuilder(
                        "ffprobe", "-v", "error",
                        "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1",
                        videoPath.toString()
                );
                probePb.redirectErrorStream(true);
                Process probeProc = probePb.start();
                String durationStr = new String(probeProc.getInputStream().readAllBytes()).trim();
                probeProc.waitFor();
                double duration = Double.parseDouble(durationStr);
                double seekSec = duration * 0.25;
                int h = (int) (seekSec / 3600);
                int m = (int) ((seekSec % 3600) / 60);
                int s = (int) (seekSec % 60);
                seekTime = String.format("%02d:%02d:%02d", h, m, s);
            } catch (Exception e) {
                log.debug("Could not probe duration, using default seek time: {}", e.getMessage());
            }

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-ss", seekTime,
                    "-i", videoPath.toString(),
                    "-vframes", "1",
                    "-vf", "scale=480:-1",
                    "-q:v", "2",
                    "-y", thumbPath.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();
            process.getInputStream().readAllBytes();
            int exit = process.waitFor();
            if (exit == 0 && Files.exists(thumbPath)) {
                return thumbName;
            }
            log.warn("FFmpeg thumbnail generation failed for {}", videoPath);
        } catch (Exception e) {
            log.warn("Could not generate thumbnail: {}", e.getMessage());
        }
        return null;
    }

    private VideoDTO toDTO(Video video) {
        return VideoDTO.builder()
                .id(video.getId())
                .title(video.getTitle())
                .description(video.getDescription())
                .fileName(video.getFileName())
                .thumbnailName(video.getThumbnailName())
                .fileSize(video.getFileSize())
                .contentType(video.getContentType())
                .userId(video.getUser().getId())
                .userName(video.getUser().getName())
                .uploadedAt(video.getUploadedAt())
                .build();
    }
}
