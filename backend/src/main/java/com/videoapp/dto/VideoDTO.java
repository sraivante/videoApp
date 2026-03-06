package com.videoapp.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VideoDTO {
    private Long id;
    private String title;
    private String description;
    private String fileName;
    private String thumbnailName;
    private Long fileSize;
    private String contentType;
    private Long userId;
    private String userName;
    private LocalDateTime uploadedAt;
}
