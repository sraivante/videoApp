package com.videoapp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class YouTubeDownloadService {

    @Value("${video.storage.path}")
    private String storagePath;

    /** Metadata fetched without downloading the media itself. */
    public record Metadata(String videoId, String title) {}

    /**
     * Fetch the canonical video id and title without downloading the video.
     * The id is used as the de-duplication key so the same video is stored once.
     */
    public Metadata probe(String youtubeUrl) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(
                "yt-dlp",
                "--skip-download",
                "--no-playlist",
                "--remote-components", "ejs:github",
                "--print", "%(id)s",
                "--print", "%(title)s",
                youtubeUrl
        );
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);

        Process process = pb.start();
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) lines.add(line.trim());
            }
        }
        int exit = process.waitFor();
        if (exit != 0 || lines.isEmpty()) {
            throw new RuntimeException("Could not read video info (yt-dlp exit " + exit + ")");
        }
        String videoId = lines.get(0);
        String title = lines.size() > 1 ? lines.get(1) : youtubeUrl;
        return new Metadata(videoId, title);
    }

    /** Download the video to the given output path, overwriting any existing file. */
    public void downloadTo(String youtubeUrl, Path outputPath) throws IOException, InterruptedException {
        Files.createDirectories(outputPath.getParent());

        ProcessBuilder pb = new ProcessBuilder(
                "yt-dlp",
                "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format", "mp4",
                "--remote-components", "ejs:github",
                "--force-overwrites",
                "-o", outputPath.toString(),
                "--no-playlist",
                youtubeUrl
        );
        pb.redirectErrorStream(true);

        Process process = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.info("yt-dlp: {}", line);
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new RuntimeException("yt-dlp failed with exit code: " + exitCode);
        }
    }
}
