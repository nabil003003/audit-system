package com.audit.platform.modules.audit.controller;

import com.audit.platform.modules.audit.domain.AuditStatus;
import com.audit.platform.modules.audit.repository.AuditRepository;
import com.audit.platform.modules.user.domain.UserRole;
import com.audit.platform.modules.user.repository.UserRepository;
import com.audit.platform.modules.audit.domain.AuditLog;
import com.audit.platform.modules.audit.dto.SystemStatusResponse;
import com.audit.platform.modules.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/system")
@RequiredArgsConstructor
public class SystemController {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final AuditRepository auditRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping("/status")
    public SystemStatusResponse getSystemStatus() {
        // 1. Get recent logs
        List<AuditLog> logs = auditLogRepository.findTop10ByOrderByCreatedAtDesc();
        List<SystemStatusResponse.AuditLogResponse> logResponses = logs.stream()
                .map(log -> SystemStatusResponse.AuditLogResponse.builder()
                        .timestamp(log.getCreatedAt() != null ? log.getCreatedAt().toString() : Instant.now().toString())
                        .action(log.getAction())
                        .userEmail(log.getUser() != null ? log.getUser().getEmail() : "system")
                        .ipAddress(log.getIpAddress())
                        .build())
                .collect(Collectors.toList());

        // 2. Get RAG Status from Python API
        SystemStatusResponse.RagStatus ragStatus;
        try {
            Map<String, Object> health = restTemplate.getForObject("http://localhost:8000/health", Map.class);
            int chunks = 0;
            if (health != null && health.get("chunks_indexed") != null) {
                Object val = health.get("chunks_indexed");
                if (val instanceof Number) {
                    chunks = ((Number) val).intValue();
                }
            }
            ragStatus = SystemStatusResponse.RagStatus.builder()
                    .online(true)
                    .chunksIndexed(chunks)
                    .build();
        } catch (Exception e) {
            ragStatus = SystemStatusResponse.RagStatus.builder()
                    .online(false)
                    .chunksIndexed(0)
                    .build();
        }

        // 3. Get Last Backup Time (timestamp of vector_db folder or sqlite file)
        // Adjust path based on actual location. Assuming execution from root of project.
        File dbFile = new File("audit_rag_maroc/vector_db/chroma.sqlite3");
        if (!dbFile.exists()) {
            dbFile = new File("audit_rag_maroc/vector_db");
        }
        Instant lastBackup = dbFile.exists() ? Instant.ofEpochMilli(dbFile.lastModified()) : Instant.now();

        // 4. Calculate Stats
        Map<String, Long> userStats = Map.of(
            "ADMIN", userRepository.countByRole(UserRole.ADMIN),
            "MANAGER", userRepository.countByRole(UserRole.MANAGER),
            "AUDITOR", userRepository.countByRole(UserRole.AUDITOR),
            "CLIENT", userRepository.countByRole(UserRole.CLIENT)
        );

        Map<String, Long> auditStats = Map.of(
            "DRAFT", auditRepository.countByStatus(AuditStatus.DRAFT),
            "PENDING", auditRepository.countByStatus(AuditStatus.PENDING),
            "IN_PROGRESS", auditRepository.countByStatus(AuditStatus.IN_PROGRESS),
            "AWAITING_DOCS", auditRepository.countByStatus(AuditStatus.AWAITING_DOCS),
            "COMPLETED", auditRepository.countByStatus(AuditStatus.COMPLETED),
            "CANCELLED", auditRepository.countByStatus(AuditStatus.CANCELLED)
        );

        return SystemStatusResponse.builder()
                .recentLogs(logResponses)
                .ragStatus(ragStatus)
                .lastBackup(lastBackup)
                .userStats(userStats)
                .auditStats(auditStats)
                .build();
    }
}
