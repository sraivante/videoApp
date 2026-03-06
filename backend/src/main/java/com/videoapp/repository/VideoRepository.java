package com.videoapp.repository;

import com.videoapp.model.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByUserIdOrderByUploadedAtDesc(Long userId);
    List<Video> findByUserIdNotOrderByUploadedAtDesc(Long userId);
    List<Video> findAllByOrderByUploadedAtDesc();
}
