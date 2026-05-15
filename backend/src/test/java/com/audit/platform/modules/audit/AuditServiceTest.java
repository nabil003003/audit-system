package com.audit.platform.modules.audit;

import com.audit.platform.modules.audit.domain.Audit;
import com.audit.platform.modules.audit.domain.AuditStatus;
import com.audit.platform.modules.audit.dto.AuditResponse;
import com.audit.platform.modules.audit.dto.CreateAuditRequest;
import com.audit.platform.modules.audit.repository.AuditHistoryRepository;
import com.audit.platform.modules.audit.repository.AuditRepository;
import com.audit.platform.modules.audit.service.AuditService;
import com.audit.platform.modules.notification.service.NotificationService;
import com.audit.platform.modules.user.domain.User;
import com.audit.platform.modules.user.domain.UserRole;
import com.audit.platform.modules.user.repository.UserRepository;
import com.audit.platform.shared.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import com.audit.platform.config.SecurityUserDetails;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import com.audit.platform.modules.audit.dto.AssignAuditRequest;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuditService Unit Tests")
class AuditServiceTest {

    @Mock private AuditRepository auditRepository;
    @Mock private AuditHistoryRepository auditHistoryRepository;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private AuditService auditService;

    private User clientUser;
    private User auditorUser;
    private User managerUser;
    private Audit testAudit;

    @BeforeEach
    void setUp() {
        clientUser = new User();
        clientUser.setId(UUID.randomUUID());
        clientUser.setRole(UserRole.CLIENT);
        clientUser.setFullName("Client Test");

        auditorUser = new User();
        auditorUser.setId(UUID.randomUUID());
        auditorUser.setRole(UserRole.AUDITOR);
        auditorUser.setFullName("Auditeur Test");
        auditorUser.setEmail("auditor@audit.com");

        managerUser = new User();
        managerUser.setId(UUID.randomUUID());
        managerUser.setRole(UserRole.MANAGER);
        managerUser.setEmail("manager@audit.com");
        managerUser.setPasswordHash("encodedPassword");
        managerUser.setStatus(com.audit.platform.modules.user.domain.UserStatus.ACTIVE);

        testAudit = new Audit();
        testAudit.setId(UUID.randomUUID());
        testAudit.setClient(clientUser);
        testAudit.setStatus(AuditStatus.PENDING);
        testAudit.setTitle("Audit Test");
    }

    @Test
    @DisplayName("Création d'audit pour client existant")
    void createAudit_ForValidClient_ReturnsAuditResponse() {
        // Given
        CreateAuditRequest request = new CreateAuditRequest();
        request.setTitle("Audit Financier 2025");
        request.setDescription("Description test");
        request.setClientId(clientUser.getId());

        SecurityUserDetails ud = new SecurityUserDetails(managerUser);
        Authentication auth = new UsernamePasswordAuthenticationToken(ud, null, ud.getAuthorities());
        SecurityContext sc = mock(SecurityContext.class);
        when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);

        when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));
        when(userRepository.findById(clientUser.getId())).thenReturn(Optional.of(clientUser));
        when(userRepository.findByRole(UserRole.MANAGER)).thenReturn(List.of(managerUser));
        when(auditRepository.save(any(Audit.class))).thenAnswer(inv -> {
            Audit a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            return a;
        });

        // When
        AuditResponse response = auditService.create(request);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getTitle()).isEqualTo("Audit Financier 2025");
        verify(auditRepository).save(any(Audit.class));
    }

    @Test
    @DisplayName("Assignation d'un auditeur notifie l'auditeur")
    void assignAudit_NotifiesAuditor() {
        // Given
        testAudit.setStatus(AuditStatus.PENDING);
        SecurityUserDetails ud = new SecurityUserDetails(managerUser);
        Authentication auth = new UsernamePasswordAuthenticationToken(ud, null, ud.getAuthorities());
        SecurityContext sc = mock(SecurityContext.class);
        when(sc.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(sc);
        
        when(userRepository.findById(managerUser.getId())).thenReturn(Optional.of(managerUser));

        when(auditRepository.findById(testAudit.getId())).thenReturn(Optional.of(testAudit));
        when(userRepository.findById(auditorUser.getId())).thenReturn(Optional.of(auditorUser));
        when(auditRepository.save(any(Audit.class))).thenReturn(testAudit);
        when(auditHistoryRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        AssignAuditRequest req = new AssignAuditRequest();
        req.setAuditorId(auditorUser.getId());

        // When
        auditService.assign(testAudit.getId(), req);

        // Then
        verify(notificationService).push(
                eq(auditorUser), any(), anyString(), anyString(), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("Récupération audit inexistant lance ApiException")
    void getAudit_NotFound_ThrowsApiException() {
        UUID randomId = UUID.randomUUID();
        when(auditRepository.findById(randomId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> auditService.getById(randomId))
                .isInstanceOf(ApiException.class);
    }
}
