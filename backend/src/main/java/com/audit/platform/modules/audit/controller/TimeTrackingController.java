package com.audit.platform.modules.audit.controller;

import com.audit.platform.modules.audit.service.TimeTrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/audits/time")
@RequiredArgsConstructor
@Tag(name = "Audit Time Tracking", description = "Track time spent by auditors on dossiers")
public class TimeTrackingController {

    private final TimeTrackingService service;

    @PostMapping("/{auditId}/start")
    @Operation(summary = "Start a time tracking session (Auditor only)")
    public ResponseEntity<Void> start(@PathVariable UUID auditId) {
        service.startSession(auditId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{auditId}/stop")
    @Operation(summary = "Stop a time tracking session (Auditor only)")
    public ResponseEntity<Void> stop(@PathVariable UUID auditId) {
        service.stopSession(auditId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{auditId}/heartbeat")
    @Operation(summary = "Send a heartbeat to keep the session active (Auditor only)")
    public ResponseEntity<Void> heartbeat(@PathVariable UUID auditId) {
        service.heartbeat(auditId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{auditId}/stats")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Get time spent per auditor for a specific audit")
    public ResponseEntity<Map<String, Long>> getAuditStats(@PathVariable UUID auditId) {
        return ResponseEntity.ok(service.getTimeSpentPerAuditor(auditId));
    }

    @GetMapping("/all-stats")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    @Operation(summary = "Get time stats for all audits (Manager/Admin dashboard)")
    public ResponseEntity<List<Map<String, Object>>> getAllStats() {
        return ResponseEntity.ok(service.getAllAuditsTimeStats());
    }
}
