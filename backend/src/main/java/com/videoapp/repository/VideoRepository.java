package com.videoapp.repository;

import com.videoapp.model.Video;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByUserIdOrderByUploadedAtDesc(Long userId);
    List<Video> findByUserIdNotOrderByUploadedAtDesc(Long userId);
    List<Video> findAllByOrderByUploadedAtDesc();

    // Shared-storage / de-duplication support. Multiple Video rows may point at the
    // same physical file (same fileName); the file is only removed when the last
    // reference is deleted.
    Optional<Video> findFirstByFileName(String fileName);
    Optional<Video> findFirstByUserIdAndFileName(Long userId, String fileName);
    List<Video> findByUserIdAndFileName(Long userId, String fileName);
    long countByFileName(String fileName);
}
