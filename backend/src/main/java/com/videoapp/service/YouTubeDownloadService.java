package com.videoapp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class YouTubeDownloadService {

    @Value("${video.storage.path}")
    private String storagePath;

    public DownloadResult download(String youtubeUrl, Long userId) throws IOException, InterruptedException {
        Path userDir = Paths.get(storagePath, String.valueOf(userId));
        Files.createDirectories(userDir);

        String fileName = UUID.randomUUID() + ".mp4";
        Path outputPath = userDir.resolve(fileName);

        ProcessBuilder pb = new ProcessBuilder(
                "yt-dlp",
                "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format", "mp4",
                "--remote-components", "ejs:github",
                "-o", outputPath.toString(),
                "--no-playlist",
                youtubeUrl
        );
        pb.redirectErrorStream(true);

        Process process = pb.start();
        String title = youtubeUrl;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.info("yt-dlp: {}", line);
                if (line.contains("[download] Destination:") || line.contains("[Merger]")) {
                    // Extract info from output
                }
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("yt-dlp failed with exit code: " + exitCode);
        }

        // Get title using yt-dlp
        ProcessBuilder titlePb = new ProcessBuilder("yt-dlp", "--get-title", "--no-playlist", "--remote-components", "ejs:github", youtubeUrl);
        titlePb.redirectErrorStream(true);
        Process titleProcess = titlePb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(titleProcess.getInputStream()))) {
            String firstLine = reader.readLine();
            if (firstLine != null && !firstLine.isEmpty()) {
                title = firstLine;
            }
        }
        titleProcess.waitFor();

        long fileSize = Files.size(outputPath);
        String relativePath = userId + "/" + fileName;

        return new DownloadResult(relativePath, title, fileSize);
    }

    public record DownloadResult(String filePath, String title, long fileSize) {}
}
