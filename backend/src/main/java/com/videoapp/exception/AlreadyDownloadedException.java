package com.videoapp.exception;

import lombok.Getter;

/**
 * Thrown when a user tries to add a video (upload or YouTube download) that they
 * already have in their library. The controller maps this to HTTP 409 so the
 * frontend can ask whether to delete and re-download.
 */
@Getter
public class AlreadyDownloadedException extends RuntimeException {
    private final String videoId;

    public AlreadyDownloadedException(String message, String videoId) {
        super(message);
        this.videoId = videoId;
    }
}
