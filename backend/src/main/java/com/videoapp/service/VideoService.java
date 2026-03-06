package com.videoapp.service;

import com.videoapp.dto.VideoDTO;
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
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VideoService {

    private final VideoRepository videoRepository;
    private final UserRepository userRepository;

    @Value("${video.storage.path}")
    private String storagePath;

    @PostConstruct
    public void init() throws IOException {
        Files.createDirectories(Paths.get(storagePath));
        Files.createDirectories(Paths.get(storagePath, "thumbnails"));
    }

    public VideoDTO uploadVideo(MultipartFile file, String title, String description, Long userId) throws IOException {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Path userDir = Paths.get(storagePath, String.valueOf(userId));
        Files.createDirectories(userDir);

        String originalName = file.getOriginalFilename();
        String extension = originalName != null && originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf("."))
                : ".mp4";
        String fileName = UUID.randomUUID() + extension;

        Path filePath = userDir.resolve(fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        String thumbnailName = generateThumbnail(filePath, fileName);

        Video video = Video.builder()
                .title(title != null ? title : originalName)
                .description(description)
                .fileName(userId + "/" + fileName)
                .thumbnailName(thumbnailName)
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .user(user)
                .build();

        Video saved = videoRepository.save(video);
        return toDTO(saved);
    }

    public VideoDTO saveDownloadedVideo(String relPath, String title, Long fileSize, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Path videoFile = Paths.get(storagePath, relPath);
        String thumbFileName = relPath.replace("/", "_");
        String thumbnailName = generateThumbnail(videoFile, thumbFileName);

        Video video = Video.builder()
                .title(title)
                .fileName(relPath)
                .thumbnailName(thumbnailName)
                .fileSize(fileSize)
                .contentType("video/mp4")
                .user(user)
                .build();

        Video saved = videoRepository.save(video);
        return toDTO(saved);
    }

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

    public void deleteVideo(Long videoId, Long userId) throws IOException {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found"));
        if (!video.getUser().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        Path path = Paths.get(storagePath, video.getFileName());
        Files.deleteIfExists(path);
        if (video.getThumbnailName() != null) {
            Files.deleteIfExists(Paths.get(storagePath, "thumbnails", video.getThumbnailName()));
        }
        videoRepository.delete(video);
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
