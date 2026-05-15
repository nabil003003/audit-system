package com.audit.platform.modules.audit.service;

import com.audit.platform.config.SecurityUserDetails;
import com.audit.platform.modules.audit.domain.Audit;
import com.audit.platform.modules.audit.domain.AuditTimeTracking;
import com.audit.platform.modules.audit.repository.AuditRepository;
import com.audit.platform.modules.audit.repository.AuditTimeTrackingRepository;
import com.audit.platform.modules.user.domain.User;
import com.audit.platform.modules.user.repository.UserRepository;
import com.audit.platform.shared.exception.ApiException;
import com.audit.platform.shared.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TimeTrackingService {

    private final AuditTimeTrackingRepository repository;
    private final AuditRepository auditRepository;
    private final UserRepository userRepository;

    @Transactional
    public void startSession(UUID auditId) {
        User user = currentUser();
        // Only track time for AUDITORs
        if (user.getRole() != com.audit.platform.modules.user.domain.UserRole.AUDITOR) {
            return;
        }

        // Close any existing active sessions for this user/audit to avoid duplicates
        List<AuditTimeTracking> activeSessions = repository.findActiveSessions(user.getId(), auditId);
        for (AuditTimeTracking session : activeSessions) {
            stopSession(auditId);
        }

        Audit audit = auditRepository.findById(auditId)
                .orElseThrow(() -> new ApiException(ErrorCode.AUDIT_001, HttpStatus.NOT_FOUND));

        AuditTimeTracking session = AuditTimeTracking.builder()
                .audit(audit)
                .user(user)
                .startTime(Instant.now())
                .lastHeartbeat(Instant.now())
                .build();

        repository.save(session);
    }

    @Transactional
    public void stopSession(UUID auditId) {
        User user = currentUser();
        List<AuditTimeTracking> activeSessions = repository.findActiveSessions(user.getId(), auditId);
        Instant now = Instant.now();

        for (AuditTimeTracking session : activeSessions) {
            session.setEndTime(now);
            session.setLastHeartbeat(now);
            long seconds = Duration.between(session.getStartTime(), now).getSeconds();
            session.setDurationSeconds(Math.max(0, seconds));
            repository.save(session);
        }
    }

    @Transactional
    public void heartbeat(UUID auditId) {
        User user = currentUser();
        List<AuditTimeTracking> activeSessions = repository.findActiveSessions(user.getId(), auditId);
        Instant now = Instant.now();

        if (activeSessions.isEmpty()) {
            startSession(auditId);
            return;
        }

        for (AuditTimeTracking session : activeSessions) {
            session.setLastHeartbeat(now);
            // Optionally update partial duration if needed for real-time charts
            long seconds = Duration.between(session.getStartTime(), now).getSeconds();
            session.setDurationSeconds(Math.max(0, seconds));
            repository.save(session);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getTimeSpentPerAuditor(UUID auditId) {
        List<Object[]> results = repository.getTimePerAuditorForAudit(auditId);
        Map<String, Long> stats = new HashMap<>();
        for (Object[] row : results) {
            stats.put((String) row[0], (Long) row[1]);
        }
        return stats;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllAuditsTimeStats() {
        // This could be enhanced to return more detail
        return auditRepository.findAll().stream().map(audit -> {
            Map<String, Object> map = new HashMap<>();
            map.put("auditId", audit.getId());
            map.put("auditTitle", audit.getTitle());
            List<Object[]> auditorTimes = repository.getTimePerAuditorForAudit(audit.getId());
            long totalSeconds = auditorTimes.stream().mapToLong(row -> (Long) row[1]).sum();
            map.put("totalSeconds", totalSeconds);
            map.put("auditors", auditorTimes.stream().map(row -> Map.of("name", row[0], "seconds", row[1])).collect(Collectors.toList()));
            return map;
        }).collect(Collectors.toList());
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUserDetails)) {
            throw new ApiException(ErrorCode.AUTH_001, HttpStatus.UNAUTHORIZED);
        }
        SecurityUserDetails d = (SecurityUserDetails) auth.getPrincipal();
        return userRepository.findById(d.getId())
                .orElseThrow(() -> new ApiException(ErrorCode.USER_001, HttpStatus.NOT_FOUND));
    }
}
