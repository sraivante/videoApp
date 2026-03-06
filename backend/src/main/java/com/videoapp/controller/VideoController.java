package com.videoapp.controller;

import com.videoapp.dto.VideoDTO;
import com.videoapp.model.User;
import com.videoapp.service.UserService;
import com.videoapp.service.VideoService;
import com.videoapp.service.YouTubeDownloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;
    private final YouTubeDownloadService youTubeDownloadService;
    private final UserService userService;

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file,
                                    @RequestParam(value = "title", required = false) String title,
                                    @RequestParam(value = "description", required = false) String description,
                                    Authentication auth) {
        try {
            User user = userService.findByEmail(auth.getName());
            VideoDTO video = videoService.uploadVideo(file, title, description, user.getId());
            return ResponseEntity.ok(video);
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    @PostMapping("/download-youtube")
    public ResponseEntity<?> downloadFromYoutube(@RequestBody Map<String, String> request,
                                                  Authentication auth) {
        try {
            String url = request.get("url");
            if (url == null || url.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "URL is required"));
            }
            User user = userService.findByEmail(auth.getName());
            YouTubeDownloadService.DownloadResult result = youTubeDownloadService.download(url, user.getId());
            VideoDTO video = videoService.saveDownloadedVideo(
                    result.filePath(), result.title(), result.fileSize(), user.getId());
            return ResponseEntity.ok(video);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Download failed: " + e.getMessage()));
        }
    }

    @GetMapping("/my")
    public ResponseEntity<List<VideoDTO>> myVideos(Authentication auth) {
        User user = userService.findByEmail(auth.getName());
        return ResponseEntity.ok(videoService.getUserVideos(user.getId()));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<VideoDTO>> suggestions(Authentication auth) {
        User user = userService.findByEmail(auth.getName());
        List<VideoDTO> suggestions = videoService.getSuggestions(user.getId());
        if (suggestions.isEmpty()) {
            suggestions = videoService.getUserVideos(user.getId());
        }
        return ResponseEntity.ok(suggestions);
    }

    @GetMapping("/all")
    public ResponseEntity<List<VideoDTO>> allVideos() {
        return ResponseEntity.ok(videoService.getAllVideos());
    }

    @GetMapping("/thumbnail/{thumbnailName}")
    public ResponseEntity<Resource> getThumbnail(@PathVariable String thumbnailName) {
        try {
            Resource resource = videoService.getThumbnailResource(thumbnailName);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .header(HttpHeaders.CACHE_CONTROL, "max-age=86400")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/stream/{userId}/{fileName}")
    public ResponseEntity<Resource> streamVideo(@PathVariable String userId,
                                                 @PathVariable String fileName) {
        String path = userId + "/" + fileName;
        Resource resource = videoService.getVideoResource(path);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("video/mp4"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication auth) {
        try {
            User user = userService.findByEmail(auth.getName());
            videoService.deleteVideo(id, user.getId());
            return ResponseEntity.ok(Map.of("message", "Video deleted"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
