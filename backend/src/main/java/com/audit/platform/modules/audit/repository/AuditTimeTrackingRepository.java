package com.audit.platform.modules.audit.repository;

import com.audit.platform.modules.audit.domain.AuditTimeTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AuditTimeTrackingRepository extends JpaRepository<AuditTimeTracking, UUID> {

    List<AuditTimeTracking> findByAuditId(UUID auditId);

    @Query("SELECT att FROM AuditTimeTracking att WHERE att.user.id = :userId AND att.audit.id = :auditId AND att.endTime IS NULL")
    List<AuditTimeTracking> findActiveSessions(@Param("userId") UUID userId, @Param("auditId") UUID auditId);

    @Query("SELECT att.audit.id, SUM(att.durationSeconds) FROM AuditTimeTracking att GROUP BY att.audit.id")
    List<Object[]> getTotalTimePerAudit();
    
    @Query("SELECT att.user.fullName, SUM(att.durationSeconds) FROM AuditTimeTracking att WHERE att.audit.id = :auditId GROUP BY att.user.id, att.user.fullName")
    List<Object[]> getTimePerAuditorForAudit(@Param("auditId") UUID auditId);
}
