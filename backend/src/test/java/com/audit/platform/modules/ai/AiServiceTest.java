package com.audit.platform.modules.ai;

import com.audit.platform.modules.ai.domain.AiResult;
import com.audit.platform.modules.ai.domain.RiskLevel;
import com.audit.platform.modules.ai.repository.AiResultRepository;
import com.audit.platform.modules.ai.service.AiService;
import com.audit.platform.modules.audit.domain.Audit;
import com.audit.platform.modules.audit.repository.AuditRepository;
import com.audit.platform.modules.form.domain.AuditForm;
import com.audit.platform.modules.form.repository.AuditFormRepository;
import com.audit.platform.modules.notification.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiService Unit Tests")
class AiServiceTest {

    @Mock private AiResultRepository aiResultRepository;
    @Mock private AuditRepository auditRepository;
    @Mock private AuditFormRepository formRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private AiService aiService;

    @Test
    @DisplayName("getByAuditId retourne le bon résultat")
    void getByAuditId_ReturnsExistingResult() {
        // Given
        UUID auditId = UUID.randomUUID();
        Audit audit = new Audit();
        audit.setId(auditId);

        AiResult result = new AiResult();
        result.setId(UUID.randomUUID());
        result.setAudit(audit);
        result.setRiskLevel(RiskLevel.HIGH);
        result.setRiskScore(75);
        result.setSummary("Résumé test");
        result.setAnomalies("[]");
        result.setRecommendations("Recommandation test");
        result.setModelUsed("mistral-small-latest");
        result.setProcessingTimeMs(1500L);

        when(aiResultRepository.findByAuditId(auditId)).thenReturn(Optional.of(result));

        // When
        var response = aiService.getByAuditId(auditId);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getRiskScore()).isEqualTo(75);
        assertThat(response.getRiskLevel()).isEqualTo(RiskLevel.HIGH);
    }

    @Test
    @DisplayName("getByAuditId lève exception si résultat introuvable")
    void getByAuditId_NotFound_ThrowsApiException() {
        UUID id = UUID.randomUUID();
        when(aiResultRepository.findByAuditId(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> aiService.getByAuditId(id))
                .isInstanceOf(com.audit.platform.shared.exception.ApiException.class);
    }
}
