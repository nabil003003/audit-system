
package com.audit.platform.config;

import com.audit.platform.modules.audit.domain.Audit;
import com.audit.platform.modules.audit.domain.AuditStatus;
import com.audit.platform.modules.audit.repository.AuditRepository;
import com.audit.platform.modules.user.domain.User;
import com.audit.platform.modules.user.domain.UserRole;
import com.audit.platform.modules.user.domain.UserStatus;
import com.audit.platform.modules.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DashboardDataSeeder {

    private final UserRepository userRepository;
    private final AuditRepository auditRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    public ApplicationRunner seedDashboardData() {
        return args -> {
            if (userRepository.count() > 3) {
                log.info("Dashboard data already seeded.");
                return;
            }

            log.info("🌱 Seeding Dashboard Data...");

            // 1. Create Users
            User admin = getOrCreateUser("admin@audit.ma", "Admin@2024", UserRole.ADMIN, "Directeur Audit");
            User manager = getOrCreateUser("manager@audit.ma", "Manager@2024", UserRole.MANAGER, "Chef de Mission");
            User auditor = getOrCreateUser("auditeur@audit.ma", "Audit@2024", UserRole.AUDITOR, "Auditeur Senior");
            User client = getOrCreateUser("client@entrepise.ma", "Client@2024", UserRole.CLIENT, "Groupe OCP");

            // 2. Create Sample Audits
            if (auditRepository.count() == 0) {
                createAudit("Audit de Conformité Fiscale 2023", client, manager, auditor, AuditStatus.IN_PROGRESS);
                createAudit("Analyse des Risques Cybersécurité", client, manager, auditor, AuditStatus.PENDING);
                createAudit("Audit Légal - Fusion Acquisition", client, manager, null, AuditStatus.AWAITING_DOCS);
                createAudit("Revue des Processus RH", client, null, null, AuditStatus.DRAFT);
                createAudit("Audit de Clôture Annuelle", client, manager, auditor, AuditStatus.COMPLETED);
                
                log.info("✅ 5 Sample Audits created.");
            }

            log.info("🚀 Dashboard data seeding complete!");
        };
    }

    private User getOrCreateUser(String email, String pass, UserRole role, String name) {
        return userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
            User user = User.builder()
                    .email(email)
                    .passwordHash(passwordEncoder.encode(pass))
                    .role(role)
                    .fullName(name)
                    .status(UserStatus.ACTIVE)
                    .firstLogin(false)
                    .build();
            return userRepository.save(user);
        });
    }

    private void createAudit(String title, User client, User manager, User auditor, AuditStatus status) {
        Audit audit = Audit.builder()
                .title(title)
                .description("Analyse approfondie de la conformité pour " + title)
                .client(client)
                .manager(manager)
                .auditor(auditor)
                .status(status)
                .deadline(java.time.LocalDate.now().plusDays(30))
                .build();
        auditRepository.save(audit);
    }
}
