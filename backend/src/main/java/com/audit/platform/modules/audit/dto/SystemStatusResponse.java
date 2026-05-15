package com.audit.platform.modules.audit.dto;

import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class SystemStatusResponse {
    private List<AuditLogResponse> recentLogs;
    private RagStatus ragStatus;
    private Instant lastBackup;
    private java.util.Map<String, Long> userStats;
    private java.util.Map<String, Long> auditStats;

    @Data
    @Builder
    public static class AuditLogResponse {
        private String timestamp;
        private String action;
        private String userEmail;
        private String ipAddress;
    }

    @Data
    @Builder
    public static class RagStatus {
        private boolean online;
        private int chunksIndexed;
    }
}
